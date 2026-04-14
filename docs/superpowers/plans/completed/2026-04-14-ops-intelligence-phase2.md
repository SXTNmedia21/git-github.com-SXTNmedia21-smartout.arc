---
title: "AI Operations Intelligence — Phase 2 Implementation Plan"
status: draft
updated: 2026-04-14
created: 2026-04-14
module: ai
tags: [ai, operations, intelligence, phase-2, monitor, act]
---

# AI Operations Intelligence — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the MONITOR evaluator for anomaly detection, the periodic `ops-monitor` cron Edge Function, ACT extensions to Event Engine dispatch with loop guard, HACCP monitoring stub (blocked), and on-demand intelligence tools (`query_monitor_alerts`, `get_session_intelligence`) in the `operations_intelligence` capability.

**Architecture:** MONITOR runs as a new evaluator in Stage Engine (`operations-evaluator.ts`) and a 15-minute cron Edge Function (`ops-monitor`). ACT extends the existing `engine-dispatch` with new action types for automated operational responses. All system-created entities carry `origin: 'system'` metadata for loop guard. On-demand tools live in the `operations_intelligence` capability.

**Tech Stack:** TypeScript, Zod, Supabase Edge Functions (Deno), pg_cron, `@smartout/telemetry` emit(), Stage Engine (Hono), `@smartout/notifications` outbox.

**Spec:** `docs/superpowers/specs/2026-04-14-ai-operations-intelligence-design.md` (Section 5 + Section 10 steps 2a-2d)
**ADR:** `docs/decisions/0088-ai-operations-intelligence-capability.md`
**Phase 1 plan:** `docs/superpowers/plans/2026-04-14-ops-intelligence-phase1.md`

**Prerequisites:** Phase 1 (Tasks 1-9) must be complete before starting Phase 2. The `operations_intelligence` capability scaffold, telemetry `ops_intelligence` category, and foundation migrations must exist.

---

## File Map

### New Files
| Path | Responsibility |
|------|---------------|
| `services/stage-engine/src/core/operations-evaluator.ts` | MONITOR evaluator: anomaly detection rules for active sessions |
| `supabase/functions/ops-monitor/index.ts` | Periodic Edge Function (15 min cron): sweeps active sessions for anomalies |
| `supabase/migrations/YYYYMMDDHHMMSS_ops_monitor_cron.sql` | pg_cron registration for ops-monitor (every 15 minutes) |
| `packages/ai/src/capabilities/operations-intelligence/monitor-tools.ts` | On-demand tools: `query_monitor_alerts`, `get_session_intelligence` |

### Modified Files
| Path | Change |
|------|--------|
| `supabase/functions/engine-dispatch/index.ts` | Add `ops_escalate`, `ops_redistribute_tasks`, `ops_freeze_session` action types + loop guard on `create_session_task` and `assign_task` |
| `packages/ai/src/capabilities/operations-intelligence/index.ts` | Import + register monitor tools and escalation tool |
| `packages/telemetry/src/registry.ts` | Add `ops.monitor.*` and `ops.act.*` event interfaces + routing entries |

---

## Task 1: Operations Evaluator in Stage Engine

**Files:**
- Create: `services/stage-engine/src/core/operations-evaluator.ts`

This is a NEW evaluator, completely separate from `guardian-evaluator.ts` (which evaluates journey data completeness). The operations evaluator checks active `department_session` rows for operational anomalies.

- [ ] **Step 1: Create the operations evaluator**

Create `services/stage-engine/src/core/operations-evaluator.ts`:

