// ============================================
// prompt-builder.ts
// Builds system prompts for LLMs by combining stage instructions
// with session context and collected data.
// The output is a single string ready for any LLM — channel-agnostic.
// Connected to: DECISIONS.md D9, D10, D11 (agent/stage separation)
// Connected to: src/core/session-manager.ts (calls buildStagePrompt)
// ============================================

import type { Stage } from "../types/session.js";

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

  return sections.join("\n\n");
}
