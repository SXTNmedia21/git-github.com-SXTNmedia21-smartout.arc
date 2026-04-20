/**
 * ops-monitor — Periodic operations monitor (every 15 minutes).
 *
 * Sweeps all active department_sessions for operational anomalies:
 * late punch-ins, no-shows, overdue tasks, understaffing, approaching
 * close, and unsigned sessions. Emits ops.monitor.* events and routes
 * critical/active alerts to notification outbox.
 *
 * Auth: WATCHDOG_CRON_SECRET bearer token (cron-only pattern).
 * ADR-0088: AI Operations Intelligence Phase 2 — MONITOR function.
 *
 * Timezone policy (ultrareview rp6ofqyfv bug_014, 2026-04-17):
 *   - `schedule_shift.start_time/end_time` and `department_session.planned_close`
 *     are plain Postgres TIME values; they represent workspace-LOCAL wall-clock.
 *   - `department_session.session_date` is a plain DATE in workspace-LOCAL time.
 *   - Supabase Edge runs on Deno Deploy with TZ=UTC, so `now.toISOString()`
 *     yields UTC. Using UTC strings against workspace-local columns produces
 *     a 1-2h offset in Europe/Oslo (100% of current customers).
 *   - This module resolves `workspace.timezone` per session and computes
 *     workspace-local date + HH:MM strings using Intl.DateTimeFormat. All
 *     time deltas are expressed in minutes-of-day to avoid Date arithmetic
 *     (which would reintroduce the UTC drift).
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Types ────────────────────────────────────────────────────────────

type AlertSeverity = "info" | "warning" | "critical";

type MonitorAlert = {
  rule: string;
  severity: AlertSeverity;
  department_id: string;
  session_id: string;
  workspace_id: string;
  message: string;
  details: Record<string, unknown>;
};

type OpsConfig = {
  late_punchin_threshold_minutes: number;
  noshow_threshold_minutes: number;
  task_overdue_grace_minutes: number;
};

/**
 * Workspace-local clock. Computed once per session sweep to avoid per-rule
 * timezone thrashing. All time comparisons happen against these fields.
 */
type WorkspaceClock = {
  timezone: string; // IANA TZ, e.g. "Europe/Oslo"
  todayLocal: string; // "YYYY-MM-DD" in workspace TZ
  hhmmLocal: string; // "HH:MM" in workspace TZ
  minuteOfDay: number; // 0..1439, derived from hhmmLocal
  nowUtc: Date; // original UTC instant for timestamptz comparisons
};

const DEFAULT_CONFIG: OpsConfig = {
  late_punchin_threshold_minutes: 10,
  noshow_threshold_minutes: 30,
  task_overdue_grace_minutes: 15,
};

const FALLBACK_TIMEZONE = "Europe/Oslo";

// ── Timezone helpers ─────────────────────────────────────────────────

/**
 * Resolve workspace-local "today" (YYYY-MM-DD) and current "HH:MM"
 * using Intl.DateTimeFormat. Avoids any Date-TZ math.
 */
function buildClock(now: Date, timezone: string): WorkspaceClock {
  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const todayLocal = dateFmt.format(now); // en-CA emits "YYYY-MM-DD"
  const hhmmLocal = timeFmt.format(now).slice(0, 5); // "HH:MM"
  const [h, m] = hhmmLocal.split(":").map(Number);

  return {
    timezone,
    todayLocal,
    hhmmLocal,
    minuteOfDay: h * 60 + m,
    nowUtc: now,
  };
}

/**
 * Minute delta between current wall-clock and a TIME value ("HH:MM" or
 * "HH:MM:SS"). Positive when now is after target. Bounded to the same
 * calendar day — caller is responsible for confirming the TIME belongs
 * to clock.todayLocal.
 */
function minutesSinceLocalTime(clock: WorkspaceClock, timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return clock.minuteOfDay - (h * 60 + m);
}

async function resolveTimezone(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
): Promise<string> {
  const { data } = await supabase
    .from("workspace")
    .select("timezone")
    .eq("workspace_id", workspaceId)
    .limit(1)
    .maybeSingle();
  return (data?.timezone as string) ?? FALLBACK_TIMEZONE;
}

