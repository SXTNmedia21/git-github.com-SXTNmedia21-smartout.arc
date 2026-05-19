/**
 * Shift phase calculation — pure function that determines where in the shift cycle
 * an employee currently is. This drives the entire home screen, FAB shortcuts,
 * and push notification priority.
 *
 * CRITICAL: "during_shift" requires an active time_entry with clocked_in status.
 * A shift's scheduled time range WITHOUT a punch does NOT produce "during_shift".
 */

import type { Database } from "@smartout/supabase/database.types";
import type { TimeEntry } from "@/types/time-entry";

export type ShiftPhase =
  | "no_shift"
  | "before_shift"
  | "awaiting_punch_in"
  | "during_shift"
  | "missed_shift"
  | "after_shift";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];

export type ShiftPhaseInput = {
  /** Upcoming/recent shifts for this employee */
  shifts: ScheduleShift[];
  /** Currently active time entry (clocked_in, no punch_out) — null if none */
  activeTimeEntry: TimeEntry | null;
  /** Current time — injectable for testing */
  now: Date;
  /** How many hours before a shift counts as "before_shift" (default: 4) */
  beforeShiftHours?: number;
};

export type ShiftPhaseResult = {
  phase: ShiftPhase;
  /** The shift that is currently active (during_shift or after_shift) */
  activeShift: ScheduleShift | null;
  /** The active time entry if clocked in */
  activeTimeEntry: TimeEntry | null;
  /** The next upcoming shift (before_shift or no_shift with upcoming) */
  nextShift: ScheduleShift | null;
};

const HOURS_MS = 60 * 60 * 1000;
const DEFAULT_BEFORE_SHIFT_HOURS = 12;
const LOOKAHEAD_HOURS = 48;

/**
 * Builds a UTC Date from a shift's shift_date (DATE "YYYY-MM-DD") + start_time/end_time (TIME "HH:MM:SS").
 * Postgres TIME columns come back as "HH:MM:SS" without timezone. We treat them as UTC
 * to avoid local timezone ambiguity on the device.
 */
function buildShiftDateTime(shiftDate: string, time: string): Date {
  // Strip any existing timezone suffix (Z, +00, etc.) so we can append our own
  const cleanTime = time.replace(/[Z+-].*$/, "");
  return new Date(`${shiftDate}T${cleanTime}Z`);
}

function getShiftStart(shift: ScheduleShift): Date {
  return buildShiftDateTime(shift.shift_date, shift.start_time);
}

function getShiftEnd(shift: ScheduleShift): Date {
  return buildShiftDateTime(shift.shift_date, shift.end_time);
}

/**
 * Calculates the current shift phase for an employee.
 *
 * Priority order:
 * 1. Active time_entry with clocked_in → during_shift
 * 2. Time_entry with punch_out (completed) → after_shift
 * 3. Next shift within beforeShiftHours → before_shift
 *    (includes shifts that have started but employee hasn't punched in — late punch warning)
 * 4. Nothing relevant → no_shift
 */
export function calculateShiftPhase(input: ShiftPhaseInput): ShiftPhaseResult {
  const { shifts, activeTimeEntry, now, beforeShiftHours = DEFAULT_BEFORE_SHIFT_HOURS } = input;

  const nowMs = now.getTime();
  const beforeShiftMs = beforeShiftHours * HOURS_MS;
  const lookaheadMs = LOOKAHEAD_HOURS * HOURS_MS;

  // 1. Active clocked_in time entry → during_shift
  if (activeTimeEntry && activeTimeEntry.status === "clocked_in" && !activeTimeEntry.punch_out) {
    // Find the shift associated with this time entry
    const activeShift =
      shifts.find((s) => s.schedule_shift_id === activeTimeEntry.shift_id) ?? null;

    return {
      phase: "during_shift",
      activeShift,
      activeTimeEntry,
      nextShift: null,
    };
  }

  // 2. Recent time entry with punch_out (completed shift, handoff/confirmation pending)
  //    Look for any time entry that was completed recently (within lookahead window)
  //    The activeTimeEntry param can also be a recently completed entry
  if (activeTimeEntry && activeTimeEntry.punch_out && activeTimeEntry.status === "completed") {
    const activeShift =
      shifts.find((s) => s.schedule_shift_id === activeTimeEntry.shift_id) ?? null;

    return {
      phase: "after_shift",
      activeShift,
      activeTimeEntry,
      nextShift: null,
    };
  }

  // 3. Sort shifts by start time ascending to find the next relevant shift
  const sortedShifts = [...shifts].sort(
    (a, b) => getShiftStart(a).getTime() - getShiftStart(b).getTime(),
  );

  // Bucket time-observant phases. Cascade D6 lifecycle:
  // upcoming → active → pending_signoff → closed | missed
  //
  // Mobile mapping with no active time entry:
  //   end < now              → missed_shift (only most-recent missed surfaces)
  //   start <= now < end     → awaiting_punch_in (shift in progress, no punch)
  //   now < start <= +window → before_shift
  //   start within 48h       → no_shift (peek at upcoming)
  let recentlyMissed: ScheduleShift | null = null;

  for (const shift of sortedShifts) {
    const startMs = getShiftStart(shift).getTime();
    const endMs = getShiftEnd(shift).getTime();

    // Past shift — surface as missed only if no completed time entry covered it
    if (endMs < nowMs) {
      recentlyMissed = shift;
      continue;
    }

    // Shift in progress (start passed, end not yet) AND no active punch
    // → late-punch surface, NOT before_shift
    if (startMs <= nowMs && nowMs < endMs) {
      return {
        phase: "awaiting_punch_in",
        activeShift: shift,
        activeTimeEntry: null,
        nextShift: shift,
      };
    }

    // Strictly in the future, within beforeShiftHours window
    if (startMs > nowMs && startMs - nowMs <= beforeShiftMs) {
      return {
        phase: "before_shift",
        activeShift: null,
        activeTimeEntry: null,
        nextShift: shift,
      };
    }

    // Within lookahead window but outside before-window — peek
    if (startMs - nowMs <= lookaheadMs) {
      return {
        phase: "no_shift",
        activeShift: null,
        activeTimeEntry: null,
        nextShift: shift,
      };
    }
  }

  // 4a. Most-recently missed shift in current lookahead window → missed_shift
  if (recentlyMissed) {
    const missedEnd = getShiftEnd(recentlyMissed).getTime();
    if (nowMs - missedEnd <= lookaheadMs) {
      return {
        phase: "missed_shift",
        activeShift: recentlyMissed,
        activeTimeEntry: null,
        nextShift: null,
      };
    }
  }

  // 4b. Nothing relevant → no_shift
  return {
    phase: "no_shift",
    activeShift: null,
    activeTimeEntry: null,
    nextShift: null,
  };
}
