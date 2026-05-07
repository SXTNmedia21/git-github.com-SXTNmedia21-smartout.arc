import { describe, it, expect } from "vitest";
import { resolveOvertime } from "../src/overtime-resolver.js";
import type { PayrollProfile, TimeBucket } from "../src/types.js";

const PAID_OUT_PROFILE: PayrollProfile = {
  id: "pp-002",
  profile_id: "prof-002",
  workspace_id: "ws-test",
  salary_type: "hourly",
  agreed_weekly_hours: 37.5,
  holiday_allowance_pct: 12.0,
  overtime_mode: "paid_out",
  toil_agreement_signed_at: null,
  toil_max_banked_hours: null,
  seniority_start_date: "2023-06-01",
  tariff_category: "voksen_ufaglart",
  has_fagbrev: false,
  sector_experience_years: 1,
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

describe("resolveOvertime — paid_out mode", () => {
  it("pays base + premium for daily OT", () => {
    // Daily worked so far: 540min (9h exactly). Bucket 30min → 30min OT
    // 200 NOK/h = 20000 øre/h → 333 øre/min (floor of 20000/60)
    // base_ore_30min = 333 * 30 = 9990
    // premium (50%) = round(9990 * 0.5) = 4995
    // total = 9990 + 4995 = 14985
    const result = resolveOvertime(PAID_OUT_PROFILE, makeBucket(30), 540, 0, 200);
    expect(result.ot_minutes).toBe(30);
    expect(result.banked_minutes).toBe(0); // paid_out: no banking
    expect(result.paid_out_amount_ore).toBe(14985n);
  });

  it("pays zero for non-OT bucket", () => {
    // 0 minutes worked so far. Bucket 60min → 60min < 9h threshold, no OT
    const result = resolveOvertime(PAID_OUT_PROFILE, makeBucket(60), 0, 0, 200);
    expect(result.ot_minutes).toBe(0);
    expect(result.banked_minutes).toBe(0);
    expect(result.paid_out_amount_ore).toBe(0n);
  });

  it("pays base + premium for weekly OT", () => {
    // Weekly worked: 2400min (40h exactly). Bucket 60min → 60min weekly OT
    // 333 * 60 = 19980 base. premium = round(19980 * 0.5) = 9990. total = 29970
    const result = resolveOvertime(PAID_OUT_PROFILE, makeBucket(60), 0, 2400, 200);
    expect(result.ot_minutes).toBe(60);
    expect(result.banked_minutes).toBe(0);
    expect(result.paid_out_amount_ore).toBe(29970n);
  });

  it("handles partial OT (bucket spans normal + OT)", () => {
    // Daily worked: 510min (8.5h). Bucket 60min → 30min normal, 30min OT
    // Only OT portion contributes to paid_out_amount_ore
    // 333 * 30 = 9990. premium = 4995. total OT pay = 14985
    const result = resolveOvertime(PAID_OUT_PROFILE, makeBucket(60), 510, 0, 200);
    expect(result.ot_minutes).toBe(30); // only 30min exceed threshold
    expect(result.banked_minutes).toBe(0);
    expect(result.paid_out_amount_ore).toBe(14985n);
  });

  it("takes max of daily vs weekly OT (no double-count)", () => {
    // Daily: 540 min worked. Weekly: 2400 min worked. Bucket: 90 min.
    // daily OT = min(90, 540+90-540) = min(90, 90) = 90
    // weekly OT = min(90, 2400+90-2400) = min(90, 90) = 90
    // max(90, 90) = 90 — not double-counted
    // 333 * 90 = 29970 base. premium = round(29970 * 0.5) = 14985. total = 44955
    const result = resolveOvertime(PAID_OUT_PROFILE, makeBucket(90), 540, 2400, 200);
    expect(result.ot_minutes).toBe(90);
    expect(result.paid_out_amount_ore).toBe(44955n);
  });
});
