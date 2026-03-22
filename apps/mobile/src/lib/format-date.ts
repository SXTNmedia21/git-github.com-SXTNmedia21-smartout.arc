/**
 * Shared date formatting utilities for payroll screens.
 *
 * Centralizes the two date display patterns used across
 * AbsenceBalanceScreen and TimebankScreen so they stay consistent
 * and changes only need to happen in one place.
 */

/** Format a date string (YYYY-MM-DD or ISO) as "DD.MM.YYYY" — e.g. "21.03.2026" */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const dd = date.getDate().toString().padStart(2, "0");
  const mm = (date.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/** Format a timestamp (ISO string) as "DD.MM kl. HH:MM" — e.g. "21.03 kl. 14:30" */
export function formatTimestamp(isoStr: string): string {
  const date = new Date(isoStr);
  const dd = date.getDate().toString().padStart(2, "0");
  const mm = (date.getMonth() + 1).toString().padStart(2, "0");
  const hh = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  return `${dd}.${mm} kl. ${hh}:${min}`;
}
