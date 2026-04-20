// packages/ai/src/capabilities/operations-intelligence/predict-tools.ts
// ADR-0088 Phase 3 PREDICT: On-demand predictive tools for manager conversations.
// predict_coverage — analyzes upcoming schedule vs min_staff requirements to surface gaps.
// predict_compliance — analyzes HACCP/hygiene task completion rates against a threshold.
import { z } from "zod";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

/**
 * predict_coverage — Predict staffing coverage gaps over the next N days.
 * Manager asks: "will we be understaffed next week?" or "coverage gaps coming up?"
 */
export const predictCoverage = defineTool({
  name: "predict_coverage",
  description:
    "Predict staffing coverage gaps for a department over the next N days by comparing scheduled shifts against minimum staff requirements. Returns per-day analysis and any cached predictions from engine_memory.",
  capability: "operations_intelligence",
  schema: z.object({
    department_id: z.string().uuid().describe("Department to analyze for coverage gaps"),
    days_ahead: z
      .number()
      .min(1)
      .max(14)
      .default(7)
      .describe("How many days ahead to analyze. Default 7, max 14."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Fetch min_staff requirements keyed by day_of_week (0=Sun, 1=Mon, …, 6=Sat)
    const { data: operatingHours, error: hoursError } = await supabase
      .from("department_operating_hours")
      .select("day_of_week, min_staff")
      .eq("workspace_id", ctx.workspaceId)
      .eq("department_id", params.department_id);

    if (hoursError) {
      return JSON.stringify({ error: hoursError.message });
    }

    const minStaffByDow: Record<number, number> = {};
    for (const row of operatingHours ?? []) {
      minStaffByDow[row.day_of_week as number] = (row.min_staff as number) ?? 0;
    }

    // 2. Build date range
    const dateRange: string[] = [];
    for (let i = 0; i < params.days_ahead; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dateRange.push(d.toISOString().slice(0, 10));
    }

    const startDate = dateRange[0];
    const endDate = dateRange[dateRange.length - 1];

    // 3. Fetch scheduled shifts for the entire range in one query
    const { data: shifts, error: shiftsError } = await supabase
      .from("schedule_shift")
      .select("schedule_shift_id, shift_date, status")
      .eq("workspace_id", ctx.workspaceId)
      .eq("department_id", params.department_id)
      .gte("shift_date", startDate)
      .lte("shift_date", endDate)
      .in("status", ["published", "confirmed"]);

    if (shiftsError) {
      return JSON.stringify({ error: shiftsError.message });
    }

    // Count published/confirmed shifts per date
    const shiftsPerDate: Record<string, number> = {};
    for (const shift of shifts ?? []) {
      const d = shift.shift_date as string;
      shiftsPerDate[d] = (shiftsPerDate[d] ?? 0) + 1;
    }

    // 4. Build per-day analysis
    const dailyAnalysis: {
      date: string;
      day_of_week: number;
      scheduled: number;
      min_required: number;
      gap: number;
      has_gap: boolean;
    }[] = [];

    let daysWithGaps = 0;
    let totalUnfilledPositions = 0;

    for (const date of dateRange) {
      const dow = new Date(date).getDay();
      const minRequired = minStaffByDow[dow] ?? 0;
      const scheduled = shiftsPerDate[date] ?? 0;
      const gap = Math.max(0, minRequired - scheduled);

      dailyAnalysis.push({
        date,
        day_of_week: dow,
        scheduled,
        min_required: minRequired,
        gap,
        has_gap: gap > 0,
      });

      if (gap > 0) {
        daysWithGaps++;
        totalUnfilledPositions += gap;
      }
    }

    // 5. Fetch cached predictions from engine_memory
    const now = new Date().toISOString();
    const { data: cachedPredictions } = await supabase
      .from("engine_memory")
      .select("memory_id, content, importance, expires_at, created_at")
      .eq("workspace_id", ctx.workspaceId)
      .eq("memory_type", "prediction")
      .eq("entity_type", "department")
      .eq("entity_id", params.department_id)
      .or(`expires_at.is.null,expires_at.gte.${now}`)
      .order("created_at", { ascending: false })
      .limit(10);

    // 6. Emit telemetry
    await emit({
      event: "ops.predict coverage_queried",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: {
          entity_type: "department",
          entity_id: params.department_id,
        },
        data: {
          department_id: params.department_id,
          date_range_days: params.days_ahead,
          gaps_found: daysWithGaps,
        },
      },
    });

    return JSON.stringify({
      department_id: params.department_id,
      days_analyzed: params.days_ahead,
      days_with_gaps: daysWithGaps,
      total_unfilled_positions: totalUnfilledPositions,
      daily_analysis: dailyAnalysis,
      cached_predictions: cachedPredictions ?? [],
    });
  },
});

/**
 * predict_compliance — Predict HACCP/hygiene compliance risk based on recent task completion.
 * Manager asks: "are we at risk for our next hygiene inspection?" or "compliance rate this week?"
 */
export const predictCompliance = defineTool({
  name: "predict_compliance",
  description:
    "Analyze recent HACCP, temperature, and hygiene task completion rates to predict compliance risk. Returns overall compliance rate, risk level, per-task-type breakdown, and cached risk predictions.",
  capability: "operations_intelligence",
  schema: z.object({
    department_id: z
      .string()
      .uuid()
      .optional()
      .describe("Scope analysis to this department. If omitted, returns workspace-wide analysis."),
    days_back: z
      .number()
      .min(1)
      .max(30)
      .default(7)
      .describe("How many days back to analyze. Default 7, max 30."),
    threshold: z
      .number()
      .min(0)
      .max(100)
      .default(90)
      .describe("Compliance rate threshold (percentage). Below this = non-compliant. Default 90."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const since = new Date(Date.now() - params.days_back * 24 * 60 * 60 * 1000).toISOString();

    // 1. Build session_task query for compliance-related tasks
    // If department_id given, we join through department_session
    let tasksQuery = supabase
      .from("session_task")
      .select("id, task_type, status, department_session_id, created_at")
      .eq("workspace_id", ctx.workspaceId)
      .gte("created_at", since)
      .or("task_type.ilike.%haccp%,task_type.ilike.%temperature%,task_type.ilike.%hygiene%");

    const { data: tasks, error: tasksError } = await tasksQuery;

    if (tasksError) {
      return JSON.stringify({ error: tasksError.message });
    }

    let filteredTasks = tasks ?? [];

    // If department_id given, filter via department_session join
    if (params.department_id) {
      const { data: sessions } = await supabase
        .from("department_session")
        .select("department_session_id")
        .eq("workspace_id", ctx.workspaceId)
        .eq("department_id", params.department_id)
        .gte("created_at", since);

      const sessionIds = new Set((sessions ?? []).map((s) => s.department_session_id as string));
      filteredTasks = filteredTasks.filter((t) =>
        sessionIds.has(t.department_session_id as string),
      );
    }

    // 2. Compute overall compliance rate
    const totalTasks = filteredTasks.length;
    const completedTasks = filteredTasks.filter((t) => t.status === "completed").length;
    const complianceRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;

    const isCompliant = complianceRate >= params.threshold;
    const riskLevel =
      complianceRate >= params.threshold
        ? "low"
        : complianceRate >= params.threshold - 10
          ? "medium"
          : "high";

    // 3. Build per-task-type breakdown
    const byTaskType: Record<string, { total: number; completed: number; rate: number }> = {};

    for (const task of filteredTasks) {
      const tt = (task.task_type as string) ?? "unknown";
      if (!byTaskType[tt]) {
        byTaskType[tt] = { total: 0, completed: 0, rate: 0 };
      }
      byTaskType[tt].total++;
      if (task.status === "completed") {
        byTaskType[tt].completed++;
      }
    }
    for (const tt of Object.keys(byTaskType)) {
      const entry = byTaskType[tt];
      if (entry) {
        entry.rate = entry.total > 0 ? Math.round((entry.completed / entry.total) * 100) : 100;
      }
    }

    const breakdown = Object.entries(byTaskType).map(([task_type, stats]) => ({
      task_type,
      ...stats,
    }));

    // 4. Fetch cached compliance_risk predictions from engine_memory
    const now = new Date().toISOString();
    const memoryQuery = supabase
      .from("engine_memory")
      .select("memory_id, content, importance, expires_at, created_at")
      .eq("workspace_id", ctx.workspaceId)
      .eq("memory_type", "prediction")
      .ilike("content", "%compliance_risk%")
      .or(`expires_at.is.null,expires_at.gte.${now}`)
      .order("created_at", { ascending: false })
      .limit(10);

    if (params.department_id) {
      memoryQuery.eq("entity_id", params.department_id);
    }

    const { data: cachedPredictions } = await memoryQuery;

    // 5. Build human-readable summary
    const summary = isCompliant
      ? `Compliance rate of ${complianceRate}% over the last ${params.days_back} days meets the ${params.threshold}% threshold. Risk is ${riskLevel}.`
      : `Compliance rate of ${complianceRate}% is below the ${params.threshold}% threshold. Risk is ${riskLevel}. ${totalTasks - completedTasks} tasks incomplete.`;

    // 6. Emit telemetry
    await emit({
      event: "ops.predict compliance_queried",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: {
          entity_type: "workspace",
          entity_id: ctx.workspaceId,
        },
        data: {
          department_id: params.department_id ?? null,
          completion_rate: complianceRate,
          threshold: params.threshold,
        },
      },
    });

    return JSON.stringify({
      department_id: params.department_id ?? null,
      days_analyzed: params.days_back,
      threshold: params.threshold,
      compliance_rate: complianceRate,
      is_compliant: isCompliant,
      risk_level: riskLevel,
      summary,
      breakdown,
      cached_predictions: cachedPredictions ?? [],
    });
  },
});
