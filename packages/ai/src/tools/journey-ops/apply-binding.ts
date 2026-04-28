// ============================================
// apply-binding.ts — Persist engine binding to journey row
// PATCHes journey.{trigger_event, step_event_type, entity_type} and
// emits a journey_event of type "edit". Use after run_runbook + user
// has confirmed the values look right.
// ============================================

import { z } from "zod";
import { defineTool } from "../../types";
import type { JourneyOpsToolContext } from "./types";

const EVENT_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const ENTITY_PATTERN = /^[a-z][a-z0-9_]*$/;

export const applyBinding = defineTool({
  name: "apply_binding",
  description:
    "Persist trigger_event, step_event_type, and entity_type to the journey " +
    "row. Validates dot.case for events and snake_case for entity_type " +
    "before writing. Logs a journey_event with metadata.changed for audit. " +
    "Defaults to the current journey when journey_id is omitted.",
  schema: z.object({
    journey_id: z.string().uuid().nullish(),
    trigger_event: z.string().min(1),
    step_event_type: z.string().min(1),
    entity_type: z.string().min(1),
    rationale: z.string().optional().describe("Short reason for this binding"),
  }),

  async execute(
    { journey_id, trigger_event, step_event_type, entity_type, rationale },
    ctx: JourneyOpsToolContext,
  ) {
    const target = journey_id ?? ctx.currentJourneyId;
    if (!target) return "No journey id provided and no journey is currently in focus.";

    if (!EVENT_PATTERN.test(trigger_event)) {
      return `Validation error: trigger_event "${trigger_event}" violates dot.case pattern.`;
    }
    if (!EVENT_PATTERN.test(step_event_type)) {
      return `Validation error: step_event_type "${step_event_type}" violates dot.case pattern.`;
    }
    if (!ENTITY_PATTERN.test(entity_type)) {
      return `Validation error: entity_type "${entity_type}" violates snake_case pattern.`;
    }

    const { data: existing, error: fetchErr } = await ctx.admin
      .from("journey")
      .select("journey_id, workspace_id")
      .eq("journey_id", target)
      .single();
    if (fetchErr || !existing) {
      return `Journey not found: ${fetchErr?.message ?? target}`;
    }

    const { data: updated, error: updateErr } = await ctx.admin
      .from("journey")
      .update({ trigger_event, step_event_type, entity_type })
      .eq("journey_id", target)
      .select("journey_id, slug, trigger_event, step_event_type, entity_type")
      .single();
    if (updateErr || !updated) {
      return `Update failed: ${updateErr?.message ?? "unknown"}`;
    }

    const { error: eventErr } = await ctx.admin.from("journey_event").insert({
      journey_id: target,
      workspace_id: existing.workspace_id,
      event_type: "edit" as never,
      actor_id: ctx.actorId,
      metadata: {
        changed: ["trigger_event", "step_event_type", "entity_type"],
        rationale: rationale ?? null,
        source: "journey-ops-agent",
      },
    });
    if (eventErr) {
      // Non-fatal — write succeeded.
      return JSON.stringify({
        ok: true,
        warning: `audit event failed: ${eventErr.message}`,
        binding: updated,
      });
    }

    return JSON.stringify({ ok: true, binding: updated });
  },
});
