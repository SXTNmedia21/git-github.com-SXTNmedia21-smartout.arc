/**
 * Format utilities for the Min Lønn page.
 *
 * All monetary values are settled (from closed payroll periods) — no disclaimers needed.
 * Format matches Norwegian locale conventions: space as thousands separator, "kr" prefix.
 */

/** Norwegian month names indexed 0-11 */
const MONTH_NAMES = [
  "Januar",
  "Februar",
  "Mars",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

/**
 * Formats a NOK amount as "kr 21 146".
 * Uses nb-NO locale for the space-separated thousands grouping.
 */
export function formatNOK(amount: number): string {
  const rounded = Math.round(amount);
  return `kr ${rounded.toLocaleString("nb-NO")}`;
}

/**
 * Formats a decimal hours value as "7t 30min".
 * Whole-hour values omit the minutes part: "8t".
 */
export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}t`;
  return `${h}t ${m}min`;
}

/**
 * Formats a working-minutes integer as "7t 30min".
 * Used for net_working_minutes from the calculation row.
 */
export function formatMinutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}min`;
}

/**
 * Formats a period start date (YYYY-MM-DD) as "Mars 2026".
 * Matches the display label used throughout the mobile app.
 */
export function formatPeriodName(startDate: string): string {
  const date = new Date(startDate + "T00:00:00");
  const month = MONTH_NAMES[date.getMonth()];
  return `${month} ${date.getFullYear()}`;
}

/** Formats a date string (YYYY-MM-DD) as "25. mars" */
export function formatDayMonth(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const day = date.getDate();
  const month = MONTH_NAMES[date.getMonth()]?.toLowerCase() ?? "";
  return `${day}. ${month}`;
}

/** Formats a period date range as "1. mars – 31. mars" */
export function formatDateRange(startDate: string, endDate: string): string {
  return `${formatDayMonth(startDate)} – ${formatDayMonth(endDate)}`;
}
