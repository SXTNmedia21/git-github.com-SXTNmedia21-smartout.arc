import { describe, it, expect } from "vitest";
import { resolveTariffRate } from "../resolve-tariff-rate";
import type { TariffContext, TariffRateRow } from "../types";

function makeRate(overrides: Partial<TariffRateRow> = {}): TariffRateRow {
  return {
    id: "rate-1",
    rateType: "kveldstillegg",
    amount: 15.65,
    unit: "kr/t",
    effectiveFrom: "2024-04-01",
    effectiveUntil: null,
    ...overrides,
  };
}

function makeContext(overrides: Partial<TariffContext> = {}): TariffContext {
  return {
    payrollProfile: {
      tariffOverrideId: null,
      tariffCategory: "ufaglart",
      seniorityStartDate: "2025-01-01",
      hasFagbrev: false,
    },
    workspaceTariffRates: [],
    platformTariffRates: [
      makeRate({ id: "plat-kveld", rateType: "kveldstillegg", amount: 15.65, unit: "kr/t" }),
      makeRate({ id: "plat-helg", rateType: "helgetillegg", amount: 29.74, unit: "kr/t" }),
      makeRate({ id: "plat-hellig", rateType: "helligdagstillegg", amount: 100, unit: "percent" }),
      makeRate({ id: "plat-ot50", rateType: "overtidstillegg_50", amount: 50, unit: "percent" }),
      makeRate({ id: "plat-ot100", rateType: "overtidstillegg_100", amount: 100, unit: "percent" }),
    ],
    isPublicHoliday: false,
    ...overrides,
  };
}

describe("resolveTariffRate", () => {
  it("returns base rate with no supplements for daytime weekday", () => {
    const result = resolveTariffRate(makeContext(), "2026-03-18T14:00:00Z");
    // Wednesday 14:00 — no evening, no weekend, no holiday
    expect(result.supplements).toHaveLength(0);
    expect(result.sourceTier).toBe("platform");
    expect(result.tariffCategory).toBe("ufaglart");
  });

  it("applies kveldstillegg for evening shift (22:00)", () => {
    const result = resolveTariffRate(makeContext(), "2026-03-18T22:00:00Z");
    // 22:00 is within 21:00-06:00
    const kveld = result.supplements.find((s) => s.type === "kveldstillegg");
    expect(kveld).toBeDefined();
    expect(kveld?.amount).toBe(15.65);
    expect(kveld?.unit).toBe("kr/t");
  });

  it("applies helgetillegg for Saturday afternoon (16:00)", () => {
    // 2026-03-21 is a Saturday
    const result = resolveTariffRate(makeContext(), "2026-03-21T16:00:00Z");
    const helg = result.supplements.find((s) => s.type === "helgetillegg");
    expect(helg).toBeDefined();
    expect(helg?.amount).toBe(29.74);
  });

  it("applies helligdagstillegg for public holiday", () => {
    const result = resolveTariffRate(
      makeContext({ isPublicHoliday: true }),
      "2026-03-18T14:00:00Z",
    );
    const hellig = result.supplements.find((s) => s.type === "helligdagstillegg");
    expect(hellig).toBeDefined();
    expect(hellig?.amount).toBe(100);
    expect(hellig?.unit).toBe("percent");
  });

  it("stacks multiple kr/t supplements: Saturday night = kveld + helg", () => {
    // 2026-03-21 is Saturday, 22:00 is evening
    const result = resolveTariffRate(makeContext(), "2026-03-21T22:00:00Z");
    const types = result.supplements.map((s) => s.type);
    expect(types).toContain("kveldstillegg");
    expect(types).toContain("helgetillegg");
    expect(result.supplements).toHaveLength(2);
  });

  it("stacks holiday + evening: % on base + kr/h additive", () => {
    const result = resolveTariffRate(
      makeContext({ isPublicHoliday: true }),
      "2026-03-18T22:00:00Z",
    );
    const types = result.supplements.map((s) => s.type);
    expect(types).toContain("helligdagstillegg");
    expect(types).toContain("kveldstillegg");
  });

  it("workspace tier wins over platform tier", () => {
    const ctx = makeContext({
      workspaceTariffRates: [
        makeRate({ id: "ws-kveld", rateType: "kveldstillegg", amount: 20.0, unit: "kr/t" }),
      ],
    });
    const result = resolveTariffRate(ctx, "2026-03-18T22:00:00Z");
    const kveld = result.supplements.find((s) => s.type === "kveldstillegg");
    expect(kveld?.amount).toBe(20.0);
    expect(result.sourceTier).toBe("workspace");
  });

  it("does not apply kveldstillegg during daytime (14:00)", () => {
    const result = resolveTariffRate(makeContext(), "2026-03-18T14:00:00Z");
    const kveld = result.supplements.find((s) => s.type === "kveldstillegg");
    expect(kveld).toBeUndefined();
  });

  it("does not apply helgetillegg on weekday", () => {
    // Wednesday
    const result = resolveTariffRate(makeContext(), "2026-03-18T16:00:00Z");
    const helg = result.supplements.find((s) => s.type === "helgetillegg");
    expect(helg).toBeUndefined();
  });

  it("returns baseRate 0 when no payroll profile", () => {
    const result = resolveTariffRate(makeContext({ payrollProfile: null }), "2026-03-18T14:00:00Z");
    expect(result.baseRate).toBe(0);
    expect(result.baseRateUnit).toBe("hourly");
  });
});
