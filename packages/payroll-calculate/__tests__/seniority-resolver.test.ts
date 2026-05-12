import { describe, it, expect } from "vitest";
import { resolveSeniorityTier } from "../src/seniority-resolver.js";

describe("resolveSeniorityTier", () => {
  it("returns begynner for < 2 years", () => {
    expect(resolveSeniorityTier("2024-04-15", "2026-04-14")).toBe("begynner");
  });

  it("returns 2_aar on exact 2-year anniversary", () => {
    expect(resolveSeniorityTier("2024-04-15", "2026-04-15")).toBe("2_aar");
  });

  it("returns 2_aar for 2.5 years", () => {
    expect(resolveSeniorityTier("2024-01-01", "2026-07-01")).toBe("2_aar");
  });

  it("returns 4_aar on exact 4-year anniversary", () => {
    expect(resolveSeniorityTier("2022-04-15", "2026-04-15")).toBe("4_aar");
  });

  it("returns 4_aar for 5 years", () => {
    expect(resolveSeniorityTier("2021-04-15", "2026-04-15")).toBe("4_aar");
  });

  it("returns 6_aar for 6 years", () => {
    expect(resolveSeniorityTier("2020-04-15", "2026-04-15")).toBe("6_aar");
  });

  it("returns 8_aar for 8 years", () => {
    expect(resolveSeniorityTier("2018-04-15", "2026-04-15")).toBe("8_aar");
  });

  it("returns 10_aar for 10 years", () => {
    expect(resolveSeniorityTier("2016-04-15", "2026-04-15")).toBe("10_aar");
  });

  it("returns 10_aar for 15 years", () => {
    expect(resolveSeniorityTier("2011-04-15", "2026-04-15")).toBe("10_aar");
  });

  it("returns begynner for same date (0 years)", () => {
    expect(resolveSeniorityTier("2026-04-15", "2026-04-15")).toBe("begynner");
  });

  it("returns begynner when evaluation date is before start (negative case)", () => {
    expect(resolveSeniorityTier("2026-04-15", "2026-04-10")).toBe("begynner");
  });

  it("handles leap-year start date in non-leap evaluation year", () => {
    // Start: 2024-02-29 (leap year). Eval: 2026-02-28 (anniversary in non-leap year)
    expect(resolveSeniorityTier("2024-02-29", "2026-02-28")).toBe("2_aar");
  });

  it("does NOT give 2_aar on Feb 27 in non-leap year for leap-year start", () => {
    // 2026-02-27 is before the 2026-02-28 anniversary → still begynner
    expect(resolveSeniorityTier("2024-02-29", "2026-02-27")).toBe("begynner");
  });

  it("handles exactly 3 years 364 days (stays 2_aar)", () => {
    // Start: 2022-01-01. Eval: 2025-12-31. Years = 3 → 2_aar
    expect(resolveSeniorityTier("2022-01-01", "2025-12-31")).toBe("2_aar");
  });
});
