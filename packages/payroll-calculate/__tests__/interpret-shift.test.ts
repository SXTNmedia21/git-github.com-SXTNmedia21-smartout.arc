import { describe, it, expect } from "vitest";
import { interpretShift } from "../src/interpret-shift.js";
import type { ShiftInput, TimeEntryInput, PublicHoliday, WorkspaceSettings } from "../src/types.js";

const BASE_SETTINGS: WorkspaceSettings = {
  workspace_id: "ws-test",
  is_tariff_bound: true,
  supplement_stacking_policy: "category_exclusive",
  overtime_requires_pre_approval: false,
  overtime_warn_threshold_minutes: 30,
  punch_rounding_minutes: 0,
  punch_rounding_direction: "toward_employee",
  punch_rounding_snap_window_minutes: 10,
  punch_window_early_minutes: 15,
  punch_window_late_minutes: 30,
  punch_grace_after_scheduled_minutes: 60,
  forced_break_reminder_minutes: 300,
  toil_default_max_banked_hours: 80,
  wellness_days_per_year_default: 0,
  split_shift_threshold_minutes: 0,
  split_shift_allowance_amount: 0,
  vacation_pay_pct: 12.0,
  period_type: "monthly",
};

const NO_HOLIDAYS: PublicHoliday[] = [];
const EASTER_2026: PublicHoliday[] = [
  { date: "2026-04-02", name: "Skjærtorsdag" },
  { date: "2026-04-03", name: "Langfredag" },
  { date: "2026-04-05", name: "1. påskedag" },
  { date: "2026-04-06", name: "2. påskedag" },
];

function makeShift(overrides: Partial<ShiftInput> = {}): ShiftInput {
  return {
    shift_id: "sh-test",
    profile_id: "prof-test",
    workspace_id: "ws-test",
    start_time: "2026-04-07T06:00:00Z",
    end_time: "2026-04-07T14:00:00Z",
    scheduled_start: "2026-04-07T06:00:00Z",
    scheduled_end: "2026-04-07T14:00:00Z",
    scheduled_break_minutes: 30,
    shift_date: "2026-04-07",
    night_worker_category: null,
    custom_rate: null,
    custom_rate_type: null,
    ...overrides,
  };
}

function makeTimeEntry(
  shiftId: string,
  punchIn: string,
  punchOut: string | null,
  breaks: TimeEntryInput["breaks"] = null,
): TimeEntryInput {
  return {
    time_entry_id: "te-test",
    shift_id: shiftId,
    profile_id: "prof-test",
    workspace_id: "ws-test",
    punch_in: punchIn,
    punch_out: punchOut,
    breaks,
  };
}

