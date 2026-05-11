// ============================================
// build-session-summary.ts
// Pure helper: concatenates user turns from a conversation and truncates to
// 1000 chars. Used by session-manager.ts to write a session summary to
// engine_memory when a session expires or is abandoned.
//
// Design constraints:
//   - Pure: no I/O, no side effects. Tests can run without Supabase.
//   - Only user turns are included — assistant text carries no signal worth
//     memorising at the session level.
//   - 1000-char cap is a content-budget decision, not a token count. It keeps
//     the summary legible in the collector prompt context (top-10 memories).
//
// Connected to: src/core/session-manager.ts (caller)
//               packages/ai/src/context/memory-writer.ts (downstream writer)
//               src/core/__tests__/build-session-summary.test.ts (unit tests)
// ============================================

import type { ConversationTurn } from "../types/agent.js";

const MAX_SUMMARY_CHARS = 1000;

/**
 * Builds a session summary from the conversation history.
 *
 * Extracts all user turns, joins them with newlines, and truncates the result
 * to MAX_SUMMARY_CHARS. Returns an empty string when there are no user turns.
 */
export function buildSessionSummary(conversation: ConversationTurn[]): string {
  const userMessages = conversation
    .filter((turn) => turn.role === "user")
    .map((turn) => turn.content);

  if (userMessages.length === 0) {
    return "";
  }

  const joined = userMessages.join("\n");
  return joined.slice(0, MAX_SUMMARY_CHARS);
}
