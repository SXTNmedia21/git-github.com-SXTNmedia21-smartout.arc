// packages/ai/src/capabilities/communication/compile-preclose.ts
// ADR-0088: COMPILE function — Pre-close Summary compilation.
import { z } from "zod";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

/**
 * compile_preclose_summary — Compile a pre-close summary for a department session.
 * Shows: tasks done vs remaining, open deviations, unsigned items, handoff prep.
 */
export const compilePreclose = defineTool({
  name: "compile_preclose_summary",
  description:
    "Compile a pre-close summary for a department session — tasks done, tasks remaining, open deviations, items needing sign-off",
  capability: "communication",
  schema: z.object({
    department_id: z.string().uuid().describe("Department to compile pre-close for"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const today = new Date().toISOString().slice(0, 10);

    // Get today's session
    const { data: session } = await supabase
      .from("department_session")
      .select(
        "department_session_id, status, planned_close, tasks_total, tasks_completed, duty_leader_id",
      )
      .eq("workspace_id", ctx.workspaceId)
      .eq("department_id", params.department_id)
      .eq("session_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!session) {
      return JSON.stringify({ error: "No active session found for today." });
    }

    // Parallel: incomplete tasks, deviations, required unsigned tasks
    const [incompleteTasks, deviations, requiredTasks] = await Promise.all([
      supabase
        .from("session_task")
        .select("id, title, priority, status, assigned_to, due_at")
        .eq("workspace_id", ctx.workspaceId)
        .eq("department_session_id", session.department_session_id)
        .in("status", ["pending", "in_progress", "overdue"])
        .order("priority", { ascending: true }),

      supabase
        .from("deviation")
        .select("deviation_id, title, severity, status")
        .eq("workspace_id", ctx.workspaceId)
        .eq("department_id", params.department_id)
        .in("status", ["open", "in_progress"])
        .order("severity", { ascending: true }),

      supabase
        .from("session_task")
        .select("id, title, priority, status")
        .eq("workspace_id", ctx.workspaceId)
        .eq("department_session_id", session.department_session_id)
        .eq("is_required", true)
        .neq("status", "completed"),
    ]);

    const summary = {
      session_id: session.department_session_id,
      session_status: session.status,
      planned_close: session.planned_close,
      tasks: {
        total: session.tasks_total ?? 0,
        completed: session.tasks_completed ?? 0,
        remaining: (incompleteTasks.data ?? []).length,
        required_incomplete: (requiredTasks.data ?? []).length,
        items: (incompleteTasks.data ?? []).map((t) => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          status: t.status,
          assigned_to: t.assigned_to,
        })),
      },
      deviations: {
        open_count: (deviations.data ?? []).length,
        items: (deviations.data ?? []).map((d) => ({
          id: d.deviation_id,
          title: d.title,
          severity: d.severity,
        })),
      },
      ready_for_signoff:
        (requiredTasks.data ?? []).length === 0 && (deviations.data ?? []).length === 0,
    };

    // T1 fix: route via emit() registry — ADR-0156 / L-0064.
    await emit({
      event: "ops.compile preclose_summary",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: {
          entity_type: "department_session",
          entity_id: session.department_session_id,
        },
        data: {
          tasks_remaining: summary.tasks.remaining,
          deviations_open: summary.deviations.open_count,
          ready_for_signoff: summary.ready_for_signoff,
        },
      },
    });

    return JSON.stringify(summary);
  },
});
