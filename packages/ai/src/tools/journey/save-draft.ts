// ============================================
// save-draft.ts — Save Draft Journey Progress
// Updates the wizard session's draft_journey and current_phase.
// Called by the agent after each phase to persist progress.
// Connected to: wizard_session table
// ============================================

import { z } from "zod";
import { defineTool } from "../../types";
import type { JourneyToolContext } from "./types";

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
    const updates: Record<string, unknown> = {
      draft_journey: draft,
    };

    if (next_phase) {
      updates.current_phase = next_phase;
    }

    const { error } = await ctx.supabase
      .from("wizard_session")
      .update(updates)
      .eq("wizard_session_id", ctx.sessionId);

    if (error) return `Error saving draft: ${error.message}`;

    const phaseMsg = next_phase ? ` Advanced to phase: ${next_phase}.` : "";
    return `Draft saved successfully.${phaseMsg}`;
  },
});
