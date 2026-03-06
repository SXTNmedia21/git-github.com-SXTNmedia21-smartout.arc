// packages/ai/src/tools/season/create-season.ts
// Tool: createSeason — Stage: seed
// Creates a new season with a draft budget and default day/hour factors.
import { z } from "zod";
import { defineTool } from "../../types";
import type { SeasonToolContext } from "./types";

export const createSeason = defineTool({
  name: "create_season",
  description:
    "Create a new season with name, type, and date range. Sets up a draft budget and loads default day/hour factors for the industry.",
  schema: z.object({
    type: z.string().describe("Season type (e.g., 'summer', 'winter', 'christmas', 'custom')"),
    name: z.string().describe("Human-readable season name"),
    startDate: z.string().describe("Season start date in ISO format (YYYY-MM-DD)"),
    endDate: z.string().describe("Season end date in ISO format (YYYY-MM-DD)"),
  }),
  execute: async ({ type, name, startDate, endDate }, ctx: SeasonToolContext) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    const weeks = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7));

    // Map user-friendly type to season_type enum
    const seasonTypeMap: Record<string, string> = {
      summer: "calendar",
      winter: "calendar",
      christmas: "calendar",
      spring: "calendar",
      fall: "calendar",
      custom: "custom",
      focus: "focus",
      cycle: "cycle",
    };
    const seasonType = seasonTypeMap[type.toLowerCase()] ?? "custom";

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Insert season
    const { data: season, error: seasonError } = await ctx.supabase
      .from("season")
      .insert({
        name,
        slug,
        season_type: seasonType as "default" | "calendar" | "focus" | "cycle" | "custom",
        start_date: startDate,
        end_date: endDate,
        status: "draft",
        workspace_id: ctx.workspaceId,
        description: `${type} season: ${name}`,
      })
      .select("season_id")
      .single();

    if (seasonError || !season) {
      return `Failed to create season: ${seasonError?.message ?? "unknown error"}. Check if a season with this name already exists.`;
    }

    // Create draft budget (1:1 with season)
    const { data: budget, error: budgetError } = await ctx.supabase
      .from("season_budget")
      .insert({
        season_id: season.season_id,
        workspace_id: ctx.workspaceId,
        status: "draft",
        total_target_revenue: 0,
        target_labor_percentage: 30,
      })
      .select("season_budget_id")
      .single();

    if (budgetError) {
      return `Season created but budget setup failed: ${budgetError.message}. Season ID: ${season.season_id}`;
    }

    // Create default day factors (weekdays 0-6, all factor 1.0)
    if (budget) {
      const dayFactorRows = Array.from({ length: 7 }, (_, i) => ({
        season_budget_id: budget.season_budget_id,
        workspace_id: ctx.workspaceId,
        weekday: i,
        factor: 1.0,
      }));

      await ctx.supabase.from("day_factor").insert(dayFactorRows);

      // Create default hour factors (hours 0-23, all factor 1.0)
      const hourFactorRows = Array.from({ length: 24 }, (_, i) => ({
        season_budget_id: budget.season_budget_id,
        workspace_id: ctx.workspaceId,
        hour: i,
        factor: 1.0,
      }));

      await ctx.supabase.from("hour_factor").insert(hourFactorRows);
    }

    return [
      `Season '${name}' created successfully.`,
      `Type: ${type}, Period: ${startDate} to ${endDate} (${weeks} weeks).`,
      `Draft budget initialized with 30% default labor percentage.`,
      `Default day and hour factors set to 1.0 (ready for customization).`,
      `Season ID: ${season.season_id}`,
    ].join("\n");
  },
});
