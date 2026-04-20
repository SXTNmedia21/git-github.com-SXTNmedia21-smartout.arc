// packages/ai/src/capabilities/operations/tools.ts
import { z } from "zod";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

export const getMyTasks = defineTool({
  name: "get_my_tasks",
  description:
    "Get pending tasks assigned to the current employee for the active or upcoming session",
  capability: "operations",
  schema: z.object({
    status: z
      .enum(["pending", "in_progress", "completed", "overdue"])
      .optional()
      .default("pending")
      .describe("Filter by task status"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    const { data, error } = await supabase
      .from("session_task")
      .select(
        "id, title, description, task_type, status, due_at, priority, session:department_session_id(id, status, department:department_id(name))",
      )
      .eq("workspace_id", ctx.workspaceId)
      .eq("assigned_to", ctx.profileId)
      .eq("status", params.status)
      .order("due_at", { ascending: true });

    if (error) return `Error loading tasks: ${error.message}`;
    if (!data || data.length === 0) return `No ${params.status} tasks found.`;
    return JSON.stringify(data);
  },
});

export const getSessionInfo = defineTool({
  name: "get_session_info",
  description: "Get the current department session status (today's operating session)",
  capability: "operations",
  schema: z.object({
    department_id: z
      .string()
      .uuid()
      .optional()
      .describe("Department ID. If omitted, uses the employee's department."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    let deptId = params.department_id;
    if (!deptId) {
      const { data: profile } = await supabase
        .from("profile")
        .select("department_id")
        .eq("workspace_id", ctx.workspaceId)
        .eq("profile_id", ctx.profileId)
        .single();
      deptId = profile?.department_id;
    }
    if (!deptId) return "No department found for this employee.";

    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("department_session")
      .select(
        "department_session_id, status, session_date, opened_at, closed_at, tasks_total, tasks_completed, department:department_id(name)",
      )
      .eq("workspace_id", ctx.workspaceId)
      .eq("department_id", deptId)
      .eq("session_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return `Error loading session: ${error.message}`;
    if (!data) return "No active session found for today.";
    return JSON.stringify(data);
  },
});

export const getDepartmentStatus = defineTool({
  name: "get_department_status",
  description:
    "Get department operational status: session state, active staff count, and pending task count",
  capability: "operations",
  schema: z.object({
    department_id: z
      .string()
      .uuid()
      .optional()
      .describe("Department ID. If omitted, uses the employee's department."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    let deptId = params.department_id;
    if (!deptId) {
      const { data: profile } = await supabase
        .from("profile")
        .select("department_id")
        .eq("workspace_id", ctx.workspaceId)
        .eq("profile_id", ctx.profileId)
        .single();
      deptId = profile?.department_id;
    }
    if (!deptId) return "No department found for this employee.";

    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toISOString();

    // Get today's session
    const { data: session, error: sessionError } = await supabase
      .from("department_session")
      .select("department_session_id")
      .eq("workspace_id", ctx.workspaceId)
      .eq("department_id", deptId)
      .eq("session_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionError) return `Error loading session: ${sessionError.message}`;

    // Count active shifts (currently scheduled)
    const { count: activeStaffCount, error: shiftsError } = await supabase
      .from("schedule_shift")
      .select("id", { count: "exact" })
      .eq("workspace_id", ctx.workspaceId)
      .eq("department_id", deptId)
      .lte("start_time", now)
      .gte("end_time", now);

    if (shiftsError) return `Error loading shifts: ${shiftsError.message}`;

    // Count pending tasks for today's session
    let pendingTaskCount = 0;
    if (session?.department_session_id) {
      const { count, error: tasksError } = await supabase
        .from("session_task")
        .select("id", { count: "exact" })
        .eq("workspace_id", ctx.workspaceId)
        .eq("department_session_id", session.department_session_id)
        .eq("status", "pending");

      if (tasksError) return `Error loading tasks: ${tasksError.message}`;
      pendingTaskCount = count ?? 0;
    }

    return JSON.stringify({
      session: session ?? null,
      active_staff_count: activeStaffCount ?? 0,
      pending_task_count: pendingTaskCount,
    });
  },
});

export const createDeviation = defineTool({
  name: "create_deviation",
  description: "Report a work deviation (quality issue, safety concern, process violation)",
  capability: "operations",
  schema: z.object({
    title: z.string().min(3).describe("Short title describing the deviation"),
    description: z.string().optional().describe("Detailed description of what happened"),
    domain: z
      .enum(["safety", "customer", "procedure", "system", "material"])
      .default("procedure")
      .describe("Deviation domain category"),
    severity: z
      .enum(["low", "medium", "high", "critical"])
      .optional()
      .default("medium")
      .describe("Severity level of the deviation"),
    department_id: z
      .string()
      .uuid()
      .optional()
      .describe("Department ID. If omitted, uses the employee's department."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    let deptId = params.department_id;
    if (!deptId) {
      const { data: profile } = await supabase
        .from("profile")
        .select("department_id")
        .eq("workspace_id", ctx.workspaceId)
        .eq("profile_id", ctx.profileId)
        .single();
      deptId = profile?.department_id;
    }
    if (!deptId) return "No department found for this employee.";

    const { data, error } = await supabase
      .from("deviation")
      .insert({
        workspace_id: ctx.workspaceId,
        department_id: deptId,
        domain: params.domain,
        reported_by: ctx.profileId,
        title: params.title,
        description: params.description ?? null,
        severity: params.severity,
        status: "open",
      })
      .select("deviation_id, title, severity, status")
      .single();

    if (error) return `Error creating deviation: ${error.message}`;

    // T1 fix: route via emit() registry — "deviation reported" (registered).
    // Unifies audit trail with useCreateDeviation + DeviationDialog UI
    // callers that already use this event name. ADR-0156 / L-0064.
    await emit({
      event: "deviation reported",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: { entity_type: "deviation", entity_id: data.deviation_id },
        data: {
          domain: params.domain,
          severity: params.severity,
        },
      },
    });

    return JSON.stringify({ created: true, deviation: data });
  },
});

export const completeTask = defineTool({
  name: "complete_task",
  description: "Mark a session task as completed",
  capability: "operations",
  schema: z.object({
    task_id: z.string().uuid().describe("The task ID to mark as completed"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    const { data, error } = await supabase
      .from("session_task")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", params.task_id)
      .eq("assigned_to", ctx.profileId)
      .select("id, title, status")
      .single();

    if (error) return `Error completing task: ${error.message}`;
    if (!data) return "Task not found or not assigned to you.";

    // Emit via registry (ADR-0156 Gate 3 + L-0064 fix: route through `emit()`
    // so the event fans out to PostHog + logger + activity_trail + engine_event,
    // matching the Server Action's behaviour. Prior direct engine_event insert
    // produced non-equivalent audit trails for agent-completed vs human-
    // completed tasks. Event name aligned with registry: "session_task completed".
    await emit({
      event: "session_task completed",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: {
          entity_type: "session_task",
          entity_id: params.task_id,
          entity_label: data.title,
        },
        data: {
          task_id: params.task_id,
          profile_id: ctx.profileId,
        },
      },
    });

    return JSON.stringify({ completed: true, task: data });
  },
});