describe("interpretShift — basic", () => {
  it("computes worked_minutes = gross - unpaid break", () => {
    const shift = makeShift();
    const te = makeTimeEntry("sh-test", "2026-04-07T06:00:00Z", "2026-04-07T14:00:00Z", [
      { start: "2026-04-07T10:00:00Z", end: "2026-04-07T10:30:00Z", minutes: 30 },
    ]);
    const result = interpretShift(shift, te, NO_HOLIDAYS, BASE_SETTINGS);
    expect(result.gross_minutes).toBe(480);
    expect(result.worked_minutes).toBe(450); // 480 - 30
    expect(result.unpaid_break_minutes).toBe(30);
    expect(result.buckets.length).toBeGreaterThan(0);
    expect(result.buckets.reduce((s, b) => s + b.minutes, 0)).toBe(450);
  });

  it("uses scheduled break as fallback when breaks JSONB is null", () => {
    const shift = makeShift({ scheduled_break_minutes: 30 });
    const te = makeTimeEntry("sh-test", "2026-04-07T06:00:00Z", "2026-04-07T14:00:00Z", null);
    const result = interpretShift(shift, te, NO_HOLIDAYS, BASE_SETTINGS);
    expect(result.unpaid_break_minutes).toBe(30);
    expect(result.worked_minutes).toBe(450);
  });

  it("uses scheduled end when punch_out is null", () => {
    const shift = makeShift({ scheduled_end: "2026-04-07T14:00:00Z" });
    const te = makeTimeEntry("sh-test", "2026-04-07T06:00:00Z", null, null);
    const result = interpretShift(shift, te, NO_HOLIDAYS, BASE_SETTINGS);
    expect(result.gross_minutes).toBe(480);
  });

  it("classifies holiday correctly", () => {
    // Langfredag 2026-04-03
    const shift = makeShift({
      start_time: "2026-04-03T08:00:00Z",
      end_time: "2026-04-03T16:00:00Z",
      scheduled_start: "2026-04-03T08:00:00Z",
      scheduled_end: "2026-04-03T16:00:00Z",
      shift_date: "2026-04-03",
      scheduled_break_minutes: 0,
    });
    const te = makeTimeEntry("sh-test", "2026-04-03T08:00:00Z", "2026-04-03T16:00:00Z", null);
    const result = interpretShift(shift, te, EASTER_2026, BASE_SETTINGS);
    const holidayBuckets = result.buckets.filter((b) => b.classification === "holiday");
    expect(holidayBuckets.length).toBeGreaterThan(0);
    expect(holidayBuckets.reduce((s, b) => s + b.minutes, 0)).toBe(480);
  });

  it("classifies Sunday as weekend_sun", () => {
    // 2026-04-12 is Sunday
    const shift = makeShift({
      start_time: "2026-04-12T08:00:00Z",
      end_time: "2026-04-12T14:00:00Z",
      scheduled_start: "2026-04-12T08:00:00Z",
      scheduled_end: "2026-04-12T14:00:00Z",
      shift_date: "2026-04-12",
      scheduled_break_minutes: 0,
    });
    const te = makeTimeEntry("sh-test", "2026-04-12T08:00:00Z", "2026-04-12T14:00:00Z", null);
    const result = interpretShift(shift, te, NO_HOLIDAYS, BASE_SETTINGS);
    expect(result.buckets.every((b) => b.classification === "weekend_sun")).toBe(true);
  });

  it("classifies Saturday as weekend_sat", () => {
    // 2026-04-11 is Saturday
    const shift = makeShift({
      start_time: "2026-04-11T08:00:00Z",
      end_time: "2026-04-11T14:00:00Z",
      scheduled_start: "2026-04-11T08:00:00Z",
      scheduled_end: "2026-04-11T14:00:00Z",
      shift_date: "2026-04-11",
      scheduled_break_minutes: 0,
    });
    const te = makeTimeEntry("sh-test", "2026-04-11T08:00:00Z", "2026-04-11T14:00:00Z", null);
    const result = interpretShift(shift, te, NO_HOLIDAYS, BASE_SETTINGS);
    expect(result.buckets.every((b) => b.classification === "weekend_sat")).toBe(true);
  });

  it("handles overnight shift correctly — midnight crossing", () => {
    // Tue 22:00 → Wed 06:00 UTC (Oslo: CEST = UTC+2, so 22:00 UTC = 00:00 Wed Oslo)
    // Actually in April, Oslo is CEST (UTC+2): 22:00 UTC = 00:00 Oslo next day
    // BUT for simplicity: punch times are UTC, Oslo offset is +2 in summer
    // 2026-04-07T22:00:00Z = 2026-04-08 00:00 Oslo (Wednesday)
    // 2026-04-08T06:00:00Z = 2026-04-08 08:00 Oslo (Wednesday)
    // So entire 8h shift is Wed Oslo day → day_normal + no crossing
    // Let's use 2026-04-07T19:00:00Z (Tue 21:00 Oslo) to 2026-04-07T23:00:00Z (Tue 01:00 Oslo+2)
    // Actually: 19:00 UTC = 21:00 Oslo. 23:00 UTC = 01:00 Oslo next day.
    // This crosses midnight Oslo → Tue→Wed boundary
    const shift = makeShift({
      start_time: "2026-04-07T19:00:00Z",
      end_time: "2026-04-07T23:00:00Z",
      scheduled_start: "2026-04-07T19:00:00Z",
      scheduled_end: "2026-04-07T23:00:00Z",
      shift_date: "2026-04-07",
      scheduled_break_minutes: 0,
    });
    const te = makeTimeEntry("sh-test", "2026-04-07T19:00:00Z", "2026-04-07T23:00:00Z", null);
    const result = interpretShift(shift, te, NO_HOLIDAYS, BASE_SETTINGS);
    // 19:00 UTC = 21:00 Oslo → evening classification until 22:00 Oslo = 20:00 UTC
    // 20:00 UTC to 22:00 UTC = 22:00-00:00 Oslo → evening then night
    // Total = 240 minutes
    expect(result.worked_minutes).toBe(240);
    expect(result.buckets.reduce((s, b) => s + b.minutes, 0)).toBe(240);
    // Should have evening bucket (21:00-23:59 Oslo) and night bucket (00:00-05:59)
    const classifications = result.buckets.map((b) => b.classification);
    expect(classifications).toContain("evening");
  });

  it("applies toward_employee rounding on punch-in (rounds down)", () => {
    const settings = { ...BASE_SETTINGS, punch_rounding_minutes: 15 as const };
    const shift = makeShift({ scheduled_break_minutes: 0 });
    // Punch in at 06:07 — should round DOWN to 06:00 (toward_employee for punch-in)
    const te = makeTimeEntry("sh-test", "2026-04-07T06:07:00Z", "2026-04-07T14:00:00Z", null);
    const result = interpretShift(shift, te, NO_HOLIDAYS, settings);
    expect(result.effective_start).toBe("2026-04-07T06:00:00.000Z");
    expect(result.gross_minutes).toBe(480);
  });

  it("applies toward_employee rounding on punch-out (rounds up)", () => {
    const settings = { ...BASE_SETTINGS, punch_rounding_minutes: 15 as const };
    const shift = makeShift({ scheduled_break_minutes: 0 });
    // Punch out at 13:53 — should round UP to 14:00 (toward_employee for punch-out)
    const te = makeTimeEntry("sh-test", "2026-04-07T06:00:00Z", "2026-04-07T13:53:00Z", null);
    const result = interpretShift(shift, te, NO_HOLIDAYS, settings);
    expect(result.effective_end).toBe("2026-04-07T14:00:00.000Z");
  });
});