```typescript
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
      (rules.late_punchin_threshold_minutes as number) ?? DEFAULT_CONFIG.late_punchin_threshold_minutes,
    noshow_threshold_minutes:
      (rules.noshow_threshold_minutes as number) ?? DEFAULT_CONFIG.noshow_threshold_minutes,
    task_overdue_grace_minutes:
      (rules.task_overdue_grace_minutes as number) ?? DEFAULT_CONFIG.task_overdue_grace_minutes,
    day_brief_offset_minutes:
      (rules.day_brief_offset_minutes as number) ?? DEFAULT_CONFIG.day_brief_offset_minutes,
    shift_brief_enabled: (rules.shift_brief_enabled as boolean) ?? DEFAULT_CONFIG.shift_brief_enabled,
    mid_session_digest_enabled:
      (rules.mid_session_digest_enabled as boolean) ?? DEFAULT_CONFIG.mid_session_digest_enabled,
  };
}

// ── Rule Checks ──────────────────────────────────────────────────────

/**
 * Check for late punch-ins: shifts starting within threshold minutes
 * that have no punch-in recorded yet.
 */
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

  // Shifts that should have started by now (start_time <= now)
  // but have not punched in (actual_start IS NULL)
  const { data: lateShifts } = await supabaseAdmin
    .from("schedule_shift")
    .select("schedule_shift_id, employee_id, start_time, profile:employee_id(first_name, last_name)")
    .eq("workspace_id", workspaceId)
    .eq("department_id", departmentId)
    .eq("shift_date", today)
    .in("status", ["published", "confirmed"])
    .is("actual_start", null);

  for (const shift of lateShifts ?? []) {
    const shiftStart = new Date(`${today}T${shift.start_time}`);
    const elapsed = now.getTime() - shiftStart.getTime();

    if (elapsed < 0) continue; // shift hasn't started yet

    const elapsedMinutes = elapsed / (60 * 1000);
    const profileName = (shift.profile as { first_name: string; last_name: string } | null)
      ? `${(shift.profile as { first_name: string; last_name: string }).first_name} ${(shift.profile as { first_name: string; last_name: string }).last_name}`
      : shift.employee_id;

    if (elapsed >= config.noshow_threshold_minutes * 60 * 1000) {
      // No-show: past noshow threshold
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
      // Late: past late threshold but before noshow
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

/**
 * Check for overdue tasks: tasks past due_at + grace period
 * that are not completed. Critical required tasks get higher severity.
 */
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

    if (elapsed <= graceMs) continue; // still within grace

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

/**
 * Check for understaffing: fewer people on shift than minimum.
 * Uses shift template min_staff if available.
 */
async function checkUnderstaffing(
  workspaceId: string,
  departmentId: string,
  sessionId: string,
  now: Date,
): Promise<MonitorAlert[]> {
  const alerts: MonitorAlert[] = [];
  const today = now.toISOString().slice(0, 10);
  const currentTime = now.toISOString();

  // Count currently active shifts (punched in or within shift window)
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

  // Check if there's a min_staff threshold from shift template
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

/**
 * Check for sessions approaching close with incomplete tasks.
 */
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

  // Only alert when within 1 hour of close
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

/**
 * Check for unsigned sessions past grace period.
 */
async function checkUnsignedSessions(
  workspaceId: string,
  departmentId: string,
  sessionId: string,
  sessionStatus: string,
  plannedClose: string | null,
  now: Date,
): Promise<MonitorAlert[]> {
  const alerts: MonitorAlert[] = [];

  // Only check sessions in pending_signoff status
  if (sessionStatus !== "pending_signoff" || !plannedClose) return alerts;

  const today = now.toISOString().slice(0, 10);
  const closeTime = new Date(`${today}T${plannedClose}`);
  const elapsed = now.getTime() - closeTime.getTime();
  const graceMinutes = 30; // 30 min grace after planned close

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

/**
 * Evaluate a single department session for operational anomalies.
 * Returns all detected alerts.
 */
export async function evaluateSession(
  workspaceId: string,
  departmentId: string,
  sessionId: string,
  sessionStatus: string,
  plannedClose: string | null,
): Promise<MonitorAlert[]> {
  const now = new Date();
  const config = await loadOpsConfig(workspaceId);

  // Run all checks in parallel
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

/**
 * Evaluate all active department sessions across all workspaces.
 * Called by the ops-monitor cron Edge Function every 15 minutes.
 * Returns total alerts emitted.
 */
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

      // Emit each alert as an engine_event + notify via WebSocket
      for (const alert of alerts) {
        // Dedupe: skip if an identical alert was emitted in the last 15 minutes
        const { data: recent } = await supabaseAdmin
          .from("engine_event")
          .select("id")
          .eq("workspace_id", alert.workspace_id)
          .eq("event_type", `ops.monitor.${alert.rule}`)
          .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())
          .limit(1)
          .maybeSingle();

        if (recent) continue; // already alerted recently

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

        // Notify connected WebSocket clients via guardian bus
        emitGuardianEvent({
          session_id: alert.session_id,
          workspace_id: alert.workspace_id,
          event_type: `ops.monitor.${alert.rule}`,
          actor: "monitor",
          summary: alert.message,
          data: alert.details,
        });

        totalAlerts++;
      }
    } catch (err) {
      console.error(
        `[ops-evaluator] Failed for session ${session.department_session_id}:`,
        err,
      );
    }
  }

  return { sessions_checked: sessions.length, alerts_emitted: totalAlerts };
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm turbo typecheck --filter=stage-engine`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add services/stage-engine/src/core/operations-evaluator.ts
git commit -m "$(cat <<'EOF'
feat(stage-engine): add operations evaluator for MONITOR anomaly detection

ADR-0088 Phase 2: new evaluator (separate from guardian-evaluator)
that checks active department_sessions for late punch-ins, no-shows,
overdue tasks, understaffing, approaching close, and unsigned sessions.
Configurable via ai_operations policy thresholds. Emits ops.monitor.*
events with origin: 'system' loop guard. 15-minute deduplication.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: ops-monitor Cron Edge Function

**Files:**
- Create: `supabase/functions/ops-monitor/index.ts`
- Create: `supabase/migrations/YYYYMMDDHHMMSS_ops_monitor_cron.sql`

The Edge Function runs every 15 minutes via pg_cron. It sweeps all active sessions and calls the operations evaluator logic (duplicated for Edge Function runtime since stage-engine runs on Node, not Deno).

- [ ] **Step 1: Create the ops-monitor Edge Function**

Create `supabase/functions/ops-monitor/index.ts`:

```typescript
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
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // Get all active or pending_signoff sessions today
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

      // Run all checks in parallel
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
        // Dedupe: skip if identical alert type emitted for this session in last 15 minutes
        const { data: recent } = await supabase
          .from("engine_event")
          .select("id")
          .eq("workspace_id", alert.workspace_id)
          .eq("event_type", `ops.monitor.${alert.rule}`)
          .gte("created_at", new Date(now.getTime() - 15 * 60 * 1000).toISOString())
          .limit(1)
          .maybeSingle();

        if (recent) continue;

        // Emit engine_event with loop guard
        await supabase.from("engine_event").insert({
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
        });

        // Route critical and warning alerts to notification outbox
        if (alert.severity === "critical" || alert.severity === "warning") {
          await supabase.from("notification").insert({
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
          });
        }

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
```

- [ ] **Step 2: Create the cron migration**

Create `supabase/migrations/20260414240000_ops_monitor_cron.sql`:

```sql
-- ============================================
-- 20260414240000_ops_monitor_cron.sql
-- Registers pg_cron job for periodic operations monitoring (every 15 min).
-- ADR-0088: AI Operations Intelligence Phase 2 — MONITOR function.
-- ============================================

DO $cmd$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'ops-monitor',
      '*/15 * * * *',
      $sql$SELECT net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/ops-monitor',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.watchdog_cron_secret', true))
      )$sql$
    );
  END IF;
END $cmd$;
```

- [ ] **Step 3: Apply and verify migration locally**

Run: `npx supabase db reset` or `npx supabase migration up`
Expected: Migration applies without errors.

