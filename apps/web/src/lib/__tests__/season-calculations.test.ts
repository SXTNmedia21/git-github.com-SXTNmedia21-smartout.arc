import { describe, it, expect } from "vitest";
import {
  calculateDayTargets,
  calculateHourTargets,
  calculateStaffingNeed,
  type DayFactorInput,
  type HourFactorInput,
} from "../season-calculations";

describe("calculateDayTargets", () => {
  const dayFactors: DayFactorInput[] = [
    { weekday: 0, factor: 1.0 }, // Mon
    { weekday: 1, factor: 1.1 }, // Tue
    { weekday: 2, factor: 1.2 }, // Wed
    { weekday: 3, factor: 1.4 }, // Thu
    { weekday: 4, factor: 2.2 }, // Fri
    { weekday: 5, factor: 2.5 }, // Sat
    { weekday: 6, factor: 1.3 }, // Sun
  ];

  it("distributes total target across season days using factors", () => {
    const result = calculateDayTargets({
      totalTargetRevenue: 700_000,
      startDate: "2026-04-06", // Monday
      endDate: "2026-04-12", // Sunday — exactly 7 days
      dayFactors,
    });

    expect(result).toHaveLength(7);

    // avg_factor = (1.0+1.1+1.2+1.4+2.2+2.5+1.3) / 7 = 10.7 / 7 ≈ 1.5286
    // base_daily = 700000 / 7 = 100000
    // Monday = 100000 × (1.0 / 1.5286) ≈ 65421
    // Saturday = 100000 × (2.5 / 1.5286) ≈ 163551
    const monday = result.find((d) => d.date === "2026-04-06");
    const saturday = result.find((d) => d.date === "2026-04-11");

    expect(monday).toBeDefined();
    expect(saturday).toBeDefined();
    expect(monday!.target).toBeCloseTo(65421, -1);
    expect(saturday!.target).toBeCloseTo(163551, -1);

    // Total should equal original target
    const total = result.reduce((sum, d) => sum + d.target, 0);
    expect(total).toBeCloseTo(700_000, 0);
  });

  it("handles 2-week season with correct weekday mapping", () => {
    const result = calculateDayTargets({
      totalTargetRevenue: 1_000_000,
      startDate: "2026-04-06", // Mon
      endDate: "2026-04-19", // Sun — 14 days
      dayFactors,
    });

    expect(result).toHaveLength(14);

    // Both Mondays should have same target
    const mon1 = result.find((d) => d.date === "2026-04-06");
    const mon2 = result.find((d) => d.date === "2026-04-13");
    expect(mon1!.target).toBeCloseTo(mon2!.target, 0);

    // Total = 1M
    const total = result.reduce((sum, d) => sum + d.target, 0);
    expect(total).toBeCloseTo(1_000_000, 0);
  });

  it("returns equal distribution if no day factors provided", () => {
    const result = calculateDayTargets({
      totalTargetRevenue: 500_000,
      startDate: "2026-04-06",
      endDate: "2026-04-12",
      dayFactors: [],
    });

    expect(result).toHaveLength(7);
    expect(result[0]!.target).toBeCloseTo(500_000 / 7, 0);
  });
});

describe("calculateHourTargets", () => {
  const hourFactors: HourFactorInput[] = [
    { hour: 10, factor: 0.4 },
    { hour: 11, factor: 0.7 },
    { hour: 12, factor: 1.3 },
    { hour: 13, factor: 1.0 },
    { hour: 14, factor: 0.8 },
    { hour: 15, factor: 0.6 },
    { hour: 16, factor: 0.9 },
    { hour: 17, factor: 1.5 },
    { hour: 18, factor: 2.0 },
    { hour: 19, factor: 2.4 },
    { hour: 20, factor: 2.2 },
    { hour: 21, factor: 1.1 },
  ];

  it("distributes day target across open hours using factors", () => {
    const dayTarget = 100_000;
    const result = calculateHourTargets({
      dayTarget,
      hourFactors,
      operatingHours: { openHour: 10, closeHour: 22 },
    });

    // Only open hours should have targets
    expect(result).toHaveLength(12);
    expect(result[0]!.hour).toBe(10);
    expect(result[result.length - 1]!.hour).toBe(21);

    // Sum should equal day target
    const total = result.reduce((sum, h) => sum + h.target, 0);
    expect(total).toBeCloseTo(dayTarget, 0);

    // Peak hour (19:00, factor 2.4) should be highest
    const peak = result.find((h) => h.hour === 19);
    const quiet = result.find((h) => h.hour === 15);
    expect(peak!.target).toBeGreaterThan(quiet!.target);
  });

  it("handles missing hour factors by defaulting to 1.0", () => {
    const result = calculateHourTargets({
      dayTarget: 120_000,
      hourFactors: [{ hour: 12, factor: 2.0 }], // only lunch defined
      operatingHours: { openHour: 10, closeHour: 14 }, // 4 hours
    });

    expect(result).toHaveLength(4);

    // hour 12 has factor 2.0, others default to 1.0
    // Sum of factors: 1.0 + 1.0 + 2.0 + 1.0 = 5.0
    // hour 12 target = 120000 × (2.0 / 5.0) = 48000
    const lunch = result.find((h) => h.hour === 12);
    expect(lunch!.target).toBeCloseTo(48_000, 0);

    const total = result.reduce((sum, h) => sum + h.target, 0);
    expect(total).toBeCloseTo(120_000, 0);
  });
});

describe("calculateStaffingNeed", () => {
  it("calculates staff needed from revenue target and labor %", () => {
    const result = calculateStaffingNeed({
      hourTarget: 50_000,
      targetLaborPercentage: 0.3,
      avgHourlyWage: 250,
    });

    // max_labor_cost = 50000 × 0.30 = 15000
    // staff_needed = 15000 / 250 = 60
    expect(result.maxLaborCost).toBeCloseTo(15_000, 0);
    expect(result.staffNeeded).toBeCloseTo(60, 1);
  });

  it("returns 0 staff when no wage data", () => {
    const result = calculateStaffingNeed({
      hourTarget: 50_000,
      targetLaborPercentage: 0.3,
      avgHourlyWage: 0,
    });

    expect(result.staffNeeded).toBe(0);
    expect(result.maxLaborCost).toBeCloseTo(15_000, 0);
  });

  it("handles realistic restaurant numbers", () => {
    // A restaurant doing 100K/day, open 12 hours, peak hour = ~12500 NOK
    const result = calculateStaffingNeed({
      hourTarget: 12_500,
      targetLaborPercentage: 0.3,
      avgHourlyWage: 220,
    });

    // 12500 × 0.30 = 3750 / 220 ≈ 17.05 staff
    expect(result.staffNeeded).toBeCloseTo(17.05, 1);
  });
});
