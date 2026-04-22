// packages/ai/src/lib/attention-score.ts
// ADR-0184 Q7 — composite attention score for session triage ranking.
//
// Produces a score in [0, 1] where 0 = clean session, 1 = maximum concern.
// Platform Admin ranks sessions by this score so the highest-signal
// conversations surface first. Weights favor strong single-signal indicators
// (manual_flag, pii_leak) without letting accumulated warnings saturate.

export type AttentionInputs = {
  guardian_block_count: number;
  guardian_warn_count: number;
  retry_loop_detected: boolean;
  latency_anomaly: boolean;
  pii_leak_flagged: boolean;
  manual_flag: boolean;
};

// Weights: manual_flag + pii_leak are strongest single-signal;
// guardian counts accumulate but are capped to avoid runaway saturation.
const W = {
  block: 0.2, // per occurrence, capped at 3 → max 0.6
  warn: 0.08, // per occurrence, capped at 5 → max 0.4
  retry: 0.15,
  latency: 0.1,
  pii: 0.25,
  manual: 0.3,
};

export function computeAttentionScore(i: AttentionInputs): number {
  const raw =
    Math.min(i.guardian_block_count, 3) * W.block +
    Math.min(i.guardian_warn_count, 5) * W.warn +
    (i.retry_loop_detected ? W.retry : 0) +
    (i.latency_anomaly ? W.latency : 0) +
    (i.pii_leak_flagged ? W.pii : 0) +
    (i.manual_flag ? W.manual : 0);
  return Math.min(1, Math.max(0, Number(raw.toFixed(2))));
}
