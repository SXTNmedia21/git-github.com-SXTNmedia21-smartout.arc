import { format, isWithinInterval } from "date-fns";
import { nb } from "date-fns/locale";

export function formatNorwegianDate(date: Date): string {
  return format(date, "EEEE d. MMMM yyyy", { locale: nb });
}

export interface DateRange {
  startTime: Date;
  endTime: Date;
}

export function isOverlapping(a: DateRange, b: DateRange): boolean {
  return (
    isWithinInterval(a.startTime, { start: b.startTime, end: b.endTime }) ||
    isWithinInterval(b.startTime, { start: a.startTime, end: a.endTime }) ||
    isWithinInterval(a.endTime, { start: b.startTime, end: b.endTime }) ||
    isWithinInterval(b.endTime, { start: a.startTime, end: a.endTime })
  );
}

// ── Oslo-aware date helpers (ADR-0192) ─────────────────────────────────────
//
// Why these exist:
//   `new Date().getDay()` / `setHours(0,0,0,0)` use the JS runtime's local
//   timezone. On Vercel/Droplet servers that's UTC; in a Norwegian browser it's
//   Europe/Oslo — but Next.js runs "use client" hooks on the SERVER first
//   (SSR/hydration) where the timezone is UTC. This means `getDay()` + local
//   `setHours` computes the wrong week boundary during SSR, causing a
//   hydration mismatch visible as wrong-week schedule data on first paint.
//
//   These helpers use `Intl.DateTimeFormat` with `timeZone: "Europe/Oslo"` so
//   the correct Oslo calendar day is used everywhere, regardless of where the
//   code runs (server UTC, browser UTC+2/+1).
//
// Refs: Council 2026-04-28 voice + tool perf, ADR-0192 (Oslo TZ canonical).

const OSLO_TZ = "Europe/Oslo";

/** Return the ISO date string "YYYY-MM-DD" for `instant` in Europe/Oslo. */
export function osloDateStringFromDate(instant: Date): string {
  // "en-GB" formatToParts gives stable day/month/year keys.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: OSLO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const lookup: Record<string, string> = {};
  for (const p of parts) lookup[p.type] = p.value;
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

/**
 * Return the ISO weekday (0 = Sunday … 6 = Saturday) for `instant`
 * as seen in Europe/Oslo, using the ISO calendar day.
 */
export function osloGetDay(instant: Date): number {
  const dateStr = osloDateStringFromDate(instant);
  // Parse back as UTC midnight so Date.prototype.getDay() returns the UTC
  // weekday for that calendar date — i.e. the Oslo calendar weekday.
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

/**
 * Advance an ISO date string "YYYY-MM-DD" by `days` calendar days.
 * Pure string-math — avoids creating Date objects that may carry a local-tz
 * offset into the calculation.
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Return the ISO date string "YYYY-MM-DD" for the Monday of the Oslo-calendar
 * week that contains `instant`, optionally offset by `weekOffset` weeks.
 *
 * Replaces the `getDay() + setHours(0,0,0,0)` pattern in use-week-range.ts
 * which computed wrong results during SSR (server TZ = UTC).
 */
export function osloWeekStartString(instant: Date, weekOffset = 0): string {
  const todayStr = osloDateStringFromDate(instant);
  const dayOfWeek = osloGetDay(new Date(`${todayStr}T00:00:00Z`));
  // ISO week: Monday = 1. JS `getDay()` Mon=1..Sat=6, Sun=0.
  // Days since Monday: (dayOfWeek + 6) % 7 maps Sun(0)→6, Mon(1)→0, …, Sat(6)→5.
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return addDaysToDateString(todayStr, -daysSinceMonday + weekOffset * 7);
}

/**
 * Return the ISO date string "YYYY-MM-DD" for the Sunday of the Oslo-calendar
 * week that contains `instant`, optionally offset by `weekOffset` weeks.
 */
export function osloWeekEndString(instant: Date, weekOffset = 0): string {
  return addDaysToDateString(osloWeekStartString(instant, weekOffset), 6);
}

/**
 * Return the Oslo-calendar weekday key (mon/tue/…/sun) for an ISO date string
 * "YYYY-MM-DD". Used by the roster auto-fill loop instead of `Date.getDay()`
 * which is server-local.
 */
export function weekdayKeyFromDateString(
  dateStr: string,
): "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun" {
  const dayIndex = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  const MAP = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  return MAP[dayIndex]!;
}
