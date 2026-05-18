// ══════════════════════════════════════════════════════════════════
// ADR-0367 §5.7 — day_line_push tick handler
// ══════════════════════════════════════════════════════════════════
//
// Runs on every engine-dispatch invocation (1-minute pg_cron tick).
// Selects session_task rows with scheduled_at in [now-60s, now+60s)
// where day_line_id IS NOT NULL and status = 'pending', then fans out
// push notifications to every employee clocked into the area.
//
// Fan-out path:
//   session_task.day_line_id
//     → shift_session_day_line (junction)
//     → shift_session (status = 'clocked_in')
//     → profile.expo_push_token (null = skip)
//
// Idempotency (ADR-0367 §5.7):
//   Before each send, INSERT engine_event with:
//     event_type = 'day_line_item.notified'
//     idempotency_key = '<session_task.id>:<shift_session_id>'
//   The UNIQUE index on engine_event.idempotency_key
//   (supabase/migrations/20260304100000_engine_process_tables.sql:122)
//   guarantees no double-send. On 23505 unique_violation: skip quietly.
//
// Emit contract (day_line_item.notified):
//   actor_id  = 'system:engine-dispatch'
//   entity_id = '<task_id>:<shift_session_id>'  (= idempotency_key)
//   workspace_id = session_task.workspace_id
//   data: { item_id, shift_session_id, employee_id, day_line_id }
//
// Expo Push:
//   EXPO_ACCESS_TOKEN env var (optional — Expo public access does not
//   require an access token for small volumes; keep it optional here so
//   the handler works without the secret in dev). Auth header is added
//   only when the env var is present.
//
// Refs: ADR-0367, packages/telemetry/src/registry.ts DayLineItemNotified
// ══════════════════════════════════════════════════════════════════

import type { createClient } from "jsr:@supabase/supabase-js@2";

// ─── Types ───────────────────────────────────────────────────────

export interface DayLinePushCtx {
  sb: ReturnType<typeof createClient>;
  emit: (event: {
    event: string;
    actor_id: string | null;
    workspace_id: string | null;
    properties: Record<string, unknown>;
  }) => Promise<void>;
}

type PendingTask = {
  id: string;
  day_line_id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  department_session_id: string;
};

type ClockInRecord = {
  shift_session_id: string;
  employee_id: string;
  workspace_id: string;
};

type ProfileToken = {
  profile_id: string;
  expo_push_token: string | null;
};

// ─── Idempotency key ─────────────────────────────────────────────

function makeIdempotencyKey(taskId: string, shiftSessionId: string): string {
  return `${taskId}:${shiftSessionId}`;
}

// ─── Expo push send ──────────────────────────────────────────────

