// ============================================
// stage-manager.ts
// Stage navigation logic for sequential, free, and hybrid mission modes.
// Determines the next stage and updates session state.
// Connected to: DECISIONS.md D7 (mission modes)
// Connected to: src/routes/advance.ts (route handler)
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import { loadMission } from "./session-manager.js";
import { buildStagePrompt } from "./prompt-builder.js";
import { sendWebhook, type WebhookPayload } from "./webhook-sender.js";
import { emitGuardianEvent } from "./guardian-bus.js";
import type { Session, Stage, Mission } from "../types/session.js";
import type { AdvanceRequest, AdvanceResponse, StageInfo } from "../types/api.js";

/**
 * Advances a session to the next stage.
 * Handles sequential, free, and hybrid modes.
 *
 * @param session - The current session
 * @param req - The advance request body
 * @returns AdvanceResponse with new stage info, or null on error
 */
export async function advanceStage(
  session: Session,
  req: AdvanceRequest,
): Promise<AdvanceResponse | null> {
  // Load mission, stages, and journey data (mission_id is guaranteed non-null for mission-mode sessions)
  const result = await loadMission(session.mission_id!);
  if (!result) return null;

  const { mission, stages, journeySteps } = result;

  // Find current stage
  const currentStage = stages.find((s) => s.stage_id === session.current_stage_id);

  // Save result data for current stage
  if (req.result && currentStage) {
    const updatedData = {
      ...(session.collected_data as Record<string, unknown>),
      [currentStage.stage_id]: req.result,
    };

    await supabaseAdmin
      .from("engine_sessions")
      .update({ collected_data: updatedData, updated_at: new Date().toISOString() })
      .eq("id", session.id);

    // Update local copy for prompt builder
    session.collected_data = updatedData;
  }

  // Determine next stage based on mode
  const nextStage = resolveNextStage(mission, stages, currentStage, req);

  // No next stage → mission complete
  if (!nextStage) {
    await supabaseAdmin
      .from("engine_sessions")
      .update({
        status: "complete",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    emitGuardianEvent({
      session_id: session.id,
      workspace_id: session.workspace_id,
      event_type: "session.completed",
      actor: "system",
      summary: `Session complete (${stages.length}/${stages.length} stages)`,
      data: { stages_completed: stages.length },
    });

    // Fire completion webhook
    if (session.callback_url) {
      sendWebhook(session.callback_url, {
        event: "session.completed",
        session_id: session.id,
        collected_data: session.collected_data as Record<string, unknown>,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      complete: true,
      progress: `${stages.length}/${stages.length}`,
      summary: `Mission complete. Collected data for ${Object.keys(session.collected_data as Record<string, unknown>).length} stages.`,
    };
  }

  // Advance to next stage
  const nextIndex = stages.findIndex((s) => s.stage_id === nextStage.stage_id);

  await supabaseAdmin
    .from("engine_sessions")
    .update({
      current_stage_id: nextStage.stage_id,
      stage_index: nextIndex,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  // Build stage context, enriched with linked journey step data
  const stageContext = { ...(session.context as Record<string, unknown>) };
  if (nextStage.journey_step_id && journeySteps.length > 0) {
    const linkedStep = journeySteps.find((s) => s.journey_step_id === nextStage.journey_step_id);
    if (linkedStep) {
      stageContext.journeyStep = {
        action: linkedStep.action,
        expects: linkedStep.expects,
        screen: linkedStep.screen,
        component: linkedStep.component,
        dataReads: linkedStep.data_reads,
        dataWrites: linkedStep.data_writes,
      };
    }
  }

  // Build new system prompt
  const systemPrompt = buildStagePrompt(
    nextStage,
    stageContext,
    session.collected_data as Record<string, unknown>,
  );

  emitGuardianEvent({
    session_id: session.id,
    workspace_id: session.workspace_id,
    event_type: "stage.changed",
    actor: "system",
    summary: `Stage: ${session.current_stage_id ?? "start"} → ${nextStage.stage_id}`,
    data: {
      from_stage: session.current_stage_id,
      to_stage: nextStage.stage_id,
      progress: `${nextIndex + 1}/${stages.length}`,
    },
  });

  // Fire stage change webhook
  if (session.callback_url) {
    sendWebhook(session.callback_url, {
      event: "stage.changed",
      session_id: session.id,
      stage_id: nextStage.stage_id,
      progress: `${nextIndex + 1}/${stages.length}`,
      timestamp: new Date().toISOString(),
    });
  }

  const stageInfo: StageInfo = {
    stage_id: nextStage.stage_id,
    goal: nextStage.goal,
    instructions: nextStage.instructions,
    success_criteria: nextStage.success_criteria,
    emotion_hint: nextStage.emotion_hint ?? undefined,
  };

  return {
    new_stage: stageInfo,
    progress: `${nextIndex + 1}/${stages.length}`,
    complete: false,
    system_prompt: systemPrompt,
  };
}

/**
 * Resolves the next stage based on mission mode.
 * - Sequential: follows stage.next_stage chain
 * - Free: uses next_stage_id from request
 * - Hybrid: sequential for required stages, free for optional
 */
function resolveNextStage(
  mission: Mission,
  stages: Stage[],
  currentStage: Stage | undefined,
  req: AdvanceRequest,
): Stage | null {
  switch (mission.mode) {
    case "sequential": {
      if (!currentStage?.next_stage) return null;
      return stages.find((s) => s.stage_id === currentStage.next_stage) ?? null;
    }

    case "free": {
      if (!req.next_stage_id) return null;
      return stages.find((s) => s.stage_id === req.next_stage_id) ?? null;
    }

    case "hybrid": {
      // If a specific next_stage_id is provided, use it (for optional stages)
      if (req.next_stage_id) {
        return stages.find((s) => s.stage_id === req.next_stage_id) ?? null;
      }
      // Otherwise follow sequential chain for required stages
      if (!currentStage?.next_stage) return null;
      return stages.find((s) => s.stage_id === currentStage.next_stage) ?? null;
    }

    default:
      return null;
  }
}
