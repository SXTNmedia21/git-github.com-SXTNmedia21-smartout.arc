/**
 * packages/payroll-calculate/src/oslo-time.ts
 *
 * WHAT: Re-export and extend Oslo timezone utilities for payroll calc engine.
 *
 * WHY: The schedule capability already has battle-tested Oslo time helpers in
 *      packages/ai/src/capabilities/schedule/oslo-time.ts. Rather than duplicate,
 *      we re-export the primitives we need and add payroll-specific helpers:
 *        - parseOsloComponents: extract Y/M/D/H/min from a UTC ISO string in Oslo tz
 *        - weekdayOslo: ISO weekday (1=Mon, 7=Sun) for a UTC instant
 *        - hourMinuteOslo: {hour, minute} in Oslo for a UTC instant
 *        - minutesBetween: exact integer minutes between two UTC ISO datetimes
 *        - isPublicHoliday: check a date against a holiday list
 *
 * DST handling: All functions delegate to Intl.DateTimeFormat with timeZone="Europe/Oslo"
 * for correct DST arithmetic. We do NOT use Date arithmetic (which would use UTC).
 *
 * All functions are pure and deterministic. Zero I/O.
 */

const OSLO_TZ = "Europe/Oslo";

// NOTE: We intentionally inline Oslo time helpers rather than importing from
// packages/ai/src/capabilities/schedule/oslo-time.ts because:
//   1. That is an internal path (not a published package export)
//   2. @smartout/payroll-calculate must not depend on @smartout/ai (circular risk)
//   3. subpath imports from dist require @smartout/ai to be built first
//      (see learning_stage_engine_subpath_imports in MEMORY.md)
//
// This is intentional duplication for dependency isolation.
// If oslo-time is ever extracted to a shared @smartout/time package, migrate then.

/**
 * Extract Y/M/D/H/m/s components of a UTC ISO string as seen in Europe/Oslo.
 * Uses Intl.DateTimeFormat — DST-correct.
 */
export function osloParts(isoOrDate: string | Date): {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  second: number; // 0-59
} {
  const instant = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: OSLO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);

  const lookup: Record<string, string> = {};
  for (const p of parts) lookup[p.type] = p.value ?? "";

  return {
    year: Number(lookup["year"]),
    month: Number(lookup["month"]),
    day: Number(lookup["day"]),
    hour: Number(lookup["hour"]) % 24,
    minute: Number(lookup["minute"]),
    second: Number(lookup["second"]),
  };
}

/**
 * ISO weekday (1=Monday, 7=Sunday) for a UTC ISO string, in Oslo timezone.
 */
export function weekdayOslo(isoOrDate: string | Date): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const instant = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  // getDay() is UTC-based and would give wrong result near midnight.
  // Use Intl with weekday to get Oslo-local weekday.
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: OSLO_TZ,
    weekday: "short",
  });
  const day = fmt.format(instant);
  const map: Record<string, 1 | 2 | 3 | 4 | 5 | 6 | 7> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  const result = map[day];
  if (result === undefined) {
    throw new Error(`weekdayOslo: unexpected weekday string "${day}" from Intl`);
  }
  return result;
}

/**
 * {hour, minute} of an instant in Oslo time.
 */
export function hourMinuteOslo(isoOrDate: string | Date): { hour: number; minute: number } {
  const { hour, minute } = osloParts(isoOrDate);
  return { hour, minute };
}

/**
 * "YYYY-MM-DD" in Oslo timezone for a UTC instant.
 */
export function osloDateString(isoOrDate: string | Date): string {
  const { year, month, day } = osloParts(isoOrDate);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Exact integer minutes between two UTC ISO datetimes.
 * Floor division — partial minutes are dropped.
 */
export function minutesBetween(fromIso: string, toIso: string): number {
  const fromMs = new Date(fromIso).getTime();
  const toMs = new Date(toIso).getTime();
  return Math.floor((toMs - fromMs) / 60_000);
}

/**
 * Add `minutes` to a UTC ISO string, return new UTC ISO string.
 */
export function addMinutes(isoDate: string, minutes: number): string {
  const ms = new Date(isoDate).getTime();
  return new Date(ms + minutes * 60_000).toISOString();
}

/**
 * Check if a date string ("YYYY-MM-DD") is a public holiday.
 * Uses Oslo-local date of the instant.
 */
export function isPublicHoliday(
  dateStr: string,
  holidays: ReadonlyArray<{ date: string }>,
): boolean {
  return holidays.some((h) => h.date === dateStr);
}

/**
 * Parse "HH:MM" → total minutes since midnight.
 */
export function hhmToMinutes(hhMm: string): number {
  const [hh, mm] = hhMm.split(":").map(Number);
  if (hh === undefined || mm === undefined) {
    throw new Error(`hhmToMinutes: invalid HH:MM string "${hhMm}"`);
  }
  return hh * 60 + mm;
}

/**
 * Compute the Oslo-local "minutes since midnight" for a UTC instant.
 */
export function osloMinuteSinceMidnight(isoOrDate: string | Date): number {
  const { hour, minute } = osloParts(isoOrDate);
  return hour * 60 + minute;
}

/**
 * Alias for osloParts — spec-named entry point for BATCH 3 callers.
 * `import { parseOslo } from '@smartout/payroll-calculate'` is the public name.
 */
export const parseOslo = osloParts;
