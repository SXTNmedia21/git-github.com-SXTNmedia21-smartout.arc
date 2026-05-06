// ============================================
// stage-manager.ts
// Stage navigation logic for sequential, free, and hybrid mission modes.
// Determines the next stage and updates session state.
// Connected to: DECISIONS.md D7 (mission modes)
// Connected to: src/routes/advance.ts (route handler)
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import { loadMission, createSession } from "./session-manager.js";
import { buildStagePromptWithWhispers } from "./prompt-builder.js";
import { sendWebhook, type WebhookPayload } from "./webhook-sender.js";
import { emitGuardianEvent } from "./guardian-bus.js";
import { emitSessionEvent } from "./session-event-bus.js";
import type { Session, Stage, Mission } from "../types/session.js";
import type { AdvanceRequest, AdvanceResponse, StageInfo } from "../types/api.js";
import { SEASON_LIFECYCLE_MISSION_ID } from "@smartout/ai";

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
    // Optimistic concurrency: only complete if stage hasn't been changed by another advance
    const { count } = await supabaseAdmin
      .from("engine_sessions")
      .update({
        status: "complete",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id)
      .eq("current_stage_id", session.current_stage_id ?? "")
      .eq("status", "active");

    if (count === 0) {
      console.warn(
        `[stage-manager] Skipped completion for session ${session.id} — concurrent advance detected`,
      );
      return null;
    }

    emitGuardianEvent({
      session_id: session.id,
      workspace_id: session.workspace_id,
      event_type: "session.completed",
      actor: "system",
      summary: `Session complete (${stages.length}/${stages.length} stages)`,
      data: { stages_completed: stages.length },
    });
    if (session.workspace_id) {
      emitSessionEvent("session.ended", session.workspace_id, session.id);
    }

    // Fire completion webhook
    if (session.callback_url) {
      sendWebhook(session.callback_url, {
        event: "session.completed",
        session_id: session.id,
        collected_data: session.collected_data as Record<string, unknown>,
        timestamp: new Date().toISOString(),
      });
    }

    // Onboarding → Season lifecycle handoff
    // When onboarding collects season data (stage 4), automatically spawn a season-lifecycle session
    if (session.mission_id === "onboarding-interview") {
      const collectedData = session.collected_data as Record<string, unknown>;
      const seasonData = collectedData?.season as Record<string, unknown> | undefined;

      if (seasonData?.name || seasonData?.startDate || seasonData?.start_date) {
        try {
          await createSession(
            {
              mission_id: SEASON_LIFECYCLE_MISSION_ID,
              workspace_id: session.workspace_id,
              user_id: session.user_id ?? undefined,
              profile_id: session.profile_id ?? undefined,
              channel: "autonomous",
              context: { source: "onboarding", inherited_season: seasonData },
            },
            {
              method: "jwt",
              workspaceId: session.workspace_id,
              userId: session.user_id ?? undefined,
            },
          );
          console.log(
            `[stage-manager] Onboarding→Season handoff: created season-lifecycle session for workspace ${session.workspace_id}`,
          );
        } catch (err) {
          console.error("[stage-manager] Failed to create season-lifecycle session:", err);
        }
      }
    }

    return {
      complete: true,
      progress: `${stages.length}/${stages.length}`,
      summary: `Mission complete. Collected data for ${Object.keys(session.collected_data as Record<string, unknown>).length} stages.`,
    };
  }

  // Advance to next stage — optimistic concurrency check prevents double-advance
  const nextIndex = stages.findIndex((s) => s.stage_id === nextStage.stage_id);

  const { count: advanceCount } = await supabaseAdmin
    .from("engine_sessions")
    .update({
      current_stage_id: nextStage.stage_id,
      stage_index: nextIndex,
      stage_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .eq("current_stage_id", session.current_stage_id ?? "")
    .eq("status", "active");

  if (advanceCount === 0) {
    console.warn(
      `[stage-manager] Skipped advance for session ${session.id} — concurrent advance detected`,
    );
    return null;
  }

  // Build stage context, enriched with linked journey step data (including timing + progress)
  const stageContext = { ...(session.context as Record<string, unknown>) };
  if (nextStage.journey_step_id && journeySteps.length > 0) {
    const linkedStep = journeySteps.find((s) => s.journey_step_id === nextStage.journey_step_id);
    if (linkedStep) {
      stageContext.journeyStep = {
        step_order: linkedStep.step_order,
        title: linkedStep.title,
        action: linkedStep.action,
        expects: linkedStep.expects,
        screen: linkedStep.screen,
        component: linkedStep.component,
        data_reads: linkedStep.data_reads ?? [],
        data_writes: linkedStep.data_writes ?? [],
        min_duration_seconds: linkedStep.min_duration_seconds,
        max_duration_seconds: linkedStep.max_duration_seconds,
        required_confirmation: linkedStep.required_confirmation,
      };

      // Add journey progress context
      const journeyCtx = session.context.journey as Record<string, unknown> | undefined;
      stageContext.journey_total_steps = journeyCtx?.total_steps ?? null;

      const totalSteps = (journeyCtx?.total_steps as number) ?? 0;
      stageContext.journey_progress =
        totalSteps > 0 ? `${linkedStep.step_order}/${totalSteps} steg` : null;
    }
  }

  // Build new system prompt (with mission-level base prompt + platform-admin
  // whispers). The async variant injects <admin_note> blocks for any
  // unconsumed whispers on this session and records the final prompt via the
  // recorder singleton (ADR-0184, ADR-0185). A whisper / recorder failure
  // never blocks stage advance — the helper catches DB errors internally.
  const systemPrompt = await buildStagePromptWithWhispers(
    nextStage,
    stageContext,
    session.collected_data as Record<string, unknown>,
    mission.system_prompt,
    {
      supabase: supabaseAdmin,
      sessionId: session.id,
      workspaceId: session.workspace_id,
    },
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
  if (session.workspace_id) {
    emitSessionEvent("session.transitioned", session.workspace_id, session.id);
  }

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