async function sendExpoPush(params: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<{ ok: boolean; error?: string }> {
  const message = {
    to: params.token,
    title: params.title,
    body: params.body,
    sound: "default",
    priority: "normal",
    channelId: "default",
    data: params.data ?? {},
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  if (expoAccessToken) {
    headers["Authorization"] = `Bearer ${expoAccessToken}`;
  }

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers,
      body: JSON.stringify(message),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return { ok: false, error: `Expo ${res.status}: ${errBody}` };
    }
    const expoData = await res.json();
    const ticket = expoData?.data;
    if (ticket?.status === "error") {
      return {
        ok: false,
        error: `ticket error: ${ticket.message ?? "unknown"} (${ticket.details?.error ?? ""})`,
      };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Idempotency INSERT + check ──────────────────────────────────
// Attempts to INSERT the engine_event row. Returns:
//   'inserted'  — row created, proceed with push
//   'duplicate' — unique_violation (23505), already sent — skip
//   'error'     — unexpected DB error

type IdempotencyOutcome = "inserted" | "duplicate" | "error";

async function tryInsertIdempotencyEvent(
  sb: ReturnType<typeof createClient>,
  workspaceId: string,
  idempotencyKey: string,
): Promise<IdempotencyOutcome> {
  const { error } = await sb.from("engine_event").insert({
    event_type: "day_line_item.notified",
    workspace_id: workspaceId,
    idempotency_key: idempotencyKey,
    payload: {},
  });

  if (!error) return "inserted";

  // Postgres unique_violation — already processed. Safe skip per ADR-0367 §5.7.
  if (error.code === "23505") return "duplicate";

  console.error(
    `[day_line_push] engine_event insert failed (key=${idempotencyKey}):`,
    error.message,
  );
  return "error";
}

// ─── Main tick handler ───────────────────────────────────────────

/**
 * dispatchDayLinePush — called on every engine-dispatch tick.
 *
 * Scans session_task rows with scheduled_at in the ±60s window that
 * have a day_line_id, then fans out push notifications to all employees
 * clocked into the corresponding area. Idempotency via engine_event
 * UNIQUE(idempotency_key). Returns a summary for logging.
 */
export async function dispatchDayLinePush(ctx: DayLinePushCtx): Promise<{
  scanned: number;
  sent: number;
  skipped_no_token: number;
  skipped_idempotent: number;
  skipped_not_clocked_in: number;
  errors: number;
}> {
  const { sb, emit } = ctx;
  const nowMs = Date.now();
  const windowStart = new Date(nowMs - 60_000).toISOString();
  const windowEnd = new Date(nowMs + 60_000).toISOString();

  // 1. Select pending tasks in the scheduled_at window with a day_line_id.
  const { data: tasks, error: taskErr } = await sb
    .from("session_task")
    .select("id, day_line_id, workspace_id, title, description, department_session_id")
    .eq("status", "pending")
    .not("day_line_id", "is", null)
    .gte("scheduled_at", windowStart)
    .lt("scheduled_at", windowEnd);

  if (taskErr) {
    console.error("[day_line_push] session_task query failed:", taskErr.message);
    return {
      scanned: 0,
      sent: 0,
      skipped_no_token: 0,
      skipped_idempotent: 0,
      skipped_not_clocked_in: 0,
      errors: 1,
    };
  }

  const pendingTasks = (tasks ?? []) as PendingTask[];
  let sent = 0;
  let skippedNoToken = 0;
  let skippedIdempotent = 0;
  let skippedNotClockedIn = 0;
  let errors = 0;

  for (const task of pendingTasks) {
    const dayLineId = task.day_line_id;

    // 2. Find clocked-in shift_session rows linked to this day_line via the
    //    shift_session_day_line junction. We join in two steps so the types
    //    remain explicit and we can handle missing join rows cleanly.
    const { data: junctionRows, error: junctionErr } = await sb
      .from("shift_session_day_line")
      .select("shift_session_id")
      .eq("day_line_id", dayLineId);

    if (junctionErr) {
      console.error(
        `[day_line_push] shift_session_day_line query failed for day_line ${dayLineId}:`,
        junctionErr.message,
      );
      errors++;
      continue;
    }

    if (!junctionRows || junctionRows.length === 0) {
      // No shift_sessions bound to this area — nothing to notify.
      skippedNotClockedIn++;
      continue;
    }

    const shiftSessionIds = (junctionRows as { shift_session_id: string }[]).map(
      (r) => r.shift_session_id,
    );

    // 3. Filter to those that are currently clocked in.
    const { data: clockedIn, error: sessionErr } = await sb
      .from("shift_session")
      .select("shift_session_id, employee_id, workspace_id")
      .in("shift_session_id", shiftSessionIds)
      .eq("status", "clocked_in");

    if (sessionErr) {
      console.error(
        `[day_line_push] shift_session query failed for task ${task.id}:`,
        sessionErr.message,
      );
      errors++;
      continue;
    }

    const clockedInRows = (clockedIn ?? []) as ClockInRecord[];
    if (clockedInRows.length === 0) {
      skippedNotClockedIn++;
      continue;
    }

    // 4. Fan out: one push per clocked-in employee.
    for (const session of clockedInRows) {
      const idempotencyKey = makeIdempotencyKey(task.id, session.shift_session_id);

      // 5. Idempotency gate — INSERT engine_event first. On duplicate, skip.
      const idempotencyOutcome = await tryInsertIdempotencyEvent(
        sb,
        task.workspace_id,
        idempotencyKey,
      );

      if (idempotencyOutcome === "duplicate") {
        skippedIdempotent++;
        continue;
      }
      if (idempotencyOutcome === "error") {
        errors++;
        continue;
      }

      // 6. Resolve expo_push_token for the employee.
      const { data: profileRow, error: profileErr } = await sb
        .from("profile")
        .select("profile_id, expo_push_token")
        .eq("profile_id", session.employee_id)
        .maybeSingle();

      if (profileErr) {
        console.error(
          `[day_line_push] profile query failed for employee ${session.employee_id}:`,
          profileErr.message,
        );
        errors++;
        continue;
      }

      const profile = profileRow as ProfileToken | null;
      if (!profile?.expo_push_token) {
        skippedNoToken++;
        continue;
      }

      // 7. Send the Expo push notification.
      const pushResult = await sendExpoPush({
        token: profile.expo_push_token,
        title: task.title,
        body: task.description ?? task.title,
        data: {
          task_id: task.id,
          day_line_id: dayLineId,
          shift_session_id: session.shift_session_id,
        },
      });

      if (!pushResult.ok) {
        console.error(
          `[day_line_push] push failed for ${profile.expo_push_token}:`,
          pushResult.error,
        );
        errors++;
        continue;
      }

      // 8. Emit day_line_item.notified telemetry per ADR-0367 §5.7.
      await emit({
        event: "day_line_item.notified",
        actor_id: "system:engine-dispatch",
        workspace_id: task.workspace_id,
        properties: {
          entity: {
            entity_type: "session_task",
            entity_id: idempotencyKey,
          },
          data: {
            item_id: task.id,
            shift_session_id: session.shift_session_id,
            employee_id: session.employee_id,
            day_line_id: dayLineId,
          },
        },
      });

      sent++;
    }
  }

  return {
    scanned: pendingTasks.length,
    sent,
    skipped_no_token: skippedNoToken,
    skipped_idempotent: skippedIdempotent,
    skipped_not_clocked_in: skippedNotClockedIn,
    errors,
  };
}
