// ============================================
// guardian-evaluator.ts
// Evaluates active sessions against journey criteria.
// Whispers corrections, nudges missing fields, and auto-advances
// stages when all required data is collected.
// Connected to: guardian-bus.ts (event emission)
// Connected to: stage-manager.ts (auto-advance)
// Connected to: types/session.ts (Session type)
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import { emitGuardianEvent } from "./guardian-bus.js";
import { getRecorder } from "./session-recorder.js";
import { advanceStage } from "./stage-manager.js";
import type { Session } from "../types/session.js";

type EvaluationResult = {
  action: "none" | "advance" | "nudge" | "timeout" | "off_topic" | "silence";
  whisper?: string;
  details?: Record<string, unknown>;
};

/**
 * Evaluate a session against its journey criteria.
 * Called on events (data.collected, user.message, agent.response)
 * and periodically (every 30 seconds for active sessions).
 */
export async function evaluateSession(sessionId: string): Promise<EvaluationResult> {
  const { data: session } = await supabaseAdmin
    .from("engine_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("status", "active")
    .single();

  if (!session) return { action: "none" };
  if (!session.journey_id) return { action: "none" };

  const { data: stages } = await supabaseAdmin
    .from("engine_stages")
    .select("*")
    .eq("mission_id", session.mission_id)
    .order("stage_order", { ascending: true });

  const currentStage = stages?.find((s) => s.stage_id === session.current_stage_id);
  if (!currentStage?.journey_step_id) return { action: "none" };

  const { data: journeyStep } = await supabaseAdmin
    .from("journey_step")
    .select("*")
    .eq("journey_step_id", currentStage.journey_step_id)
    .single();

  if (!journeyStep) return { action: "none" };

  const collected = (session.collected_data ?? {}) as Record<string, unknown>;
  const stageStarted = session.stage_started_at
    ? new Date(session.stage_started_at as string)
    : new Date(session.created_at);
  const elapsedSeconds = (Date.now() - stageStarted.getTime()) / 1000;

  // 1. Check data completeness
  const requiredFields = (journeyStep.data_writes as string[]) ?? [];
  const missing = requiredFields.filter((field) => !hasNestedValue(collected, field));

  if (missing.length === 0) {
    const minDuration = (journeyStep.min_duration_seconds as number) ?? 0;
    if (elapsedSeconds >= minDuration) {
      if (journeyStep.required_confirmation) {
        if (elapsedSeconds > minDuration + 30) {
          return whisperToSession(
            session,
            sessionId,
            "Alle data er samlet. Spor bruker om bekreftelse for du gar videre.",
            "guardian.nudge_confirm",
          );
        }
        return { action: "none" };
      }

      // Auto-advance
      try {
        await advanceStage(session as unknown as Session, {});
        emitGuardianEvent({
          session_id: sessionId,
          workspace_id: session.workspace_id,
          event_type: "guardian.auto_advance",
          actor: "guardian",
          summary: `Auto-advanced past "${journeyStep.title}" — all required data collected`,
          data: { journey_step: journeyStep.title, elapsed_seconds: Math.round(elapsedSeconds) },
        });
        return { action: "advance", details: { step: journeyStep.title } };
      } catch {
        return { action: "none" };
      }
    }
  }

  // 2. Hard timeout
  const maxDuration = journeyStep.max_duration_seconds as number | null;
  if (maxDuration && elapsedSeconds > maxDuration) {
    return whisperToSession(
      session,
      sessionId,
      `Timeout pa "${journeyStep.title}". Avslutt steget og ga videre. Mangler: ${missing.join(", ")}`,
      "guardian.timeout",
    );
  }

  // 3. Timeout warning (80%)
  if (maxDuration && elapsedSeconds > maxDuration * 0.8) {
    const remaining = Math.round(maxDuration - elapsedSeconds);
    return whisperToSession(
      session,
      sessionId,
      `${remaining} sekunder igjen pa "${journeyStep.title}". Mangler: ${missing.join(", ")}`,
      "guardian.timeout_warning",
    );
  }

  // 4. Missing field nudge (after 60s)
  if (elapsedSeconds > 60 && missing.length > 0) {
    return whisperToSession(session, sessionId, `Spor om: ${missing.join(", ")}`, "guardian.nudge");
  }

  return { action: "none" };
}

async function whisperToSession(
  session: Record<string, unknown>,
  sessionId: string,
  message: string,
  eventType: string,
): Promise<EvaluationResult> {
  const collected = (session.collected_data ?? {}) as Record<string, unknown>;
  const whispers = (collected._whispers as string[]) ?? [];
  whispers.push(`[Guardian ${new Date().toISOString()}] ${message}`);

  await supabaseAdmin
    .from("engine_sessions")
    .update({
      collected_data: { ...collected, _whispers: whispers },
      guardian_whisper_count: ((session.guardian_whisper_count as number) ?? 0) + 1,
    })
    .eq("id", sessionId);

  emitGuardianEvent({
    session_id: sessionId,
    workspace_id: session.workspace_id as string,
    event_type: eventType,
    actor: "guardian",
    summary: message,
    data: { whisper: message },
  });

  // ADR-0184 — record guardian_verdict. A guardian whisper is effectively a
  // verdict ("on the current trajectory, nudge / timeout / advance") so we
  // capture it with turn_kind=guardian_verdict + phase=guardian_eval. Severity
  // is derived from the event type so replays can filter by severity without
  // re-parsing the event name.
  const severity =
    eventType === "guardian.timeout"
      ? "high"
      : eventType === "guardian.timeout_warning"
        ? "medium"
        : "low";
  try {
    getRecorder()?.recordTurn({
      sessionId,
      workspaceId: session.workspace_id as string,
      turnKind: "guardian_verdict",
      phase: "guardian_eval",
      content: {
        event_type: eventType,
        message,
        severity,
      },
    });
  } catch {
    // Recorder must never throw into the primary path.
  }

  // Map event types to valid action enum values
  const eventToAction: Record<string, EvaluationResult["action"]> = {
    "guardian.nudge": "nudge",
    "guardian.nudge_confirm": "nudge",
    "guardian.timeout": "timeout",
    "guardian.timeout_warning": "timeout",
  };
  const action = eventToAction[eventType] ?? "none";
  return { action, whisper: message };
}

function hasNestedValue(obj: Record<string, unknown>, path: string): boolean {
  if (path.endsWith("[]")) {
    const key = path.slice(0, -2);
    const val = getNestedValue(obj, key);
    return Array.isArray(val) && val.length > 0;
  }
  const val = getNestedValue(obj, path);
  return val !== undefined && val !== null && val !== "";
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Run evaluation for all active sessions with journeys.
 * Called on a 30-second timer.
 */
export async function evaluateAllActiveSessions(): Promise<void> {
  const { data: sessions } = await supabaseAdmin
    .from("engine_sessions")
    .select("id")
    .eq("status", "active")
    .not("journey_id", "is", null);

  if (!sessions || sessions.length === 0) return;

  for (const session of sessions) {
    try {
      await evaluateSession(session.id);
    } catch (err) {
      console.error(`Guardian eval failed for session ${session.id}:`, err);
    }
  }
}
