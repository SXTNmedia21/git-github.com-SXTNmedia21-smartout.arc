import { describe, it, expect } from "vitest";
import { snapshotShiftCost } from "../src/snapshot-cost.js";
import type { InterpretedShift, TariffRateInput, PayrollProfile } from "../src/types.js";
import { oreToNok } from "../src/cents.js";

const TARIFF: TariffRateInput[] = [
  {
    id: "trt-001",
    workspace_id: null,
    rate_type: "kveldstillegg",
    amount: 42.41,
    unit: "kr/t",
    source: "riksavtalen",
    law_version: "2025",
    effective_from: "2025-04-01",
    effective_until: null,
    paragraf_ref: null,
    seniority_level: null,
    role_class: null,
  },
];

const HOURLY_PROFILE: PayrollProfile = {
  id: "pp-001",
  profile_id: "prof-001",
  workspace_id: "ws-test",
  salary_type: "hourly",
  agreed_weekly_hours: 37.5,
  holiday_allowance_pct: 12.0,
  overtime_mode: "paid_out",
  toil_agreement_signed_at: null,
  toil_max_banked_hours: null,
  seniority_start_date: "2022-01-01",
  tariff_category: "voksen_ufaglart",
  has_fagbrev: false,
  sector_experience_years: 4,
};

const MONTHLY_PROFILE: PayrollProfile = {
  ...HOURLY_PROFILE,
  salary_type: "monthly",
};

function makeInterpreted(overrides: Partial<InterpretedShift> = {}): InterpretedShift {
  return {
    shift_id: "sh-001",
    profile_id: "prof-001",
    workspace_id: "ws-test",
    effective_start: "2026-04-07T06:00:00Z",
    effective_end: "2026-04-07T14:00:00Z",
    scheduled_break_minutes: 30,
    paid_break_minutes: 0,
    unpaid_break_minutes: 30,
    gross_minutes: 480,
    worked_minutes: 450,
    buckets: [],
    fired_supplements: [],
    night_worker_category: null,
    ...overrides,
  };
}

describe("snapshotShiftCost", () => {
  it("computes base pay for hourly employee", () => {
    const interpreted = makeInterpreted();
    const result = snapshotShiftCost(interpreted, TARIFF, HOURLY_PROFILE, 200.0);
    // 200 NOK/h: 20000 øre/h → 333 øre/min (floor of 20000/60) * 450 min = 149850 øre
    // Actually: 20000/60 = 333 (floor), 333 * 450 = 149850 øre = 1498.50 NOK
    expect(result.base_pay_ore).toBe(149850n);
    expect(result.total_supplements_ore).toBe(0n);
    expect(result.total_ore).toBe(149850n);
  });

  it("emits base_monthly=0 for monthly employee per shift", () => {
    const interpreted = makeInterpreted();
    const result = snapshotShiftCost(interpreted, TARIFF, MONTHLY_PROFILE, 0);
    expect(result.base_pay_ore).toBe(0n);
    const baseLine = result.lines.find((l) => l.pay_code === "base_monthly");
    expect(baseLine).toBeDefined();
    expect(baseLine!.amount_ore).toBe(0n);
  });

  it("groups fired_supplements by rule_id and sums across buckets", () => {
    const supplement = {
      rule_id: "rule-kveldstiilegg-001",
      supplement_type: "normal",
      rate_type: "fixed_per_hour",
      tariff_rate_table_id: "trt-001",
      rate_value_nok: 42.41,
      amount_ore: 4200n, // 60 min bucket
      quantity_minutes: 60,
      provenance: { rate_source: "tariff_lookup" as const },
    };
    const supplement2 = { ...supplement, amount_ore: 4200n, quantity_minutes: 60 };
    const interpreted = makeInterpreted({ fired_supplements: [supplement, supplement2] });
    const result = snapshotShiftCost(interpreted, TARIFF, HOURLY_PROFILE, 200.0);
    expect(result.total_supplements_ore).toBe(8400n); // 4200 + 4200
    expect(
      result.lines.filter((l) => l.supplement_rule_id === "rule-kveldstiilegg-001").length,
    ).toBe(1);
  });

  it("freezes tariff snapshot (deep-equal to input)", () => {
    const interpreted = makeInterpreted();
    const result = snapshotShiftCost(interpreted, TARIFF, HOURLY_PROFILE, 200.0);
    expect(result.tariff_rate_snapshot).toEqual(TARIFF);
  });

  it("FIX-C: mutating the input rates array after snapshot does NOT affect the snapshot", () => {
    // Verify spread-clone makes the snapshot independent of the caller's array.
    // TariffRateInput contains only primitive fields — spread produces a fully independent copy.
    // This guards ADR-0252 idempotence: the snapshot must be immutable after creation.
    const mutableRates: TariffRateInput[] = [
      {
        id: "trt-mut-001",
        workspace_id: null,
        rate_type: "kveldstillegg",
        amount: 42.41,
        unit: "kr/t",
        source: "riksavtalen",
        law_version: "2025",
        effective_from: "2025-04-01",
        effective_until: null,
        paragraf_ref: null,
        seniority_level: null,
        role_class: null,
      },
    ];

    const interpreted = makeInterpreted();
    const result = snapshotShiftCost(interpreted, mutableRates, HOURLY_PROFILE, 200.0);

    // Capture snapshot amount before mutation
    const snapshotAmountBefore = result.tariff_rate_snapshot[0]!.amount;

    // Mutate the original input array after snapshot was taken
    mutableRates[0]!.amount = 999.99;

    // Snapshot must be unchanged — spread-clone ensures no shared reference
    expect(result.tariff_rate_snapshot[0]!.amount).toBe(snapshotAmountBefore);
    expect(result.tariff_rate_snapshot[0]!.amount).not.toBe(999.99);
  });

  it("correct total = base + supplements", () => {
    const supplement = {
      rule_id: "r1",
      supplement_type: "normal",
      rate_type: "fixed_per_hour",
      tariff_rate_table_id: null,
      rate_value_nok: 42.41,
      amount_ore: 5000n,
      quantity_minutes: 60,
      provenance: { rate_source: "rule_fallback" as const },
    };
    const interpreted = makeInterpreted({ fired_supplements: [supplement] });
    const result = snapshotShiftCost(interpreted, TARIFF, HOURLY_PROFILE, 200.0);
    expect(result.total_ore).toBe(result.base_pay_ore + result.total_supplements_ore);
  });
});
