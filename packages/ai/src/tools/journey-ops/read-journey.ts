// ============================================
// read-journey.ts — Full journey spec read
// Returns the journey row + all steps + recent events.
// Defaults to ctx.currentJourneyId when no id is passed.
// ============================================

import { z } from "zod";
import { defineTool } from "../../types";
import type { JourneyOpsToolContext } from "./types";

export const readJourney = defineTool({
  name: "read_journey",
  description:
    "Read the full spec for a journey: row + ordered steps + recent events. " +
    "Pass journey_id to look up a specific one, or omit to read the current " +
    "journey the user is viewing. ALWAYS call this before suggesting changes.",
  schema: z.object({
    journey_id: z
      .string()
      .uuid()
      .nullish()
      .describe("Specific journey id; defaults to the journey currently in focus"),
  }),

  async execute({ journey_id }, ctx: JourneyOpsToolContext) {
    const target = journey_id ?? ctx.currentJourneyId;
    if (!target) {
      return "No journey id provided and no journey is currently in focus.";
    }

    const [journeyRes, stepsRes, eventsRes] = await Promise.all([
      ctx.admin.from("journey").select("*").eq("journey_id", target).single(),
      ctx.admin.from("journey_step").select("*").eq("journey_id", target).order("step_order"),
      ctx.admin
        .from("journey_event")
        .select("event_type, from_status, to_status, metadata, created_at")
        .eq("journey_id", target)
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

    if (journeyRes.error || !journeyRes.data) {
      return `Journey not found: ${journeyRes.error?.message ?? target}`;
    }

    const j = journeyRes.data;
    const out = {
      journey: {
        id: j.journey_id,
        code: j.code,
        slug: j.slug,
        title: j.title,
        module: j.module,
        actor: j.actor,
        platform: j.platform,
        priority: j.priority,
        status: j.status,
        version: j.version,
        engine_process_id: j.engine_process_id,
        binding: {
          trigger_event: j.trigger_event,
          step_event_type: j.step_event_type,
          entity_type: j.entity_type,
        },
        trigger_description: j.trigger_description,
        preconditions: j.preconditions,
        outcomes: {
          success: j.outcomes_success,
          empty: j.outcomes_empty,
          error: j.outcomes_error,
        },
        doc_title: j.doc_title,
        tags: j.tags,
      },
      step_count: stepsRes.data?.length ?? 0,
      steps: (stepsRes.data ?? []).map((s) => ({
        order: s.step_order,
        slug: s.slug,
        title: s.title,
        action: s.action,
        expects: s.expects,
        screen: s.screen,
        component: s.component,
        data_reads: s.data_reads,
        data_writes: s.data_writes,
        action_type_override: s.action_type_override,
        action_payload_override: s.action_payload_override,
      })),
      recent_events: (eventsRes.data ?? []).map((e) => ({
        type: e.event_type,
        from: e.from_status,
        to: e.to_status,
        at: e.created_at,
        meta: e.metadata,
      })),
    };

    return JSON.stringify(out, null, 2);
  },
});
