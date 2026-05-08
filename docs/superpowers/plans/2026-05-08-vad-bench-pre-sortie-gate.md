---
title: "vad-bench — Pre-Sortie Gate for ADR-0282 Voice-Plane Consolidation"
status: ready
created: 2026-05-08
updated: 2026-05-08
module: MODULE_BOTSSON
tags: [voice, livekit, vad, benchmark, adr-0282, pre-sortie-gate]
adr: [ADR-0282, ADR-0073]
sortie: feat/vad-bench
parallel_with: [B1, B2]
gates: [ADR-0282 E6 deletions]
---

# vad-bench Pre-Sortie Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `services/voice-agent/scripts/vad-bench.ts` — a deterministic CI-runnable benchmark that measures LiveKit + OpenAI Realtime turn-taking against absolute ADR-0282 R6 targets. Hard-fails on any miss. Pre-sortie gate for ADR-0282 E6 (Ultravox deletions) — no E6 without passing bench.

**Architecture:** Two phases per run.
1. **Record phase (`--record`):** drive OpenAI Realtime VAD with synthetic WAV input through the voice-agent's existing turnDetection config. Capture `audio_end_ts` (silence boundary in fixture) and `turn_end_ts` (when server VAD declared end-of-turn). Writes `bench-results-<timestamp>.json`.
2. **Score phase (default):** read JSON, compute `latencyMs[] = turn_end_ts - audio_end_ts`, derive P50/P95 percentiles + false-end ratio, write `bench-summary.md`. Exit 0 on pass, exit 1 on any target miss.

Pure-fn cores (percentile, false-end, markdown) are TDD-able offline. Live recorder is integration-mode and uses the same OpenAI Realtime client config as `services/voice-agent/src/agent.ts:103-124`.

**Tech Stack:** Node.js + tsx (matches voice-agent runtime), `@livekit/agents-plugin-openai` (already installed for OpenAI Realtime client), Vitest (TDD pure fns), Zod (fixture schema). NO new framework — reuses pattern from `packages/ai/src/__evals__/golden-transcripts.eval.ts`.

**Targets (ADR-0282 R6, absolute):**
- P50 latency ≤ 600ms
- P95 latency ≤ 900ms
- False-end-of-turn ratio ≤ 5%

Hard fail on any miss. No "consider" or "review". Exit code drives CI.

**Parallel with B1 + B2:** No file overlap. B1 touches BFF + stage-engine adapter. B2 touches BFF auth lib + mobile hooks. vad-bench is `services/voice-agent/scripts/`. Three sorties run independently.

---

## Files

- Create: `services/voice-agent/scripts/vad-bench.ts` — CLI entry
- Create: `services/voice-agent/scripts/vad-bench/types.ts` — types + Zod schema
- Create: `services/voice-agent/scripts/vad-bench/percentile.ts` — pure-fn percentile calculator
- Create: `services/voice-agent/scripts/vad-bench/false-end.ts` — pure-fn false-end ratio
- Create: `services/voice-agent/scripts/vad-bench/markdown.ts` — pure-fn markdown formatter
- Create: `services/voice-agent/scripts/vad-bench/recorder.ts` — live OpenAI Realtime recorder
- Create: `services/voice-agent/scripts/vad-bench/scorer.ts` — orchestrates scoring + acceptance
- Create: `services/voice-agent/scripts/vad-bench/__tests__/percentile.test.ts`
- Create: `services/voice-agent/scripts/vad-bench/__tests__/false-end.test.ts`
- Create: `services/voice-agent/scripts/vad-bench/__tests__/markdown.test.ts`
- Create: `services/voice-agent/scripts/vad-bench/__tests__/scorer.test.ts`
- Create: `services/voice-agent/scripts/vad-bench/fixtures/README.md` — fixture authoring rules
- Create: `services/voice-agent/scripts/vad-bench/fixtures/<seed>.json` — committed seed fixtures (5-10 scenarios)
- Modify: `services/voice-agent/package.json` — add `vad-bench` and `vad-bench:record` script entries
- Modify: `services/voice-agent/package.json` — add `vitest` to devDependencies (currently missing)

## Self-Review Notes

Voice-agent currently has no test framework. devDependencies = tsx + typescript only. Adding vitest is necessary for TDD; keep it as devDependency only, not a runtime cost.

Fixture format defines `audio_path` (relative to fixtures dir), `audio_end_ts_ms` (silence boundary in source WAV), and recorded outputs `turn_end_ts_ms` (added by recorder phase). Same fixture re-used across record + score phases.

False-end definition: turn-end event fired BEFORE `audio_end_ts_ms` (i.e. while user is still speaking). Detection ratio = false-end-events / total-fixtures.

OpenAI Realtime turnDetection config copied verbatim from `services/voice-agent/src/agent.ts:114-123`:
```typescript
{
  type: "server_vad",
  threshold: 0.5,
  prefix_padding_ms: 200,
  silence_duration_ms: 250,
  create_response: true,
  interrupt_response: true,
}
```

Bench runs against THIS config — same shape that production uses. If config changes, bench must re-run.

Live recorder requires `OPENAI_API_KEY` env var (already part of voice-agent runtime config). Score-only mode requires no API access — runs against committed JSON fixtures.

---

## Task 1: Types + JSON output schema

**Files:**
- Create: `services/voice-agent/scripts/vad-bench/types.ts`

