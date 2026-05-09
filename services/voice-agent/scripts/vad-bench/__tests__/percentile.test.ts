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
