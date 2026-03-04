// ============================================
// tokens.ts
// Token estimation utilities for chunking decisions.
// Uses a rough character-based heuristic instead of a
// full tokenizer to avoid heavy dependencies.
// Connected to: src/chunking/chunker.ts (chunk size decisions)
// ============================================

/**
 * Estimates the token count of a text string.
 *
 * Why: We need to know approximate token counts to decide whether
 * to split chunks and to store token_count metadata. A full tokenizer
 * (tiktoken) is heavy; the ~4 chars/token heuristic is accurate enough
 * for chunking decisions.
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count (always at least 1 for non-empty text)
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}