/**
 * The outer session scan needs to find "today's sessions" across all
 * workspaces regardless of timezone. A UTC day boundary can lag or lead
 * a workspace-local day by up to ±1 calendar day, so we over-select
 * with a 3-day window (yesterday / today / tomorrow UTC) and the per-
 * session check filters down using workspace-local dates.
 */
function utcDateWindow(now: Date): [string, string, string] {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86_400_000);
  const tomorrow = new Date(now.getTime() + 86_400_000);
  return [iso(yesterday), iso(now), iso(tomorrow)];
}

// ── Config ───────────────────────────────────────────────────────────

async function loadConfig(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
): Promise<OpsConfig> {
  const { data } = await supabase
    .from("policy")
    .select("rules_json")
    .eq("workspace_id", workspaceId)
    .eq("policy_type", "ai_operations")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!data?.rules_json) return DEFAULT_CONFIG;
  const rules = data.rules_json as Record<string, unknown>;

  return {
    late_punchin_threshold_minutes:
      (rules.late_punchin_threshold_minutes as number) ?? DEFAULT_CONFIG.late_punchin_threshold_minutes,
    noshow_threshold_minutes:
      (rules.noshow_threshold_minutes as number) ?? DEFAULT_CONFIG.noshow_threshold_minutes,
    task_overdue_grace_minutes:
      (rules.task_overdue_grace_minutes as number) ?? DEFAULT_CONFIG.task_overdue_grace_minutes,
  };
}

// ── Rule Checks ──────────────────────────────────────────────────────

async function checkLatePunchins(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  departmentId: string,
  sessionId: string,
  config: OpsConfig,
  clock: WorkspaceClock,
): Promise<MonitorAlert[]> {
  const alerts: MonitorAlert[] = [];

  const { data: lateShifts } = await supabase
    .from("schedule_shift")
    .select("schedule_shift_id, employee_id, start_time")
    .eq("workspace_id", workspaceId)
    .eq("department_id", departmentId)
    .eq("shift_date", clock.todayLocal)
    .in("status", ["published", "confirmed"])
    .is("actual_start", null);

  for (const shift of lateShifts ?? []) {
    const elapsedMinutes = minutesSinceLocalTime(clock, shift.start_time as string);
    if (elapsedMinutes < 0) continue;

    if (elapsedMinutes >= config.noshow_threshold_minutes) {
      alerts.push({
        rule: "no_show",
        severity: "critical",
        department_id: departmentId,
        session_id: sessionId,
        workspace_id: workspaceId,
        message: `No-show: employee ${shift.employee_id} — ${elapsedMinutes} min past shift start`,
        details: {
          shift_id: shift.schedule_shift_id,
          employee_id: shift.employee_id,
          start_time: shift.start_time,
          elapsed_minutes: elapsedMinutes,
        },
      });
    } else if (elapsedMinutes >= config.late_punchin_threshold_minutes) {
      alerts.push({
        rule: "late_punchin",
        severity: "warning",
        department_id: departmentId,
        session_id: sessionId,
        workspace_id: workspaceId,
        message: `Late punch-in: employee ${shift.employee_id} — ${elapsedMinutes} min overdue`,
        details: {
          shift_id: shift.schedule_shift_id,
          employee_id: shift.employee_id,
          start_time: shift.start_time,
          elapsed_minutes: elapsedMinutes,
        },
      });
    }
  }

  return alerts;
}

async function checkOverdueTasks(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  sessionId: string,
  departmentId: string,
  config: OpsConfig,
  clock: WorkspaceClock,
): Promise<MonitorAlert[]> {
  const alerts: MonitorAlert[] = [];
  const graceMs = config.task_overdue_grace_minutes * 60 * 1000;

  const { data: tasks } = await supabase
    .from("session_task")
    .select("id, title, priority, status, due_at, is_required, is_compliance_required, assigned_to")
    .eq("workspace_id", workspaceId)
    .eq("department_session_id", sessionId)
    .in("status", ["pending", "in_progress", "available"])
    .not("due_at", "is", null);

  // due_at is timestamptz — comparing as UTC instants is correct regardless of workspace TZ.
  for (const task of tasks ?? []) {
    const dueAt = new Date(task.due_at as string);
    const elapsed = clock.nowUtc.getTime() - dueAt.getTime();
    if (elapsed <= graceMs) continue;

    const isCritical = task.priority === "critical" || task.is_compliance_required;

    alerts.push({
      rule: isCritical ? "critical_task_missed" : "task_overdue",
      severity: isCritical ? "critical" : "warning",
      department_id: departmentId,
      session_id: sessionId,
      workspace_id: workspaceId,
      message: isCritical
        ? `Critical task missed: "${task.title}"`
        : `Task overdue: "${task.title}" — ${Math.round(elapsed / 60000)} min past due`,
      details: {
        task_id: task.id,
        title: task.title,
        due_at: task.due_at,
        priority: task.priority,
        assigned_to: task.assigned_to,
        elapsed_minutes: Math.round(elapsed / 60000),
      },
    });
  }

  return alerts;
}

