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
      // 2 high-latency outliers (indices 18 + 19) push P95 (nearest-rank index 18) above 900ms
      r(`f${i}`, 1000 + (i >= 18 ? 1000 : 500), 1000),
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
