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
  /** Council R3 2026-05-08: scenario intentionally designed to trigger false VAD end-of-turn. */
  false_end_pressure: z.boolean().optional(),
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