Verify in SQL:
```sql
SELECT jobname FROM cron.job WHERE jobname = 'ops-monitor';
-- Should return 1 row
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/ops-monitor/index.ts \
  supabase/migrations/20260414240000_ops_monitor_cron.sql
git commit -m "$(cat <<'EOF'
feat(edge): add ops-monitor cron Edge Function (every 15 min)

ADR-0088 Phase 2 MONITOR: periodic sweep of all active
department_sessions for late punch-ins, no-shows, overdue tasks,
understaffing, approaching close, and unsigned sessions. 15-minute
deduplication prevents alert flooding. Critical/warning alerts
routed to notification table. All events carry origin: 'system'.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: ACT Extensions to Event Engine Dispatch

**Files:**
- Modify: `supabase/functions/engine-dispatch/index.ts`

Add three new action types to the `executeStep` switch statement, and ensure existing `create_session_task` and `assign_task` action types propagate `origin: 'system'` in metadata when the state context contains it.

- [ ] **Step 1: Add loop guard to existing action types**

In `supabase/functions/engine-dispatch/index.ts`, modify the `assign_task` case (around line 596) to propagate origin:

```typescript
    case "assign_task": {
      const ap = step.action_payload as Record<string, unknown>;
      // Create session_task if department_session context exists
      if (state.entity_type === "department_session" && state.entity_id) {
        const ctxOrigin = (state.context as Record<string, unknown>).origin as string | undefined;
        await supabase.from("session_task").insert({
          workspace_id: state.workspace_id,
          department_session_id: state.entity_id,
          title: (ap.task as string) ?? "Task",
          description: (ap.description as string) ?? null,
          status: "available",
          assigned_to: state.assignee_id ?? null,
          is_compliance_required: false,
          metadata: ctxOrigin === "system" ? { origin: "system" } : {},
        });
      }
      await advanceToNextStep(supabase, state, step);
      break;
    }
```

Modify the `create_session_task` case (around line 1040) similarly:

```typescript
    case "create_session_task": {
      const ap = step.action_payload as Record<string, unknown>;
      const sessionId = (state.context as Record<string, unknown>).department_session_id as
        | string
        | undefined;
      const hookId = (state.context as Record<string, unknown>).session_hook_id as
        | string
        | undefined;
      const ctxOrigin = (state.context as Record<string, unknown>).origin as string | undefined;

      if (sessionId) {
        await supabase.from("session_task").insert({
          workspace_id: state.workspace_id,
          department_session_id: sessionId,
          session_hook_id: hookId ?? null,
          title: (ap.title as string) ?? "Task",
          description: (ap.description as string) ?? null,
          status: "available",
          assigned_to: state.assignee_id ?? null,
          is_compliance_required: (ap.compliance_required as boolean) ?? false,
          metadata: ctxOrigin === "system" ? { origin: "system" } : {},
        });
      }
      await advanceToNextStep(supabase, state, step);
      break;
    }
