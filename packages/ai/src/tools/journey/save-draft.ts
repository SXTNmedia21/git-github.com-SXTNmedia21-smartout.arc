// ============================================
// save-draft.ts — Save Draft Journey Progress
// Updates the wizard session's draft_journey and current_phase.
// Called by the agent after each phase to persist progress.
// Connected to: wizard_session table
// ============================================

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@smartout/supabase";
import { defineTool } from "../../types";
import { gatedMutation } from "../../gate/gatedMutation";
import type { JourneyToolContext } from "./types";

/**
 * save_draft — routes wizard_session UPDATE through `gatedMutation()`
 * per SS-5 (ADR-0204). The wizard is godmode-only (BFF route enforces
 * super-admin), so Pathway A's authority evaluation is effectively a
 * no-op today — but running through the orchestrator ensures Pathway B
 * (`cascade_gate_write`) can still introduce framework-rule diffs on
 * `wizard_session` updates (e.g. "no draft advancement past `steps`
 * phase without a named mission template") without touching this tool.
 */
export const saveDraft = defineTool({
  name: "save_draft",
  description:
    "Save the current draft journey state and optionally advance to the next phase. " +
    "Call this after collecting info in each phase to persist progress.",
  schema: z.object({
    draft: z.record(z.unknown()).describe("Updated draft journey object"),
    next_phase: z
      .enum(["discovery", "classification", "steps", "testing", "documentation", "review"])
      .optional()
      .describe("Phase to advance to (omit to stay in current phase)"),
  }),

  /**
   * Persists the draft journey to the wizard_session table
   * and optionally advances the phase.
   */
  async execute({ draft, next_phase }, ctx: JourneyToolContext) {
    if (!ctx.profileId) {
      return "Error saving draft: missing actor profile id. Upstream caller must supply ctx.profileId before gate evaluation.";
    }

    const updates: Record<string, unknown> = {
      draft_journey: draft,
    };

    if (next_phase) {
      updates.current_phase = next_phase;
    }

    const result = await gatedMutation(ctx.supabase as unknown as SupabaseClient, {
      workspace_id: ctx.workspaceId,
      actor_profile_id: ctx.profileId,
      capability: "journey_wizard",
      channel: ctx.channel ?? "chat",
      action_type: next_phase ? "advance_phase" : "save_draft",
      entity_id: ctx.sessionId,
      entity_type: "wizard_session",
      action: "update",
      proposed_data: updates as unknown as Json,
      current_data: null,
      execute: async (client) => {
        /* eslint-disable-next-line smartout/no-direct-supabase-write --
           Domain write inside gatedMutation().execute callback (ADR-0204 §3). */
        const { error } = await client
          .from("wizard_session")
          .update(updates)
          .eq("wizard_session_id", ctx.sessionId);
        if (error) return { ok: false, reason: error.message };
        return { ok: true };
      },
    });

    if (!result.ok) {
      return `Error saving draft: ${result.reason}`;
    }

    if (result.proposal_id) {
      return `Draft change queued for approval (proposal ${result.proposal_id}).`;
    }

    const phaseMsg = next_phase ? ` Advanced to phase: ${next_phase}.` : "";
    return `Draft saved successfully.${phaseMsg}`;
  },
});
