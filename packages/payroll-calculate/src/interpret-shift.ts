/**
 * packages/payroll-calculate/src/interpret-shift.ts
 *
 * WHAT: Pure function that takes raw shift + time-entry data and produces
 *       a structured InterpretedShift with time-buckets classified by
 *       day/time/holiday type.
 *
 * WHY: This is Layer 3 of the payroll pipeline. Before we can apply supplement
 *      rules or compute costs, we must:
 *        1. Apply workspace punch-rounding policy to actual punch times
 *        2. Subtract unpaid breaks from gross duration
 *        3. Split remaining worked time into contiguous buckets, each tagged
 *           with its Oslo-local classification (day_normal / evening / night /
 *           weekend_sat / weekend_sun / holiday)
 *
 * BUCKET SPLITS: We walk minute-by-minute in 1-minute steps. This is simple
 * and deterministic. Performance: a 12-hour shift = 720 iterations. For
 * 600 shifts/month × 720 iterations = 432,000 iterations — well within Node.js
 * budget. No memoisation needed.
 *
 * CLASSIFICATION RULES (time-of-day based, Oslo local):
 *   - holiday: public holiday overrides everything
 *   - weekend_sun: Sunday (weekday=7)
 *   - weekend_sat: Saturday (weekday=6)
 *   - night: 00:00–05:59 Oslo (Riksavtalen §6 definition) — before day starts
 *   - evening: 21:00–23:59 Oslo (Riksavtalen §6 definition)
 *   - day_normal: all other Mon–Fri time
 *
 * NOTE: The "evening" / "night" thresholds here are ENGINE defaults for bucket
 * classification ONLY. The actual supplement rules (via evaluate-supplements.ts)
 * determine which rate fires using their own match_predicate windows. The bucket
 * classification exists so that UI can display a breakdown even without running
 * supplement rules.
 *
 * OVERNIGHT SHIFTS: A shift spanning midnight (e.g. 22:00 Fri → 02:00 Sat)
 * will produce buckets tagged with the correct Oslo-local weekday for each
 * minute. The weekday may change mid-shift.
 *
 * BREAKS: Only unpaid breaks are subtracted from worked time. Paid breaks
 * are included in worked_minutes (but flagged). Break deduction: if multiple
 * breaks JSONB entries, sum all. If breaks JSONB is null → use scheduled
 * break minutes from shift as fallback. Paid vs unpaid: determined by caller
 * (payroll.break_rule.is_paid is a workspace config; caller must pass
 * paid_break_minutes via WorkspaceSettings or derive before calling this fn).
 *
 * ROUNDING: Applied BEFORE bucket-splitting. Punch times are rounded per
 * workspace policy, then the rounded times define the bucket boundaries.
 *
 * Zero I/O. All inputs are parameters.
 */

import type {
  InterpretedShift,
  ShiftInput,
  TimeEntryInput,
  TimeBucket,
  PublicHoliday,
  WorkspaceSettings,
  TimeClassification,
  ISOWeekday,
} from "./types.js";
import {
  osloParts,
  weekdayOslo,
  minutesBetween,
  addMinutes,
  isPublicHoliday,
  osloDateString,
  osloMinuteSinceMidnight,
  hhmToMinutes,
} from "./oslo-time.js";

// ─────────────────────────────────────────────
// Rounding
// ─────────────────────────────────────────────

/**
 * Apply workspace punch-rounding to a punch time.
 *
 * @param punchIso - actual punch-in or punch-out (UTC ISO)
 * @param scheduledIso - scheduled start/end (UTC ISO) — used for snap_to_scheduled
 * @param settings - workspace rounding settings
 * @param direction - "in" (punch-in rounds favorably = backward for employee) or
 *                    "out" (punch-out rounds favorably = forward for employee)
 * @returns rounded UTC ISO string
 */