```

- [ ] **Step 2: Add `ops_escalate` action type**

Add after the last `case` in the `executeStep` switch (before the `default` case if there is one, or at the end of the switch):

```typescript
    case "ops_escalate": {
      // ADR-0088 Phase 2 ACT: escalate an operational alert through the chain.
      // Payload: { alert_rule, department_id, session_id, message, severity }
      // Creates a notification for the next level in the escalation chain:
      // assigned → shift lead → manager → admin
      const ap = step.action_payload as Record<string, unknown>;
      const alertRule = (ap.alert_rule as string) ?? "escalation";
      const severity = (ap.severity as string) ?? "warning";
      const message = (ap.message as string) ?? `Escalation: ${alertRule}`;
      const deptId = (ap.department_id as string) ?? null;

      // Route to notification outbox for manager escalation
      await supabase.from("notification").insert({
        workspace_id: state.workspace_id,
        title: `[ESCALATION] ${alertRule.replace(/_/g, " ")}`,
        body: message,
        icon_type: severity === "critical" ? "alert" : "warning",
        priority: severity === "critical" ? "critical" : "high",
        target_type: deptId ? "department" : "workspace",
        target_id: deptId ?? state.workspace_id,
        metadata: {
          type: "ops_escalation",
          alert_rule: alertRule,
          session_id: (ap.session_id as string) ?? state.entity_id,
          origin: "system",
        },
      });

      // Emit ACT telemetry
      await supabase.from("engine_event").insert({
        workspace_id: state.workspace_id,
        event_type: "ops.act.escalated",
        payload: {
          alert_rule: alertRule,
          department_id: deptId,
          session_id: (ap.session_id as string) ?? state.entity_id,
          severity,
          origin: "system",
        },
      });

      await advanceToNextStep(supabase, state, step);
      break;
    }

    case "ops_redistribute_tasks": {
      // ADR-0088 Phase 2 ACT: redistribute tasks from a no-show employee
      // to other on-shift staff. Creates notification for affected employees.
      // Payload: { absent_employee_id, department_id, session_id }
      const ap = step.action_payload as Record<string, unknown>;
      const absentId = ap.absent_employee_id as string;
      const sessionId = (ap.session_id as string) ?? state.entity_id;
      const deptId = ap.department_id as string;
      const today = new Date().toISOString().slice(0, 10);

      if (absentId && sessionId) {
        // Find tasks assigned to the absent employee
        const { data: orphanedTasks } = await supabase
          .from("session_task")
          .select("id, title, priority")
          .eq("department_session_id", sessionId)
          .eq("assigned_to", absentId)
          .in("status", ["pending", "available"]);

        // Unassign them (make available for pickup)
        if (orphanedTasks && orphanedTasks.length > 0) {
          const taskIds = orphanedTasks.map((t: { id: string }) => t.id);
          await supabase
            .from("session_task")
            .update({
              assigned_to: null,
              status: "available",
              metadata: { origin: "system", redistributed_from: absentId },
              updated_at: new Date().toISOString(),
            })
            .in("id", taskIds);
        }

        // Notify on-shift staff about redistributed tasks
        if (deptId) {
          const { data: onShift } = await supabase
            .from("schedule_shift")
            .select("employee_id")
            .eq("workspace_id", state.workspace_id)
            .eq("department_id", deptId)
            .eq("shift_date", today)
            .in("status", ["published", "confirmed"])
            .neq("employee_id", absentId);

          for (const shift of onShift ?? []) {
            if (!shift.employee_id) continue;
            await supabase.from("notification_outbox").insert({
              workspace_id: state.workspace_id,
              recipient_id: shift.employee_id,
              mode: "work",
              priority: 1,
              title: "Tasks redistributed",
              body: `${orphanedTasks?.length ?? 0} tasks need pickup due to absent colleague`,
              action_url: null,
              metadata: {
                event_key: "ops.act.tasks_redistributed",
                session_id: sessionId,
                origin: "system",
              },
              allowed_channels: ["push", "in_app"],
            });
          }
        }

        // Emit ACT telemetry
        await supabase.from("engine_event").insert({
          workspace_id: state.workspace_id,
          event_type: "ops.act.tasks_redistributed",
          payload: {
            absent_employee_id: absentId,
            department_id: deptId,
            session_id: sessionId,
            tasks_redistributed: orphanedTasks?.length ?? 0,
            origin: "system",
          },
        });
      }

      await advanceToNextStep(supabase, state, step);
      break;
    }

    case "ops_freeze_session": {
      // ADR-0088 Phase 2 ACT: freeze session task statuses and prepare handoff.
      // Used after session sign-off is completed.
      // Payload: { session_id }
      const ap = step.action_payload as Record<string, unknown>;
      const sessionId = (ap.session_id as string) ?? state.entity_id;

      if (sessionId) {
        // Freeze all non-completed tasks to their current status
        const { data: activeTasks } = await supabase
          .from("session_task")
          .select("id, status")
          .eq("department_session_id", sessionId)
          .in("status", ["pending", "in_progress", "available"]);

        if (activeTasks && activeTasks.length > 0) {
          const taskIds = activeTasks.map((t: { id: string }) => t.id);
          await supabase
            .from("session_task")
            .update({
              status: "skipped",
              metadata: { origin: "system", frozen_at: new Date().toISOString() },
              updated_at: new Date().toISOString(),
            })
            .in("id", taskIds);
        }

        // Calculate task aggregates for the session
        const { count: totalCount } = await supabase
          .from("session_task")
          .select("id", { count: "exact", head: true })
          .eq("department_session_id", sessionId);

        const { count: completedCount } = await supabase
          .from("session_task")
          .select("id", { count: "exact", head: true })
          .eq("department_session_id", sessionId)
          .eq("status", "completed");

        // Update session with aggregates
        await supabase
          .from("department_session")
          .update({
            tasks_total: totalCount ?? 0,
            tasks_completed: completedCount ?? 0,
            updated_at: new Date().toISOString(),
          })
          .eq("department_session_id", sessionId);

        // Emit ACT telemetry
        await supabase.from("engine_event").insert({
          workspace_id: state.workspace_id,
          event_type: "ops.act.session_frozen",
          payload: {
            session_id: sessionId,
            tasks_total: totalCount ?? 0,
            tasks_completed: completedCount ?? 0,
            tasks_frozen: activeTasks?.length ?? 0,
            origin: "system",
          },
        });
      }

      await advanceToNextStep(supabase, state, step);
      break;
    }
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm turbo typecheck`
Expected: 0 errors. (engine-dispatch is a Deno Edge Function, no turbo typecheck — verify with manual review.)

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/engine-dispatch/index.ts
git commit -m "$(cat <<'EOF'
feat(engine): add ACT action types + loop guard for ops intelligence

ADR-0088 Phase 2 ACT: three new action types in engine-dispatch:
- ops_escalate: route alerts through escalation chain
- ops_redistribute_tasks: unassign tasks from no-show, notify team
- ops_freeze_session: freeze task statuses and calculate aggregates

Loop guard: assign_task and create_session_task now propagate
origin: 'system' metadata when context carries it, preventing
MONITOR from re-evaluating system-created entities.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: HACCP Monitoring (BLOCKED)

> **BLOCKED:** This task requires the `haccp_control_point` table which does NOT exist yet. The table needs its own spec and migration (Module 5 scope). This task is documented here for completeness but MUST NOT be implemented until the prerequisite table exists.

**Prerequisite:** Create `haccp_control_point` table with at minimum:
- `haccp_control_point_id` UUID PK
- `workspace_id` UUID FK
- `department_id` UUID FK
- `name` TEXT
- `critical_limit_min` NUMERIC
- `critical_limit_max` NUMERIC
- `monitoring_frequency_minutes` INTEGER
- `is_active` BOOLEAN

**When unblocked, add to `operations-evaluator.ts`:**

```typescript
/**
 * HACCP temperature validation — BLOCKED on haccp_control_point table.
 * When table exists:
 * 1. Query session_task rows with task_type = 'haccp_check'
 * 2. Read completion_data.temperature from completed tasks
 * 3. Validate against haccp_control_point.critical_limit_min/max
 * 4. Auto-flag deviation when reading outside limits
 * 5. Check for deviation patterns (3+ flags same control point this week)
 */
