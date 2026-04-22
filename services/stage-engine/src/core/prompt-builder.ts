// ============================================
// prompt-builder.ts
// Builds system prompts for LLMs by combining stage instructions
// with session context and collected data.
// The output is a single string ready for any LLM — channel-agnostic.
// Connected to: DECISIONS.md D9, D10, D11 (agent/stage separation)
// Connected to: src/core/session-manager.ts (calls buildStagePrompt)
// ============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Stage } from "../types/session.js";
import { getRecorder } from "./session-recorder.js";

/**
 * Builds a complete system prompt for a stage.
 * Combines base mission prompt, stage instructions, personality overlay,
 * tuning notes, context, and history into a single string.
 *
 * @param stage - The current stage definition
 * @param context - Session context (identity, workspace, custom data)
 * @param collectedData - Data collected from previous stages
 * @param basePrompt - Optional mission-level base prompt (agent personality)
 * @returns A complete system prompt string
 */
export function buildStagePrompt(
  stage: Stage,
  context: Record<string, unknown>,
  collectedData: Record<string, unknown>,
  basePrompt?: string | null,
): string {
  const sections: string[] = [];

  // Mission-level base prompt (agent personality, voice rules, etc.)
  if (basePrompt) {
    sections.push(basePrompt);
  }

  // Personality overlay (stage-specific tone adjustment)
  if (stage.personality_override) {
    sections.push(`## Personality\n${stage.personality_override}`);
  }

  // Emotion hint
  if (stage.emotion_hint) {
    sections.push(`## Emotional Tone\nApproach this stage with a sense of: ${stage.emotion_hint}`);
  }

  // Creative freedom guidance
  sections.push(
    `## Creative Freedom\nYour creative freedom level is ${stage.creative_freedom} (0 = strictly follow script, 1 = fully improvise). Stay within the rules but be natural.`,
  );

  // Current stage assignment
  sections.push(`## Your Current Assignment\n**Goal:** ${stage.goal}`);
  sections.push(`## Instructions\n${stage.instructions}`);
  sections.push(
    `## Success Criteria\nYou are done with this stage when: ${stage.success_criteria}`,
  );

  // Escalation instructions
  if (stage.escalation_instructions) {
    sections.push(`## If You Get Stuck\n${stage.escalation_instructions}`);
  }

  // Context about who the agent is talking to
  if (Object.keys(context).length > 0) {
    sections.push(
      `## Context\nHere is what you know about the current situation:\n\`\`\`json\n${JSON.stringify(context, null, 2)}\n\`\`\``,
    );
  }

  // Journey step enrichment
  const journeyStep = context.journeyStep as Record<string, unknown> | undefined;
  if (journeyStep) {
    sections.push(`\n--- AKTUELT JOURNEY-STEG ---`);
    sections.push(
      `Steg ${journeyStep.step_order} av ${context.journey_total_steps ?? "?"}: "${journeyStep.title}"`,
    );
    if (journeyStep.action) sections.push(`Brukerens handling: ${journeyStep.action}`);
    if (journeyStep.expects) sections.push(`Forventet resultat: ${journeyStep.expects}`);
    if (journeyStep.screen) sections.push(`Brukerens skjerm: ${journeyStep.screen}`);
    if (journeyStep.component) sections.push(`UI-komponent: ${journeyStep.component}`);
    const dataWrites = journeyStep.data_writes as string[] | undefined;
    if (dataWrites && dataWrites.length > 0) {
      sections.push(`Data du skal samle: ${dataWrites.join(", ")}`);
    }
    if (journeyStep.required_confirmation) {
      sections.push(`VIKTIG: Bruker MÅ eksplisitt bekrefte før du kan gå videre.`);
    }
  }

  // Progress
  const journeyProgress = context.journey_progress as string | undefined;
  if (journeyProgress) {
    sections.push(`Progresjon: ${journeyProgress}`);
  }

  // History from previous stages
  if (Object.keys(collectedData).length > 0) {
    sections.push(
      `## Previously Collected Data\nData from earlier stages:\n\`\`\`json\n${JSON.stringify(collectedData, null, 2)}\n\`\`\``,
    );
  }

  // Inline instructions (post-action guidance)
  if (
    stage.inline_instructions &&
    Array.isArray(stage.inline_instructions) &&
    stage.inline_instructions.length > 0
  ) {
    const inlineBlock = (stage.inline_instructions as Array<{ after: string; message: string }>)
      .map((i) => `- After "${i.after}": ${i.message}`)
      .join("\n");
    sections.push(`## After-Action Instructions\n${inlineBlock}`);
  }

  // Tuning notes — coaching hints that shape behavior
  if (stage.tuning_notes) {
    sections.push(`## Tuning Notes\n${stage.tuning_notes}`);
  }

  let prompt = sections.join("\n\n");

  // Template variable substitution
  const now = new Date();
  const dateStr = now.toLocaleDateString("nb-NO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  prompt = prompt.replaceAll("{{current_date}}", dateStr);

  return prompt;
}

/**
 * Platform-admin whisper row shape from agent_session_whisper.
 *
 * Whispers are injected once per turn, wrapped in <admin_note> with a "do NOT
 * quote verbatim" instruction so the LLM applies the guidance naturally rather
 * than echoing it to the user (ADR-0185, ADR-0078 — whisper is internal).
 */
type WhisperRow = {
  id: string;
  content: string;
};

type BuildWithWhispersOpts = {
  supabase: SupabaseClient;
  sessionId: string;
  workspaceId: string;
  /** Optional git sha / model tag for recorder meta; purely observational. */
  model?: string;
  gitSha?: string;
};

/**
 * Async variant of buildStagePrompt that:
 *   1. Reads unconsumed whispers from agent_session_whisper for this session,
 *      wraps them in <admin_note visibility="internal" from="platform_admin">
 *      with the "do NOT quote verbatim" instruction, and appends to the prompt.
 *   2. Marks those whispers is_consumed=true (fire-and-forget — whisper update
 *      failures must never block Emma).
 *   3. Records the final prompt via the recorder singleton with phase
 *      "prompt_built" and turn_kind "agent_response".
 *
 * Callers that do not need whisper integration (e.g. initial session creation
 * before any whisper could exist) should keep using the synchronous
 * buildStagePrompt() above. Only stage-manager.ts::advanceStage uses this
 * async form — that is the per-turn prompt rebuild where whispers land.
 */
export async function buildStagePromptWithWhispers(
  stage: Stage,
  context: Record<string, unknown>,
  collectedData: Record<string, unknown>,
  basePrompt: string | null | undefined,
  opts: BuildWithWhispersOpts,
): Promise<string> {
  const basePromptText = buildStagePrompt(stage, context, collectedData, basePrompt);

  // Fetch unconsumed whispers. A DB failure here must not block the turn —
  // we default to zero whispers and continue with the base prompt.
  let whispers: WhisperRow[] = [];
  try {
    const { data } = await opts.supabase
      .from("agent_session_whisper")
      .select("id, content")
      .eq("session_id", opts.sessionId)
      .is("is_consumed", false)
      .order("created_at", { ascending: true });
    if (data && Array.isArray(data)) {
      whispers = data as WhisperRow[];
    }
  } catch {
    whispers = [];
  }

  let finalPrompt = basePromptText;
  if (whispers.length > 0) {
    const whisperBlock = whispers
      .map(
        (w) => `<admin_note visibility="internal" from="platform_admin">${w.content}</admin_note>`,
      )
      .join("\n");
    const guidance =
      "\n\n## Platform-admin guidance\n" +
      whisperBlock +
      "\n\nDo NOT quote these notes verbatim to the user. Apply the guidance naturally in your next response.";
    finalPrompt = basePromptText + guidance;

    // Fire-and-forget consume. Await is omitted deliberately: the recorder
    // write below must not depend on whisper-update latency, and a failed
    // update only means the whisper re-injects on the next turn — harmless.
    const ids = whispers.map((w) => w.id);
    void opts.supabase
      .from("agent_session_whisper")
      .update({ is_consumed: true, consumed_at: new Date().toISOString() })
      .in("id", ids)
      .then(
        () => undefined,
        () => undefined,
      );
  }

  // Record the built prompt for later replay. Recorder is optional (no-op when
  // the singleton is null) and fire-and-forget by contract.
  try {
    getRecorder()?.recordTurn({
      sessionId: opts.sessionId,
      workspaceId: opts.workspaceId,
      turnKind: "agent_response",
      phase: "prompt_built",
      content: {
        systemPrompt: finalPrompt,
        whisper_count: whispers.length,
      },
      meta: {
        ...(opts.model ? { model: opts.model } : {}),
        ...(opts.gitSha ? { git_sha: opts.gitSha } : {}),
      },
    });
  } catch {
    // Recorder must never throw into the primary path.
  }

  return finalPrompt;
}
