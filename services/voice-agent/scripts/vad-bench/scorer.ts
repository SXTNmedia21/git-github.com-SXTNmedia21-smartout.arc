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
