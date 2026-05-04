// packages/ai/src/__evals__/golden-transcripts/scoring.ts
//
// Scoring module for the golden-transcripts eval (ADR-0073 Phase 6).
//
// "Mid-contract" scoring style: we measure the intent-classification hop
// of the agent-router — not the full tool-selection + execution pipeline.
// Each fixture declares an expected `capability` + `minConfidence`; the
// classifier output is scored against both.
//
// This is a narrower contract than `packages/ai/src/router/__evals__`
// (which covers the full router fixture set) — see ADR-0073 for the four
// scoring styles and why each exists.
//
// Fixtures whose expected capability is `null` are graceful-fallback
// cases: the classifier is right when its confidence stays low.

import type { GoldenTranscript } from "./_schema.js";
import type { classifyIntent } from "../../router/intent-classifier.js";

/**
 * The classifier's return type. We intentionally reference it structurally
 * via `Awaited<ReturnType<typeof classifyIntent>>` so the eval cannot drift
 * out of sync with the classifier's exported shape — if the classifier
 * return type is renamed or refined, typecheck fails here first.
 */
type IntentResult = Awaited<ReturnType<typeof classifyIntent>>;

export type GoldenScore = {
  id: string;
  intentMatch: boolean;
  confidenceOk: boolean;
  error?: string;
  latencyMs: number;
};

/**
 * Score a single fixture against a classifier result.
 *
 * - `intentMatch`: the classifier's capability equals the fixture's
 *   expected capability. For `capability === null` fixtures (fallback),
 *   we accept any capability — correctness is judged purely on confidence.
 * - `confidenceOk`: for concrete capabilities, confidence must be ≥
 *   `minConfidence`. For `null` (fallback) fixtures, confidence must be
 *   ≤ 0.5 — the classifier should be visibly unsure on small-talk.
 */
export function scoreGolden(
  fixture: GoldenTranscript,
  intent: IntentResult,
  latencyMs: number,
): GoldenScore {
  const expectedCapability = fixture.expected.intent.capability;
  const intentMatch = expectedCapability === null ? true : intent.capability === expectedCapability;
  const confidenceOk =
    expectedCapability === null
      ? intent.confidence <= 0.5
      : intent.confidence >= fixture.expected.intent.minConfidence;
  return { id: fixture.id, intentMatch, confidenceOk, latencyMs };
}

/**
 * Aggregate per-fixture scores into suite-level totals.
 *
 * `accuracy` counts a fixture as passing only when BOTH `intentMatch`
 * and `confidenceOk` hold. Fixtures with an `error` field are treated as
 * failures (neither flag is true).
 */
export function summarize(scores: GoldenScore[]): {
  pass: number;
  fail: number;
  accuracy: number;
} {
  const pass = scores.filter((s) => s.intentMatch && s.confidenceOk).length;
  const count = scores.length;
  return {
    pass,
    fail: count - pass,
    accuracy: count === 0 ? 0 : pass / count,
  };
}
