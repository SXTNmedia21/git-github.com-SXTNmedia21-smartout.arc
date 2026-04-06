/**
 * Supplement Engine — pure functions for calculating Norwegian wage supplements.
 *
 * Implements the four canonical stacking rules for kveld, helg, and helligdag:
 * 1. Kveld + Helg → additive (both apply simultaneously)
 * 2. Kveld + Helligdag → additive (both apply simultaneously)
 * 3. Helg + Helligdag → helligdag wins (highest rate replaces weekend rate)
 * 4. Kveld + Helg + Helligdag → kveld + helligdag (helligdag replaces helg, kveld still stacks)
 *
 * Cross-midnight shifts are split at 00:00. Each date segment is evaluated
 * independently for day-of-week and holiday status.
 *
 * Break time is excluded proportionally: only paid hours qualify for supplements.
 * paid_hours = total_hours - break_hours
 * qualifying_hours = raw_qualifying_hours * (paid_hours / total_hours)
 *
 * No dependencies on React or any database layer — this module is safe for
 * both mobile and server-side use.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SupplementRule = {
  id: string;
  name: string;
  supplementType: "evening" | "weekend" | "holiday";
  /** HH:MM:SS — start of the time window this rule applies to */
  startTime: string;
  /** HH:MM:SS — end of the time window. "00:00:00" means midnight (end of day) */
  endTime: string;
  rate: number;
  rateType: "fixed_per_hour" | "percentage";
  isActive: boolean;
  /** Day-of-week indices where rule applies: 0=Sun, 1=Mon, …, 6=Sat */
  appliesToWeekdays: number[];
  appliesToWeekends: boolean;
};

export type SupplementInput = {
  /** YYYY-MM-DD — the start date of the shift */
  shiftDate: string;
  /** HH:MM:SS */
  startTime: string;
  /** HH:MM:SS — if earlier than startTime, shift crosses midnight */
  endTime: string;
  /** Unpaid break duration in minutes */
  breakMinutes: number;
  rules: SupplementRule[];
  /** Array of ISO date strings (YYYY-MM-DD) that are public holidays */
  holidays: string[];
};

export type ShiftSupplement = {
  type: "kveld" | "helg" | "helligdag";
  label: string;
  hours: number;
  /** The raw rate from the matching supplement rule */
  rate: number;
  /** Whether the rate is a fixed kr/hour amount or a percentage of base pay */
  rateType: "fixed_per_hour" | "percentage";
  /** Pre-computed amount for fixed_per_hour rules. Undefined for percentage rules
   * because the base hourly rate (needed for the calculation) is not available here. */
  estimatedAmount?: number;
};

// A single date-bounded segment of a shift after cross-midnight splitting
type ShiftSegment = {
  date: string;
  start: string; // HH:MM:SS
  end: string; // HH:MM:SS — "00:00:00" means end-of-day (midnight)
};

// ---------------------------------------------------------------------------
// Helper: date utilities
// ---------------------------------------------------------------------------

/**
 * Returns the UTC day-of-week for a YYYY-MM-DD date string.
 * 0 = Sunday, 1 = Monday, …, 6 = Saturday
 */
export function getDayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

/** True when dayOfWeek is Saturday (6) or Sunday (0) */
export function isWeekend(dayOfWeek: number): boolean {
  return dayOfWeek === 0 || dayOfWeek === 6;
}

// ---------------------------------------------------------------------------
// Helper: time arithmetic
// ---------------------------------------------------------------------------

/**
 * Converts "HH:MM:SS" to minutes since midnight.
 * "00:00:00" → 0 (used both as midnight-start and midnight-end in rule windows)
 */
