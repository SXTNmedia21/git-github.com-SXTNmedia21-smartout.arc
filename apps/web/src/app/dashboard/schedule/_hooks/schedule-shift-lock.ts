/**
 * Client-side approximation of the `schedule_shift_is_temporally_locked`
 * PL/pgSQL function (supabase/migrations/20260428130000_schedule_shift_temporal_lock.sql).
 *
 * Server-side is still the source of truth — this is UX only.
 *
 * The PG function reads `workspace.timezone` (fallback `Europe/Oslo`) and
 * compares shift-start against `timezone(ws_tz, now())`. This TS helper
 * mirrors that by accepting the workspace timezone and using
 * `Intl.DateTimeFormat` to resolve "now" in the same zone as the DB.
 * Callers should pass `workspace.timezone`; the fallback keeps parity with
 * the PG function for pre-workspace contexts.
 */

type LockableShift = {
  dateId: string;
  startTime: string;
};

const FALLBACK_TIMEZONE = "Europe/Oslo";

function getWorkspaceLocalParts(timezone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");

  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour") % 24, // Intl can emit "24" at midnight in some locales
    minute: pick("minute"),
  };
}

export function isShiftTemporallyLocked(
  shift: LockableShift,
  timezone: string = FALLBACK_TIMEZONE,
): boolean {
  const [year, month, day] = shift.dateId.split("-").map(Number);
  const [startHour, startMinute] = shift.startTime.split(":").map(Number);

  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    startHour === undefined ||
    startMinute === undefined
  ) {
    return false;
  }

  const now = getWorkspaceLocalParts(timezone);

  // Shift is locked if its date is before "today" in workspace TZ,
  // OR its start-of-day-plus-time is at-or-before workspace "now".
  // Mirrors the two-branch OR in schedule_shift_is_temporally_locked().
  const shiftBeforeToday =
    year < now.year ||
    (year === now.year && month < now.month) ||
    (year === now.year && month === now.month && day < now.day);

  if (shiftBeforeToday) return true;

  const shiftOnToday = year === now.year && month === now.month && day === now.day;
  if (!shiftOnToday) return false;

  const shiftStartMinutes = startHour * 60 + startMinute;
  const nowMinutes = now.hour * 60 + now.minute;
  return shiftStartMinutes <= nowMinutes;
}
