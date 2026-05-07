import { describe, it, expect } from "vitest";
import { resolveOvertime } from "../src/overtime-resolver.js";
import type { PayrollProfile, TimeBucket } from "../src/types.js";

const BANKED_PROFILE: PayrollProfile = {
  id: "pp-001",
  profile_id: "prof-001",
  workspace_id: "ws-test",
  salary_type: "hourly",
  agreed_weekly_hours: 37.5,
  holiday_allowance_pct: 12.0,
  overtime_mode: "banked",
  toil_agreement_signed_at: "2026-01-10T09:00:00Z",
  toil_max_banked_hours: 80,
  seniority_start_date: "2022-01-01",
  tariff_category: "voksen_ufaglart",
  has_fagbrev: false,
  sector_experience_years: 4,
};

function makeBucket(minutes: number): TimeBucket {
  return {
    from: "2026-04-07T06:00:00Z",
    to: "2026-04-07T09:00:00Z",
    minutes,
    weekday: 2,
    classification: "day_normal",
  };
}

describe("resolveOvertime — banked mode", () => {
  it("banks OT minutes instead of paying base, but pays premium", () => {
    // Daily worked so far: 540min (9h exactly). This bucket has 30 more min → 30min OT
    const result = resolveOvertime(BANKED_PROFILE, makeBucket(30), 540, 0, 200);
    expect(result.ot_minutes).toBe(30);
    expect(result.banked_minutes).toBe(30); // all OT minutes go to bank
    // Premium only: 200 NOK/h, 50% of base for 30min
    // base_ore_per_min = floor(20000/60) = 333
    // base_ore_30min = 333 * 30 = 9990
    // premium (50%) = round(9990 * 0.5) = 4995
    expect(result.paid_out_amount_ore).toBe(4995n);
  });

  it("banks zero for non-OT bucket", () => {
    const result = resolveOvertime(BANKED_PROFILE, makeBucket(60), 0, 0, 200);
    expect(result.ot_minutes).toBe(0);
    expect(result.banked_minutes).toBe(0);
    expect(result.paid_out_amount_ore).toBe(0n);
  });

  it("computes weekly OT correctly", () => {
    // Weekly worked so far: 2400min (40h exactly). Bucket 60min → 60min weekly OT
    const result = resolveOvertime(BANKED_PROFILE, makeBucket(60), 0, 2400, 200);
    expect(result.ot_minutes).toBe(60);
    expect(result.banked_minutes).toBe(60);
    // 333 * 60 = 19980 base. 50% = round(19980 * 0.5) = 9990
    expect(result.paid_out_amount_ore).toBe(9990n);
  });
});
