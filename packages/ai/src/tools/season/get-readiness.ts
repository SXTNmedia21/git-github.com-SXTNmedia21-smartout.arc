// packages/ai/src/tools/season/get-readiness.ts
// Tool: getReadiness — Stage: ready
// Returns workforce readiness report by querying protocol_assignment via profile.
import { z } from "zod";
import { defineTool } from "../../types";
import type { SeasonToolContext } from "./types";

export const getReadiness = defineTool({
  name: "get_readiness",
  description:
    "Get the workforce readiness report for the current season. Shows how many employees have completed required protocols and policies.",
  schema: z.object({}),
  execute: async (_params, ctx: SeasonToolContext) => {
    // Count active profiles in workspace
    const { count: totalProfiles, error: profileError } = await ctx.supabase
      .from("profile")
      .select("profile_id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId)
      .eq("is_active", true);

    if (profileError) {
      return `Failed to load profiles: ${profileError.message}`;
    }

    const total = totalProfiles ?? 0;

    // Query protocol_assignment completion stats
    // protocol_assignment doesn't have workspace_id directly — join through profile
    const { data: assignments, error: assignError } = await ctx.supabase
      .from("protocol_assignment")
      .select("status, profile!inner(workspace_id)")
      .eq("profile.workspace_id", ctx.workspaceId);

    if (assignError) {
      return [
        `Readiness Report for ${total} active employees:`,
        `- Protocol data unavailable: ${assignError.message}`,
        "",
        "Note: Protocol assignment query failed. Check table structure.",
      ].join("\n");
    }

    const totalAssignments = assignments?.length ?? 0;
    // Enum: pending | completed | expired
    const completed = assignments?.filter((a) => a.status === "completed").length ?? 0;
    const pending = assignments?.filter((a) => a.status === "pending").length ?? 0;
    const expired = assignments?.filter((a) => a.status === "expired").length ?? 0;
    const readinessPercent =
      totalAssignments > 0 ? Math.round((completed / totalAssignments) * 100) : 0;

    return [
      `Readiness Report:`,
      `- Active employees: ${total}`,
      `- Protocol assignments: ${totalAssignments}`,
      `  - Completed: ${completed}`,
      `  - Pending: ${pending}`,
      `  - Expired: ${expired}`,
      `- Overall readiness: ${readinessPercent}%`,
      "",
      readinessPercent >= 90
        ? "Status: Team is well-prepared for the season."
        : readinessPercent >= 70
          ? "Status: Good progress, but some protocols still need completion."
          : "Status: Significant training gaps remain. Consider prioritizing protocol completion before season start.",
    ].join("\n");
  },
});