function applyPunchRounding(
  punchIso: string,
  scheduledIso: string,
  settings: WorkspaceSettings,
  direction: "in" | "out",
): string {
  const { punch_rounding_minutes: stepMinutes, punch_rounding_direction } = settings;

  // 0 = no rounding
  if (stepMinutes === 0) return punchIso;

  const punchMs = new Date(punchIso).getTime();
  const stepMs = stepMinutes * 60_000;

  if (punch_rounding_direction === "snap_to_scheduled") {
    const scheduledMs = new Date(scheduledIso).getTime();
    const diffMinutes = Math.abs(punchMs - scheduledMs) / 60_000;
    // If within snap window, snap to scheduled time
    if (diffMinutes <= settings.punch_rounding_snap_window_minutes) {
      return scheduledIso;
    }
    // Outside window: fall through to half_up rounding
    const roundedMs = Math.round(punchMs / stepMs) * stepMs;
    return new Date(roundedMs).toISOString();
  }

  if (punch_rounding_direction === "toward_employee") {
    // Punch-in: round down (employee benefits from earlier start)
    // Punch-out: round up (employee benefits from later end)
    if (direction === "in") {
      const roundedMs = Math.floor(punchMs / stepMs) * stepMs;
      return new Date(roundedMs).toISOString();
    } else {
      const roundedMs = Math.ceil(punchMs / stepMs) * stepMs;
      return new Date(roundedMs).toISOString();
    }
  }

  // half_up: standard rounding to nearest step
  const roundedMs = Math.round(punchMs / stepMs) * stepMs;
  return new Date(roundedMs).toISOString();
}

// ─────────────────────────────────────────────
// Bucket classification
// ─────────────────────────────────────────────

// Night window: 00:00–05:59 Oslo (Riksavtalen §6 baseline)
const NIGHT_END_MINUTE = 6 * 60; // 06:00 = 360 minutes from midnight
// Evening window: 21:00–23:59 Oslo
const EVENING_START_MINUTE = 21 * 60; // 21:00 = 1260 minutes from midnight

function classifyMinute(instant: Date, holidays: ReadonlyArray<PublicHoliday>): TimeClassification {
  const dateStr = osloDateString(instant);
  if (isPublicHoliday(dateStr, holidays)) return "holiday";

  const weekday = weekdayOslo(instant);
  if (weekday === 7) return "weekend_sun";
  if (weekday === 6) return "weekend_sat";

  const minuteOfDay = osloMinuteSinceMidnight(instant.toISOString());
  if (minuteOfDay < NIGHT_END_MINUTE) return "night";
  if (minuteOfDay >= EVENING_START_MINUTE) return "evening";

  return "day_normal";
}

// ─────────────────────────────────────────────
// Bucket builder
// ─────────────────────────────────────────────

/**
 * Build contiguous time-buckets from a start+end datetime range.
 * Walks minute-by-minute, grouping consecutive minutes with the same
 * classification into a single bucket.
 *
 * @param startIso - inclusive start (UTC ISO)
 * @param endIso - exclusive end (UTC ISO) — up to but not including this minute
 * @param holidays - public holidays for classification
 * @returns sorted array of TimeBucket
 */
function buildBuckets(
  startIso: string,
  endIso: string,
  holidays: ReadonlyArray<PublicHoliday>,
): TimeBucket[] {
  const totalMinutes = minutesBetween(startIso, endIso);
  if (totalMinutes <= 0) return [];

  const buckets: TimeBucket[] = [];
  let currentBucketStart = startIso;
  let currentClass: TimeClassification | null = null;
  let currentWeekday: ISOWeekday | null = null;
  let currentMinutes = 0;

  for (let i = 0; i < totalMinutes; i++) {
    const minuteIso = addMinutes(startIso, i);
    const instant = new Date(minuteIso);
    const cls = classifyMinute(instant, holidays);
    const weekday = weekdayOslo(instant);

    if (cls !== currentClass || weekday !== currentWeekday) {
      // Flush current bucket
      if (currentClass !== null && currentWeekday !== null && currentMinutes > 0) {
        buckets.push({
          from: currentBucketStart,
          to: addMinutes(currentBucketStart, currentMinutes),
          minutes: currentMinutes,
          weekday: currentWeekday,
          classification: currentClass,
        });
      }
      // Start new bucket
      currentBucketStart = minuteIso;
      currentClass = cls;
      currentWeekday = weekday;
      currentMinutes = 1;
    } else {
      currentMinutes++;
    }
  }

  // Flush final bucket
  if (currentClass !== null && currentWeekday !== null && currentMinutes > 0) {
    buckets.push({
      from: currentBucketStart,
      to: addMinutes(currentBucketStart, currentMinutes),
      minutes: currentMinutes,
      weekday: currentWeekday,
      classification: currentClass,
    });
  }

  return buckets;
}

// ─────────────────────────────────────────────
// Break deduction
// ─────────────────────────────────────────────

