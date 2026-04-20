// ============================================
// operations-evaluator.ts
// MONITOR function — evaluates active department sessions for
// operational anomalies: late punch-ins, no-shows, overdue tasks,
// understaffing, unsigned sessions, and approaching close.
// NOT an extension of guardian-evaluator.ts (different domain entirely).
// Connected to: supabase.ts (data access)
// Connected to: guardian-bus.ts (event emission for WebSocket clients)
// ADR-0088: AI Operations Intelligence Phase 2.
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import { emitGuardianEvent } from "./guardian-bus.js";

// ── Types ────────────────────────────────────────────────────────────

type MonitorDomain = "operations" | "haccp";

type AlertSeverity = "info" | "warning" | "critical";

type MonitorAlert = {
  rule: string;
  domain: MonitorDomain;
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
  day_brief_offset_minutes: number;
  shift_brief_enabled: boolean;
  mid_session_digest_enabled: boolean;
};

const DEFAULT_CONFIG: OpsConfig = {
  late_punchin_threshold_minutes: 10,
  noshow_threshold_minutes: 30,
  task_overdue_grace_minutes: 15,
  day_brief_offset_minutes: 30,
  shift_brief_enabled: true,
  mid_session_digest_enabled: false,
};

// ── Config Loading ───────────────────────────────────────────────────

async function loadOpsConfig(workspaceId: string): Promise<OpsConfig> {
  const { data } = await supabaseAdmin
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
      (rules.late_punchin_threshold_minutes as number) ??
      DEFAULT_CONFIG.late_punchin_threshold_minutes,
    noshow_threshold_minutes:
      (rules.noshow_threshold_minutes as number) ?? DEFAULT_CONFIG.noshow_threshold_minutes,
    task_overdue_grace_minutes:
      (rules.task_overdue_grace_minutes as number) ?? DEFAULT_CONFIG.task_overdue_grace_minutes,
    day_brief_offset_minutes:
      (rules.day_brief_offset_minutes as number) ?? DEFAULT_CONFIG.day_brief_offset_minutes,
    shift_brief_enabled:
      (rules.shift_brief_enabled as boolean) ?? DEFAULT_CONFIG.shift_brief_enabled,
    mid_session_digest_enabled:
      (rules.mid_session_digest_enabled as boolean) ?? DEFAULT_CONFIG.mid_session_digest_enabled,
  };
}

// ── Rule Checks ──────────────────────────────────────────────────────

async function checkLatePunchins(
  workspaceId: string,
  departmentId: string,
  sessionId: string,
  config: OpsConfig,
  now: Date,
): Promise<MonitorAlert[]> {
  const alerts: MonitorAlert[] = [];
  const thresholdMs = config.late_punchin_threshold_minutes * 60 * 1000;
  const today = now.toISOString().slice(0, 10);

  const { data: lateShifts } = await supabaseAdmin
    .from("schedule_shift")
    .select(
      "schedule_shift_id, employee_id, start_time, profile:employee_id(first_name, last_name)",
    )
    .eq("workspace_id", workspaceId)
    .eq("department_id", departmentId)
    .eq("shift_date", today)
    .in("status", ["published", "confirmed"])
    .is("actual_start", null);

  for (const shift of lateShifts ?? []) {
    const shiftStart = new Date(`${today}T${shift.start_time}`);
    const elapsed = now.getTime() - shiftStart.getTime();

    if (elapsed < 0) continue;

    const elapsedMinutes = elapsed / (60 * 1000);
    const profileArr = shift.profile as { first_name: string; last_name: string }[] | null;
    const profileEntry = Array.isArray(profileArr) ? profileArr[0] : null;
    const profileName = profileEntry
      ? `${profileEntry.first_name} ${profileEntry.last_name}`
      : shift.employee_id;

    if (elapsed >= config.noshow_threshold_minutes * 60 * 1000) {
      alerts.push({
        rule: "no_show",
        domain: "operations",
        severity: "critical",
        department_id: departmentId,
        session_id: sessionId,
        workspace_id: workspaceId,
        message: `No-show: ${profileName} — ${Math.round(elapsedMinutes)} min past shift start`,
        details: {
          shift_id: shift.schedule_shift_id,
          employee_id: shift.employee_id,
          start_time: shift.start_time,
          elapsed_minutes: Math.round(elapsedMinutes),
        },
      });
    } else if (elapsed >= thresholdMs) {
      alerts.push({
        rule: "late_punchin",
        domain: "operations",
        severity: "warning",
        department_id: departmentId,
        session_id: sessionId,
        workspace_id: workspaceId,
        message: `Late punch-in: ${profileName} — ${Math.round(elapsedMinutes)} min overdue`,
        details: {
          shift_id: shift.schedule_shift_id,
          employee_id: shift.employee_id,
          start_time: shift.start_time,
          elapsed_minutes: Math.round(elapsedMinutes),
        },
      });
    }
  }

  return alerts;
}

