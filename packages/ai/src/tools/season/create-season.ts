// packages/ai/src/tools/season/create-season.ts
// Tool: createSeason — Stage: seed
// Creates a new season with a draft budget and default day/hour factors.
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@smartout/supabase";
import { defineTool } from "../../types";
import { gatedMutation } from "../../gate/gatedMutation";
import type { SeasonToolContext } from "./types";

/**
 * create_season — wires four related inserts through `gatedMutation()`:
 *   1. `season`         (root — Pathway A + B both evaluate)
 *   2. `season_budget`  (1:1 child — gated so change_proposal catches
 *                        workspaces that restrict budget authoring)
 *   3. `day_factor` x 7 (default row batch)
 *   4. `hour_factor` x 24 (default row batch)
 *
 * SS-5 (ADR-0204): Each step calls the orchestrator, failing fast if any
 * step is denied. On proposal, the partial state (season only) is left in
 * place for the admin flow to resume — matches how
 * `apps/web/src/app/dashboard/setup/_actions/season-actions.ts` handles
 * the same table today.
 *
 * This tool is currently not wired to a runtime agent (`SEASON_TOOLS` is
 * exported but not consumed by any BFF route or runner as of SS-5).
 * `ctx.profileId` is therefore optional on `SeasonToolContext` — but if a
 * future caller omits it, each `gatedMutation()` call fails closed with a
 * clear reason rather than silently bypassing the gate.
 */
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

    if (end <= start) {
      return "Sluttdato må være etter startdato.";
    }

    if (!ctx.profileId) {
      return "Cannot create season: missing actor profile id. Upstream caller must supply ctx.profileId before gate evaluation.";
    }

    const actorId = ctx.profileId;
    const channel = ctx.channel ?? "system";
    const db = ctx.supabase as unknown as SupabaseClient;

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

    // ── 1. Season ───────────────────────────────────────────────────
    const seasonProposed = {
      name,
      slug,
      season_type: seasonType as "default" | "calendar" | "focus" | "cycle" | "custom",
      start_date: startDate,
      end_date: endDate,
      status: "draft",
      workspace_id: ctx.workspaceId,
      description: `${type} season: ${name}`,
    };

    let seasonId: string | null = null;

    const seasonResult = await gatedMutation(db, {
      workspace_id: ctx.workspaceId,
      actor_profile_id: actorId,
      capability: "season",
      channel,
      action_type: "create",
      entity_id: null,
      entity_type: "season",
      action: "create",
      proposed_data: seasonProposed as unknown as Json,
      current_data: null,
      execute: async (client) => {
        /* eslint-disable-next-line smartout/no-direct-supabase-write --
           Domain write inside gatedMutation().execute callback (ADR-0204 §3). */
        const { data, error } = await client
          .from("season")
          .insert(seasonProposed)
          .select("season_id")
          .single();
        if (error) return { ok: false, reason: error.message };
        seasonId = (data as { season_id: string }).season_id;
        return { ok: true };
      },
    });

    if (!seasonResult.ok) {
      return `Failed to create season: ${seasonResult.reason}. Check if a season with this name already exists.`;
    }

    if (seasonResult.proposal_id) {
      return `Season '${name}' is queued for approval (proposal ${seasonResult.proposal_id}).`;
    }

    if (!seasonId) {
      return "Failed to create season: gate allowed write but no season_id returned.";
    }

    // ── 2. Season budget ────────────────────────────────────────────
    const budgetProposed = {
      season_id: seasonId,
      workspace_id: ctx.workspaceId,
      status: "draft",
      total_target_revenue: 0,
      target_labor_percentage: 30,
    };

    let budgetId: string | null = null;

    const budgetResult = await gatedMutation(db, {
      workspace_id: ctx.workspaceId,
      actor_profile_id: actorId,
      capability: "season",
      channel,
      action_type: "create",
      entity_id: null,
      entity_type: "season_budget",
      action: "create",
      proposed_data: budgetProposed as unknown as Json,
      current_data: null,
      execute: async (client) => {
        /* eslint-disable-next-line smartout/no-direct-supabase-write --
           Domain write inside gatedMutation().execute callback (ADR-0204 §3). */
        const { data, error } = await client
          .from("season_budget")
          .insert(budgetProposed)
          .select("season_budget_id")
          .single();
        if (error) return { ok: false, reason: error.message };
        budgetId = (data as { season_budget_id: string }).season_budget_id;
        return { ok: true };
      },
    });

    if (!budgetResult.ok) {
      return `Season created but budget setup failed: ${budgetResult.reason}. Season ID: ${seasonId}`;
    }

    if (budgetResult.proposal_id) {
      return `Season '${name}' created, budget queued for approval (proposal ${budgetResult.proposal_id}).`;
    }

    // ── 3. Default day factors (7 rows) ─────────────────────────────
    if (budgetId) {
      const dayFactorRows = Array.from({ length: 7 }, (_, i) => ({
        season_budget_id: budgetId,
        workspace_id: ctx.workspaceId,
        weekday: i,
        factor: 1.0,
      }));

      const dayResult = await gatedMutation(db, {
        workspace_id: ctx.workspaceId,
        actor_profile_id: actorId,
        capability: "season",
        channel,
        action_type: "create",
        entity_id: null,
        entity_type: "day_factor",
        action: "create",
        proposed_data: dayFactorRows as unknown as Json,
        current_data: null,
        execute: async (client) => {
          /* eslint-disable-next-line smartout/no-direct-supabase-write --
             Domain write inside gatedMutation().execute callback (ADR-0204 §3). */
          const { error } = await client.from("day_factor").insert(dayFactorRows);
          if (error) return { ok: false, reason: error.message };
          return { ok: true };
        },
      });

      if (!dayResult.ok) {
        return `Season created but day_factor seeding failed: ${dayResult.reason}. Season ID: ${seasonId}`;
      }

      // ── 4. Default hour factors (24 rows) ─────────────────────────
      const hourFactorRows = Array.from({ length: 24 }, (_, i) => ({
        season_budget_id: budgetId,
        workspace_id: ctx.workspaceId,
        hour: i,
        factor: 1.0,
      }));

      const hourResult = await gatedMutation(db, {
        workspace_id: ctx.workspaceId,
        actor_profile_id: actorId,
        capability: "season",
        channel,
        action_type: "create",
        entity_id: null,
        entity_type: "hour_factor",
        action: "create",
        proposed_data: hourFactorRows as unknown as Json,
        current_data: null,
        execute: async (client) => {
          /* eslint-disable-next-line smartout/no-direct-supabase-write --
             Domain write inside gatedMutation().execute callback (ADR-0204 §3). */
          const { error } = await client.from("hour_factor").insert(hourFactorRows);
          if (error) return { ok: false, reason: error.message };
          return { ok: true };
        },
      });

      if (!hourResult.ok) {
        return `Season created but hour_factor seeding failed: ${hourResult.reason}. Season ID: ${seasonId}`;
      }
    }

    return [
      `Season '${name}' created successfully.`,
      `Type: ${type}, Period: ${startDate} to ${endDate} (${weeks} weeks).`,
      `Draft budget initialized with 30% default labor percentage.`,
      `Default day and hour factors set to 1.0 (ready for customization).`,
      `Season ID: ${seasonId}`,
    ].join("\n");
  },
});
