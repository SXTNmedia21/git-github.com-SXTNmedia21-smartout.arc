// packages/ai/src/tools/season/create-season.ts
// Tool: createSeason — Capability: season.create (ADR-0201)
// Creates a new season with a draft budget and default day/hour factors.
//
// Migration 2026-04-23 (M3.2):
//   - SeasonToolContext → AgentToolContext (ADR-0191 single auth-passing pattern)
//   - ctx.supabase → ctx.supabaseAdmin (RLS bypass safe — explicit workspace_id filter)
//   - Adds callGateAction before first .insert() per ADR-0099 / ADR-0196 Invariant 13
import { z } from "zod";
import { defineTool } from "../../types";
import type { AgentToolContext, SessionChannel } from "../../capabilities/types";
import { callGateAction } from "../../capabilities/season/gate";

const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "system";

export const createSeason = defineTool({
  name: "season.create",
  description:
    "Create a new season with name, type, and date range. Sets up a draft budget and loads default day/hour factors for the industry.",
  capability: "season.create",
  schema: z.object({
    type: z.string().describe("Season type (e.g., 'summer', 'winter', 'christmas', 'custom')"),
    name: z.string().describe("Human-readable season name"),
    startDate: z.string().describe("Season start date in ISO format (YYYY-MM-DD)"),
    endDate: z.string().describe("Season end date in ISO format (YYYY-MM-DD)"),
  }),
  execute: async ({ type, name, startDate, endDate }, ctx: AgentToolContext) => {
    // ADR-0134 guard — workspace_id + profile_id must resolve non-empty
    // before any DB write. L-0066 / L-0097.
    if (!ctx.workspaceId || !ctx.profileId) {
      return JSON.stringify({
        ok: false,
        error: "missing_context",
        message: "season.create requires resolved workspaceId + profileId (ADR-0134).",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      return "Sluttdato må være etter startdato.";
    }

    const diffMs = end.getTime() - start.getTime();
    const weeks = Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 7));

    // ADR-0099 / ADR-0196 Invariant 13: mandatory C4 gate before first mutation.
    // `suggest` default is not a skip-the-gate license. Fail CLOSED on RPC error.
    const gate = await callGateAction(ctx.supabaseAdmin, ctx.workspaceId, ctx.profileId, {
      capability: "season.create",
      channel: normaliseChannel(ctx.channel),
      actionType: "create",
    });

    if (!gate.allow) {
      return JSON.stringify({
        ok: false,
        error: "gate_denied",
        reason: gate.reason ?? "denied",
      });
    }

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
    const { data: season, error: seasonError } = await ctx.supabaseAdmin
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
    const { data: budget, error: budgetError } = await ctx.supabaseAdmin
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

      await ctx.supabaseAdmin.from("day_factor").insert(dayFactorRows);

      // Create default hour factors (hours 0-23, all factor 1.0)
      const hourFactorRows = Array.from({ length: 24 }, (_, i) => ({
        season_budget_id: budget.season_budget_id,
        workspace_id: ctx.workspaceId,
        hour: i,
        factor: 1.0,
      }));

      await ctx.supabaseAdmin.from("hour_factor").insert(hourFactorRows);
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
