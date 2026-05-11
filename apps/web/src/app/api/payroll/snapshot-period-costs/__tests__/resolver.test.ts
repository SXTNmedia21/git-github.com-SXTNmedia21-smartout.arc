/**
 * __tests__/resolver.test.ts — SMA-345 unit tests for resolveBaseHourlyRate.
 *
 * Golden cases covering all 4 resolution tiers:
 *   1. "column"          — explicit hourly_rate on profile
 *   2. "monthly_derived" — monthly_salary / divisor
 *   3. "tariff"          — minstelonn lookup from tariff_rate_table
 *   4. "none"            — all tiers exhausted
 */
import { describe, it, expect } from "vitest";
import { resolveBaseHourlyRate } from "../resolver";
import type { TariffRateInput } from "@smartout/payroll-calculate";

// Minimal TariffRateInput factory — only fields used by resolver
function makeTariffRow(
  overrides: Partial<TariffRateInput> & { rate_type: string; amount: number },
): TariffRateInput {
  return {
    id: "tariff-row-id",
    workspace_id: null, // platform-level by default
    rate_type: overrides.rate_type,
    amount: overrides.amount,
    unit: "kr/t",
    source: "riksavtalen",
    law_version: "2025",
    effective_from: "2025-04-01",
    effective_until: null,
    paragraf_ref: null,
    seniority_level: null,
    role_class: overrides.role_class ?? null,
    ...overrides,
  };
}

describe("resolveBaseHourlyRate — SMA-345", () => {
  // ── Tier 1: explicit hourly_rate column ──────────────────────────────────
  it("returns explicit hourly_rate when employee_payroll_profile has it", () => {
    const result = resolveBaseHourlyRate({
      payrollProfile: { hourly_rate: 280.5, monthly_salary: null },
      tariffRates: [makeTariffRow({ rate_type: "minstelonn_voksen_ufaglart", amount: 215 })],
      tariffCategory: "voksen_ufaglart",
    });
    expect(result).toEqual({ rate: 280.5, source: "column" });
  });

  it("uses hourly_rate even when monthly_salary is also set", () => {
    // hourly_rate wins over monthly_salary — tier 1 has absolute priority
    const result = resolveBaseHourlyRate({
      payrollProfile: {
        hourly_rate: 300,
        monthly_salary: 50000,
        remuneration_type: "monthly",
      },
      tariffRates: [],
    });
    expect(result).toEqual({ rate: 300, source: "column" });
  });

  // ── Tier 2: monthly_salary / divisor ────────────────────────────────────
  it("converts monthly_salary to hourly when remuneration_type=monthly", () => {
    const result = resolveBaseHourlyRate({
      payrollProfile: {
        hourly_rate: null,
        monthly_salary: 50000,
        remuneration_type: "monthly",
      },
      tariffRates: [makeTariffRow({ rate_type: "minstelonn_voksen_ufaglart", amount: 215 })],
      monthlyToHourlyDivisor: 162.5, // 37.5h × 4.333 weeks
    });
    // 50000 / 162.5 ≈ 307.69 NOK/t
    expect(result.rate).toBeCloseTo(307.69, 2);
    expect(result.source).toBe("monthly_derived");
  });

  it("does NOT use monthly_salary when remuneration_type is not monthly", () => {
    // remuneration_type = "hourly" → skip tier 2, fall through to tariff
    const tariffRow = makeTariffRow({ rate_type: "minstelonn_voksen_ufaglart", amount: 215 });
    const result = resolveBaseHourlyRate({
      payrollProfile: {
        hourly_rate: null,
        monthly_salary: 50000,
        remuneration_type: "hourly",
      },
      tariffRates: [tariffRow],
      tariffCategory: "voksen_ufaglart",
    });
    expect(result).toEqual({ rate: 215, source: "tariff" });
  });

  // ── Tier 3: tariff minstelonn lookup ────────────────────────────────────
  it("falls back to tariff minimum when hourly_rate is null", () => {
    const result = resolveBaseHourlyRate({
      payrollProfile: { hourly_rate: null, monthly_salary: null },
      tariffRates: [makeTariffRow({ rate_type: "minstelonn_voksen_ufaglart", amount: 215 })],
      tariffCategory: "voksen_ufaglart",
    });
    expect(result).toEqual({ rate: 215, source: "tariff" });
  });

  it("prefers workspace-specific tariff over platform tariff", () => {
    const platformRow = makeTariffRow({
      rate_type: "minstelonn_voksen_ufaglart",
      amount: 215,
      workspace_id: null,
      role_class: "voksen_ufaglart",
    });
    const workspaceRow = makeTariffRow({
      rate_type: "minstelonn_voksen_ufaglart",
      amount: 240, // local agreement override
      workspace_id: "ws-uuid-1234",
      role_class: "voksen_ufaglart",
    });
    const result = resolveBaseHourlyRate({
      payrollProfile: { hourly_rate: null, monthly_salary: null },
      tariffRates: [platformRow, workspaceRow],
      tariffCategory: "voksen_ufaglart",
    });
    expect(result).toEqual({ rate: 240, source: "tariff" });
  });

  it("uses exact role_class match over null-wildcard tariff row", () => {
    const wildcardRow = makeTariffRow({
      rate_type: "minstelonn_generell",
      amount: 200,
      role_class: null, // wildcard
    });
    const exactRow = makeTariffRow({
      rate_type: "minstelonn_voksen_ufaglart",
      amount: 215,
      role_class: "voksen_ufaglart",
    });
    const result = resolveBaseHourlyRate({
      payrollProfile: { hourly_rate: null, monthly_salary: null },
      tariffRates: [wildcardRow, exactRow],
      tariffCategory: "voksen_ufaglart",
    });
    expect(result).toEqual({ rate: 215, source: "tariff" });
  });

  // ── Tier 4: none ────────────────────────────────────────────────────────
  it("returns 0 with source=none when all tiers exhausted", () => {
    const result = resolveBaseHourlyRate({
      payrollProfile: { hourly_rate: null, monthly_salary: null },
      tariffRates: [],
    });
    expect(result).toEqual({ rate: 0, source: "none" });
  });

  it("returns 0/none when tariff lookup yields no matching minstelonn row", () => {
    // tariff array has rows but none match rate_type startsWith("minstelonn")
    const result = resolveBaseHourlyRate({
      payrollProfile: { hourly_rate: null, monthly_salary: null },
      tariffRates: [
        makeTariffRow({ rate_type: "kveldstillegg", amount: 35 }),
        makeTariffRow({ rate_type: "nattillegg_nattvakt", amount: 42.41 }),
      ],
      tariffCategory: "voksen_ufaglart",
    });
    expect(result).toEqual({ rate: 0, source: "none" });
  });
});