- [ ] **Step 1: Write the types**

```typescript
// services/voice-agent/scripts/vad-bench/types.ts
//
// Bench data shapes for vad-bench. Single source of truth for the JSON
// produced by the recorder and consumed by the scorer.
//
// Targets are codified inline so a config drift can be caught by reviewing
// this file alongside services/voice-agent/src/agent.ts.

import { z } from "zod";

/** Absolute targets per ADR-0282 R6 — codified, not configurable. */
export const TARGETS = {
  P50_MS: 600,
  P95_MS: 900,
  FALSE_END_RATIO: 0.05,
} as const;

export const fixtureSchema = z.object({
  /** Stable identifier for cross-run comparison. */
  id: z.string().min(1),
  /** Human-readable description. */
  description: z.string(),
  /** Path to WAV fixture, relative to fixtures dir. */
  audio_path: z.string().min(1),
  /** Ground-truth: ms offset where the user's last utterance ends + silence begins. */
  audio_end_ts_ms: z.number().int().nonnegative(),
  /** Optional ground-truth label for false-end detection. */
  contains_internal_pauses: z.boolean().default(false),
});

export type Fixture = z.infer<typeof fixtureSchema>;

export const recordingSchema = z.object({
  /** Reference back to the fixture by id. */
  fixture_id: z.string().min(1),
  /** Server-VAD turn-end timestamp, ms offset within the audio stream. */
  turn_end_ts_ms: z.number().int().nonnegative(),
  /** Whether the server fired turn-end before the ground-truth audio_end_ts_ms. */
  false_end: z.boolean(),
  /** Wall-clock ms the recording took (incl. handshake). */
  wall_ms: z.number().int().nonnegative(),
});

export type Recording = z.infer<typeof recordingSchema>;

export const benchOutputSchema = z.object({
  /** ISO-8601 timestamp the recording phase finished. */
  recorded_at: z.string(),
  /** Hash of the turnDetection config the bench was run against. */
  config_hash: z.string(),
  /** Per-fixture recording rows. */
  recordings: z.array(recordingSchema),
});

export type BenchOutput = z.infer<typeof benchOutputSchema>;

/** Computed bench result from scoring phase. */
export type BenchScore = {
  total: number;
  p50_ms: number;
  p95_ms: number;
  false_end_count: number;
  false_end_ratio: number;
  passed: {
    p50: boolean;
    p95: boolean;
    false_end: boolean;
    overall: boolean;
  };
};
```

- [ ] **Step 2: Confirm vitest is available in voice-agent**

Run: `pnpm --filter @smartout/voice-agent why vitest 2>&1 | head -5`

If "package not found" — proceed to Step 3 install. Else skip.

- [ ] **Step 3: Add vitest to voice-agent devDependencies (if missing)**

Run:
```bash
pnpm --filter @smartout/voice-agent add -D vitest @vitest/expect zod
```

`zod` may already be installed via workspace — verify with `pnpm list zod`. If transitively present, add direct dep anyway for explicit reference.

- [ ] **Step 4: Commit**

```bash
git add services/voice-agent/scripts/vad-bench/types.ts services/voice-agent/package.json pnpm-lock.yaml
git commit -m "feat(voice-agent): vad-bench types + targets (ADR-0282 R6)

Defines Fixture, Recording, BenchOutput schemas with Zod. TARGETS constant
codifies P50 ≤ 600ms, P95 ≤ 900ms, false-end ≤ 5% from ADR-0282 R6.
Adds vitest + zod as devDependencies for TDD pure-fn cores.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Percentile calculator (TDD)

**Files:**
- Create: `services/voice-agent/scripts/vad-bench/percentile.ts`
- Create: `services/voice-agent/scripts/vad-bench/__tests__/percentile.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// services/voice-agent/scripts/vad-bench/__tests__/percentile.test.ts
import { describe, expect, it } from "vitest";
import { percentile } from "../percentile.js";

