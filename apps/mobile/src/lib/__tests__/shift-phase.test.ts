/**
 * Tests for calculateShiftPhase() — the core logic driving the entire mobile app experience.
 *
 * Each test verifies a specific phase transition rule. The critical invariant is that
 * "during_shift" ONLY fires when there's an active time_entry with status "clocked_in".
 * A shift's scheduled time without a punch is NOT "during_shift".
 *
 * Time conventions: shift_date is "YYYY-MM-DD", start_time/end_time are "HH:MM:SS"
 * (Postgres TIME, no timezone). The function treats them as UTC. All `now` values use UTC.
 */

import { calculateShiftPhase } from "../shift-phase";
import type { Database } from "@smartout/supabase/database.types";
import type { TimeEntry } from "@/types/time-entry";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

// --- Test Helpers ---

/** Midnight UTC on test day */
const BASE_DATE = new Date("2026-03-18T12:00:00Z");

function makeShift(overrides: Partial<ScheduleShift> = {}): ScheduleShift {
  const base: ScheduleShift = {
    schedule_shift_id: "shift-1",
    workspace_id: "ws-1",
    employee_id: "emp-1",
    shift_date: "2026-03-18",
    start_time: "16:00:00",
    end_time: "23:00:00",
    role: "server",
    status: "published",
    is_published: true,
    source: "human",
    breaks: 0,
    work_hours: 7,
    day_category: "morning",
    indicator: "green",
    adhoc_approved_at: null,
    adhoc_approved_by: null,
    approved_at: null,
    approved_by: null,
    confirmed_at: null,
    confirmed_by: null,
    custom_rate: null,
    custom_rate_type: null,
    is_adhoc: false,
    notes: null,
    position_id: null,
    shift_type_id: null,
    team_id: null,
    department_id: null,
    location_id: null,
    zone: null,
    template_shift_id: null,
    pipeline_lock_state_id: null,
    created_at: "2026-03-17T10:00:00Z",
    updated_at: "2026-03-17T10:00:00Z",
  };
  return { ...base, ...overrides } as ScheduleShift;
}

function makeTimeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    time_entry_id: "te-1",
    shift_id: "shift-1",
    profile_id: "profile-1",
    workspace_id: "ws-1",
    punch_in: "2026-03-18T16:02:00Z",
    punch_out: null,
    breaks: null,
    punch_in_location: null,
    status: "clocked_in",
    created_at: "2026-03-18T16:02:00Z",
    updated_at: "2026-03-18T16:02:00Z",
    ...overrides,
  };
}

// --- Tests ---

