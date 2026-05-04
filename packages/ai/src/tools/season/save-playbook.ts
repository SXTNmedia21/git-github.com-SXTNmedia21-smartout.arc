// packages/ai/src/tools/season/save-playbook.ts
// Tool: savePlaybook — Capability: season.save_playbook (ADR-0201)
// Saves season playbook notes to the season's description field.
//
// Migration 2026-04-23 (M3.2):
//   - SeasonToolContext → AgentToolContext (ADR-0191)
//   - ctx.supabase → ctx.supabaseAdmin
//   - Adds callGateAction before first .update() per ADR-0099 / ADR-0196 Invariant 13
import { z } from "zod";
import { defineTool } from "../../types";
import type { AgentToolContext, SessionChannel } from "../../capabilities/types";
import { callGateAction } from "../../capabilities/season/gate";

const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "system";

export const savePlaybook = defineTool({
  name: "season.save_playbook",
  description:
    "Save the season playbook — a summary of decisions, factor adjustments, and learnings for this season cycle. Optionally include manager notes.",
  capability: "season.save_playbook",
  schema: z.object({
    notes: z
      .string()
      .optional()
      .describe("Optional manager notes or reflections to include in the playbook"),
  }),
  execute: async ({ notes }, ctx: AgentToolContext) => {
    // ADR-0134 guard — workspace_id + profile_id must resolve non-empty.
    if (!ctx.workspaceId || !ctx.profileId) {
      return JSON.stringify({
        ok: false,
        error: "missing_context",
        message: "season.save_playbook requires resolved workspaceId + profileId (ADR-0134).",
      });
    }

    const timestamp = new Date().toISOString();

    // Find the most recent season for this workspace (active or draft)
    const { data: season, error: seasonError } = await ctx.supabaseAdmin
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

    // ADR-0099 / ADR-0196 Invariant 13: mandatory C4 gate before mutation.
    const gate = await callGateAction(ctx.supabaseAdmin, ctx.workspaceId, ctx.profileId, {
      capability: "season.save_playbook",
      channel: normaliseChannel(ctx.channel),
      actionType: "save_playbook",
      entityId: season.season_id,
    });

    if (!gate.allow) {
      return JSON.stringify({
        ok: false,
        error: "gate_denied",
        reason: gate.reason ?? "denied",
      });
    }

    // Append playbook notes to season description
    const existingDesc = season.description ?? "";
    const playbookSection = [
      "",
      `--- Playbook (${new Date(timestamp).toLocaleDateString("nb-NO")}) ---`,
      notes ?? "No additional notes.",
    ].join("\n");

    const { error: updateError } = await ctx.supabaseAdmin
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