async function checkHaccpTemperatures(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  departmentId: string,
  sessionId: string,
  _now: Date,
): Promise<MonitorAlert[]> {
  const alerts: MonitorAlert[] = [];

  // Query HACCP tasks completed in this session
  const { data: haccpTasks } = await supabase
    .from("session_task")
    .select("id, title, completion_data")
    .eq("department_session_id", sessionId)
    .eq("task_type", "haccp_check")
    .eq("status", "completed");

  for (const task of haccpTasks ?? []) {
    const completionData = task.completion_data as Record<string, unknown> | null;
    const temperature = completionData?.temperature as number | undefined;
    const controlPointId = completionData?.control_point_id as string | undefined;

    if (temperature === undefined || !controlPointId) continue;

    // Look up limits from haccp_control_point
    const { data: controlPoint } = await supabase
      .from("haccp_control_point")
      .select("name, critical_limit_min, critical_limit_max")
      .eq("haccp_control_point_id", controlPointId)
      .single();

    if (!controlPoint) continue;

    const min = controlPoint.critical_limit_min as number;
    const max = controlPoint.critical_limit_max as number;

    if (temperature < min || temperature > max) {
      alerts.push({
        rule: "temperature_violation",
        domain: "haccp",
        severity: "critical",
        department_id: departmentId,
        session_id: sessionId,
        workspace_id: workspaceId,
        message: `Temperature violation at ${controlPoint.name}: ${temperature}C (limits: ${min}-${max}C)`,
        details: {
          task_id: task.id,
          control_point_id: controlPointId,
          control_point_name: controlPoint.name,
          temperature,
          critical_limit_min: min,
          critical_limit_max: max,
        },
      });
    }
  }

  // Check deviation pattern: same control point flagged 3+ times this week
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentAlerts } = await supabase
    .from("engine_event")
    .select("payload")
    .eq("workspace_id", workspaceId)
    .eq("event_type", "ops.monitor.temperature_violation")
    .gte("created_at", weekAgo);

  // Group by control_point_id
  const counts: Record<string, number> = {};
  for (const evt of recentAlerts ?? []) {
    const cpId = (evt.payload as Record<string, unknown>)?.control_point_id as string | undefined;
    if (cpId) counts[cpId] = (counts[cpId] ?? 0) + 1;
  }

  for (const [cpId, count] of Object.entries(counts)) {
    if (count >= 3) {
      alerts.push({
        rule: "deviation_pattern",
        domain: "haccp",
        severity: "warning",
        department_id: departmentId,
        session_id: sessionId,
        workspace_id: workspaceId,
        message: `Deviation pattern: control point ${cpId} flagged ${count} times this week`,
        details: { control_point_id: cpId, occurrences: count, period: "7d" },
      });
    }
  }

  return alerts;
}
```

**Domain discriminator:** When HACCP monitoring is unblocked, add a `domain` parameter to all monitor rule functions so they can be filtered independently:
- `domain: 'operations'` — general ops (late punch-in, overdue tasks, etc.)
- `domain: 'haccp'` — food safety (temperature, deviation patterns)

- [ ] **Step 1: Document blocker in code**

Add a TODO comment at the end of `services/stage-engine/src/core/operations-evaluator.ts`:

```typescript
// ── BLOCKED: HACCP Monitoring ────────────────────────────────────────
// TODO(ADR-0088 Phase 2c): HACCP temperature validation requires
// `haccp_control_point` table (Module 5 scope, separate spec/migration).
// When unblocked:
// 1. Add checkHaccpTemperatures() function
// 2. Add domain discriminator ('operations' | 'haccp') to all rules
// 3. Validate temperature readings against critical_limit_min/max
// 4. Auto-flag deviations and detect patterns (3+ violations per week)
// See spec Section 5.1 HACCP Monitoring for full requirements.
```

- [ ] **Step 2: Commit**

```bash
git add services/stage-engine/src/core/operations-evaluator.ts
git commit -m "$(cat <<'EOF'
docs(stage-engine): document HACCP monitoring blocker in operations evaluator

ADR-0088 Phase 2c: HACCP temperature validation is blocked on
haccp_control_point table (Module 5 scope). Added TODO with full
requirements for when the prerequisite table is created.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: On-Demand Intelligence Tools

**Files:**
- Create: `packages/ai/src/capabilities/operations-intelligence/monitor-tools.ts`
- Modify: `packages/ai/src/capabilities/operations-intelligence/index.ts`

- [ ] **Step 1: Create the monitor tools file**

Create `packages/ai/src/capabilities/operations-intelligence/monitor-tools.ts`:

