// packages/ai/src/tools/season/get-readiness.ts
// Tool: getReadiness — Capability: season.get_readiness (ADR-0201)
// Returns workforce readiness report by querying protocol_assignment via profile.
//
// Migration 2026-04-23 (M3.2):
//   - SeasonToolContext → AgentToolContext (ADR-0191)
//   - ctx.supabase → ctx.supabaseAdmin (explicit workspace_id filter preserved)
//   - No callGateAction — ADR-0196 Invariant 13 scopes gate enforcement to
//     DB-writing capabilities. Read-only precedent: schedule + helpdesk_query
//     skip the gate for .select() paths. ADR-0201 §D4.
import { z } from "zod";
import { defineTool } from "../../types";
import type { AgentToolContext } from "../../capabilities/types";

export const getReadiness = defineTool({
  name: "season.get_readiness",
  description:
    "Get the workforce readiness report for the current season. Shows how many employees have completed required protocols and policies.",
  capability: "season.get_readiness",
  schema: z.object({}),
  execute: async (_params, ctx: AgentToolContext) => {
    // ADR-0134 guard — workspace_id + profile_id must resolve non-empty.
    if (!ctx.workspaceId || !ctx.profileId) {
      return JSON.stringify({
        ok: false,
        error: "missing_context",
        message: "season.get_readiness requires resolved workspaceId + profileId (ADR-0134).",
      });
    }

    // Count active profiles in workspace
    const { count: totalProfiles, error: profileError } = await ctx.supabaseAdmin
      .from("profile")
      .select("profile_id", { count: "exact", head: true })
      .eq("workspace_id", ctx.workspaceId)
      .eq("is_active", true);

    if (profileError) {
      return `Failed to load profiles: ${profileError.message}`;
    }

    const total = totalProfiles ?? 0;

    // Query protocol_assignment completion stats using count queries (no row transfer)
    // protocol_assignment doesn't have workspace_id directly — join through profile
    const [pendingResult, completedResult, expiredResult] = await Promise.all([
      ctx.supabaseAdmin
        .from("protocol_assignment")
        .select("*, profile!inner(workspace_id)", { count: "exact", head: true })
        .eq("profile.workspace_id", ctx.workspaceId)
        .eq("status", "pending"),
      ctx.supabaseAdmin
        .from("protocol_assignment")
        .select("*, profile!inner(workspace_id)", { count: "exact", head: true })
        .eq("profile.workspace_id", ctx.workspaceId)
        .eq("status", "completed"),
      ctx.supabaseAdmin
        .from("protocol_assignment")
        .select("*, profile!inner(workspace_id)", { count: "exact", head: true })
        .eq("profile.workspace_id", ctx.workspaceId)
        .eq("status", "expired"),
    ]);

    const assignError = pendingResult.error ?? completedResult.error ?? expiredResult.error;
    if (assignError) {
      return [
        `Readiness Report for ${total} active employees:`,
        `- Protocol data unavailable: ${assignError.message}`,
        "",
        "Note: Protocol assignment query failed. Check table structure.",
      ].join("\n");
    }

    const pending = pendingResult.count ?? 0;
    const completed = completedResult.count ?? 0;
    const expired = expiredResult.count ?? 0;
    const totalAssignments = pending + completed + expired;
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
