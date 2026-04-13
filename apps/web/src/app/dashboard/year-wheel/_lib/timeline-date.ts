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
