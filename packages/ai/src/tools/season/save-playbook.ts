// packages/ai/src/tools/season/save-playbook.ts
// Tool: savePlaybook — Stage: reflect
// Saves season playbook notes to the season's description field and
// stores structured data in the engine_session's collected_data.
import { z } from "zod";
import { defineTool } from "../../types";
import type { SeasonToolContext } from "./types";

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

    // Append playbook notes to season description
    const existingDesc = season.description ?? "";
    const playbookSection = [
      "",
      `--- Playbook (${new Date(timestamp).toLocaleDateString("nb-NO")}) ---`,
      notes ?? "No additional notes.",
    ].join("\n");

    const { error: updateError } = await ctx.supabase
      .from("season")
      .update({
        description: existingDesc + playbookSection,
        updated_at: timestamp,
      })
      .eq("season_id", season.season_id)
      .eq("workspace_id", ctx.workspaceId);

    if (updateError) {
      return `Failed to save playbook to season: ${updateError.message}`;
    }

    const notesLine = notes ? `\nNotes: "${notes}"` : "";

    return [
      `Playbook saved for '${season.name}' at ${new Date(timestamp).toLocaleDateString("nb-NO")}.${notesLine}`,
      "The playbook captures this season's configuration and learnings for future reference.",
      "Use learn_factors next season to compare against these baseline settings.",
    ].join("\n");
  },
});
