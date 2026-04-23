// packages/ai/src/tools/season/set-revenue.ts
// Tool: setRevenue — Stage: revenue
// Sets revenue target and labor percentage for the season budget.
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@smartout/supabase";
import { defineTool } from "../../types";
import { gatedMutation } from "../../gate/gatedMutation";
import type { SeasonToolContext } from "./types";

/**
 * set_revenue — updates the most recent draft season's budget. SS-5
 * (ADR-0204): UPDATE routed through `gatedMutation()`. Pathway B receives
 * the existing budget row as `current_data` so framework-rule diffs can
 * compare old vs new revenue targets (e.g. a workspace may require
 * four-eyes on any >20% revenue-target change via `season` capability's
 * `requires_four_eyes` flag once seeded).
 */
export const setRevenue = defineTool({
  name: "set_revenue",
  description:
    "Set the total revenue target and labor cost percentage for the season. Calculates daily averages and weekday distribution hints.",
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

    if (!ctx.profileId) {
      return "Cannot set revenue: missing actor profile id. Upstream caller must supply ctx.profileId before gate evaluation.";
    }

    // Load the current budget row so Pathway B can diff old → new.
    const { data: currentBudget } = await ctx.supabase
      .from("season_budget")
      .select("season_budget_id, total_target_revenue, target_labor_percentage, status")
      .eq("season_id", season.season_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();

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

    const proposed = {
      total_target_revenue: totalRevenue,
      target_labor_percentage: laborPercentage,
      updated_at: new Date().toISOString(),
    };

    const result = await gatedMutation(ctx.supabase as unknown as SupabaseClient, {
      workspace_id: ctx.workspaceId,
      actor_profile_id: ctx.profileId,
      capability: "season",
      channel: ctx.channel ?? "system",
      action_type: "set_revenue",
      entity_id: currentBudget?.season_budget_id ?? season.season_id,
      entity_type: "season_budget",
      action: "update",
      proposed_data: proposed as unknown as Json,
      current_data: (currentBudget ?? null) as unknown as Json,
      execute: async (client) => {
        /* eslint-disable-next-line smartout/no-direct-supabase-write --
           Domain write inside gatedMutation().execute callback (ADR-0204 §3). */
        const { error } = await client
          .from("season_budget")
          .update(proposed)
          .eq("season_id", season.season_id)
          .eq("workspace_id", ctx.workspaceId);
        if (error) return { ok: false, reason: error.message };
        return { ok: true };
      },
    });

    if (!result.ok) {
      return `Failed to update budget: ${result.reason}`;
    }

    if (result.proposal_id) {
      return `Revenue target for '${season.name}' queued for approval (proposal ${result.proposal_id}).`;
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