```typescript
// packages/ai/src/capabilities/operations-intelligence/monitor-tools.ts
// ADR-0088 Phase 2: On-demand MONITOR tools for manager conversations.
// query_monitor_alerts — query recent anomalies for a department/session.
// get_session_intelligence — comprehensive session status with AI analysis.
import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

/**
 * query_monitor_alerts — Query recent operational anomalies.
 * Manager asks: "any issues in the kitchen today?" or "what alerts fired?"
 */
export const queryMonitorAlerts = defineTool({
  name: "query_monitor_alerts",
  description:
    "Query recent operational anomalies and monitor alerts for a department or session. Returns alerts from the last N hours including late punch-ins, no-shows, overdue tasks, and understaffing.",
  schema: z.object({
    department_id: z
      .string()
      .uuid()
      .optional()
      .describe("Filter alerts to this department. If omitted, returns workspace-wide alerts."),
    session_id: z
      .string()
      .uuid()
      .optional()
      .describe("Filter alerts to this specific session."),
    hours: z
      .number()
      .min(1)
      .max(72)
      .default(24)
      .describe("How many hours back to query. Default 24."),
    severity: z
      .enum(["info", "warning", "critical"])
      .optional()
      .describe("Filter by minimum severity level."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const since = new Date(Date.now() - params.hours * 60 * 60 * 1000).toISOString();

    // Build query for ops.monitor.* events
    let query = supabase
      .from("engine_event")
      .select("id, event_type, payload, created_at")
      .eq("workspace_id", ctx.workspaceId)
      .like("event_type", "ops.monitor.%")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50);

    if (params.department_id) {
      query = query.eq("payload->>department_id", params.department_id);
    }
    if (params.session_id) {
      query = query.eq("payload->>session_id", params.session_id);
    }

    const { data: events, error } = await query;

    if (error) {
      return JSON.stringify({ error: error.message });
    }

    // Filter by severity if requested
    let filtered = events ?? [];
    if (params.severity) {
      const severityOrder = { info: 0, warning: 1, critical: 2 };
      const minSeverity = severityOrder[params.severity];
      filtered = filtered.filter((e) => {
        const payload = e.payload as Record<string, unknown>;
        const sev = (payload.severity as string) ?? "info";
        return severityOrder[sev as keyof typeof severityOrder] >= minSeverity;
      });
    }

    // Group by rule type for summary
    const byRule: Record<string, number> = {};
    for (const e of filtered) {
      const rule = e.event_type.replace("ops.monitor.", "");
      byRule[rule] = (byRule[rule] ?? 0) + 1;
    }

    const result = {
      total_alerts: filtered.length,
      period_hours: params.hours,
      summary_by_rule: byRule,
      alerts: filtered.map((e) => ({
        id: e.id,
        rule: e.event_type.replace("ops.monitor.", ""),
        severity: (e.payload as Record<string, unknown>).severity ?? "info",
        message: (e.payload as Record<string, unknown>).message ?? "",
        department_id: (e.payload as Record<string, unknown>).department_id,
        session_id: (e.payload as Record<string, unknown>).session_id,
        details: e.payload,
        timestamp: e.created_at,
      })),
    };

    // Emit telemetry
    await supabase.from("engine_event").insert({
      workspace_id: ctx.workspaceId,
      event_type: "ops.monitor.alerts_queried",
      payload: {
        department_id: params.department_id ?? null,
        session_id: params.session_id ?? null,
        hours: params.hours,
        total_alerts: result.total_alerts,
        source: "agent_tool",
        actor_id: ctx.profileId,
        origin: "system",
      },
    });

    return JSON.stringify(result);
  },
});

/**
 * get_session_intelligence — Comprehensive session status with analysis.
 * Manager asks: "how's the kitchen session going?" or "session status?"
 */
export const getSessionIntelligence = defineTool({
  name: "get_session_intelligence",
  description:
    "Get comprehensive intelligence for a department session: task progress, staff status, recent alerts, deviations, and operational health score. Provides a complete picture for manager decision-making.",
  schema: z.object({
    department_id: z.string().uuid().describe("Department to analyze"),
    date: z
      .string()
      .optional()
      .describe("Date in YYYY-MM-DD format. Defaults to today."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const targetDate = params.date ?? new Date().toISOString().slice(0, 10);

    // Get the session for this department and date
    const { data: session } = await supabase
      .from("department_session")
      .select(
        "department_session_id, status, planned_open, planned_close, duty_leader_id, tasks_total, tasks_completed, handoff_notes",
      )
      .eq("workspace_id", ctx.workspaceId)
      .eq("department_id", params.department_id)
      .eq("session_date", targetDate)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!session) {
      return JSON.stringify({ error: "No session found for this department and date." });
    }

    // Parallel: tasks, shifts, alerts, deviations, staff on shift now
    const now = new Date().toISOString();
    const [tasksResult, shiftsResult, alertsResult, deviationsResult] = await Promise.all([
      // Task breakdown by status
      supabase
        .from("session_task")
        .select("id, title, priority, status, due_at, assigned_to, is_required, is_compliance_required")
        .eq("workspace_id", ctx.workspaceId)
        .eq("department_session_id", session.department_session_id),

      // Shifts for today
      supabase
        .from("schedule_shift")
        .select("schedule_shift_id, employee_id, start_time, end_time, actual_start, actual_end, status")
        .eq("workspace_id", ctx.workspaceId)
        .eq("department_id", params.department_id)
        .eq("shift_date", targetDate)
        .in("status", ["published", "confirmed"]),

      // Recent monitor alerts (last 4 hours)
      supabase
        .from("engine_event")
        .select("event_type, payload, created_at")
        .eq("workspace_id", ctx.workspaceId)
        .like("event_type", "ops.monitor.%")
        .eq("payload->>department_id", params.department_id)
        .gte("created_at", new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(20),

      // Open deviations
      supabase
        .from("deviation")
        .select("deviation_id, title, severity, status, created_at")
        .eq("workspace_id", ctx.workspaceId)
        .eq("department_id", params.department_id)
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    // Process task data
    const tasks = tasksResult.data ?? [];
    const tasksByStatus: Record<string, number> = {};
    for (const t of tasks) {
      tasksByStatus[t.status] = (tasksByStatus[t.status] ?? 0) + 1;
    }
    const overdueTasks = tasks.filter(
      (t) => t.due_at && new Date(t.due_at as string) < new Date() && t.status !== "completed",
    );
    const criticalIncomplete = tasks.filter(
      (t) => (t.priority === "critical" || t.is_compliance_required) && t.status !== "completed",
    );

    // Process shift data
    const shifts = shiftsResult.data ?? [];
    const punchedIn = shifts.filter((s) => s.actual_start != null);
    const notYetPunchedIn = shifts.filter(
      (s) => s.actual_start == null && new Date(`${targetDate}T${s.start_time}`) <= new Date(now),
    );

    // Calculate health score (0-100)
    const totalTasks = tasks.length || 1;
    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const taskScore = (completedTasks / totalTasks) * 40; // 40% weight

    const totalShifts = shifts.length || 1;
    const punchedInRatio = punchedIn.length / totalShifts;
    const staffScore = punchedInRatio * 30; // 30% weight

    const alertCount = (alertsResult.data ?? []).length;
    const alertPenalty = Math.min(alertCount * 5, 20); // -5 per alert, max -20

    const deviationCount = (deviationsResult.data ?? []).length;
    const deviationPenalty = Math.min(deviationCount * 5, 10); // -5 per deviation, max -10

    const healthScore = Math.max(0, Math.min(100, Math.round(taskScore + staffScore + 30 - alertPenalty - deviationPenalty)));

    const intelligence = {
      session: {
        id: session.department_session_id,
        status: session.status,
        planned_open: session.planned_open,
        planned_close: session.planned_close,
        duty_leader_id: session.duty_leader_id,
      },
      health_score: healthScore,
      tasks: {
        total: tasks.length,
        by_status: tasksByStatus,
        overdue: overdueTasks.length,
        critical_incomplete: criticalIncomplete.length,
        overdue_items: overdueTasks.slice(0, 5).map((t) => ({
          title: t.title,
          priority: t.priority,
          due_at: t.due_at,
        })),
      },
      staff: {
        scheduled: shifts.length,
        punched_in: punchedIn.length,
        not_yet_arrived: notYetPunchedIn.length,
        late_arrivals: notYetPunchedIn.map((s) => ({
          employee_id: s.employee_id,
          expected_start: s.start_time,
        })),
      },
      alerts: {
        recent_count: (alertsResult.data ?? []).length,
        items: (alertsResult.data ?? []).slice(0, 5).map((e) => ({
          rule: e.event_type.replace("ops.monitor.", ""),
          message: (e.payload as Record<string, unknown>).message ?? "",
          severity: (e.payload as Record<string, unknown>).severity ?? "info",
          timestamp: e.created_at,
        })),
      },
      deviations: {
        open_count: (deviationsResult.data ?? []).length,
        items: (deviationsResult.data ?? []).map((d) => ({
          title: d.title,
          severity: d.severity,
          status: d.status,
        })),
      },
    };

    // Emit telemetry
    await supabase.from("engine_event").insert({
      workspace_id: ctx.workspaceId,
      event_type: "ops.monitor.session_intelligence_queried",
      payload: {
        department_id: params.department_id,
        session_id: session.department_session_id,
        health_score: healthScore,
        source: "agent_tool",
        actor_id: ctx.profileId,
        origin: "system",
      },
    });

    return JSON.stringify(intelligence);
  },
});
```

