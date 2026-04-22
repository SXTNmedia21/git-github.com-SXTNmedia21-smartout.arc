/**
 * Pure helpers for mapping pointer X positions on the year-wheel timeline
 * to calendar dates (full-year or single-month viewport).
 */

/** Number of days in a given calendar year (handles leap years). */
export function getDaysInYear(year: number): number {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/** ISO date (YYYY-MM-DD) from X within a full-year track. */
export function clientXToIsoDateYear(clientX: number, rect: DOMRect, year: number): string {
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  const days = getDaysInYear(year);
  const idx = Math.round(ratio * Math.max(0, days - 1));
  const d = new Date(year, 0, 1);
  d.setDate(d.getDate() + idx);
  return d.toISOString().split("T")[0]!;
}

/** ISO date from X within a single-month track (day 1 … last day of month). */
export function clientXToIsoDateMonth(
  clientX: number,
  rect: DOMRect,
  year: number,
  monthIndex: number,
): string {
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  const dim = new Date(year, monthIndex + 1, 0).getDate();
  const day = Math.min(dim, Math.max(1, Math.round(ratio * (dim - 1)) + 1));
  const d = new Date(year, monthIndex, day);
  return d.toISOString().split("T")[0]!;
}

/**
 * Forward projection — X coordinate within a full-year track for a given ISO date.
 * Inverse of `clientXToIsoDateYear` at fractional-day resolution. Dates outside
 * the given year are clamped to [0, width].
 */
export function xForDate(dateStr: string, year: number, width: number): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (y == null || m == null || d == null) return 0;
  const date = Date.UTC(y, m - 1, d);
  const start = Date.UTC(year, 0, 1);
  const daysInYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
  const dayIdx = Math.floor((date - start) / 86_400_000);
  const clamped = Math.max(0, Math.min(daysInYear, dayIdx));
  return (clamped / daysInYear) * width;
}

/** Inverse of `xForDate` using raw width (no DOMRect required). */
export function xToDate(x: number, year: number, width: number): string {
  const ratio = Math.min(1, Math.max(0, x / Math.max(1, width)));
  const daysInYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
  const idx = Math.round(ratio * Math.max(0, daysInYear - 1));
  const d = new Date(year, 0, 1);
  d.setDate(d.getDate() + idx);
  return d.toISOString().split("T")[0]!;
}
