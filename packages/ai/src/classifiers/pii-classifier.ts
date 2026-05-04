/**
 * pii-classifier.ts — Synchronous regex-based PII classifier (ADR-0166).
 *
 * Purpose:
 *   Detect Norwegian-language personally identifying information in a
 *   single chat message BEFORE the message flips to RLS-visible state
 *   in a `privacy_mode='public'` helpdesk channel. The caller uses the
 *   result to:
 *     1. Copy the original content + hash to audit trail.
 *     2. Redact the public timeline copy to a placeholder.
 *     3. Spawn a private sub-channel carrying the real content.
 *
 * Non-goals:
 *   - This module does NOT perform any IO. No DB, no fetch, no filesystem.
 *     The hook site (Phase 1A.2) handles persistence + redaction placement.
 *   - This module does NOT attempt perfect recall. ADR-0166 explicitly
 *     accepts false-negatives in 1.0 (regex-only) and defers LLM-based
 *     classification to Phase 2+. False-positives here merely trigger
 *     redaction + private-thread spawn; the user can re-send with context.
 *
 * Latency budget:
 *   Classifier must complete well under 800ms per ADR-0166 Rule 1 (800ms
 *   soft-hold timeout). Regex on a chat-sized message is microseconds;
 *   the budget exists for the hook round-trip, not this function.
 *
 * Privacy:
 *   Raw matched text is NEVER logged at any level. The caller receives
 *   `matches[].matchedText` so it can construct the redacted string, but
 *   the only artifact that persists beyond the call is `originalContentHash`
 *   (SHA-256 hex of the full input). Downstream code must not log
 *   `matches[].matchedText` or the raw input itself.
 *
 * References:
 *   - docs/decisions/0166-pii-public-mode-redaction.md (authoritative spec)
 *   - docs/decisions/0163-adr-0078-amendment-pii-allowedchannels-mandatory.md
 *   - docs/decisions/0078-engine-process-channel-restriction.md (voice path)
 */

import { createHash } from "node:crypto";

/** Classifier version — bump when regex set or semantics change. */
export const PII_CLASSIFIER_VERSION = "1.0.0-regex-nor";

/**
 * PII categories detected by the 1.0 regex classifier. Ordering in this
 * union matches detection priority when the same substring could match
 * multiple categories (personnummer before bank_account_nor etc.).
 */
export type PiiCategory = "personnummer" | "iban" | "bank_account_nor" | "phone_nor" | "email";

export type PiiMatch = {
  /** Category of the detected PII. */
  category: PiiCategory;
  /** Start index in the original text (inclusive). */
  startIndex: number;
  /** End index in the original text (exclusive). */
  endIndex: number;
  /**
   * The raw matched substring. Needed by the caller to compute the
   * redacted replacement but MUST NOT be logged or persisted.
   * The audit trail keeps only the SHA-256 hash of the full message.
   */
  matchedText: string;
};

export type PiiClassificationResult = {
  /** True when at least one match was found. */
  detected: boolean;
  /** All matches, sorted by startIndex ascending, overlaps removed. */
  matches: PiiMatch[];
  /** Original text with every match replaced by `[PII: <category>]`. */
  redactedText: string;
  /** SHA-256 hex of the original `text` input. Deterministic, lowercase. */
  originalContentHash: string;
  /** Classifier version that produced this result. */
  classifierVersion: string;
  /** Wall-clock duration of the classification call, in milliseconds. */
  durationMs: number;
};

// ── Regex rules ────────────────────────────────────────────────────
// Rules are listed in priority order. When matches from different rules
// overlap, the earlier rule wins. This matters for e.g. an 11-digit
// string that could match both personnummer and bank_account_nor.

type Rule = {
  category: PiiCategory;
  /** Must be `g` flag to iterate all matches. */
  pattern: RegExp;
};

/**
 * Norwegian PII regex rules.
 *
 * - personnummer: 11 digits in DDMMYY XXXXX form, optional single space after the date part.
 * - iban: Norwegian IBAN (NO + 2 check digits + 11 digits), optional spaces every 4 chars.
 * - bank_account_nor: 11-digit konto in 4-2-5 form with optional dots or single spaces.
 * - phone_nor: 8-digit Norwegian phone (optional +47 prefix, optional spaces every 2 digits).
 * - email: RFC-ish email — generic pattern, opt-in category.
 */
const RULES: Rule[] = [
  {
    category: "personnummer",
    pattern: /\b\d{6}\s?\d{5}\b/g,
  },
  {
    category: "iban",
    pattern: /\b(NO\d{2}\s?\d{4}\s?\d{4}\s?\d{3})\b/gi,
  },
  {
    category: "bank_account_nor",
    pattern: /\b\d{4}\.?\s?\d{2}\.?\s?\d{5}\b/g,
  },
  {
    category: "phone_nor",
    pattern: /\b(?:\+47\s?)?(?:\d{2}\s?){3}\d{2}\b/g,
  },
  {
    category: "email",
    pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,
  },
];

// ── Implementation ─────────────────────────────────────────────────

/**
 * Collect all matches from all rules. Later rules' matches are dropped
 * when they overlap an earlier rule's match (priority order).
 */
function collectMatches(text: string): PiiMatch[] {
  const accepted: PiiMatch[] = [];

  for (const rule of RULES) {
    // Always use a fresh regex to avoid lastIndex leaking between calls.
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const start = match.index;
      const end = match.index + match[0].length;

      const overlapsExisting = accepted.some((m) => !(end <= m.startIndex || start >= m.endIndex));
      if (overlapsExisting) continue;

      accepted.push({
        category: rule.category,
        startIndex: start,
        endIndex: end,
        matchedText: match[0],
      });

      // Guard against zero-width matches locking the loop.
      if (match[0].length === 0) re.lastIndex += 1;
    }
  }

  accepted.sort((a, b) => a.startIndex - b.startIndex);
  return accepted;
}

/**
 * Produce the redacted text by replacing every match with `[PII: <category>]`.
 * Assumes matches are sorted by startIndex and non-overlapping.
 */
function buildRedactedText(text: string, matches: PiiMatch[]): string {
  if (matches.length === 0) return text;

  const pieces: string[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.startIndex > cursor) pieces.push(text.slice(cursor, m.startIndex));
    pieces.push(`[PII: ${m.category}]`);
    cursor = m.endIndex;
  }
  if (cursor < text.length) pieces.push(text.slice(cursor));
  return pieces.join("");
}

/**
 * SHA-256 hex of input. Deterministic; used for audit dedup + later
 * `original_content_hash` column population. Never stores plaintext.
 */
function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Classify a chat message for Norwegian PII. Synchronous, deterministic,
 * fast. Safe to call on the hot path of message insert per ADR-0166.
 *
 * Empty or whitespace-only input returns `detected: false` with an empty
 * match list and the hash of the literal input (so auditors can verify
 * the classifier ran on the intended content).
 */
export function classifyPii(text: string): PiiClassificationResult {
  const started =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();

  const matches = text.length === 0 ? [] : collectMatches(text);
  const redactedText = buildRedactedText(text, matches);
  const originalContentHash = sha256Hex(text);

  const ended =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();

  return {
    detected: matches.length > 0,
    matches,
    redactedText,
    originalContentHash,
    classifierVersion: PII_CLASSIFIER_VERSION,
    durationMs: ended - started,
  };
}
