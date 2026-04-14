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

const DEFAULT_CONFIG: OpsConfig = {
  late_punchin_threshold_minutes: 10,
  noshow_threshold_minutes: 30,
  task_overdue_grace_minutes: 15,
};

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
  now: Date,
): Promise<MonitorAlert[]> {
  const alerts: MonitorAlert[] = [];
  const today = now.toISOString().slice(0, 10);

  const { data: lateShifts } = await supabase
    .from("schedule_shift")
    .select("schedule_shift_id, employee_id, start_time")
    .eq("workspace_id", workspaceId)
    .eq("department_id", departmentId)
    .eq("shift_date", today)
    .in("status", ["published", "confirmed"])
    .is("actual_start", null);

  for (const shift of lateShifts ?? []) {
    const shiftStart = new Date(`${today}T${shift.start_time}`);
    const elapsed = now.getTime() - shiftStart.getTime();
    if (elapsed < 0) continue;

    const elapsedMinutes = Math.round(elapsed / 60000);

    if (elapsed >= config.noshow_threshold_minutes * 60 * 1000) {
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
    } else if (elapsed >= config.late_punchin_threshold_minutes * 60 * 1000) {
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
  now: Date,
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

  for (const task of tasks ?? []) {
    const dueAt = new Date(task.due_at as string);
    const elapsed = now.getTime() - dueAt.getTime();
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
  now: Date,
): Promise<MonitorAlert[]> {
  const alerts: MonitorAlert[] = [];
  const today = now.toISOString().slice(0, 10);
  const hhmm = now.toISOString().slice(11, 16);

  const { data: activeShifts } = await supabase
    .from("schedule_shift")
    .select("schedule_shift_id")
    .eq("workspace_id", workspaceId)
    .eq("department_id", departmentId)
    .eq("shift_date", today)
    .in("status", ["published", "confirmed"])
    .lte("start_time", hhmm)
    .gte("end_time", hhmm);

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
  now: Date,
): Promise<MonitorAlert[]> {
  if (!plannedClose) return [];

  const today = now.toISOString().slice(0, 10);
  const closeTime = new Date(`${today}T${plannedClose}`);
  const timeUntilClose = closeTime.getTime() - now.getTime();
  const oneHour = 60 * 60 * 1000;

  if (timeUntilClose > oneHour || timeUntilClose < 0) return [];

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
      message: `Session closing in ${Math.round(timeUntilClose / 60000)} min — ${count} tasks incomplete`,
      details: {
        planned_close: plannedClose,
        minutes_until_close: Math.round(timeUntilClose / 60000),
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
  now: Date,
): Promise<MonitorAlert[]> {
  if (sessionStatus !== "pending_signoff" || !plannedClose) return [];

  const today = now.toISOString().slice(0, 10);
  const closeTime = new Date(`${today}T${plannedClose}`);
  const elapsed = now.getTime() - closeTime.getTime();
  const graceMs = 30 * 60 * 1000;

  if (elapsed <= graceMs) return [];

  return [
    {
      rule: "unsigned_session",
      severity: "warning",
      department_id: departmentId,
      session_id: sessionId,
      workspace_id: workspaceId,
      message: `Unsigned session — ${Math.round(elapsed / 60000)} min past close, awaiting sign-off`,
      details: {
        planned_close: plannedClose,
        minutes_past_close: Math.round(elapsed / 60000),
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
    const today = now.toISOString().slice(0, 10);

    const { data: sessions, error: sessionsError } = await supabase
      .from("department_session")
      .select("department_session_id, workspace_id, department_id, status, planned_close")
      .eq("session_date", today)
      .in("status", ["active", "pending_signoff"]);

    if (sessionsError) throw sessionsError;
    if (!sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify({ sessions_checked: 0, alerts_emitted: 0, message: "No active sessions" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let totalAlerts = 0;

    for (const session of sessions) {
      const config = await loadConfig(supabase, session.workspace_id);

      const [latePunchins, overdueTasks, understaffing, approachingClose, unsignedSessions] =
        await Promise.all([
          checkLatePunchins(supabase, session.workspace_id, session.department_id, session.department_session_id, config, now),
          checkOverdueTasks(supabase, session.workspace_id, session.department_session_id, session.department_id, config, now),
          checkUnderstaffing(supabase, session.workspace_id, session.department_id, session.department_session_id, now),
          checkApproachingClose(supabase, session.workspace_id, session.department_id, session.department_session_id, session.planned_close, now),
          checkUnsignedSessions(session.workspace_id, session.department_id, session.department_session_id, session.status, session.planned_close, now),
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
        sessions_checked: sessions.length,
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
