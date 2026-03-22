import { describe, it, expect } from "vitest";
import {
  propagateBudgetTargets,
  type BudgetPropagationInput,
  type DailyTarget,
} from "../propagate-budget-targets";

function makeInput(overrides: Partial<BudgetPropagationInput> = {}): BudgetPropagationInput {
  return {
    totalTargetRevenue: 700_000,
    targetLaborPercentage: 0.3,
    avgHourlyWage: 200,
    dayFactors: [
      { weekday: 0, factor: 1.0 }, // Mon
      { weekday: 1, factor: 1.0 }, // Tue
      { weekday: 2, factor: 1.0 }, // Wed
      { weekday: 3, factor: 1.0 }, // Thu
      { weekday: 4, factor: 1.0 }, // Fri
      { weekday: 5, factor: 1.0 }, // Sat
      { weekday: 6, factor: 1.0 }, // Sun
    ],
    startDate: "2026-03-02", // Monday
    endDate: "2026-03-08", // Sunday (1 full week)
    ...overrides,
  };
}

describe("propagateBudgetTargets", () => {
  it("distributes evenly when all day factors are 1.0", () => {
    const result = propagateBudgetTargets(makeInput());

    expect(result).toHaveLength(7);
    const dailyRevenue = 700_000 / 7;
    for (const target of result) {
      expect(target.targetRevenue).toBeCloseTo(dailyRevenue, 2);
    }
  });

  it("distributes proportionally with weighted day factors (Fri/Sat higher)", () => {
    const input = makeInput({
      dayFactors: [
        { weekday: 0, factor: 1.0 },
        { weekday: 1, factor: 1.0 },
        { weekday: 2, factor: 1.0 },
        { weekday: 3, factor: 1.0 },
        { weekday: 4, factor: 1.5 }, // Fri
        { weekday: 5, factor: 2.0 }, // Sat
        { weekday: 6, factor: 0.5 }, // Sun
      ],
    });

    const result = propagateBudgetTargets(input);
    expect(result).toHaveLength(7);

    // Friday should get 1.5x of Monday's share
    const monday = result.find((t) => t.date === "2026-03-02")!;
    const friday = result.find((t) => t.date === "2026-03-06")!;
    const saturday = result.find((t) => t.date === "2026-03-07")!;

    expect(friday.targetRevenue / monday.targetRevenue).toBeCloseTo(1.5, 2);
    expect(saturday.targetRevenue / monday.targetRevenue).toBeCloseTo(2.0, 2);

    // Total must still equal 700_000
    const totalRevenue = result.reduce((sum, t) => sum + t.targetRevenue, 0);
    expect(totalRevenue).toBeCloseTo(700_000, 0);
  });

  it("computes labor cost as revenue × labor percentage", () => {
    const result = propagateBudgetTargets(makeInput());

    for (const target of result) {
      expect(target.targetLaborCost).toBeCloseTo(target.targetRevenue * 0.3, 2);
    }
  });

  it("computes staff hours as labor cost ÷ avg hourly wage", () => {
    const result = propagateBudgetTargets(makeInput());

    for (const target of result) {
      const expectedHours = target.targetLaborCost / 200;
      expect(target.targetStaffHours).toBeCloseTo(expectedHours, 2);
    }
  });

  it("handles multi-week season with correct weekly normalization", () => {
    const input = makeInput({
      totalTargetRevenue: 1_400_000,
      startDate: "2026-03-02", // Monday
      endDate: "2026-03-15", // Sunday (2 full weeks)
    });

    const result = propagateBudgetTargets(input);
    expect(result).toHaveLength(14);

    // Each day should get 1_400_000 / 14 = 100_000
    const dailyRevenue = 1_400_000 / 14;
    for (const target of result) {
      expect(target.targetRevenue).toBeCloseTo(dailyRevenue, 2);
    }

    // Total should match
    const totalRevenue = result.reduce((sum, t) => sum + t.targetRevenue, 0);
    expect(totalRevenue).toBeCloseTo(1_400_000, 0);
  });

  it("returns staff hours = 0 when avg hourly wage is zero (no division by zero)", () => {
    const input = makeInput({ avgHourlyWage: 0 });
    const result = propagateBudgetTargets(input);

    for (const target of result) {
      expect(target.targetStaffHours).toBe(0);
      // Revenue and labor cost should still be computed
      expect(target.targetRevenue).toBeGreaterThan(0);
      expect(target.targetLaborCost).toBeGreaterThan(0);
    }
  });

  it("falls back to equal distribution when day factors are empty", () => {
    const input = makeInput({ dayFactors: [] });
    const result = propagateBudgetTargets(input);

    expect(result).toHaveLength(7);
    const dailyRevenue = 700_000 / 7;
    for (const target of result) {
      expect(target.targetRevenue).toBeCloseTo(dailyRevenue, 2);
    }
  });
});