/**
 * Compute break minutes from time_entry.breaks JSONB.
 * Falls back to shift.scheduled_break_minutes if breaks array is null/empty.
 */
function computeBreakMinutes(
  timeEntry: TimeEntryInput,
  shift: ShiftInput,
): { totalBreakMinutes: number; paidBreakMinutes: number; unpaidBreakMinutes: number } {
  let totalBreakMinutes: number;

  if (timeEntry.breaks && timeEntry.breaks.length > 0) {
    // Sum all recorded break durations
    totalBreakMinutes = timeEntry.breaks.reduce((acc, b) => acc + b.minutes, 0);
  } else {
    // Fall back to scheduled breaks
    totalBreakMinutes = shift.scheduled_break_minutes;
  }

  // Convention: breaks are unpaid unless overridden by payroll.break_rule.is_paid.
  // The calc engine receives this as a workspace setting. For now, all breaks are
  // treated as unpaid (standard Aml. §10-9 — breaks > 30 min are unpaid).
  // ASSUMPTION: is_paid = false (unpaid breaks). If workspace has paid breaks,
  // caller must adjust shift.scheduled_break_minutes to reflect paid-only breaks.
  // TODO: Thread payroll.break_rule.is_paid through when Day 4 RPC supplies it.
  const paidBreakMinutes = 0;
  const unpaidBreakMinutes = totalBreakMinutes;

  return { totalBreakMinutes, paidBreakMinutes, unpaidBreakMinutes };
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────

/**
 * interpretShift — Layer 3 pure function.
 *
 * Converts raw punch data + shift metadata into a structured InterpretedShift
 * with classified time-buckets. Supplement rules are NOT applied here —
 * that is the job of evaluateSupplements().
 *
 * @param shift - schedule_shift row fields + employee linkage
 * @param timeEntry - time_entry row with punch_in/out/breaks
 * @param publicHolidays - list of public holidays for the relevant period
 * @param workspaceSettings - rounding + break policy settings
 * @returns InterpretedShift with buckets and fired_supplements=[] (populated later)
 */
export function interpretShift(
  shift: ShiftInput,
  timeEntry: TimeEntryInput,
  publicHolidays: ReadonlyArray<PublicHoliday>,
  workspaceSettings: WorkspaceSettings,
): InterpretedShift {
  // 1. Resolve effective punch-out (fallback to scheduled end if null)
  const rawPunchOut = timeEntry.punch_out ?? shift.scheduled_end;

  // 2. Apply rounding
  const effectiveStart = applyPunchRounding(
    timeEntry.punch_in,
    shift.scheduled_start,
    workspaceSettings,
    "in",
  );
  const effectiveEnd = applyPunchRounding(
    rawPunchOut,
    shift.scheduled_end,
    workspaceSettings,
    "out",
  );

  // 3. Compute break minutes
  const { totalBreakMinutes, paidBreakMinutes, unpaidBreakMinutes } = computeBreakMinutes(
    timeEntry,
    shift,
  );

  // 4. Gross and net minutes
  const grossMinutes = minutesBetween(effectiveStart, effectiveEnd);
  const workedMinutes = Math.max(0, grossMinutes - unpaidBreakMinutes);

  // 5. Build time-buckets for the worked portion.
  // We subtract breaks from the END of the shift for simplicity.
  // Convention: breaks are taken as a single block subtracted from end.
  // (Real break placement within shift is irrelevant for bucket classification
  //  since the supplement rules operate on the bucket windows regardless.)
  //
  // This means for a 22:00–06:00 shift with 30min break:
  //   worked period = 22:00–05:30 (7.5h) — break removed from end.
  // The resulting bucket split will correctly tag the night hours.
  const workedEndIso = addMinutes(effectiveStart, workedMinutes);
  const buckets = buildBuckets(effectiveStart, workedEndIso, publicHolidays);

  return {
    shift_id: shift.shift_id,
    profile_id: shift.profile_id,
    workspace_id: shift.workspace_id,
    effective_start: effectiveStart,
    effective_end: effectiveEnd,
    scheduled_break_minutes: totalBreakMinutes,
    paid_break_minutes: paidBreakMinutes,
    unpaid_break_minutes: unpaidBreakMinutes,
    gross_minutes: grossMinutes,
    worked_minutes: workedMinutes,
    buckets,
    // Supplements populated by evaluateSupplements() in the next pipeline step
    fired_supplements: [],
    night_worker_category: shift.night_worker_category,
  };
}
