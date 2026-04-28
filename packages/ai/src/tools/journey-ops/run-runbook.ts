// ============================================
// run-runbook.ts — Engine-binding runbook tool
// Wraps the pure runRunbook function so the agent can invoke it directly.
// Read-only — does NOT persist; agent decides whether to apply via
// apply_binding afterward.
// ============================================

import { z } from "zod";
import { defineTool } from "../../types";
import { runRunbook } from "../../journey-ops/runbook";
import type { JourneyOpsToolContext } from "./types";

export const runRunbookTool = defineTool({
  name: "run_runbook",
  description:
    "Run the engine-binding runbook on a journey: validates each step, " +
    "introspects the DB for referenced tables, gathers sibling-trigger " +
    "evidence by module, and proposes the binding (trigger_event, " +
    "step_event_type, entity_type). Returns full report including step " +
    "validations and guardrail issues. Defaults to the current journey. " +
    "Does NOT persist — call apply_binding to commit.",
  schema: z.object({
    journey_id: z.string().uuid().nullish().describe("Defaults to current journey"),
    skip_ai: z
      .boolean()
      .optional()
      .describe("If true, returns the deterministic candidate without AI refinement"),
  }),

  async execute({ journey_id, skip_ai }, ctx: JourneyOpsToolContext) {
    const target = journey_id ?? ctx.currentJourneyId;
    if (!target) return "No journey id provided and no journey is currently in focus.";

    const result = await runRunbook(ctx.admin, target, ctx.openrouterKey, {
      skipAi: skip_ai === true,
    });
    if ("error" in result) return `Runbook error: ${result.error}`;

    return JSON.stringify(result, null, 2);
  },
});
