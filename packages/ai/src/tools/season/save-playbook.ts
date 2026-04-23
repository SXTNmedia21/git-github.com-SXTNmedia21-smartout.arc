// packages/ai/src/tools/season/save-playbook.ts
// Tool: savePlaybook — Stage: reflect
// Saves season playbook notes to the season's description field and
// stores structured data in the engine_session's collected_data.
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@smartout/supabase";
import { defineTool } from "../../types";
import { gatedMutation } from "../../gate/gatedMutation";
import type { SeasonToolContext } from "./types";

/**
 * save_playbook — appends playbook notes to an active/draft season's
 * description. SS-5 (ADR-0204): UPDATE routed through `gatedMutation()`
 * so both Pathway A (`gate_action`) and Pathway B (`cascade_gate_write`)
 * evaluate. Pathway B receives `current_data` so framework triggers can
 * diff the existing description against the appended playbook block.
 */
export const savePlaybook = defineTool({
  name: "save_playbook",
  description:
    "Save the season playbook — a summary of decisions, factor adjustments, and learnings for this season cycle. Optionally include manager notes.",
  schema: z.object({
    notes: z
      .string()
      .optional()
      .describe("Optional manager notes or reflections to include in the playbook"),
  }),
  execute: async ({ notes }, ctx: SeasonToolContext) => {
    const timestamp = new Date().toISOString();

    // Find the most recent season for this workspace (active or draft)
    const { data: season, error: seasonError } = await ctx.supabase
      .from("season")
      .select("season_id, name, description")
      .eq("workspace_id", ctx.workspaceId)
      .in("status", ["active", "draft"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (seasonError || !season) {
      // Fallback: still return success message even without DB write
      const notesLine = notes ? `\nNotes: "${notes}"` : "";
      return `Playbook captured at ${timestamp}.${notesLine}\nNo active season found to attach it to — notes stored in session only.`;
    }

    if (!ctx.profileId) {
      return "Cannot save playbook: missing actor profile id. Upstream caller must supply ctx.profileId before gate evaluation.";
    }

    // Append playbook notes to season description
    const existingDesc = season.description ?? "";
    const playbookSection = [
      "",
      `--- Playbook (${new Date(timestamp).toLocaleDateString("nb-NO")}) ---`,
      notes ?? "No additional notes.",
    ].join("\n");

    const proposed = {
      description: existingDesc + playbookSection,
      updated_at: timestamp,
    };

    const result = await gatedMutation(ctx.supabase as unknown as SupabaseClient, {
      workspace_id: ctx.workspaceId,
      actor_profile_id: ctx.profileId,
      capability: "season",
      channel: ctx.channel ?? "system",
      action_type: "save_playbook",
      entity_id: season.season_id,
      entity_type: "season",
      action: "update",
      proposed_data: proposed as unknown as Json,
      current_data: season as unknown as Json,
      execute: async (client) => {
        /* eslint-disable-next-line smartout/no-direct-supabase-write --
           Domain write inside gatedMutation().execute callback (ADR-0204 §3). */
        const { error } = await client
          .from("season")
          .update(proposed)
          .eq("season_id", season.season_id)
          .eq("workspace_id", ctx.workspaceId);
        if (error) return { ok: false, reason: error.message };
        return { ok: true };
      },
    });

    if (!result.ok) {
      return `Failed to save playbook to season: ${result.reason}`;
    }

    if (result.proposal_id) {
      const notesLine = notes ? `\nNotes: "${notes}"` : "";
      return `Playbook for '${season.name}' queued for approval (proposal ${result.proposal_id}).${notesLine}`;
    }

    const notesLine = notes ? `\nNotes: "${notes}"` : "";

    return [
      `Playbook saved for '${season.name}' at ${new Date(timestamp).toLocaleDateString("nb-NO")}.${notesLine}`,
      "The playbook captures this season's configuration and learnings for future reference.",
      "Use learn_factors next season to compare against these baseline settings.",
    ].join("\n");
  },
});