- [ ] **Step 2: Update capability index to include monitor tools**

In `packages/ai/src/capabilities/operations-intelligence/index.ts`, add the new tools:

```typescript
// packages/ai/src/capabilities/operations-intelligence/index.ts
// ADR-0088: Operations Intelligence — manager/system-scoped capability.

import type { SmartoutTool } from "../../types.js";
import type { AgentToolContext, CapabilityDefinition } from "../types.js";
import { triageEvent } from "./tools.js";
import { queryMonitorAlerts, getSessionIntelligence } from "./monitor-tools.js";

const allTools = [
  triageEvent,
  queryMonitorAlerts,
  getSessionIntelligence,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const readOnlyTools = [
  queryMonitorAlerts,
  getSessionIntelligence,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

const suggestTools = [
  triageEvent,
  queryMonitorAlerts,
  getSessionIntelligence,
] as unknown as ReadonlyArray<SmartoutTool<AgentToolContext>>;

export const operationsIntelligenceCapability: CapabilityDefinition = {
  name: "operations_intelligence",
  description:
    "Operational intelligence: event triage, anomaly monitoring, session analysis. Manager and system scope.",
  tools: allTools,
  readOnlyTools,
  suggestTools,
};
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm turbo typecheck --filter=@smartout/ai`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add packages/ai/src/capabilities/operations-intelligence/monitor-tools.ts \
  packages/ai/src/capabilities/operations-intelligence/index.ts
git commit -m "$(cat <<'EOF'
feat(ai): add query_monitor_alerts and get_session_intelligence tools

ADR-0088 Phase 2d: on-demand MONITOR tools for manager conversations.
query_monitor_alerts queries recent ops.monitor.* events with severity
filtering and rule grouping. get_session_intelligence provides a
comprehensive session status with health score (0-100), task progress,
staff status, recent alerts, and open deviations. Both emit telemetry.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Telemetry Registry Updates

**Files:**
- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Add ops.monitor and ops.act event interfaces**

In `packages/telemetry/src/registry.ts`, add after the existing ops intelligence event interfaces (OpsTriageClassified):

```typescript
// ─── Operations Intelligence Phase 2 Events (ADR-0088) ─────────────

export interface OpsMonitorLatePunchin extends BaseEvent {
  event: "ops.monitor late_punchin";
  properties: {
    entity: { entity_type: "shift"; entity_id: string };
    data: { employee_id: string; elapsed_minutes: number; department_id: string };
  };
}

export interface OpsMonitorNoShow extends BaseEvent {
  event: "ops.monitor no_show";
  properties: {
    entity: { entity_type: "shift"; entity_id: string };
    data: { employee_id: string; elapsed_minutes: number; department_id: string };
  };
}

export interface OpsMonitorTaskOverdue extends BaseEvent {
  event: "ops.monitor task_overdue";
  properties: {
    entity: { entity_type: "session_task"; entity_id: string };
    data: { title: string; elapsed_minutes: number; priority: string };
  };
}

export interface OpsMonitorCriticalTaskMissed extends BaseEvent {
  event: "ops.monitor critical_task_missed";
  properties: {
    entity: { entity_type: "session_task"; entity_id: string };
    data: { title: string; department_id: string };
  };
}

export interface OpsMonitorUnderstaffing extends BaseEvent {
  event: "ops.monitor understaffing";
  properties: {
    entity: { entity_type: "department_session"; entity_id: string };
    data: { current_count: number; min_required: number; deficit: number };
  };
}

export interface OpsMonitorApproachingClose extends BaseEvent {
  event: "ops.monitor session_approaching_close";
  properties: {
    entity: { entity_type: "department_session"; entity_id: string };
    data: { minutes_until_close: number; incomplete_tasks: number };
  };
}

export interface OpsMonitorUnsignedSession extends BaseEvent {
  event: "ops.monitor unsigned_session";
  properties: {
    entity: { entity_type: "department_session"; entity_id: string };
    data: { minutes_past_close: number };
  };
}

export interface OpsMonitorAlertsQueried extends BaseEvent {
  event: "ops.monitor alerts_queried";
  properties: {
    data: { department_id: string | null; hours: number; total_alerts: number };
  };
}

export interface OpsMonitorSessionIntelligenceQueried extends BaseEvent {
  event: "ops.monitor session_intelligence_queried";
  properties: {
    entity: { entity_type: "department_session"; entity_id: string };
    data: { department_id: string; health_score: number };
  };
}

export interface OpsActEscalated extends BaseEvent {
  event: "ops.act escalated";
  properties: {
    entity: { entity_type: "department_session"; entity_id: string };
    data: { alert_rule: string; severity: string; department_id: string };
  };
}

export interface OpsActTasksRedistributed extends BaseEvent {
  event: "ops.act tasks_redistributed";
  properties: {
    entity: { entity_type: "department_session"; entity_id: string };
    data: { absent_employee_id: string; tasks_redistributed: number };
  };
}

export interface OpsActSessionFrozen extends BaseEvent {
  event: "ops.act session_frozen";
  properties: {
    entity: { entity_type: "department_session"; entity_id: string };
    data: { tasks_total: number; tasks_completed: number; tasks_frozen: number };
  };
}
```

