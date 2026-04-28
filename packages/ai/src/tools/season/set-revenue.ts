// packages/ai/src/tools/season/set-revenue.ts
// Tool: setRevenue — Capability: season.set_revenue (ADR-0201)
// Sets revenue target and labor percentage for the season budget.
//
// Migration 2026-04-23 (M3.2):
//   - SeasonToolContext → AgentToolContext (ADR-0191)
//   - ctx.supabase → ctx.supabaseAdmin (explicit workspace_id filter in all queries)
//   - Adds callGateAction before first .update() per ADR-0099 / ADR-0196 Invariant 13
import { z } from "zod";
import { defineTool } from "../../types";
import type { AgentToolContext, SessionChannel } from "../../capabilities/types";
import { callGateAction } from "../../capabilities/season/gate";

const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "system";

export const setRevenue = defineTool({
  name: "season.set_revenue",
  description:
    "Set the total revenue target and labor cost percentage for the season. Calculates daily averages and weekday distribution hints.",
  capability: "season.set_revenue",
  schema: z.object({
    totalRevenue: z
      .number()
      .positive("Revenue must be positive")
      .describe("Total revenue target for the season in NOK"),
    laborPercentage: z
      .number()
      .optional()
      .default(30)
      .describe("Labor cost as percentage of revenue (default: 30)"),
  }),
  execute: async ({ totalRevenue, laborPercentage }, ctx: AgentToolContext) => {
    // ADR-0134 guard — workspace_id + profile_id must resolve non-empty
    // before any DB write.
    if (!ctx.workspaceId || !ctx.profileId) {
      return JSON.stringify({
        ok: false,
        error: "missing_context",
        message: "season.set_revenue requires resolved workspaceId + profileId (ADR-0134).",
      });
    }

    // Find the most recent draft season for this workspace
    const { data: season, error: seasonError } = await ctx.supabaseAdmin
      .from("season")
      .select("season_id, name, start_date, end_date")
      .eq("workspace_id", ctx.workspaceId)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (seasonError || !season) {
      return "No draft season found. Create a season first using create_season.";
    }

    // Calculate actual days in the season
    const startDate = season.start_date ? new Date(season.start_date) : null;
    const endDate = season.end_date ? new Date(season.end_date) : null;
    const seasonDays =
      startDate && endDate
        ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        : 90;

    const laborBudget = totalRevenue * (laborPercentage / 100);
    const dailyAvgRevenue = Math.round(totalRevenue / seasonDays);
    const dailyAvgLabor = Math.round(laborBudget / seasonDays);

    // ADR-0099 / ADR-0196 Invariant 13: mandatory C4 gate before mutation.
    const gate = await callGateAction(ctx.supabaseAdmin, ctx.workspaceId, ctx.profileId, {
      capability: "season.set_revenue",
      channel: normaliseChannel(ctx.channel),
      actionType: "set_revenue",
      entityId: season.season_id,
    });

    if (!gate.allow) {
      return JSON.stringify({
        ok: false,
        error: "gate_denied",
        reason: gate.reason ?? "denied",
      });
    }

    // Update the season_budget
    const { error: updateError } = await ctx.supabaseAdmin
      .from("season_budget")
      .update({
        total_target_revenue: totalRevenue,
        target_labor_percentage: laborPercentage,
        updated_at: new Date().toISOString(),
      })
      .eq("season_id", season.season_id)
      .eq("workspace_id", ctx.workspaceId);

    if (updateError) {
      return `Failed to update budget: ${updateError.message}`;
    }

    return [
      `Revenue target set for '${season.name}': ${totalRevenue.toLocaleString("nb-NO")} NOK total.`,
      `Labor budget: ${laborPercentage}% = ${laborBudget.toLocaleString("nb-NO")} NOK.`,
      `Season length: ${seasonDays} days.`,
      `Daily averages: ${dailyAvgRevenue.toLocaleString("nb-NO")} NOK revenue, ${dailyAvgLabor.toLocaleString("nb-NO")} NOK labor.`,
      `Tip: Weekday factors (Fri/Sat typically 1.3-1.5x) will refine daily targets.`,
    ].join("\n");
  },
});