describe("percentile — nearest-rank method, sorted ascending", () => {
  it("returns NaN for empty input", () => {
    expect(percentile([], 0.5)).toBeNaN();
  });

  it("returns the single value for a single-element input", () => {
    expect(percentile([42], 0.5)).toBe(42);
    expect(percentile([42], 0.95)).toBe(42);
  });

  it("computes P50 for an odd-length sorted array", () => {
    expect(percentile([100, 200, 300, 400, 500], 0.5)).toBe(300);
  });

  it("computes P95 for a 20-element distribution", () => {
    const arr = Array.from({ length: 20 }, (_, i) => (i + 1) * 100);
    expect(percentile(arr, 0.95)).toBe(1900);
  });

  it("does not require pre-sorted input", () => {
    expect(percentile([500, 100, 300, 200, 400], 0.5)).toBe(300);
  });

  it("clamps quantile to [0, 1] range", () => {
    expect(percentile([1, 2, 3], 1.5)).toBe(3);
    expect(percentile([1, 2, 3], -0.5)).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @smartout/voice-agent vitest run scripts/vad-bench/__tests__/percentile.test.ts`

Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```typescript
// services/voice-agent/scripts/vad-bench/percentile.ts
//
// Nearest-rank percentile calculation. We deliberately do NOT use linear
// interpolation — bench targets are integer ms thresholds, so the more
// pessimistic nearest-rank reading is preferred (a P95 = 901 must fail
// even if interpolated P95 would round to 900).

export function percentile(values: readonly number[], quantile: number): number {
  if (values.length === 0) return NaN;
  const q = Math.min(1, Math.max(0, quantile));
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(q * sorted.length) - 1;
  const idx = Math.min(Math.max(rank, 0), sorted.length - 1);
  return sorted[idx];
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @smartout/voice-agent vitest run scripts/vad-bench/__tests__/percentile.test.ts`

Expected: 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add services/voice-agent/scripts/vad-bench/percentile.ts services/voice-agent/scripts/vad-bench/__tests__/percentile.test.ts
git commit -m "feat(voice-agent): nearest-rank percentile for vad-bench

Pure pessimistic percentile — chooses the higher integer at boundary so
sub-millisecond bench misses still fail. 6 vitest cases covering empty,
singleton, odd-length, 20-element, unsorted, and clamped quantile ranges.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: False-end ratio calculator (TDD)

**Files:**
- Create: `services/voice-agent/scripts/vad-bench/false-end.ts`
- Create: `services/voice-agent/scripts/vad-bench/__tests__/false-end.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// services/voice-agent/scripts/vad-bench/__tests__/false-end.test.ts
import { describe, expect, it } from "vitest";
import { falseEndRatio, isFalseEnd } from "../false-end.js";
import type { Fixture, Recording } from "../types.js";

const fixture = (overrides: Partial<Fixture> = {}): Fixture => ({
  id: "f1",
  description: "test",
  audio_path: "f1.wav",
  audio_end_ts_ms: 5000,
  contains_internal_pauses: false,
  ...overrides,
});

const recording = (overrides: Partial<Recording> = {}): Recording => ({
  fixture_id: "f1",
  turn_end_ts_ms: 5500,
  false_end: false,
  wall_ms: 100,
  ...overrides,
});

describe("isFalseEnd — turn-end fired before user finished speaking", () => {
  it("returns false when turn_end is at or after audio_end", () => {
    expect(isFalseEnd(fixture(), recording({ turn_end_ts_ms: 5000 }))).toBe(false);
    expect(isFalseEnd(fixture(), recording({ turn_end_ts_ms: 5500 }))).toBe(false);
  });

  it("returns true when turn_end fires before audio_end", () => {
    expect(isFalseEnd(fixture(), recording({ turn_end_ts_ms: 4500 }))).toBe(true);
  });

  it("respects the silence_duration_ms tolerance — 250ms inside is still false-end", () => {
    // Server fires turn_end after 250ms silence; if our ground-truth audio_end is at 5000
    // and server fires at 4900, that's 100ms BEFORE end-of-speech — clearly false.
    expect(isFalseEnd(fixture(), recording({ turn_end_ts_ms: 4900 }))).toBe(true);
  });
});

describe("falseEndRatio — fraction of recordings that fired before audio_end", () => {
  it("returns 0 for an empty list", () => {
    expect(falseEndRatio([])).toBe(0);
  });

  it("returns 0 when no recordings are false-end", () => {
    const recordings = [
      recording({ false_end: false }),
      recording({ fixture_id: "f2", false_end: false }),
    ];
    expect(falseEndRatio(recordings)).toBe(0);
  });

  it("computes 0.5 when half the recordings are false-end", () => {
    const recordings = [
      recording({ false_end: true }),
      recording({ fixture_id: "f2", false_end: false }),
    ];
    expect(falseEndRatio(recordings)).toBe(0.5);
  });

  it("returns 1.0 when all recordings are false-end", () => {
    expect(falseEndRatio([recording({ false_end: true })])).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @smartout/voice-agent vitest run scripts/vad-bench/__tests__/false-end.test.ts`

Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```typescript
// services/voice-agent/scripts/vad-bench/false-end.ts
//
// "False end of turn" = OpenAI server VAD fired turn-end while the user
// was still speaking, i.e. before the ground-truth audio_end_ts_ms in the
// fixture. ADR-0282 R6 caps acceptable rate at 5%.

import type { Fixture, Recording } from "./types.js";

export function isFalseEnd(fixture: Fixture, recording: Recording): boolean {
  return recording.turn_end_ts_ms < fixture.audio_end_ts_ms;
}

export function falseEndRatio(recordings: readonly Recording[]): number {
  if (recordings.length === 0) return 0;
  const falseEnds = recordings.filter((r) => r.false_end).length;
  return falseEnds / recordings.length;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @smartout/voice-agent vitest run scripts/vad-bench/__tests__/false-end.test.ts`

Expected: 7 PASS.

- [ ] **Step 5: Commit**

```bash
git add services/voice-agent/scripts/vad-bench/false-end.ts services/voice-agent/scripts/vad-bench/__tests__/false-end.test.ts
git commit -m "feat(voice-agent): false-end-of-turn detector for vad-bench

isFalseEnd compares server turn_end_ts against ground-truth audio_end_ts;
fires true when server cut user off mid-utterance. falseEndRatio aggregates.
7 vitest cases covering boundary, mid-speech cut, half-distribution, all-false.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Markdown summary formatter (TDD)

**Files:**
- Create: `services/voice-agent/scripts/vad-bench/markdown.ts`
- Create: `services/voice-agent/scripts/vad-bench/__tests__/markdown.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// services/voice-agent/scripts/vad-bench/__tests__/markdown.test.ts
import { describe, expect, it } from "vitest";
import { formatSummary } from "../markdown.js";
import type { BenchScore } from "../types.js";

const passingScore: BenchScore = {
  total: 10,
  p50_ms: 480,
  p95_ms: 820,
  false_end_count: 0,
  false_end_ratio: 0,
  passed: { p50: true, p95: true, false_end: true, overall: true },
};

const failingScore: BenchScore = {
  total: 10,
  p50_ms: 720,
  p95_ms: 1100,
  false_end_count: 2,
  false_end_ratio: 0.2,
  passed: { p50: false, p95: false, false_end: false, overall: false },
};

describe("formatSummary — markdown emit for CI artefact", () => {
  it("includes a PASS verdict line when overall passed", () => {
    const md = formatSummary(passingScore);
    expect(md).toContain("Overall: PASS");
    expect(md).toContain("P50: 480ms (≤ 600ms) ✅");
    expect(md).toContain("P95: 820ms (≤ 900ms) ✅");
    expect(md).toContain("False-end: 0% (≤ 5%) ✅");
  });

  it("includes a FAIL verdict line and per-target FAIL marks when any target missed", () => {
    const md = formatSummary(failingScore);
    expect(md).toContain("Overall: FAIL");
    expect(md).toContain("P50: 720ms (≤ 600ms) ❌");
    expect(md).toContain("P95: 1100ms (≤ 900ms) ❌");
    expect(md).toContain("False-end: 20% (≤ 5%) ❌");
  });

  it("includes total fixture count", () => {
    expect(formatSummary(passingScore)).toContain("Total fixtures: 10");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @smartout/voice-agent vitest run scripts/vad-bench/__tests__/markdown.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
// services/voice-agent/scripts/vad-bench/markdown.ts
//
// Renders BenchScore as CI-attachable markdown. Output is consumed by
// (a) developer reviewing local bench output, (b) CI artefact uploader,
// (c) GitHub Actions step summary.

import { TARGETS, type BenchScore } from "./types.js";

const mark = (passed: boolean): string => (passed ? "✅" : "❌");

export function formatSummary(score: BenchScore): string {
  const overall = score.passed.overall ? "PASS" : "FAIL";
  const lines = [
    "# vad-bench summary",
    "",
    `Overall: ${overall}`,
    "",
    `Total fixtures: ${score.total}`,
    "",
    "## Latency",
    "",
    `- P50: ${score.p50_ms}ms (≤ ${TARGETS.P50_MS}ms) ${mark(score.passed.p50)}`,
    `- P95: ${score.p95_ms}ms (≤ ${TARGETS.P95_MS}ms) ${mark(score.passed.p95)}`,
    "",
    "## Turn-taking integrity",
    "",
    `- False-end: ${(score.false_end_ratio * 100).toFixed(0)}% (≤ ${(TARGETS.FALSE_END_RATIO * 100).toFixed(0)}%) ${mark(score.passed.false_end)}`,
    `- False-end count: ${score.false_end_count}`,
    "",
  ];
  return lines.join("\n");
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @smartout/voice-agent vitest run scripts/vad-bench/__tests__/markdown.test.ts`

Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add services/voice-agent/scripts/vad-bench/markdown.ts services/voice-agent/scripts/vad-bench/__tests__/markdown.test.ts
git commit -m "feat(voice-agent): markdown summary formatter for vad-bench

CI-attachable markdown emit with per-target PASS/FAIL marks and overall
verdict. 3 vitest cases covering passing run, failing run, total count.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Scorer — orchestrate score-from-recording (TDD)

**Files:**
- Create: `services/voice-agent/scripts/vad-bench/scorer.ts`
- Create: `services/voice-agent/scripts/vad-bench/__tests__/scorer.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// services/voice-agent/scripts/vad-bench/__tests__/scorer.test.ts
import { describe, expect, it } from "vitest";
import { scoreBench } from "../scorer.js";
import type { Fixture, Recording } from "../types.js";

const f = (id: string, audio_end: number): Fixture => ({
  id,
  description: id,
  audio_path: `${id}.wav`,
  audio_end_ts_ms: audio_end,
  contains_internal_pauses: false,
});

const r = (id: string, turn_end: number, audio_end: number): Recording => ({
  fixture_id: id,
  turn_end_ts_ms: turn_end,
  false_end: turn_end < audio_end,
  wall_ms: 100,
});

describe("scoreBench — combines latency percentiles + false-end ratio + acceptance gate", () => {
  it("PASSES when all targets met", () => {
    const fixtures = [f("a", 1000), f("b", 1000), f("c", 1000)];
    const recordings = [r("a", 1400, 1000), r("b", 1500, 1000), r("c", 1450, 1000)];
    // Latencies: 400, 500, 450 — P50=450, P95=500, both well under targets.
    const score = scoreBench(fixtures, recordings);
    expect(score.passed.overall).toBe(true);
    expect(score.p50_ms).toBe(450);
    expect(score.p95_ms).toBe(500);
    expect(score.false_end_ratio).toBe(0);
  });

  it("FAILS when P95 misses target", () => {
    const fixtures = Array.from({ length: 20 }, (_, i) => f(`f${i}`, 1000));
    const recordings = Array.from({ length: 20 }, (_, i) =>
      // First 19 latencies = 500ms, 20th = 1000ms (above P95 target)
      r(`f${i}`, 1000 + (i === 19 ? 1000 : 500), 1000),
    );
    const score = scoreBench(fixtures, recordings);
    expect(score.passed.p95).toBe(false);
    expect(score.passed.overall).toBe(false);
    expect(score.p95_ms).toBe(1000);
  });

  it("FAILS when false-end ratio above 5%", () => {
    const fixtures = Array.from({ length: 10 }, (_, i) => f(`f${i}`, 1000));
    const recordings = [
      // 1 false-end (turn_end = 800 < audio_end = 1000), 9 valid
      r("f0", 800, 1000),
      ...Array.from({ length: 9 }, (_, i) => r(`f${i + 1}`, 1500, 1000)),
    ];
    const score = scoreBench(fixtures, recordings);
    expect(score.false_end_ratio).toBeCloseTo(0.1, 2);
    expect(score.passed.false_end).toBe(false);
    expect(score.passed.overall).toBe(false);
  });

  it("FAILS when fixture count is zero", () => {
    const score = scoreBench([], []);
    expect(score.passed.overall).toBe(false);
  });

  it("ignores recordings with no matching fixture", () => {
    const fixtures = [f("a", 1000)];
    const recordings = [r("a", 1500, 1000), r("orphan", 9999, 1000)];
    const score = scoreBench(fixtures, recordings);
    expect(score.total).toBe(1);
    expect(score.p50_ms).toBe(500);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @smartout/voice-agent vitest run scripts/vad-bench/__tests__/scorer.test.ts`

Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```typescript
// services/voice-agent/scripts/vad-bench/scorer.ts
//
// Aggregates a fixture set + recording set into a BenchScore. Pure data
// transformation — no I/O. Caller (vad-bench.ts) is responsible for
// loading the fixtures and recordings and writing the JSON / markdown.

import { percentile } from "./percentile.js";
import { falseEndRatio } from "./false-end.js";
import { TARGETS, type BenchScore, type Fixture, type Recording } from "./types.js";

export function scoreBench(
  fixtures: readonly Fixture[],
  recordings: readonly Recording[],
): BenchScore {
  // Match recordings to fixtures by id. Drop orphans defensively — shouldn't
  // happen in correct flow but a missing fixture should not skew percentiles.
  const fixtureById = new Map(fixtures.map((f) => [f.id, f]));
  const matched: Array<{ fixture: Fixture; recording: Recording }> = [];
  for (const r of recordings) {
    const fix = fixtureById.get(r.fixture_id);
    if (fix) matched.push({ fixture: fix, recording: r });
  }

  const latencies = matched.map(
    ({ fixture, recording }) => recording.turn_end_ts_ms - fixture.audio_end_ts_ms,
  );

  const p50_ms = matched.length === 0 ? 0 : Math.round(percentile(latencies, 0.5));
  const p95_ms = matched.length === 0 ? 0 : Math.round(percentile(latencies, 0.95));
  const false_end_count = matched.filter(({ recording }) => recording.false_end).length;
  const false_end_ratio_value =
    matched.length === 0 ? 0 : falseEndRatio(matched.map((m) => m.recording));

  const p50_pass = matched.length > 0 && p50_ms <= TARGETS.P50_MS;
  const p95_pass = matched.length > 0 && p95_ms <= TARGETS.P95_MS;
  const false_end_pass = matched.length > 0 && false_end_ratio_value <= TARGETS.FALSE_END_RATIO;

  return {
    total: matched.length,
    p50_ms,
    p95_ms,
    false_end_count,
    false_end_ratio: false_end_ratio_value,
    passed: {
      p50: p50_pass,
      p95: p95_pass,
      false_end: false_end_pass,
      overall: p50_pass && p95_pass && false_end_pass,
    },
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @smartout/voice-agent vitest run scripts/vad-bench/__tests__/scorer.test.ts`

Expected: 5 PASS.

- [ ] **Step 5: Commit**

```bash
git add services/voice-agent/scripts/vad-bench/scorer.ts services/voice-agent/scripts/vad-bench/__tests__/scorer.test.ts
git commit -m "feat(voice-agent): scoreBench orchestrator for vad-bench

Pure data transformation matching recordings to fixtures by id, computing
P50/P95 latencies and false-end ratio, then deriving per-target + overall
acceptance booleans against TARGETS. 5 vitest cases covering all-pass,
P95 miss, false-end miss, empty fixture set, orphan recording.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Live recorder against OpenAI Realtime VAD

**Files:**
- Create: `services/voice-agent/scripts/vad-bench/recorder.ts`
- Create: `services/voice-agent/scripts/vad-bench/fixtures/README.md`
- Create: `services/voice-agent/scripts/vad-bench/fixtures/0001-short-utterance.json`

- [ ] **Step 1: Write fixtures README**

```markdown
# vad-bench fixtures

Each fixture is a JSON file declaring a synthetic audio sample plus the
ground-truth boundary where the user's last utterance ends and silence
begins. The recorder feeds the WAV through OpenAI Realtime server-VAD
with the same `turnDetection` config the production voice-agent uses
(`services/voice-agent/src/agent.ts:114-123`), captures the server
turn-end timestamp, and writes a recording row.

## Fixture file format

```json
{
  "id": "0001-short-utterance",
  "description": "Single short utterance, 3s speech + 2s silence",
  "audio_path": "wav/0001-short-utterance.wav",
  "audio_end_ts_ms": 3000,
  "contains_internal_pauses": false
}
```

## WAV requirements

- 16 kHz mono PCM16, matching OpenAI Realtime input format
- ≥ 1s of trailing silence after `audio_end_ts_ms` so the server has
  enough silence to fire turn-end without running off the end of audio
- TTS-generated is fine — Pontus' personal Norwegian TTS or `say`/`espeak`
  output is acceptable. Voice clarity matters less than reliable boundary
  detection by the VAD.

## Generating the seed set

Run `pnpm --filter @smartout/voice-agent vad-bench:generate-fixtures` to
TTS-generate a default set of 10 scenarios. (Script lives at
`scripts/vad-bench/generate-fixtures.ts` — out of scope for this plan;
seed set is committed pre-bench-run.)

## Scenarios in the seed set

The seed set covers (committed in this plan):

1. Short utterance (3s + 2s silence)
2. Long utterance (15s + 2s silence)
3. Mid-sentence pause (5s + 600ms pause + 5s + 2s silence) — `contains_internal_pauses: true`
4. Multiple short utterances back-to-back
5. Long silence preceding short utterance
6. Whispered low-volume utterance
7. Loud utterance
8. Slow speech rate
9. Fast speech rate
10. Speech with background noise (TTS + lo-fi noise overlay)
```

- [ ] **Step 2: Commit one seed fixture (others added when WAV files generated)**

```json
// services/voice-agent/scripts/vad-bench/fixtures/0001-short-utterance.json
{
  "id": "0001-short-utterance",
  "description": "Single short utterance, 3s speech + 2s trailing silence",
  "audio_path": "wav/0001-short-utterance.wav",
  "audio_end_ts_ms": 3000,
  "contains_internal_pauses": false
}
```

WAV file (`wav/0001-short-utterance.wav`) is binary — operator generates locally before first record run. Reference command:

```bash
# Linux: espeak-ng + sox
espeak-ng -v no -s 160 "Hei Botsson, hva er status på dagens vakter?" --stdout \
  | sox - -r 16000 -c 1 -b 16 -e signed-integer wav/0001-short-utterance.wav pad 0 2
```

- [ ] **Step 3: Implement live recorder**

```typescript
// services/voice-agent/scripts/vad-bench/recorder.ts
//
// Drives OpenAI Realtime server-VAD with WAV fixtures and captures the
// turn_end timestamp. Mirrors services/voice-agent/src/agent.ts:103-124
// turnDetection config so the bench measures the same VAD configuration
// production uses.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import type { Fixture, Recording } from "./types.js";

const TURN_DETECTION = {
  type: "server_vad" as const,
  threshold: 0.5,
  prefix_padding_ms: 200,
  silence_duration_ms: 250,
  create_response: true,
  interrupt_response: true,
};

export const TURN_DETECTION_HASH = JSON.stringify(TURN_DETECTION);

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(SCRIPT_DIR, "fixtures");

/**
 * Records a single fixture against OpenAI Realtime API. Resolves with the
 * Recording row or throws on connection / API failure. Caller is responsible
 * for retry / aggregation.
 *
 * Implementation detail: this uses the OpenAI Node SDK Realtime API
 * (websocket-based). The WAV is read from disk, base64-encoded, and sent
 * as a single input_audio_buffer.append + input_audio_buffer.commit. The
 * server responds with input_audio_buffer.speech_started / speech_stopped
 * events; we measure speech_stopped offset relative to the file's leading
 * silence start.
 */
export async function recordFixture(fixture: Fixture, apiKey: string): Promise<Recording> {
  const wavPath = join(FIXTURES_DIR, fixture.audio_path);
  const wavBuffer = readFileSync(wavPath);
  const audio_b64 = wavBuffer.toString("base64");

  const client = new OpenAI({ apiKey });

  const startedAt = Date.now();
  const session = await client.beta.realtime.sessions.create({
    model: "gpt-4o-realtime-preview",
    turn_detection: TURN_DETECTION,
    input_audio_format: "pcm16",
  });

  const wsUrl = `wss://api.openai.com/v1/realtime?model=${session.model}`;
  const ws = new WebSocket(wsUrl, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Beta": "realtime=v1",
    },
  } as unknown as undefined);

  return new Promise((resolve, reject) => {
    let speechStoppedMs: number | null = null;

    ws.addEventListener("open", () => {
      ws.send(
        JSON.stringify({
          type: "input_audio_buffer.append",
          audio: audio_b64,
        }),
      );
      ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    });

    ws.addEventListener("message", (ev) => {
      const evt = JSON.parse(ev.data as string);
      if (evt.type === "input_audio_buffer.speech_stopped") {
        speechStoppedMs = evt.audio_end_ms ?? Date.now() - startedAt;
        ws.close();
      }
    });

    ws.addEventListener("close", () => {
      const wallMs = Date.now() - startedAt;
      if (speechStoppedMs === null) {
        reject(new Error(`fixture ${fixture.id}: no speech_stopped event`));
        return;
      }
      const turn_end_ts_ms = speechStoppedMs;
      const false_end = turn_end_ts_ms < fixture.audio_end_ts_ms;
      resolve({
        fixture_id: fixture.id,
        turn_end_ts_ms,
        false_end,
        wall_ms: wallMs,
      });
    });

    ws.addEventListener("error", (err) => reject(err));
  });
}
```

- [ ] **Step 4: Manual smoke test on one fixture**

Generate `wav/0001-short-utterance.wav` per Step 2. Run:

```bash
cd services/voice-agent
op run --env-file=../../.env.template -- tsx -e "
  import('./scripts/vad-bench/recorder.js').then(async ({ recordFixture }) => {
    const fix = JSON.parse(require('fs').readFileSync('./scripts/vad-bench/fixtures/0001-short-utterance.json', 'utf8'));
    const rec = await recordFixture(fix, process.env.OPENAI_API_KEY);
    console.log(JSON.stringify(rec, null, 2));
  });
"
```

Expected: `recording` JSON with `turn_end_ts_ms` between 3200-3500 (audio_end 3000 + ~250-500ms VAD silence detection).

- [ ] **Step 5: Commit**

```bash
git add services/voice-agent/scripts/vad-bench/recorder.ts services/voice-agent/scripts/vad-bench/fixtures/README.md services/voice-agent/scripts/vad-bench/fixtures/0001-short-utterance.json
git commit -m "feat(voice-agent): vad-bench live recorder + fixture seed

OpenAI Realtime client driving server-VAD with TURN_DETECTION mirroring
agent.ts:114-123 production config. Records turn_end_ts via
input_audio_buffer.speech_stopped event. Fixture format declared in
fixtures/README.md; one seed fixture committed (WAV generated locally).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Main bench entry + acceptance gate

**Files:**
- Create: `services/voice-agent/scripts/vad-bench.ts`
- Modify: `services/voice-agent/package.json`

- [ ] **Step 1: Write entry script**

```typescript
// services/voice-agent/scripts/vad-bench.ts
//
// CLI entry. Two modes:
//
//   pnpm vad-bench:record   → records all fixtures, writes bench-results-<ts>.json
//   pnpm vad-bench          → reads latest bench-results-*.json, scores, writes
//                             bench-summary.md, exits 0 on pass / 1 on fail.
//
// Pre-sortie gate per ADR-0282 R6 — exit code drives CI / sortie-pre-flight.

import { readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  benchOutputSchema,
  fixtureSchema,
  type BenchOutput,
  type Fixture,
  type Recording,
} from "./vad-bench/types.js";
import { recordFixture, TURN_DETECTION_HASH } from "./vad-bench/recorder.js";
import { scoreBench } from "./vad-bench/scorer.js";
import { formatSummary } from "./vad-bench/markdown.js";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(SCRIPT_DIR, "vad-bench", "fixtures");
const OUTPUT_DIR = join(SCRIPT_DIR, "vad-bench", "output");

function loadFixtures(): Fixture[] {
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => fixtureSchema.parse(JSON.parse(readFileSync(join(FIXTURES_DIR, f), "utf8"))));
}

function loadLatestRecording(): BenchOutput | null {
  let candidates: string[];
  try {
    candidates = readdirSync(OUTPUT_DIR).filter((f) =>
      /^bench-results-.*\.json$/.test(f),
    );
  } catch {
    return null;
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => statSync(join(OUTPUT_DIR, b)).mtimeMs - statSync(join(OUTPUT_DIR, a)).mtimeMs);
  const latest = readFileSync(join(OUTPUT_DIR, candidates[0]), "utf8");
  return benchOutputSchema.parse(JSON.parse(latest));
}

async function recordMode(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY required for record mode");
    process.exit(2);
  }
  const fixtures = loadFixtures();
  console.log(`[vad-bench] recording ${fixtures.length} fixtures`);

  const recordings: Recording[] = [];
  for (const fix of fixtures) {
    try {
      const rec = await recordFixture(fix, apiKey);
      console.log(`[vad-bench] ${fix.id}: turn_end_ts=${rec.turn_end_ts_ms}ms false_end=${rec.false_end}`);
      recordings.push(rec);
    } catch (err) {
      console.error(`[vad-bench] ${fix.id} failed:`, err);
      process.exit(2);
    }
  }

  const out: BenchOutput = {
    recorded_at: new Date().toISOString(),
    config_hash: TURN_DETECTION_HASH,
    recordings,
  };
  const stamp = out.recorded_at.replace(/[:.]/g, "-");
  const outFile = join(OUTPUT_DIR, `bench-results-${stamp}.json`);
  await import("node:fs/promises").then((m) => m.mkdir(OUTPUT_DIR, { recursive: true }));
  writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(`[vad-bench] wrote ${outFile}`);
}

function scoreMode(): void {
  const fixtures = loadFixtures();
  const recording = loadLatestRecording();
  if (!recording) {
    console.error("[vad-bench] no bench-results-*.json found in output/. Run vad-bench:record first.");
    process.exit(2);
  }
  const score = scoreBench(fixtures, recording.recordings);
  const md = formatSummary(score);
  writeFileSync(join(OUTPUT_DIR, "bench-summary.md"), md);
  console.log(md);
  process.exit(score.passed.overall ? 0 : 1);
}

const mode = process.argv[2] === "--record" ? "record" : "score";
if (mode === "record") {
  void recordMode();
} else {
  scoreMode();
}
```

- [ ] **Step 2: Add package.json scripts**

In `services/voice-agent/package.json`, replace `"scripts": { ... }` block with:

```json
  "scripts": {
    "dev": "tsx watch src/agent.ts dev",
    "start": "tsx src/agent.ts start",
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "vad-bench": "tsx scripts/vad-bench.ts",
    "vad-bench:record": "tsx scripts/vad-bench.ts --record",
    "test": "vitest run"
  },
```

- [ ] **Step 3: Verify dry-run score-mode handles missing recording gracefully**

Run: `pnpm --filter @smartout/voice-agent vad-bench`

Expected: stderr "no bench-results-*.json found", exit code 2.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @smartout/voice-agent typecheck`

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add services/voice-agent/scripts/vad-bench.ts services/voice-agent/package.json
git commit -m "feat(voice-agent): vad-bench CLI with record + score modes

Two-phase entry: --record drives OpenAI Realtime against fixture set,
writes bench-results-<ts>.json. Default score mode reads latest results,
runs scoreBench, writes bench-summary.md, exits 0 on pass / 1 on miss.
Pre-sortie gate per ADR-0282 R6.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Acceptance + handoff

- [ ] **Step 1: Operator generates seed WAV files**

Per `fixtures/README.md`, generate `wav/0001-short-utterance.wav` through `wav/0010-...wav` using TTS pipeline. Commit WAV files to repo (binary artifacts, ~100KB each = ~1MB total).

- [ ] **Step 2: Run record + score**

```bash
op run --env-file=.env.template -- pnpm --filter @smartout/voice-agent vad-bench:record
pnpm --filter @smartout/voice-agent vad-bench
```

Expected: exit 0, `bench-summary.md` shows `Overall: PASS`.

- [ ] **Step 3: If FAIL — escalate**

Bench failure on first record-run is a finding worth sharing with PO before sortie opens. Possible causes:
- Voice-agent `silence_duration_ms` setting needs tuning beyond 250ms
- Fixture set is unrepresentative
- OpenAI Realtime regressed
- WAV input format mismatch

Do NOT tune the bench thresholds to make tests pass. Targets are codified in `TARGETS` per ADR-0282 R6 — they require an ADR amendment to change.

- [ ] **Step 4: Write handoff**

Create `docs/HANDOFF-vad-bench.md` summarizing:
- Pure-fn cores TDD'd: percentile, falseEndRatio, formatSummary, scoreBench (4 modules, 21 vitest cases)
- Live recorder against OpenAI Realtime
- Seed fixture set with 10 scenarios
- First-run pass/fail verdict + JSON + markdown artifacts attached
- Sortie pre-flight protocol: run bench before any ADR-0282 E6 deletions; require exit 0

- [ ] **Step 5: CI integration (optional, for follow-up)**

A future GitHub Actions workflow can invoke `pnpm vad-bench` as a required check before any PR touching `services/voice-agent/src/agent.ts` (turnDetection config) or before tagging a sortie-pre-flight artifact. Out of scope for this plan — flag as OPS-followup.

---

## Acceptance Criteria

- [ ] `pnpm --filter @smartout/voice-agent test` runs all four pure-fn test files (percentile, false-end, markdown, scorer) — 21 PASS
- [ ] `pnpm --filter @smartout/voice-agent typecheck` — 0 errors
- [ ] `pnpm --filter @smartout/voice-agent vad-bench` (no recording) exits with code 2 + helpful error
- [ ] `pnpm --filter @smartout/voice-agent vad-bench:record` runs against 10 committed fixtures and writes `output/bench-results-<ts>.json` with `recordings.length === 10`
- [ ] `pnpm --filter @smartout/voice-agent vad-bench` after record run produces `output/bench-summary.md` and exits 0 if all targets met, 1 otherwise
- [ ] No commit touches `services/voice-agent/src/`, `apps/web/`, `apps/mobile/`, `packages/`, `supabase/`, or any ADR file (scope guard — anything else is scope creep, blocks merge)

## Estimated Time

5-7 hours including:
- Pure-fn TDD (Tasks 1-5): 2.5 hours
- Live recorder + smoke test (Task 6): 2 hours
- Main entry + package wiring (Task 7): 1 hour
- WAV fixture generation + first record-run + handoff (Task 8): 1.5 hours

## Rollback

Pure additive — no production code changed. Revert all commits, no migration to undo. Bench was never on critical-path until ADR-0282 E6 sortie opens.

## Out of Scope

- Ultravox baseline-snapshot — explicitly dropped per PO mandate 2026-05-08. Targets are absolute.
- LiveKit Room integration — bench measures OpenAI Realtime VAD directly. LiveKit transport is irrelevant to turn-taking latency (it carries audio, doesn't decide turn-end).
- VAD config tuning — if bench fails, escalate to PO. Do not touch `agent.ts:114-123` from this sortie.
- CI workflow YAML — flagged as OPS-followup. Bench is callable by hand from any operator with `OPENAI_API_KEY`.
- TTS-fixture-generation script (`generate-fixtures.ts`) — operator generates manually for first run; automation deferred.
- Mobile-side VAD measurement — Expo Speech / mobile ASR latency is a separate concern. ADR-0282 R6 targets the voice-agent hop only.

## Cross-References

- ADR-0282 R6 — establishes targets P50 ≤ 600ms, P95 ≤ 900ms, false-end ≤ 5%
- ADR-0073 — golden-transcript framework precedent (pattern reused, not framework imported)
- `services/voice-agent/src/agent.ts:103-124` — TURN_DETECTION must mirror this
- B1 + B2 — parallel sorties, no file overlap
