// packages/ai/src/capabilities/communication/compile-day-brief.ts
// ADR-0088: COMPILE function — Day Brief compilation.
// Lives in communication capability per ADR-0088 (COMPILE stays in communication).
import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

/**
 * compile_day_brief — Compile a Day Brief for a department's upcoming session.
 * Reads: previous handoff, today's schedule, pending tasks, notes, deviations.
 * Output: structured briefing JSON for rendering as dashboard card or mobile bottom sheet.
 */
export const compileDayBrief = defineTool({
  name: "compile_day_brief",
  description:
    "Compile a Day Brief for a department — previous handoff, today's schedule, pending tasks, open deviations, and announcements",
  capability: "communication",
  schema: z.object({
    department_id: z.string().uuid().describe("Department to compile brief for"),
    date: z.string().optional().describe("Date in YYYY-MM-DD format. Defaults to today."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const targetDate = params.date ?? new Date().toISOString().slice(0, 10);
    const yesterday = new Date(new Date(targetDate).getTime() - 86400000)
      .toISOString()
      .slice(0, 10);

    // Stage 1: fetch session + context that doesn't depend on session ID
    const [handoffResult, sessionResult, shiftsResult, deviationsResult, memoriesResult] =
      await Promise.all([
        // Previous session handoff notes
        supabase
          .from("department_session")
          .select("handoff_notes, signed_off_by, status")
          .eq("workspace_id", ctx.workspaceId)
          .eq("department_id", params.department_id)
          .eq("session_date", yesterday)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),

        // Today's session
        supabase
          .from("department_session")
          .select(
            "department_session_id, status, planned_open, planned_close, duty_leader_id, tasks_total, tasks_completed",
          )
          .eq("workspace_id", ctx.workspaceId)
          .eq("department_id", params.department_id)
          .eq("session_date", targetDate)
          .limit(1)
          .maybeSingle(),

        // Today's shifts
        supabase
          .from("schedule_shift")
          .select("employee_id, role, start_time, end_time, status")
          .eq("workspace_id", ctx.workspaceId)
          .eq("department_id", params.department_id)
          .eq("shift_date", targetDate)
          .in("status", ["published", "confirmed"])
          .order("start_time", { ascending: true }),

        // Open deviations
        supabase
          .from("deviation")
          .select("deviation_id, title, severity, status, created_at")
          .eq("workspace_id", ctx.workspaceId)
          .eq("department_id", params.department_id)
          .in("status", ["open", "in_progress"])
          .order("created_at", { ascending: false })
          .limit(10),

        // Recent announcements from engine_memory (K1b)
        supabase
          .from("engine_memory")
          .select("content, memory_type, importance, created_at")
          .eq("workspace_id", ctx.workspaceId)
          .gte("importance", 0.5)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

    // Stage 2: fetch tasks scoped to today's session (requires session ID from stage 1)
    const sessionId = sessionResult.data?.department_session_id;
    const tasksResult = sessionId
      ? await supabase
          .from("session_task")
          .select("id, title, priority, status, due_at, task_type")
          .eq("workspace_id", ctx.workspaceId)
          .eq("department_session_id", sessionId)
          .eq("status", "pending")
          .order("due_at", { ascending: true })
          .limit(20)
      : {
          data: [] as {
            id: string;
            title: string;
            priority: string;
            status: string;
            due_at: string;
            task_type: string;
          }[],
        };

    const brief = {
      department_id: params.department_id,
      date: targetDate,
      previous_handoff: handoffResult.data?.handoff_notes ?? null,
      previous_session_status: handoffResult.data?.status ?? null,
      session: sessionResult.data ?? null,
      shifts: {
        count: shiftsResult.data?.length ?? 0,
        schedule: (shiftsResult.data ?? []).map((s) => ({
          employee_id: s.employee_id,
          role: s.role,
          start: s.start_time,
          end: s.end_time,
        })),
      },
      pending_tasks: {
        count: tasksResult.data?.length ?? 0,
        critical: (tasksResult.data ?? []).filter((t) => t.priority === "critical").length,
        items: (tasksResult.data ?? []).slice(0, 5).map((t) => ({
          title: t.title,
          priority: t.priority,
          due_at: t.due_at,
        })),
      },
      open_deviations: {
        count: deviationsResult.data?.length ?? 0,
        items: (deviationsResult.data ?? []).map((d) => ({
          title: d.title,
          severity: d.severity,
          status: d.status,
        })),
      },
      announcements: (memoriesResult.data ?? []).map((m) => ({
        content: m.content,
        importance: m.importance,
      })),
    };

    // Emit telemetry
    await supabase.from("engine_event").insert({
      workspace_id: ctx.workspaceId,
      event_type: "ops.compile.day_brief",
      payload: {
        department_id: params.department_id,
        date: targetDate,
        shift_count: brief.shifts.count,
        task_count: brief.pending_tasks.count,
        deviation_count: brief.open_deviations.count,
        source: "agent_tool",
        actor_id: ctx.profileId,
        origin: "system",
      },
    });

    return JSON.stringify(brief);
  },
});
