"use server";

import { createClient } from "@smartout/supabase/server";
import { compileJourney, type CompileInput, type CompileStepInput } from "@smartout/journey-ir";
import type { Json } from "@smartout/supabase/database.types";

interface CompileResult {
  success: boolean;
  processId?: string;
  stepsCreated?: number;
  error?: string;
}

export async function compileJourneyAction(journeyId: string): Promise<CompileResult> {
  const supabase = await createClient();

  // 1. Fetch journey + steps
  const { data: journey, error: journeyErr } = await supabase
    .from("journey")
    .select(
      "journey_id, slug, title, trigger_event, step_event_type, entity_type, module, workspace_id",
    )
    .eq("journey_id", journeyId)
    .single();

  if (journeyErr || !journey) {
    return { success: false, error: `Journey not found: ${journeyErr?.message}` };
  }

  const { data: steps, error: stepsErr } = await supabase
    .from("journey_step")
    .select(
      "journey_step_id, step_order, title, slug, action_type_override, action_payload_override",
    )
    .eq("journey_id", journeyId)
    .order("step_order");

  if (stepsErr) {
    return { success: false, error: `Failed to fetch steps: ${stepsErr.message}` };
  }

  if (!steps || steps.length === 0) {
    return { success: false, error: "Journey has no steps. Add steps before compiling." };
  }

  // 2. Build compile input — metadata comes from journey columns directly.
  // Auto-derive defaults from slug/module if unset, then persist so subsequent
  // compiles + UI reflect the resolved values.
  const triggerEvent = journey.trigger_event ?? `${journey.slug}.start`;
  const stepEventType = journey.step_event_type ?? `${journey.slug}.step`;
  const entityType = journey.entity_type ?? journey.module;

  if (!journey.trigger_event || !journey.step_event_type || !journey.entity_type) {
    const { error: backfillErr } = await supabase
      .from("journey")
      .update({
        trigger_event: triggerEvent,
        step_event_type: stepEventType,
        entity_type: entityType,
      })
      .eq("journey_id", journeyId);
    if (backfillErr) {
      return {
        success: false,
        error: `Failed to backfill engine-binding defaults: ${backfillErr.message}`,
      };
    }
  }

  const compileSteps: CompileStepInput[] = steps.map((s) => {
    if (!s.slug) {
      throw new Error(
        `journey_step "${s.title}" (order ${s.step_order}) is missing slug. Set it before compiling.`,
      );
    }
    return {
      slug: s.slug,
      stepOrder: s.step_order,
      actionTypeOverride: s.action_type_override,
      actionPayloadOverride: s.action_payload_override as Record<string, unknown> | null,
    };
  });

  const input: CompileInput = {
    journeySlug: journey.slug,
    journeyName: journey.title,
    journeyDescription: null,
    steps: compileSteps,
    triggerEvent,
    stepEventType,
    entityType,
    workspaceId: null, // Global process (not workspace-scoped)
  };

  const output = compileJourney(input);

  // 3. UPSERT engine_process
  const { error: processErr } = await supabase
    .from("engine_process")
    .upsert(output.process, { onConflict: "id" });

  if (processErr) {
    return { success: false, error: `Failed to upsert engine_process: ${processErr.message}` };
  }

  // 4. DELETE + INSERT engine_steps (replace all for this process)
  await supabase.from("engine_step").delete().eq("process_id", output.process.id);

  const stepsWithJson = output.steps.map((s) => ({
    ...s,
    action_payload: s.action_payload as unknown as Json,
    condition: s.condition as unknown as Json,
  }));
  const { error: stepsInsertErr } = await supabase.from("engine_step").insert(stepsWithJson);

  if (stepsInsertErr) {
    return { success: false, error: `Failed to insert engine_steps: ${stepsInsertErr.message}` };
  }

  // 5. UPSERT engine_trigger (delete existing for this process, then insert)
  await supabase.from("engine_trigger").delete().eq("process_id", output.process.id);

  const triggerWithJson = {
    ...output.trigger,
    condition: output.trigger.condition as unknown as Json,
  };
  const { error: triggerErr } = await supabase.from("engine_trigger").insert(triggerWithJson);

  if (triggerErr) {
    return { success: false, error: `Failed to insert engine_trigger: ${triggerErr.message}` };
  }

  // 6. Update journey: link to engine_process + set status
  const { error: updateErr } = await supabase
    .from("journey")
    .update({
      engine_process_id: output.process.id,
      status: "ready_test",
    })
    .eq("journey_id", journeyId);

  if (updateErr) {
    return { success: false, error: `Failed to update journey: ${updateErr.message}` };
  }

  return {
    success: true,
    processId: output.process.id,
    stepsCreated: output.steps.length,
  };
}
