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
    session_id: z.string().uuid().optional().describe("Filter alerts to this specific session."),
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
    date: z.string().optional().describe("Date in YYYY-MM-DD format. Defaults to today."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const targetDate = params.date ?? new Date().toISOString().slice(0, 10);

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

    const now = new Date().toISOString();
    const [tasksResult, shiftsResult, alertsResult, deviationsResult] = await Promise.all([
      supabase
        .from("session_task")
        .select(
          "id, title, priority, status, due_at, assigned_to, is_required, is_compliance_required",
        )
        .eq("workspace_id", ctx.workspaceId)
        .eq("department_session_id", session.department_session_id),

      supabase
        .from("schedule_shift")
        .select(
          "schedule_shift_id, employee_id, start_time, end_time, actual_start, actual_end, status",
        )
        .eq("workspace_id", ctx.workspaceId)
        .eq("department_id", params.department_id)
        .eq("shift_date", targetDate)
        .in("status", ["published", "confirmed"]),

      supabase
        .from("engine_event")
        .select("event_type, payload, created_at")
        .eq("workspace_id", ctx.workspaceId)
        .like("event_type", "ops.monitor.%")
        .eq("payload->>department_id", params.department_id)
        .gte("created_at", new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(20),

      supabase
        .from("deviation")
        .select("deviation_id, title, severity, status, created_at")
        .eq("workspace_id", ctx.workspaceId)
        .eq("department_id", params.department_id)
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

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

    const shifts = shiftsResult.data ?? [];
    const punchedIn = shifts.filter((s) => s.actual_start != null);
    const notYetPunchedIn = shifts.filter(
      (s) => s.actual_start == null && new Date(`${targetDate}T${s.start_time}`) <= new Date(now),
    );

    const totalTasks = tasks.length || 1;
    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const taskScore = (completedTasks / totalTasks) * 40;

    const totalShifts = shifts.length || 1;
    const punchedInRatio = punchedIn.length / totalShifts;
    const staffScore = punchedInRatio * 30;

    const alertCount = (alertsResult.data ?? []).length;
    const alertPenalty = Math.min(alertCount * 5, 20);

    const deviationCount = (deviationsResult.data ?? []).length;
    const deviationPenalty = Math.min(deviationCount * 5, 10);

    const healthScore = Math.max(
      0,
      Math.min(100, Math.round(taskScore + staffScore + 30 - alertPenalty - deviationPenalty)),
    );

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