export function timeToMinutes(time: string): number {
  const [h = "0", m = "0"] = time.split(":");
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

/**
 * Returns the number of minutes of overlap between two time ranges.
 * Both ranges are [start, end) in minutes-since-midnight.
 */
export function getOverlapMinutes(
  segStart: number,
  segEnd: number,
  ruleStart: number,
  ruleEnd: number,
): number {
  const overlapStart = Math.max(segStart, ruleStart);
  const overlapEnd = Math.min(segEnd, ruleEnd);
  return Math.max(0, overlapEnd - overlapStart);
}

// ---------------------------------------------------------------------------
// Helper: cross-midnight splitting
// ---------------------------------------------------------------------------

/**
 * Adds one day to a YYYY-MM-DD date string, returning a new YYYY-MM-DD string.
 */
function addOneDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Splits a shift into one or two date segments at the 00:00 boundary.
 *
 * - Same-day shift (end > start): returns a single segment.
 * - End time of "00:00:00" with start time after midnight: treated as end-of-day,
 *   so a shift 18:00–00:00 is a single segment ending at midnight (not crossing it).
 * - Cross-midnight (end < start, or end is "00:00:00" and start > "00:00:00"):
 *   Hmm — a shift 18:00–00:00 ends exactly at midnight, not crossing it.
 *   A shift 22:00–06:00 crosses midnight. We treat end="00:00:00" with
 *   start > "00:00:00" as end-of-day only when endMinutes == 0 and that
 *   represents a same-day "until midnight" shift (common kveld pattern).
 *   We detect a true cross-midnight by checking endMinutes < startMinutes.
 */
export function splitCrossMidnight(
  shiftDate: string,
  startTime: string,
  endTime: string,
): ShiftSegment[] {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);

  // endMin == 0 means midnight. If startMin > 0 and endMin == 0, this could
  // be either "ends exactly at midnight" (same-day) or "ends at midnight next day"
  // (cross-midnight with a 24h shift). The convention used here: endMin == 0
  // with startMin > 0 is treated as "ends at midnight same day" (1 segment).
  // A cross-midnight shift has endMin > 0 and endMin < startMin.
  const crossesMidnight = endMin > 0 && endMin < startMin;

  if (!crossesMidnight) {
    return [{ date: shiftDate, start: startTime, end: endTime }];
  }

  return [
    { date: shiftDate, start: startTime, end: "00:00:00" },
    { date: addOneDay(shiftDate), start: "00:00:00", end: endTime },
  ];
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

/**
 * Maps a SupplementRule's supplementType to the canonical ShiftSupplement type.
 * "evening" → "kveld", "weekend" → "helg", "holiday" → "helligdag"
 */
function toSupplementType(ruleType: SupplementRule["supplementType"]): ShiftSupplement["type"] {
  switch (ruleType) {
    case "evening":
      return "kveld";
    case "weekend":
      return "helg";
    case "holiday":
      return "helligdag";
  }
}

/**
 * Returns how many minutes of qualifying time a rule contributes for a given segment.
 *
 * Weekend and holiday rules cover the full segment duration (they apply to the entire
 * day — the rule's startTime/endTime window is "00:00:00"–"00:00:00" meaning full day).
 * Evening rules apply only to the overlap between the segment and the evening window.
 */
function getRuleQualifyingMinutes(
  segment: ShiftSegment,
  rule: SupplementRule,
  holidays: string[],
): number {
  const dow = getDayOfWeek(segment.date);
  const isHoliday = holidays.includes(segment.date);

  // Check if this rule even applies to this day
  if (rule.supplementType === "weekend" && !isWeekend(dow)) return 0;
  if (rule.supplementType === "holiday" && !isHoliday) return 0;
  if (rule.supplementType === "evening" && !rule.appliesToWeekdays.includes(dow)) return 0;

  const segStart = timeToMinutes(segment.start);
  // Treat "00:00:00" as end-of-day (1440 minutes = midnight) for the segment end
  const segEnd = segment.end === "00:00:00" ? 1440 : timeToMinutes(segment.end);
  const segDuration = segEnd - segStart;

  if (segDuration <= 0) return 0;

  if (rule.supplementType === "evening") {
    const ruleStart = timeToMinutes(rule.startTime);
    // Rule ending at "00:00:00" means it covers until midnight (1440)
    const ruleEnd = rule.endTime === "00:00:00" ? 1440 : timeToMinutes(rule.endTime);
    return getOverlapMinutes(segStart, segEnd, ruleStart, ruleEnd);
  }

  // Weekend and holiday rules cover the full segment
  return segDuration;
}

/**
 * Calculates all applicable Norwegian wage supplements for a shift.
 *
 * Steps:
 * 1. Split shift into date segments (handles cross-midnight)
 * 2. For each active rule, sum qualifying minutes across all segments
 * 3. Apply proportional break deduction: qualifying_h *= (paid_h / total_h)
 * 4. Apply stacking precedence: if helligdag present, remove helg
 * 5. Filter out zero-hour results
 * 6. Return ShiftSupplement array with labels and optional estimated amounts
 */
export function calculateSupplements(input: SupplementInput): ShiftSupplement[] {
  const { shiftDate, startTime, endTime, breakMinutes, rules, holidays } = input;

  const activeRules = rules.filter((r) => r.isActive);
  if (activeRules.length === 0) return [];

  // --- Step 1: split shift into per-date segments ---
  const segments = splitCrossMidnight(shiftDate, startTime, endTime);

  // Total shift duration in minutes (before break deduction)
  const totalMinutes = segments.reduce((sum, seg) => {
    const segStart = timeToMinutes(seg.start);
    const segEnd = seg.end === "00:00:00" ? 1440 : timeToMinutes(seg.end);
    return sum + (segEnd - segStart);
  }, 0);

  if (totalMinutes <= 0) return [];

  // Paid minutes (break subtracted)
  const paidMinutes = Math.max(0, totalMinutes - breakMinutes);
  // Proportional factor: paid / total (always ≤ 1)
  const paidRatio = paidMinutes / totalMinutes;

  // --- Step 2: accumulate raw qualifying minutes per supplement type ---
  const qualifyingMinutes: Map<ShiftSupplement["type"], number> = new Map();
  const ruleByType: Map<ShiftSupplement["type"], SupplementRule> = new Map();

  for (const rule of activeRules) {
    const supplementType = toSupplementType(rule.supplementType);

    let minutes = 0;
    for (const segment of segments) {
      minutes += getRuleQualifyingMinutes(segment, rule, holidays);
    }

    if (minutes > 0) {
      // Accumulate — multiple rules of the same type sum together
      qualifyingMinutes.set(supplementType, (qualifyingMinutes.get(supplementType) ?? 0) + minutes);
      // Keep the first matching rule for rate calculation
      if (!ruleByType.has(supplementType)) {
        ruleByType.set(supplementType, rule);
      }
    }
  }

  // --- Step 3: apply proportional break deduction ---
  for (const [type, minutes] of qualifyingMinutes) {
    qualifyingMinutes.set(type, minutes * paidRatio);
  }

  // --- Step 4: stacking precedence — helligdag replaces helg ---
  if (qualifyingMinutes.has("helligdag") && qualifyingMinutes.has("helg")) {
    qualifyingMinutes.delete("helg");
    ruleByType.delete("helg");
  }

  // --- Step 5 & 6: build result, filter zeros ---
  const result: ShiftSupplement[] = [];

  for (const [type, minutes] of qualifyingMinutes) {
    const hours = minutes / 60;
    if (hours <= 0) continue;

    const rule = ruleByType.get(type);

    const supplement: ShiftSupplement = {
      type,
      label: rule?.name ?? type,
      hours,
      rate: rule?.rate ?? 0,
      rateType: rule?.rateType ?? "fixed_per_hour",
    };

    // Compute estimated amount for fixed-per-hour rates only.
    // Percentage rules require the base hourly rate (not available here) —
    // the caller must handle the percentage calculation using supplement.rate.
    if (rule && rule.rateType === "fixed_per_hour") {
      supplement.estimatedAmount = hours * rule.rate;
    }

    result.push(supplement);
  }

  return result;
}

/** Alias used by spec and downstream consumers */
export const getShiftSupplements = calculateSupplements;

// ---------------------------------------------------------------------------
// DB row → engine rule mapper
// ---------------------------------------------------------------------------

/**
 * Maps a Supabase supplement_rule row to the local SupplementRule type
 * used by calculateSupplements.
 *
 * DB supplement_type enum → engine supplementType:
 *   "normal" (with time window)  → "evening"
 *   "week_based" / "day_based"   → "weekend"
 *   "holiday"                    → "holiday"
 *
 * Other DB types ("manual", "contract_rule") are skipped — they don't
 * map to automatic time-based supplements.
 */
export function mapDbRuleToSupplementRule(dbRow: {
  id: string;
  name: string;
  supplement_type: string;
  time_window_start: string | null;
  time_window_end: string | null;
  rate_value: number;
  rate_type: string;
  is_active: boolean;
  weekdays: number[];
}): SupplementRule | null {
  let supplementType: SupplementRule["supplementType"];

  switch (dbRow.supplement_type) {
    case "normal":
      supplementType = "evening";
      break;
    case "week_based":
    case "day_based":
      supplementType = "weekend";
      break;
    case "holiday":
      supplementType = "holiday";
      break;
    default:
      // "manual" and "contract_rule" don't apply to automatic calculation
      return null;
  }

  const weekdays = dbRow.weekdays ?? [];
  const appliesToWeekends = weekdays.includes(0) || weekdays.includes(6);

  return {
    id: dbRow.id,
    name: dbRow.name,
    supplementType,
    startTime: dbRow.time_window_start ?? "00:00:00",
    endTime: dbRow.time_window_end ?? "00:00:00",
    rate: dbRow.rate_value,
    rateType: dbRow.rate_type === "percentage" ? "percentage" : "fixed_per_hour",
    isActive: dbRow.is_active,
    appliesToWeekdays: weekdays,
    appliesToWeekends,
  };
}

/**
 * Batch-maps an array of DB supplement_rule rows, filtering out unmappable types.
 */
export function mapDbRules(
  dbRows: Array<{
    id: string;
    name: string;
    supplement_type: string;
    time_window_start: string | null;
    time_window_end: string | null;
    rate_value: number;
    rate_type: string;
    is_active: boolean;
    weekdays: number[];
  }>,
): SupplementRule[] {
  const mapped: SupplementRule[] = [];
  for (const row of dbRows) {
    const rule = mapDbRuleToSupplementRule(row);
    if (rule) mapped.push(rule);
  }
  return mapped;
}
