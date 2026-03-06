// packages/ai/src/tools/season/set-revenue.ts
// Tool: setRevenue — Stage: revenue
// Sets revenue target and labor percentage for the season budget.
import { z } from "zod";
import { defineTool } from "../../types";
import type { SeasonToolContext } from "./types";

export const setRevenue = defineTool({
  name: "set_revenue",
  description:
    "Set the total revenue target and labor cost percentage for the season. Calculates daily averages and weekday distribution hints.",
  schema: z.object({
    totalRevenue: z.number().describe("Total revenue target for the season in NOK"),
    laborPercentage: z
      .number()
      .optional()
      .default(30)
      .describe("Labor cost as percentage of revenue (default: 30)"),
  }),
  execute: async ({ totalRevenue, laborPercentage }, ctx: SeasonToolContext) => {
    // Find the most recent draft season for this workspace
    const { data: season, error: seasonError } = await ctx.supabase
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

    // Update the season_budget
    const { error: updateError } = await ctx.supabase
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