describe("calculateShiftPhase", () => {
  describe("no_shift", () => {
    it("returns no_shift when there are no shifts", () => {
      const result = calculateShiftPhase({
        shifts: [],
        activeTimeEntry: null,
        now: BASE_DATE,
      });

      expect(result.phase).toBe("no_shift");
      expect(result.activeShift).toBeNull();
      expect(result.activeTimeEntry).toBeNull();
      expect(result.nextShift).toBeNull();
    });

    it("returns no_shift when all shifts are in the past beyond the 48h lookahead", () => {
      // Shift ended 2026-03-15T08:00Z — 52h before BASE_DATE (2026-03-18T12:00Z),
      // so it falls outside the LOOKAHEAD_HOURS=48 window and does NOT surface
      // as missed_shift. Shifts within 48h of end do surface as missed_shift.
      const pastShift = makeShift({
        shift_date: "2026-03-15",
        start_time: "00:00:00",
        end_time: "08:00:00",
      });

      const result = calculateShiftPhase({
        shifts: [pastShift],
        activeTimeEntry: null,
        now: BASE_DATE,
      });

      expect(result.phase).toBe("no_shift");
      expect(result.nextShift).toBeNull();
    });

    it("returns no_shift when next shift is more than 24h away", () => {
      const farShift = makeShift({
        shift_date: "2026-03-20",
        start_time: "16:00:00",
        end_time: "23:00:00",
      });

      const result = calculateShiftPhase({
        shifts: [farShift],
        activeTimeEntry: null,
        now: BASE_DATE,
      });

      expect(result.phase).toBe("no_shift");
      expect(result.nextShift).toBeNull();
    });

    it("returns no_shift with nextShift when shift is within 24h but outside beforeShiftHours", () => {
      // Shift at 16:00 UTC, now is 08:00 UTC → 8h away. Pass explicit
      // beforeShiftHours=4 so assertion is independent of DEFAULT_BEFORE_SHIFT_HOURS.
      const shift = makeShift();
      const now = new Date("2026-03-18T08:00:00Z");

      const result = calculateShiftPhase({
        shifts: [shift],
        activeTimeEntry: null,
        now,
        beforeShiftHours: 4,
      });

      expect(result.phase).toBe("no_shift");
      expect(result.nextShift).toEqual(shift);
    });
  });

  describe("before_shift", () => {
    it("returns before_shift when shift is within default 4h window", () => {
      // Shift at 16:00 UTC, now is 13:00 UTC → 3h away
      const shift = makeShift();
      const now = new Date("2026-03-18T13:00:00Z");

      const result = calculateShiftPhase({
        shifts: [shift],
        activeTimeEntry: null,
        now,
      });

      expect(result.phase).toBe("before_shift");
      expect(result.nextShift).toEqual(shift);
    });

    it("returns awaiting_punch_in when shift started but no punch (late punch scenario)", () => {
      // Shift started at 16:00 UTC, now is 16:10 UTC, no time_entry.
      // Phase machine: start <= now < end with no active punch → awaiting_punch_in.
      // This replaced the old before_shift "late punch warning" — the concept is the
      // same (shift in window, employee hasn't punched) but now has its own phase.
      const shift = makeShift();
      const now = new Date("2026-03-18T16:10:00Z");

      const result = calculateShiftPhase({
        shifts: [shift],
        activeTimeEntry: null,
        now,
      });

      expect(result.phase).toBe("awaiting_punch_in");
      expect(result.nextShift).toEqual(shift);
    });

    it("respects custom beforeShiftHours", () => {
      // Shift at 16:00 UTC, now is 10:00 UTC → 6h away, within custom 8h window
      const shift = makeShift();
      const now = new Date("2026-03-18T10:00:00Z");

      const result = calculateShiftPhase({
        shifts: [shift],
        activeTimeEntry: null,
        now,
        beforeShiftHours: 8,
      });

      expect(result.phase).toBe("before_shift");
      expect(result.nextShift).toEqual(shift);
    });

    it("picks the earliest upcoming shift when multiple exist", () => {
      const earlyShift = makeShift({
        schedule_shift_id: "shift-early",
        start_time: "14:00:00",
        end_time: "20:00:00",
      });
      const lateShift = makeShift({
        schedule_shift_id: "shift-late",
        start_time: "22:00:00",
        end_time: "23:59:00",
      });
      const now = new Date("2026-03-18T13:00:00Z");

      const result = calculateShiftPhase({
        shifts: [lateShift, earlyShift], // deliberately reversed
        activeTimeEntry: null,
        now,
      });

      expect(result.phase).toBe("before_shift");
      expect(result.nextShift?.schedule_shift_id).toBe("shift-early");
    });
  });

  describe("during_shift", () => {
    it("returns during_shift when time_entry is clocked_in", () => {
      const shift = makeShift();
      const timeEntry = makeTimeEntry();
      const now = new Date("2026-03-18T17:00:00Z");

      const result = calculateShiftPhase({
        shifts: [shift],
        activeTimeEntry: timeEntry,
        now,
      });

      expect(result.phase).toBe("during_shift");
      expect(result.activeShift).toEqual(shift);
      expect(result.activeTimeEntry).toEqual(timeEntry);
    });

    it("does NOT return during_shift when shift is in progress but no time_entry", () => {
      // This is the CRITICAL rule: shift time without punch != during_shift.
      // Phase machine now returns awaiting_punch_in for this scenario
      // (start <= now < end, no active entry) — the invariant is the same,
      // the surface label changed from the old "late punch before_shift" path.
      const shift = makeShift();
      const now = new Date("2026-03-18T18:00:00Z"); // middle of shift

      const result = calculateShiftPhase({
        shifts: [shift],
        activeTimeEntry: null,
        now,
      });

      expect(result.phase).toBe("awaiting_punch_in");
      expect(result.phase).not.toBe("during_shift");
    });

    it("matches activeShift from shifts array via shift_id", () => {
      const shift = makeShift({ schedule_shift_id: "shift-abc" });
      const timeEntry = makeTimeEntry({ shift_id: "shift-abc" });
      const now = new Date("2026-03-18T17:00:00Z");

      const result = calculateShiftPhase({
        shifts: [shift],
        activeTimeEntry: timeEntry,
        now,
      });

      expect(result.activeShift?.schedule_shift_id).toBe("shift-abc");
    });

    it("returns during_shift even if shift is not in shifts array (edge case)", () => {
      // Time entry exists but shift wasn't fetched — still during_shift, activeShift is null
      const timeEntry = makeTimeEntry({ shift_id: "shift-unknown" });
      const now = new Date("2026-03-18T17:00:00Z");

      const result = calculateShiftPhase({
        shifts: [],
        activeTimeEntry: timeEntry,
        now,
      });

      expect(result.phase).toBe("during_shift");
      expect(result.activeShift).toBeNull();
    });
  });

  describe("after_shift", () => {
    it("returns after_shift when time_entry has punch_out", () => {
      const shift = makeShift();
      const timeEntry = makeTimeEntry({
        punch_out: "2026-03-18T23:05:00Z",
        status: "completed",
      });
      const now = new Date("2026-03-18T23:10:00Z");

      const result = calculateShiftPhase({
        shifts: [shift],
        activeTimeEntry: timeEntry,
        now,
      });

      expect(result.phase).toBe("after_shift");
      expect(result.activeShift).toEqual(shift);
      expect(result.activeTimeEntry).toEqual(timeEntry);
    });
  });

  describe("phase priority", () => {
    it("during_shift takes priority over before_shift when both could apply", () => {
      // Employee has an active punch AND another shift coming up
      const currentShift = makeShift({ schedule_shift_id: "shift-current" });
      const nextShift = makeShift({
        schedule_shift_id: "shift-next",
        start_time: "23:30:00",
        end_time: "23:59:00",
      });
      const timeEntry = makeTimeEntry({ shift_id: "shift-current" });
      const now = new Date("2026-03-18T20:00:00Z");

      const result = calculateShiftPhase({
        shifts: [currentShift, nextShift],
        activeTimeEntry: timeEntry,
        now,
      });

      expect(result.phase).toBe("during_shift");
    });

    it("after_shift takes priority over before_shift", () => {
      // Employee punched out but has another shift soon
      const completedShift = makeShift({ schedule_shift_id: "shift-done" });
      const nextShift = makeShift({
        schedule_shift_id: "shift-next",
        start_time: "23:30:00",
        end_time: "23:59:00",
      });
      const timeEntry = makeTimeEntry({
        shift_id: "shift-done",
        punch_out: "2026-03-18T23:05:00Z",
        status: "completed",
      });
      const now = new Date("2026-03-18T23:10:00Z");

      const result = calculateShiftPhase({
        shifts: [completedShift, nextShift],
        activeTimeEntry: timeEntry,
        now,
      });

      expect(result.phase).toBe("after_shift");
    });
  });

  describe("edge cases", () => {
    it("handles shift exactly at beforeShiftHours boundary", () => {
      // Shift at 16:00 UTC, now is 12:00 UTC → exactly 4h = at the boundary (should be before_shift)
      const shift = makeShift();
      const now = new Date("2026-03-18T12:00:00Z");

      const result = calculateShiftPhase({
        shifts: [shift],
        activeTimeEntry: null,
        now,
      });

      expect(result.phase).toBe("before_shift");
    });

    it("handles shift ending right now", () => {
      // Shift ends at 23:00 UTC, now is 23:00 UTC — endMs is NOT strictly < nowMs,
      // so the shift is not classified as past. It is also not awaiting_punch_in
      // (23:00 < 23:00 is false) and not before_shift (start 16:00 > now 23:00 is false).
      // The lookahead check (startMs - nowMs is negative ≤ 48h) triggers no_shift
      // with nextShift populated — the shift window has closed without a punch.
      const shift = makeShift();
      const now = new Date("2026-03-18T23:00:00Z");

      const result = calculateShiftPhase({
        shifts: [shift],
        activeTimeEntry: null,
        now,
      });

      expect(result.phase).toBe("no_shift");
      expect(result.nextShift).toEqual(shift);
    });
  });
});
