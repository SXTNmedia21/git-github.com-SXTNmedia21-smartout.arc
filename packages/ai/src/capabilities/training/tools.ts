// packages/ai/src/capabilities/training/tools.ts
import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

export const getMyTrainingStatus = defineTool({
  name: "get_my_training_status",
  description:
    "Get the training status for the current employee. Returns total, completed, pending, and expired protocol assignments with overall readiness percentage.",
  capability: "training",
  schema: z.object({}),
  execute: async (_params, ctx: AgentToolContext) => {
    const { data, error } = await ctx.supabaseAdmin
      .from("protocol_assignment")
      .select("assignment_id, status, protocol:protocol_id(name)")
      .eq("profile_id", ctx.profileId)
      .eq("workspace_id", ctx.workspaceId);

    if (error) return `Failed to fetch training status: ${error.message}`;
    if (!data || data.length === 0) return "You have no protocol assignments yet.";

    const total = data.length;
    const completed = data.filter((a) => a.status === "completed").length;
    const notStarted = data.filter((a) => a.status === "not_started").length;
    const inProgress = data.filter((a) => a.status === "in_progress").length;
    const expired = data.filter((a) => a.status === "expired").length;
    const readinessPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return [
      `Training Status:`,
      `- Total protocols: ${total}`,
      `- Completed: ${completed}`,
      `- Not started: ${notStarted}`,
      `- In progress: ${inProgress}`,
      `- Expired: ${expired}`,
      `- Readiness: ${readinessPercent}%`,
    ].join("\n");
  },
});

export const getNextProtocol = defineTool({
  name: "get_next_protocol",
  description:
    "Get the next recommended protocol for the employee to work on. Returns the most recently assigned incomplete protocol.",
  capability: "training",
  schema: z.object({}),
  execute: async (_params, ctx: AgentToolContext) => {
    const { data, error } = await ctx.supabaseAdmin
      .from("protocol_assignment")
      .select("assignment_id, status, assigned_at, protocol:protocol_id(name, description)")
      .eq("profile_id", ctx.profileId)
      .eq("workspace_id", ctx.workspaceId)
      .in("status", ["not_started", "in_progress"])
      .order("assigned_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) return `Failed to fetch next protocol: ${error.message}`;
    if (!data) return "All protocols completed! You are at 100% readiness.";

    const proto = data.protocol as unknown as { name: string; description: string | null };
    return [
      `Next protocol to complete:`,
      `- Name: ${proto.name}`,
      proto.description ? `- Description: ${proto.description}` : null,
      `- Status: ${data.status}`,
      `- Assigned: ${new Date(data.assigned_at).toISOString().slice(0, 10)}`,
    ]
      .filter(Boolean)
      .join("\n");
  },
});

export const getTeamReadiness = defineTool({
  name: "get_team_readiness",
  description:
    "Get the training readiness overview for the workspace. Shows per-employee readiness percentages. Requires manager or admin role.",
  capability: "training",
  schema: z.object({
    departmentId: z.string().uuid().optional().describe("Filter by department ID"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // Fetch readiness using the RPC function
    const { data, error } = await ctx.supabaseAdmin.rpc("get_workspace_readiness", {
      p_workspace_id: ctx.workspaceId,
    });

    if (error) return `Failed to fetch team readiness: ${error.message}`;
    if (!data || data.length === 0) return "No employees with protocol assignments found.";

    // Fetch profile names
    const profileIds = data.map((r: { profile_id: string }) => r.profile_id);
    const { data: profiles } = await ctx.supabaseAdmin
      .from("profile")
      .select("profile_id, display_name, department_id")
      .in("profile_id", profileIds)
      .eq("workspace_id", ctx.workspaceId);

    const profileMap = new Map(
      (profiles ?? []).map((p) => [
        p.profile_id,
        { name: p.display_name, departmentId: p.department_id },
      ]),
    );

    let rows = data as Array<{ profile_id: string; total: number; completed: number }>;

    // Filter by department if requested
    if (params.departmentId) {
      rows = rows.filter((r) => profileMap.get(r.profile_id)?.departmentId === params.departmentId);
    }

    if (rows.length === 0) return "No employees match the filter.";

    const lines = rows.map((r) => {
      const name = profileMap.get(r.profile_id)?.name ?? "Unknown";
      const pct = r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0;
      return `- ${name}: ${pct}% (${r.completed}/${r.total})`;
    });

    const totalCompleted = rows.reduce((s, r) => s + r.completed, 0);
    const totalAssignments = rows.reduce((s, r) => s + r.total, 0);
    const overallPct =
      totalAssignments > 0 ? Math.round((totalCompleted / totalAssignments) * 100) : 0;

    return [
      `Team Readiness (${rows.length} employees):`,
      ...lines,
      ``,
      `Overall: ${overallPct}%`,
    ].join("\n");
  },
});