async function checkOverdueTasks(
  workspaceId: string,
  sessionId: string,
  departmentId: string,
  config: OpsConfig,
  now: Date,
): Promise<MonitorAlert[]> {
  const alerts: MonitorAlert[] = [];
  const graceMs = config.task_overdue_grace_minutes * 60 * 1000;

  const { data: tasks } = await supabaseAdmin
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
      domain: "operations",
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
  workspaceId: string,
  departmentId: string,
  sessionId: string,
  now: Date,
): Promise<MonitorAlert[]> {
  const alerts: MonitorAlert[] = [];
  const today = now.toISOString().slice(0, 10);
  const currentTime = now.toISOString();

  const { data: activeShifts } = await supabaseAdmin
    .from("schedule_shift")
    .select("schedule_shift_id")
    .eq("workspace_id", workspaceId)
    .eq("department_id", departmentId)
    .eq("shift_date", today)
    .in("status", ["published", "confirmed"])
    .lte("start_time", currentTime.slice(11, 16))
    .gte("end_time", currentTime.slice(11, 16));

  const currentCount = activeShifts?.length ?? 0;

  const { data: template } = await supabaseAdmin
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
      domain: "operations",
      severity: "warning",
      department_id: departmentId,
      session_id: sessionId,
      workspace_id: workspaceId,
      message: `Understaffing: ${currentCount}/${minStaff} staff on shift`,
      details: {
        current_count: currentCount,
        min_required: minStaff,
        deficit: minStaff - currentCount,
      },
    });
  }

  return alerts;
}

async function checkApproachingClose(
  workspaceId: string,
  departmentId: string,
  sessionId: string,
  plannedClose: string | null,
  now: Date,
): Promise<MonitorAlert[]> {
  const alerts: MonitorAlert[] = [];

  if (!plannedClose) return alerts;

  const today = now.toISOString().slice(0, 10);
  const closeTime = new Date(`${today}T${plannedClose}`);
  const timeUntilClose = closeTime.getTime() - now.getTime();
  const oneHour = 60 * 60 * 1000;

  if (timeUntilClose > oneHour || timeUntilClose < 0) return alerts;

  const { count } = await supabaseAdmin
    .from("session_task")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("department_session_id", sessionId)
    .in("status", ["pending", "in_progress", "available"]);

  const incompleteTasks = count ?? 0;

  if (incompleteTasks > 0) {
    alerts.push({
      rule: "session_approaching_close",
      domain: "operations",
      severity: "warning",
      department_id: departmentId,
      session_id: sessionId,
      workspace_id: workspaceId,
      message: `Session closing in ${Math.round(timeUntilClose / 60000)} min — ${incompleteTasks} tasks incomplete`,
      details: {
        planned_close: plannedClose,
        minutes_until_close: Math.round(timeUntilClose / 60000),
        incomplete_tasks: incompleteTasks,
      },
    });
  }

  return alerts;
}

