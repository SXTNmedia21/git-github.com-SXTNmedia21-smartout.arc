import { describe, it, expect } from "vitest";
import { calculatePunchPoints } from "../utils/points-calculator";

describe("calculatePunchPoints", () => {
  const shiftStart = new Date("2026-03-24T15:00:00Z");

  it("awards 7 points for 5+ min early punch", () => {
    const punchTime = new Date("2026-03-24T14:50:00Z");
    const result = calculatePunchPoints(punchTime, shiftStart);
    expect(result.base).toBe(2);
    expect(result.bonuses).toContainEqual({ label: "on_time", points: 3 });
    expect(result.bonuses).toContainEqual({ label: "early", points: 2 });
    expect(result.total).toBe(7);
  });

  it("awards 5 points for on-time punch (< 5 min early)", () => {
    const result = calculatePunchPoints(new Date("2026-03-24T14:57:00Z"), shiftStart);
    expect(result.total).toBe(5);
  });

  it("deducts points for late punch", () => {
    const result = calculatePunchPoints(new Date("2026-03-24T15:10:00Z"), shiftStart);
    expect(result.total).toBe(0);
  });

  it("deducts extra for very late punch (>15 min)", () => {
    const result = calculatePunchPoints(new Date("2026-03-24T15:20:00Z"), shiftStart);
    expect(result.total).toBe(-3);
  });

  it("applies season multiplier", () => {
    const result = calculatePunchPoints(new Date("2026-03-24T14:50:00Z"), shiftStart, {
      seasonMultiplier: 1.5,
    });
    expect(result.total).toBe(11);
  });
});
