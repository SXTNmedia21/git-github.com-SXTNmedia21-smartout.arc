// ============================================
// compile-journey.ts — Compile journey to engine_process
// Runs the pure journey-ir compiler against the journey row + steps,
// then upserts engine_process / engine_step / engine_trigger.
// Mirrors compileJourneyAction in apps/web; the agent calls this when the
// binding is finalized and steps validate.
// ============================================

import { z } from "zod";
import { defineTool } from "../../types";
import { compileJourney, type CompileStepInput } from "@smartout/journey-ir";
import type { Json } from "@smartout/supabase";
import type { JourneyOpsToolContext } from "./types";

export const compileJourneyTool = defineTool({
  name: "compile_journey",
  description:
    "Compile the journey to engine_process + engine_steps + engine_trigger. " +
    "Requires trigger_event, step_event_type, and entity_type to be set on " +
    "the journey row first (call apply_binding before this). Updates " +
    "journey.engine_process_id and journey.status='ready_test' on success.",
  schema: z.object({
    journey_id: z.string().uuid().nullish(),
  }),

  async execute({ journey_id }, ctx: JourneyOpsToolContext) {
    const target = journey_id ?? ctx.currentJourneyId;
    if (!target) return "No journey id provided and no journey is currently in focus.";

    const { data: journey, error: journeyErr } = await ctx.admin
      .from("journey")
      .select(
        "journey_id, slug, title, trigger_event, step_event_type, entity_type, module, workspace_id",
      )
      .eq("journey_id", target)
      .single();
    if (journeyErr || !journey) return `Journey not found: ${journeyErr?.message ?? target}`;

    if (!journey.trigger_event || !journey.step_event_type || !journey.entity_type) {
      return "Compile blocked: trigger_event, step_event_type, and entity_type must all be set. Call apply_binding first.";
    }

    const { data: steps, error: stepsErr } = await ctx.admin
      .from("journey_step")
      .select(
        "journey_step_id, step_order, title, slug, action_type_override, action_payload_override",
      )
      .eq("journey_id", target)
      .order("step_order");
    if (stepsErr) return `Failed to fetch steps: ${stepsErr.message}`;
    if (!steps || steps.length === 0) return "Journey has no steps.";

    const compileSteps: CompileStepInput[] = [];
    for (const s of steps) {
      if (!s.slug) {
        return `journey_step "${s.title}" (order ${s.step_order}) is missing slug.`;
      }
      compileSteps.push({
        slug: s.slug,
        stepOrder: s.step_order,
        actionTypeOverride: s.action_type_override,
        actionPayloadOverride: s.action_payload_override as Record<string, unknown> | null,
      });
    }

    const output = compileJourney({
      journeySlug: journey.slug,
      journeyName: journey.title,
      journeyDescription: null,
      steps: compileSteps,
      triggerEvent: journey.trigger_event,
      stepEventType: journey.step_event_type,
      entityType: journey.entity_type,
      workspaceId: null,
    });

    const { error: processErr } = await ctx.admin
      .from("engine_process")
      .upsert(output.process, { onConflict: "id" });
    if (processErr) return `Failed to upsert engine_process: ${processErr.message}`;

    await ctx.admin.from("engine_step").delete().eq("process_id", output.process.id);
    const stepsWithJson = output.steps.map((s) => ({
      ...s,
      action_payload: s.action_payload as unknown as Json,
      condition: s.condition as unknown as Json,
    }));
    const { error: stepsInsertErr } = await ctx.admin.from("engine_step").insert(stepsWithJson);
    if (stepsInsertErr) return `Failed to insert engine_steps: ${stepsInsertErr.message}`;

    await ctx.admin.from("engine_trigger").delete().eq("process_id", output.process.id);
    const triggerWithJson = {
      ...output.trigger,
      condition: output.trigger.condition as unknown as Json,
    };
    const { error: triggerErr } = await ctx.admin.from("engine_trigger").insert(triggerWithJson);
    if (triggerErr) return `Failed to insert engine_trigger: ${triggerErr.message}`;

    const { error: updateErr } = await ctx.admin
      .from("journey")
      .update({
        engine_process_id: output.process.id,
        status: "ready_test" as never,
      })
      .eq("journey_id", target);
    if (updateErr) return `Failed to update journey: ${updateErr.message}`;

    return JSON.stringify(
      {
        ok: true,
        process_id: output.process.id,
        steps_created: output.steps.length,
        trigger_event: output.trigger.event_type,
      },
      null,
      2,
    );
  },
});
