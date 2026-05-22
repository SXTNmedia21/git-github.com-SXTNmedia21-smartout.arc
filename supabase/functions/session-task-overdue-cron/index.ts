/**
 * session-task-overdue-cron — Periodic cron that transitions
 * `session_task` rows from pending/available/in_progress → overdue
 * when `due_at` is non-null and has passed, and notifies the assignee
 * + department managers via `notification_outbox`.
 *
 * Architecture (ADR-0187 single-emit-source invariant):
 *   1. This function performs the UPDATE on `session_task.status`.
 *   2. After each successful update it inserts into `notification_outbox`
 *      for the assignee (if any) and each workspace+department manager.
 *   3. The structured logger emits one JSON line per affected task
 *      (registry destination #2).
 *   4. `activity_trail` inserts carry the "session_task.overdue" event key
 *      (registry destination #3). engine_event (destination #4) is reserved
 *      for the downstream Event Engine subscriber — this function does NOT
 *      insert engine_event directly.
 *
 * Auth: internal cron only. `verify_jwt = false` in config.toml.
 * Bearer: WATCHDOG_CRON_SECRET (same pattern as session-watchdog-demoter,
 * journey-stuck-detector, watchdog-integrity, fire-delayed-triggers).
 *
 * Grace period: TASK_OVERDUE_GRACE_MINUTES (env, default 0 — no grace).
 * Batch cap: QUERY_LIMIT (env, default 200) — keeps a single cron run bounded.
 *
 * Idempotence: the UPDATE filters status IN ('pending','available','in_progress')
 * so a second pass will find no rows. Notification deduplication is NOT enforced
 * here — callers must rely on the notification_outbox idempotency layer.
 *
 * See:
 *   - ADR-0187 (single-emit source for session state transitions)
 *   - ADR-0298 Sortie 3 (task capability, "session_task.overdue" registry event)
 *   - Migration 20260622110000_session_task_overdue_cron.sql
 *   - session-watchdog-demoter (sibling pattern)
 *   - shift-lateness-check (notification_outbox + manager-resolution pattern)
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

// Seeded in 20260422215500_system_actor_profile_seed.sql.
const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000001";

const DEFAULT_GRACE_MINUTES = 0;
const DEFAULT_QUERY_LIMIT = 200;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface OverdueTaskRow {
  id: string;
  workspace_id: string;
  department_session_id: string;
  department_id: string | null;
  title: string;
  assigned_to: string | null;
  due_at: string;
  is_compliance_required: boolean;
}

interface OverdueResult {
  task_id: string;
  workspace_id: string;
  ok: boolean;
  error?: string;
}

// ─────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: WATCHDOG_CRON_SECRET bearer (internal cron).
  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Grace period — env-configurable, default 0 min (immediately past due_at).
  const graceMinRaw = Deno.env.get("TASK_OVERDUE_GRACE_MINUTES");
  const graceMinParsed = graceMinRaw != null ? Number(graceMinRaw) : NaN;
  const graceMin =
    Number.isFinite(graceMinParsed) && graceMinParsed >= 0
      ? graceMinParsed
      : DEFAULT_GRACE_MINUTES;

  // Query batch cap.
  const limitRaw = Deno.env.get("QUERY_LIMIT");
  const limitParsed = limitRaw != null ? Number(limitRaw) : NaN;
  const queryLimit =
    Number.isFinite(limitParsed) && limitParsed > 0 ? limitParsed : DEFAULT_QUERY_LIMIT;

  const now = new Date();
  const cutoff = new Date(now.getTime() - graceMin * 60 * 1000).toISOString();

  try {
    // ─── 1. Query session_task rows that are past due ───────────────────────────
    // Join department_session to get department_id for manager resolution.
    const { data: overdue, error: queryErr } = await supabase
      .from("session_task")
      .select(
        [
          "id",
          "workspace_id",
          "department_session_id",
          "title",
          "assigned_to",
          "due_at",
          "is_compliance_required",
          // Resolve department_id via session join for manager query.
          "department_session!inner(department_id)",
        ].join(", "),
      )
      .in("status", ["pending", "available", "in_progress"])
      .not("due_at", "is", null)
      .lt("due_at", cutoff)
      .order("due_at", { ascending: true })
      .limit(queryLimit);

    if (queryErr) {
      console.log(
        JSON.stringify({
          level: "error",
          action: "session_task_overdue_cron",
          category: "operations",
          error: queryErr.message,
        }),
      );
      return new Response(JSON.stringify({ error: queryErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Flatten the join result — Supabase returns nested object for joined table.
    const rows: OverdueTaskRow[] = (overdue ?? []).map((r) => {
      // deno-lint-ignore no-explicit-any
      const session = (r as any)["department_session"];
      return {
        id: r.id,
        workspace_id: r.workspace_id,
        department_session_id: r.department_session_id,
        department_id: (session as { department_id?: string })?.department_id ?? null,
        title: r.title,
        assigned_to: r.assigned_to ?? null,
        due_at: r.due_at,
        is_compliance_required: r.is_compliance_required ?? false,
      };
    });

    if (rows.length === 0) {
      console.log(
        JSON.stringify({
          level: "info",
          action: "session_task_overdue_cron",
          category: "operations",
          message: "no_overdue_tasks",
          grace_minutes: graceMin,
        }),
      );
      return new Response(
        JSON.stringify({ ok: true, overdue_count: 0, ids: [], grace_minutes: graceMin }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: OverdueResult[] = [];

    for (const row of rows) {
      const elapsedMs = now.getTime() - new Date(row.due_at).getTime();
      const elapsedMinutes = Math.round(elapsedMs / 60_000);

      // ─── 2. UPDATE session_task.status → 'overdue' ───────────────────────────
      // Re-check status in the WHERE clause to guard against concurrent writers.
      const { error: updateErr } = await supabase
        .from("session_task")
        .update({ status: "overdue" as "overdue", updated_at: now.toISOString() })
        .eq("id", row.id)
        .in("status", ["pending", "available", "in_progress"]);

      if (updateErr) {
        results.push({ task_id: row.id, workspace_id: row.workspace_id, ok: false, error: updateErr.message });
        console.log(
          JSON.stringify({
            level: "error",
            action: "session_task_overdue_cron",
            category: "operations",
            task_id: row.id,
            workspace_id: row.workspace_id,
            error: updateErr.message,
          }),
        );
        continue;
      }

      results.push({ task_id: row.id, workspace_id: row.workspace_id, ok: true });

      // ─── 3. activity_trail fan-out (registry destination #3) ─────────────────
      const { error: activityErr } = await supabase.from("activity_trail").insert({
        event: "session_task.overdue",
        action_verb: "expired",
        category: "operations",
        entity_type: "session_task",
        entity_id: row.id,
        entity_label: row.title,
        actor_id: SYSTEM_ACTOR_ID,
        workspace_id: row.workspace_id,
        data: {
          task_id: row.id,
          department_session_id: row.department_session_id,
          department_id: row.department_id,
          workspace_id: row.workspace_id,
          assigned_to: row.assigned_to,
          due_at: row.due_at,
          elapsed_minutes: elapsedMinutes,
          is_compliance_required: row.is_compliance_required,
          grace_minutes: graceMin,
          automated: true,
          system: true,
        },
        source: "edge-function",
      });

      if (activityErr) {
        console.log(
          JSON.stringify({
            level: "warn",
            action: "session_task_overdue_cron",
            category: "operations",
            task_id: row.id,
            activity_trail_error: activityErr.message,
          }),
        );
      }

      // ─── 4. Notify assignee (if set) via notification_outbox ─────────────────
      if (row.assigned_to) {
        const { error: assigneeNotifErr } = await supabase.from("notification_outbox").insert({
          workspace_id: row.workspace_id,
          recipient_id: row.assigned_to,
          mode: "work",
          priority: row.is_compliance_required ? 2 : 1,
          title: row.is_compliance_required ? "Kritisk oppgave forfalt" : "Oppgave forfalt",
          body: row.title,
          action_url: `/dashboard/session/${row.department_session_id}`,
          metadata: {
            event_key: "session_task.overdue",
            task_id: row.id,
            due_at: row.due_at,
            elapsed_minutes: elapsedMinutes,
            is_compliance_required: row.is_compliance_required,
          },
          allowed_channels: ["push", "email"],
        });

        if (assigneeNotifErr) {
          console.log(
            JSON.stringify({
              level: "warn",
              action: "session_task_overdue_cron",
              category: "operations",
              task_id: row.id,
              recipient: "assignee",
              notification_error: assigneeNotifErr.message,
            }),
          );
        }
      }

      // ─── 5. Notify workspace+department managers ──────────────────────────────
      // Pattern from shift-lateness-check: query profile by workspace_id +
      // department_id + role IN ['manager','admin','owner'] + is_active=true.
      const managerQuery = supabase
        .from("profile")
        .select("profile_id")
        .eq("workspace_id", row.workspace_id)
        .in("role", ["manager", "admin", "owner"])
        .eq("is_active", true);

      // Scope to department when available (avoids notifying managers of unrelated
      // departments). Falls back to workspace-wide when department_id is null.
      if (row.department_id) {
        managerQuery.eq("department_id", row.department_id);
      }

      const { data: managers } = await managerQuery;

      const priority = row.is_compliance_required ? 2 : 1;
      const title = row.is_compliance_required ? "Kritisk oppgave forfalt" : "Oppgave i vakten er forfalt";
      const body = `${row.title} (${elapsedMinutes} min forsinket)`;

      for (const mgr of managers ?? []) {
        // Skip if manager is also the assignee — they already received the assignee notification.
        if (mgr.profile_id === row.assigned_to) continue;

        const { error: mgrNotifErr } = await supabase.from("notification_outbox").insert({
          workspace_id: row.workspace_id,
          recipient_id: mgr.profile_id,
          mode: "work",
          priority,
          title,
          body,
          action_url: `/dashboard/session/${row.department_session_id}`,
          metadata: {
            event_key: "session_task.overdue",
            task_id: row.id,
            due_at: row.due_at,
            elapsed_minutes: elapsedMinutes,
            is_compliance_required: row.is_compliance_required,
            assigned_to: row.assigned_to,
          },
          allowed_channels: ["push", "email"],
        });

        if (mgrNotifErr) {
          console.log(
            JSON.stringify({
              level: "warn",
              action: "session_task_overdue_cron",
              category: "operations",
              task_id: row.id,
              recipient: mgr.profile_id,
              notification_error: mgrNotifErr.message,
            }),
          );
        }
      }

      // ─── 6. Structured logger destination (registry destination #2) ───────────
      console.log(
        JSON.stringify({
          level: "info",
          action: "session_task_overdue_cron",
          category: "operations",
          event: "session_task.overdue",
          task_id: row.id,
          workspace_id: row.workspace_id,
          department_session_id: row.department_session_id,
          department_id: row.department_id,
          assigned_to: row.assigned_to,
          due_at: row.due_at,
          elapsed_minutes: elapsedMinutes,
          is_compliance_required: row.is_compliance_required,
          activity_trail_ok: activityErr == null,
        }),
      );
    }

    const successIds = results.filter((r) => r.ok).map((r) => r.task_id);
    const failureCount = results.length - successIds.length;

    console.log(
      JSON.stringify({
        level: failureCount > 0 ? "warn" : "info",
        action: "session_task_overdue_cron",
        category: "operations",
        message: "batch_complete",
        overdue_count: successIds.length,
        failure_count: failureCount,
        grace_minutes: graceMin,
      }),
    );

    return new Response(
      JSON.stringify({
        ok: true,
        overdue_count: successIds.length,
        failure_count: failureCount,
        ids: successIds,
        grace_minutes: graceMin,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.log(
      JSON.stringify({
        level: "error",
        action: "session_task_overdue_cron",
        category: "operations",
        error: String(err),
      }),
    );
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
