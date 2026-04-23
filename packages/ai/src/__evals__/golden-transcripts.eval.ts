// packages/ai/src/__evals__/golden-transcripts.eval.ts
//
// Golden-transcripts eval (ADR-0073 Phase 6).
//
// Scores the classifier's intent-classification hop against a small set
// of hand-authored fixtures in ./golden-transcripts/fixtures/. Each
// fixture declares the expected capability + minConfidence; the scorer
// in ./golden-transcripts/scoring.ts combines them into a pass/fail.
//
// Gating:
//  - `RUN_EVALS=1` must be set (otherwise the suite is skipped — keeps CI
//    free for normal unit-test runs).
//  - `OPENROUTER_API_KEY` must be set (the classifier throws without it).
//
// Threshold: `MIN_ACCURACY = 0.8`. If the suite falls below, either a
// fixture is too ambitious for the current classifier (tune
// `minConfidence` in the fixture, not this threshold) or the classifier
// has regressed.

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { classifyIntent } from "../router/intent-classifier.js";
import { goldenTranscriptSchema, type GoldenTranscript } from "./golden-transcripts/_schema.js";
import { scoreGolden, summarize, type GoldenScore } from "./golden-transcripts/scoring.js";

const RUN_EVALS = process.env.RUN_EVALS === "1";
const HAS_KEY = Boolean(process.env.OPENROUTER_API_KEY);
const MIN_ACCURACY = 0.8;

const thisDir = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(thisDir, "golden-transcripts/fixtures");

// Skip the entire suite when:
//  - RUN_EVALS is not set (default — keeps unit-test CI free), OR
//  - OPENROUTER_API_KEY is missing (CI doesn't hard-fail when the secret
//    hasn't been added to the repo yet — first real run happens once
//    Pontus runs `gh secret set OPENROUTER_API_KEY`).
const shouldRun = RUN_EVALS && HAS_KEY;
const suite = shouldRun ? describe : describe.skip;

if (RUN_EVALS && !HAS_KEY) {
  console.warn(
    "[golden-transcripts] RUN_EVALS=1 but OPENROUTER_API_KEY missing — suite skipped. " +
      "Add the secret via `gh secret set OPENROUTER_API_KEY` to enable.",
  );
}

suite("golden-transcripts eval (mid-contract: intent -> gate -> tool-selection)", () => {
  let fixtures: GoldenTranscript[] = [];

  beforeAll(() => {
    fixtures = readdirSync(fixtureDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) =>
        goldenTranscriptSchema.parse(JSON.parse(readFileSync(join(fixtureDir, f), "utf8"))),
      );
  });

  // Note: missing OPENROUTER_API_KEY is handled at module level by skipping
  // the whole `describe` — we never reach tests when the key is absent.

  it("meets min accuracy on intent classification", async () => {
    const scores: GoldenScore[] = [];
    for (const fx of fixtures) {
      const started = Date.now();
      try {
        const intent = await classifyIntent(fx.input.message, "");
        scores.push(scoreGolden(fx, intent, Date.now() - started));
      } catch (err) {
        scores.push({
          id: fx.id,
          intentMatch: false,
          confidenceOk: false,
          error: (err as Error).message,
          latencyMs: Date.now() - started,
        });
      }
    }
    const summary = summarize(scores);
    // eslint-disable-next-line no-console -- eval reports belong in stdout
    console.log(
      `golden-transcripts: ${summary.pass}/${fixtures.length} passed (${(summary.accuracy * 100).toFixed(0)}%)`,
    );
    expect(summary.accuracy).toBeGreaterThanOrEqual(MIN_ACCURACY);
  });
});
