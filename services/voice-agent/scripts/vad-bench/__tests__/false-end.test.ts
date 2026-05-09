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