describe("interpretShift — DST", () => {
  it("handles DST spring-forward correctly (last Sunday March)", () => {
    // Norway DST spring-forward: last Sunday March 2026 = 2026-03-29
    // 01:00 UTC = 02:00 Oslo (before spring-forward), gap at 02:00 Oslo = 03:00
    // A shift spanning this transition should compute minutes correctly
    const shift = makeShift({
      start_time: "2026-03-29T00:00:00Z",
      end_time: "2026-03-29T04:00:00Z",
      scheduled_start: "2026-03-29T00:00:00Z",
      scheduled_end: "2026-03-29T04:00:00Z",
      shift_date: "2026-03-29",
      scheduled_break_minutes: 0,
    });
    const te = makeTimeEntry("sh-test", "2026-03-29T00:00:00Z", "2026-03-29T04:00:00Z", null);
    const result = interpretShift(shift, te, NO_HOLIDAYS, BASE_SETTINGS);
    // 4 hours = 240 minutes, regardless of DST (UTC timestamps)
    expect(result.gross_minutes).toBe(240);
    expect(result.worked_minutes).toBe(240);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FIX-B: is_paid break handling (BATCH 2)
// paid break → included in worked_minutes (not subtracted)
// unpaid break → subtracted from worked_minutes
// per-entry is_paid takes precedence over workspace-level break_rule_is_paid
// ─────────────────────────────────────────────────────────────────────────────
describe("interpretShift — is_paid break handling", () => {
  it("paid 30-min break: worked_minutes is NOT reduced (paid break counts as worked)", () => {
    // 8h shift (480 gross min), 30-min paid break
    // worked = 480 - 0 unpaid = 480 (paid break is not subtracted)
    const shift = makeShift({ scheduled_break_minutes: 0 });
    const te = makeTimeEntry("sh-test", "2026-04-07T06:00:00Z", "2026-04-07T14:00:00Z", [
      { start: "2026-04-07T10:00:00Z", end: "2026-04-07T10:30:00Z", minutes: 30, is_paid: true },
    ]);
    const result = interpretShift(shift, te, NO_HOLIDAYS, BASE_SETTINGS);
    expect(result.gross_minutes).toBe(480);
    expect(result.paid_break_minutes).toBe(30);
    expect(result.unpaid_break_minutes).toBe(0);
    expect(result.worked_minutes).toBe(480); // paid break NOT subtracted
  });

  it("unpaid 30-min break: worked_minutes is reduced by 30", () => {
    // 8h shift, 30-min unpaid break
    const shift = makeShift({ scheduled_break_minutes: 0 });
    const te = makeTimeEntry("sh-test", "2026-04-07T06:00:00Z", "2026-04-07T14:00:00Z", [
      { start: "2026-04-07T10:00:00Z", end: "2026-04-07T10:30:00Z", minutes: 30, is_paid: false },
    ]);
    const result = interpretShift(shift, te, NO_HOLIDAYS, BASE_SETTINGS);
    expect(result.gross_minutes).toBe(480);
    expect(result.paid_break_minutes).toBe(0);
    expect(result.unpaid_break_minutes).toBe(30);
    expect(result.worked_minutes).toBe(450); // unpaid break IS subtracted
  });

  it("mixed paid + unpaid breaks: only unpaid portion is subtracted", () => {
    // 8h shift: 20-min paid + 40-min unpaid = 60 min total break
    // worked = 480 - 40 unpaid = 440
    const shift = makeShift({ scheduled_break_minutes: 0 });
    const te = makeTimeEntry("sh-test", "2026-04-07T06:00:00Z", "2026-04-07T14:00:00Z", [
      { start: "2026-04-07T10:00:00Z", end: "2026-04-07T10:20:00Z", minutes: 20, is_paid: true },
      { start: "2026-04-07T12:00:00Z", end: "2026-04-07T12:40:00Z", minutes: 40, is_paid: false },
    ]);
    const result = interpretShift(shift, te, NO_HOLIDAYS, BASE_SETTINGS);
    expect(result.paid_break_minutes).toBe(20);
    expect(result.unpaid_break_minutes).toBe(40);
    expect(result.worked_minutes).toBe(440);
    expect(result.scheduled_break_minutes).toBe(60); // total break time
  });

  it("workspace break_rule_is_paid=true: scheduled fallback break treated as paid", () => {
    // No breaks JSONB (null) — falls back to scheduled_break_minutes=30.
    // Workspace has break_rule_is_paid=true → scheduled break is paid → not subtracted.
    const settingsPaid = { ...BASE_SETTINGS, break_rule_is_paid: true };
    const shift = makeShift({ scheduled_break_minutes: 30 });
    const te = makeTimeEntry("sh-test", "2026-04-07T06:00:00Z", "2026-04-07T14:00:00Z", null);
    const result = interpretShift(shift, te, NO_HOLIDAYS, settingsPaid);
    expect(result.paid_break_minutes).toBe(30);
    expect(result.unpaid_break_minutes).toBe(0);
    expect(result.worked_minutes).toBe(480); // paid break not subtracted from 480 gross
  });
});
