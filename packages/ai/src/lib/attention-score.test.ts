// packages/ai/src/lib/attention-score.test.ts
// ADR-0184 Q7 — composite attention score for session triage ranking.

import { describe, expect, it } from "vitest";
import { computeAttentionScore } from "./attention-score.js";

describe("computeAttentionScore", () => {
  it("returns 0 for clean session", () => {
    expect(
      computeAttentionScore({
        guardian_block_count: 0,
        guardian_warn_count: 0,
        retry_loop_detected: false,
        latency_anomaly: false,
        pii_leak_flagged: false,
        manual_flag: false,
      }),
    ).toBe(0);
  });

  it("caps at 1.0 for maximum violations", () => {
    expect(
      computeAttentionScore({
        guardian_block_count: 10,
        guardian_warn_count: 10,
        retry_loop_detected: true,
        latency_anomaly: true,
        pii_leak_flagged: true,
        manual_flag: true,
      }),
    ).toBe(1);
  });

  it("manual_flag adds 0.3", () => {
    expect(
      computeAttentionScore({
        guardian_block_count: 0,
        guardian_warn_count: 0,
        retry_loop_detected: false,
        latency_anomaly: false,
        pii_leak_flagged: false,
        manual_flag: true,
      }),
    ).toBeCloseTo(0.3, 2);
  });

  it("guardian_block weights heavier than guardian_warn", () => {
    const withBlock = computeAttentionScore({
      guardian_block_count: 1,
      guardian_warn_count: 0,
      retry_loop_detected: false,
      latency_anomaly: false,
      pii_leak_flagged: false,
      manual_flag: false,
    });
    const withWarn = computeAttentionScore({
      guardian_block_count: 0,
      guardian_warn_count: 1,
      retry_loop_detected: false,
      latency_anomaly: false,
      pii_leak_flagged: false,
      manual_flag: false,
    });
    expect(withBlock).toBeGreaterThan(withWarn);
  });
});