async function checkUnsignedSessions(
  workspaceId: string,
  departmentId: string,
  sessionId: string,
  sessionStatus: string,
  plannedClose: string | null,
  now: Date,
): Promise<MonitorAlert[]> {
  const alerts: MonitorAlert[] = [];

  if (sessionStatus !== "pending_signoff" || !plannedClose) return alerts;

  const today = now.toISOString().slice(0, 10);
  const closeTime = new Date(`${today}T${plannedClose}`);
  const elapsed = now.getTime() - closeTime.getTime();
  const graceMinutes = 30;

  if (elapsed > graceMinutes * 60 * 1000) {
    alerts.push({
      rule: "unsigned_session",
      domain: "operations",
      severity: "warning",
      department_id: departmentId,
      session_id: sessionId,
      workspace_id: workspaceId,
      message: `Unsigned session — ${Math.round(elapsed / 60000)} min past close, awaiting sign-off`,
      details: {
        planned_close: plannedClose,
        minutes_past_close: Math.round(elapsed / 60000),
      },
    });
  }

  return alerts;
}

// ── Public API ───────────────────────────────────────────────────────

export async function evaluateSession(
  workspaceId: string,
  departmentId: string,
  sessionId: string,
  sessionStatus: string,
  plannedClose: string | null,
): Promise<MonitorAlert[]> {
  const now = new Date();
  const config = await loadOpsConfig(workspaceId);

  const [latePunchins, overdueTasks, understaffing, approachingClose, unsignedSessions] =
    await Promise.all([
      checkLatePunchins(workspaceId, departmentId, sessionId, config, now),
      checkOverdueTasks(workspaceId, sessionId, departmentId, config, now),
      checkUnderstaffing(workspaceId, departmentId, sessionId, now),
      checkApproachingClose(workspaceId, departmentId, sessionId, plannedClose, now),
      checkUnsignedSessions(workspaceId, departmentId, sessionId, sessionStatus, plannedClose, now),
    ]);

  return [
    ...latePunchins,
    ...overdueTasks,
    ...understaffing,
    ...approachingClose,
    ...unsignedSessions,
  ];
}

export async function evaluateAllActiveSessions(): Promise<{
  sessions_checked: number;
  alerts_emitted: number;
}> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: sessions } = await supabaseAdmin
    .from("department_session")
    .select("department_session_id, workspace_id, department_id, status, planned_close")
    .eq("session_date", today)
    .in("status", ["active", "pending_signoff"]);

  if (!sessions || sessions.length === 0) {
    return { sessions_checked: 0, alerts_emitted: 0 };
  }

  let totalAlerts = 0;

  for (const session of sessions) {
    try {
      const alerts = await evaluateSession(
        session.workspace_id,
        session.department_id,
        session.department_session_id,
        session.status,
        session.planned_close,
      );

      for (const alert of alerts) {
        const { data: recent } = await supabaseAdmin
          .from("engine_event")
          .select("id")
          .eq("workspace_id", alert.workspace_id)
          .eq("event_type", `ops.monitor.${alert.rule}`)
          .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())
          .limit(1)
          .maybeSingle();

        if (recent) continue;

        await supabaseAdmin.from("engine_event").insert({
          workspace_id: alert.workspace_id,
          event_type: `ops.monitor.${alert.rule}`,
          payload: {
            ...alert.details,
            domain: alert.domain,
            severity: alert.severity,
            message: alert.message,
            department_id: alert.department_id,
            session_id: alert.session_id,
            origin: "system",
          },
        });

        emitGuardianEvent({
          session_id: alert.session_id,
          workspace_id: alert.workspace_id,
          event_type: `ops.monitor.${alert.rule}`,
          actor: "system",
          summary: alert.message,
          data: alert.details,
        });

        totalAlerts++;
      }
    } catch (err) {
      console.error(`[ops-evaluator] Failed for session ${session.department_session_id}:`, err);
    }
  }

  return { sessions_checked: sessions.length, alerts_emitted: totalAlerts };
}

// ── BLOCKED: HACCP Monitoring ────────────────────────────────────────
// TODO(ADR-0088 Phase 2c): HACCP temperature validation requires
// `haccp_control_point` table (Module 5 scope, separate spec/migration).
// When unblocked:
// 1. Add checkHaccpTemperatures() function
// 2. Add domain discriminator ('operations' | 'haccp') to all rules
// 3. Validate temperature readings against critical_limit_min/max
// 4. Auto-flag deviations and detect patterns (3+ violations per week)
// See spec Section 5.1 HACCP Monitoring for full requirements.
