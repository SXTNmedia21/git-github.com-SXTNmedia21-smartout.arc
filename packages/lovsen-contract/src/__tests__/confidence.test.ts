import { describe, test, expect } from "vitest";
import { ConfidenceSchema, ConfidenceLevelSchema } from "../confidence.js";

describe("ConfidenceLevelSchema", () => {
  test("accepts HØY", () => {
    expect(ConfidenceLevelSchema.safeParse("HØY").success).toBe(true);
  });

  test("accepts MEDIUM", () => {
    expect(ConfidenceLevelSchema.safeParse("MEDIUM").success).toBe(true);
  });

  test("accepts LAV", () => {
    expect(ConfidenceLevelSchema.safeParse("LAV").success).toBe(true);
  });

  test("rejects unknown level", () => {
    expect(ConfidenceLevelSchema.safeParse("HIGH").success).toBe(false);
  });
});

describe("ConfidenceSchema", () => {
  test("accepts a valid confidence object", () => {
    const result = ConfidenceSchema.safeParse({
      level: "HØY",
      score: 0.95,
      reasons: ["Direkte sitat fra Aml. §14-6 hentet fra Lovdata"],
      stale_paragraph: false,
      missing_data: [],
    });
    expect(result.success).toBe(true);
  });

  test("accepts score: 0 (min boundary)", () => {
    const result = ConfidenceSchema.safeParse({
      level: "LAV",
      score: 0,
      reasons: ["Gråsone — krever advokat-vurdering"],
      stale_paragraph: true,
      missing_data: ["contract_id", "tariff_id"],
    });
    expect(result.success).toBe(true);
  });

  test("accepts score: 1 (max boundary)", () => {
    const result = ConfidenceSchema.safeParse({
      level: "HØY",
      score: 1,
      reasons: ["Klar lovhjemmel"],
      stale_paragraph: false,
      missing_data: [],
    });
    expect(result.success).toBe(true);
  });

  test("rejects confidence missing required level field", () => {
    const result = ConfidenceSchema.safeParse({
      // level is missing
      score: 0.8,
      reasons: [],
      stale_paragraph: false,
      missing_data: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path.join("."));
      expect(fields).toContain("level");
    }
  });

  test("rejects score above 1", () => {
    const result = ConfidenceSchema.safeParse({
      level: "HØY",
      score: 1.1,
      reasons: [],
      stale_paragraph: false,
      missing_data: [],
    });
    expect(result.success).toBe(false);
  });

  test("rejects score below 0", () => {
    const result = ConfidenceSchema.safeParse({
      level: "LAV",
      score: -0.1,
      reasons: [],
      stale_paragraph: false,
      missing_data: [],
    });
    expect(result.success).toBe(false);
  });
});