- [ ] **Step 2: Add to the SmartoutEvent union type**

Find the `SmartoutEvent` union type and add the new interfaces:

```typescript
export type SmartoutEvent =
  // ... existing event types ...
  | OpsMonitorLatePunchin
  | OpsMonitorNoShow
  | OpsMonitorTaskOverdue
  | OpsMonitorCriticalTaskMissed
  | OpsMonitorUnderstaffing
  | OpsMonitorApproachingClose
  | OpsMonitorUnsignedSession
  | OpsMonitorAlertsQueried
  | OpsMonitorSessionIntelligenceQueried
  | OpsActEscalated
  | OpsActTasksRedistributed
  | OpsActSessionFrozen;
```

- [ ] **Step 3: Add event metadata entries**

Find the `EVENT_ROUTING` record and add entries:

```typescript
  "ops.monitor late_punchin": { destinations: ["logger", "engine_event"], category: "ops_intelligence" },
  "ops.monitor no_show": { destinations: ["logger", "engine_event"], category: "ops_intelligence" },
  "ops.monitor task_overdue": { destinations: ["logger", "engine_event"], category: "ops_intelligence" },
  "ops.monitor critical_task_missed": { destinations: ["logger", "engine_event"], category: "ops_intelligence" },
  "ops.monitor understaffing": { destinations: ["logger", "engine_event"], category: "ops_intelligence" },
  "ops.monitor session_approaching_close": { destinations: ["logger", "engine_event"], category: "ops_intelligence" },
  "ops.monitor unsigned_session": { destinations: ["logger", "engine_event"], category: "ops_intelligence" },
  "ops.monitor alerts_queried": { destinations: ["logger", "engine_event"], category: "ops_intelligence" },
  "ops.monitor session_intelligence_queried": { destinations: ["logger", "engine_event"], category: "ops_intelligence" },
  "ops.act escalated": { destinations: ["logger", "engine_event", "activity_trail"], category: "ops_intelligence" },
  "ops.act tasks_redistributed": { destinations: ["logger", "engine_event", "activity_trail"], category: "ops_intelligence" },
  "ops.act session_frozen": { destinations: ["logger", "engine_event", "activity_trail"], category: "ops_intelligence" },
```

Note: ACT events route to `activity_trail` in addition to `logger` + `engine_event` because they are mutations that should be audited.

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm turbo typecheck --filter=@smartout/telemetry`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "$(cat <<'EOF'
feat(telemetry): register ops.monitor.* and ops.act.* events

ADR-0088 Phase 2: adds 12 event interfaces for MONITOR (late punch-in,
no-show, task overdue, critical task missed, understaffing, approaching
close, unsigned session, alerts queried, intelligence queried) and ACT
(escalated, tasks redistributed, session frozen). ACT events route to
activity_trail for audit. All route to logger + engine_event.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Final Typecheck + Verification

- [ ] **Step 1: Full monorepo typecheck**

Run: `pnpm turbo typecheck`
Expected: 0 errors across all packages.

- [ ] **Step 2: Verify operations evaluator exists**

Run: `ls services/stage-engine/src/core/operations-evaluator.ts`
Expected: File exists.

- [ ] **Step 3: Verify ops-monitor Edge Function exists**

Run: `ls supabase/functions/ops-monitor/index.ts`
Expected: File exists.

- [ ] **Step 4: Verify migration applies**

Run: `npx supabase db reset`
Expected: All migrations apply without errors.

- [ ] **Step 5: Verify cron registered**

After reset, run SQL:
```sql
SELECT jobname FROM cron.job WHERE jobname LIKE 'ops-%';
```
Expected: `ops-day-brief` (from Phase 1) and `ops-monitor` rows.

- [ ] **Step 6: Verify capability tools count**

Run: `grep -c "defineTool" packages/ai/src/capabilities/operations-intelligence/tools.ts packages/ai/src/capabilities/operations-intelligence/monitor-tools.ts`
Expected: 1 tool in tools.ts (triage_event), 2 tools in monitor-tools.ts (query_monitor_alerts, get_session_intelligence). Total: 3 tools in operations_intelligence capability.

- [ ] **Step 7: Verify loop guard in engine-dispatch**

Run: `grep -c "origin.*system" supabase/functions/engine-dispatch/index.ts`
Expected: Multiple occurrences — all ACT action types and modified assign_task/create_session_task include origin: 'system'.

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Operations evaluator in Stage Engine | 1 new file |
| 2 | ops-monitor cron Edge Function + migration | 2 new files |
| 3 | ACT extensions to engine-dispatch + loop guard | 1 modified file |
| 4 | HACCP monitoring (BLOCKED — documented only) | 1 modified file (TODO comment) |
| 5 | On-demand intelligence tools | 2 files (1 new, 1 modified) |
| 6 | Telemetry registry updates | 1 modified file |
| 7 | Final verification | 0 files (verification only) |

**Total: 7 tasks, ~8 files created/modified, 7 commits.**

### Dependency Graph

```
Phase 1 (complete)
    │
    ├── Task 1: operations-evaluator.ts (no dependency on other Phase 2 tasks)
    │       │
    │       ├── Task 2: ops-monitor Edge Function (depends on evaluator pattern)
    │       │
    │       ├── Task 4: HACCP monitoring (BLOCKED — depends on external table)
    │       │
    │       └── Task 5: On-demand tools (depends on evaluator existing)
    │
    ├── Task 3: ACT extensions (independent of evaluator, depends on Phase 1 dispatch)
    │
    ├── Task 6: Telemetry registry (depends on all tools/events being defined)
    │
    └── Task 7: Final verification (depends on all above)
```

Tasks 1, 3, and 5 can be parallelized. Task 2 depends on Task 1 pattern. Task 6 must come after all tool/event implementations. Task 7 is always last.
