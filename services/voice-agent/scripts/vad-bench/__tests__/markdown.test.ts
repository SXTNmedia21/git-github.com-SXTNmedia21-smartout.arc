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