async function checkUnderstaffing(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  departmentId: string,
  sessionId: string,
  clock: WorkspaceClock,
): Promise<MonitorAlert[]> {
  const alerts: MonitorAlert[] = [];

  const { data: activeShifts } = await supabase
    .from("schedule_shift")
    .select("schedule_shift_id")
    .eq("workspace_id", workspaceId)
    .eq("department_id", departmentId)
    .eq("shift_date", clock.todayLocal)
    .in("status", ["published", "confirmed"])
    .lte("start_time", clock.hhmmLocal)
    .gte("end_time", clock.hhmmLocal);

  const currentCount = activeShifts?.length ?? 0;

  const { data: template } = await supabase
    .from("shift_template")
    .select("min_staff")
    .eq("workspace_id", workspaceId)
    .eq("department_id", departmentId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const minStaff = (template?.min_staff as number) ?? 0;

  if (minStaff > 0 && currentCount < minStaff) {
    alerts.push({
      rule: "understaffing",
      severity: "warning",
      department_id: departmentId,
      session_id: sessionId,
      workspace_id: workspaceId,
      message: `Understaffing: ${currentCount}/${minStaff} staff on shift`,
      details: { current_count: currentCount, min_required: minStaff, deficit: minStaff - currentCount },
    });
  }

  return alerts;
}

async function checkApproachingClose(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  departmentId: string,
  sessionId: string,
  plannedClose: string | null,
  clock: WorkspaceClock,
): Promise<MonitorAlert[]> {
  if (!plannedClose) return [];

  // planned_close is workspace-local TIME; compare minute-of-day deltas.
  const minutesUntilClose = -minutesSinceLocalTime(clock, plannedClose);
  const ONE_HOUR = 60;

  if (minutesUntilClose > ONE_HOUR || minutesUntilClose < 0) return [];

  const { count } = await supabase
    .from("session_task")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("department_session_id", sessionId)
    .in("status", ["pending", "in_progress", "available"]);

  if ((count ?? 0) === 0) return [];

  return [
    {
      rule: "session_approaching_close",
      severity: "warning",
      department_id: departmentId,
      session_id: sessionId,
      workspace_id: workspaceId,
      message: `Session closing in ${minutesUntilClose} min — ${count} tasks incomplete`,
      details: {
        planned_close: plannedClose,
        minutes_until_close: minutesUntilClose,
        incomplete_tasks: count,
      },
    },
  ];
}

async function checkUnsignedSessions(
  workspaceId: string,
  departmentId: string,
  sessionId: string,
  sessionStatus: string,
  plannedClose: string | null,
  clock: WorkspaceClock,
): Promise<MonitorAlert[]> {
  if (sessionStatus !== "pending_signoff" || !plannedClose) return [];

  // planned_close is workspace-local TIME; compute minute-of-day delta.
  const elapsedMinutes = minutesSinceLocalTime(clock, plannedClose);
  const graceMinutes = 30;

  if (elapsedMinutes <= graceMinutes) return [];

  return [
    {
      rule: "unsigned_session",
      severity: "warning",
      department_id: departmentId,
      session_id: sessionId,
      workspace_id: workspaceId,
      message: `Unsigned session — ${elapsedMinutes} min past close, awaiting sign-off`,
      details: {
        planned_close: plannedClose,
        minutes_past_close: elapsedMinutes,
      },
    },
  ];
}

// ── Handler ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization");
  const cronSecret = Deno.env.get("WATCHDOG_CRON_SECRET");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const now = new Date();
    const [yesterdayUtc, todayUtc, tomorrowUtc] = utcDateWindow(now);

    // Over-select sessions using a 3-day UTC window; per-workspace timezone
    // resolution inside the loop filters down to the workspace's local "today".
    const { data: sessions, error: sessionsError } = await supabase
      .from("department_session")
      .select("department_session_id, workspace_id, department_id, status, planned_close, session_date")
      .in("session_date", [yesterdayUtc, todayUtc, tomorrowUtc])
      .in("status", ["active", "pending_signoff"]);

    if (sessionsError) throw sessionsError;
    if (!sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify({ sessions_checked: 0, alerts_emitted: 0, message: "No active sessions" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let totalAlerts = 0;
    let sessionsProcessed = 0;

    // Cache timezone per workspace to avoid duplicate lookups.
    const timezoneCache = new Map<string, string>();

    for (const session of sessions) {
      // Per-session workspace clock — the only reliable way to decide whether
      // this session is in the workspace's current local day.
      let tz = timezoneCache.get(session.workspace_id as string);
      if (!tz) {
        tz = await resolveTimezone(supabase, session.workspace_id as string);
        timezoneCache.set(session.workspace_id as string, tz);
      }
      const clock = buildClock(now, tz);

      // Filter down: only process sessions whose session_date matches the
      // workspace's current local day. The 3-day UTC over-select guarantees
      // we saw this row; the local-date check guarantees relevance.
      if (session.session_date !== clock.todayLocal) continue;

      sessionsProcessed++;

      const config = await loadConfig(supabase, session.workspace_id as string);

      const [latePunchins, overdueTasks, understaffing, approachingClose, unsignedSessions] =
        await Promise.all([
          checkLatePunchins(
            supabase,
            session.workspace_id as string,
            session.department_id as string,
            session.department_session_id as string,
            config,
            clock,
          ),
          checkOverdueTasks(
            supabase,
            session.workspace_id as string,
            session.department_session_id as string,
            session.department_id as string,
            config,
            clock,
          ),
          checkUnderstaffing(
            supabase,
            session.workspace_id as string,
            session.department_id as string,
            session.department_session_id as string,
            clock,
          ),
          checkApproachingClose(
            supabase,
            session.workspace_id as string,
            session.department_id as string,
            session.department_session_id as string,
            session.planned_close as string | null,
            clock,
          ),
          checkUnsignedSessions(
            session.workspace_id as string,
            session.department_id as string,
            session.department_session_id as string,
            session.status as string,
            session.planned_close as string | null,
            clock,
          ),
        ]);

      const allAlerts = [
        ...latePunchins,
        ...overdueTasks,
        ...understaffing,
        ...approachingClose,
        ...unsignedSessions,
      ];

      for (const alert of allAlerts) {
        const { data: recent } = await supabase
          .from("engine_event")
          .select("id")
          .eq("workspace_id", alert.workspace_id)
          .eq("event_type", `ops.monitor.${alert.rule}`)
          .gte("created_at", new Date(now.getTime() - 15 * 60 * 1000).toISOString())
          .limit(1)
          .maybeSingle();

        if (recent) continue;

        await Promise.all([
          supabase.from("engine_event").insert({
            workspace_id: alert.workspace_id,
            event_type: `ops.monitor.${alert.rule}`,
            payload: {
              ...alert.details,
              severity: alert.severity,
              message: alert.message,
              department_id: alert.department_id,
              session_id: alert.session_id,
              origin: "system",
            },
          }),
          (alert.severity === "critical" || alert.severity === "warning")
            ? supabase.from("notification").insert({
                workspace_id: alert.workspace_id,
                title: `[${alert.severity.toUpperCase()}] ${alert.rule.replace(/_/g, " ")}`,
                body: alert.message,
                icon_type: alert.severity === "critical" ? "alert" : "warning",
                priority: alert.severity === "critical" ? "critical" : "normal",
                target_type: "department",
                target_id: alert.department_id,
                metadata: {
                  type: "monitor_alert",
                  rule: alert.rule,
                  session_id: alert.session_id,
                  origin: "system",
                },
              })
            : Promise.resolve(),
        ]);

        totalAlerts++;
      }
    }

    return new Response(
      JSON.stringify({
        sessions_considered: sessions.length,
        sessions_processed: sessionsProcessed,
        alerts_emitted: totalAlerts,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
