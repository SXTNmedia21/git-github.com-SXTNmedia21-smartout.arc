// ============================================
// date-anchor.ts
// Timezone-aware date helpers for the cockpit
// DateAnchor. Anchors all "today" concepts to the
// workspace timezone, not the client's local tz.
// ============================================

/**
 * Formats a Date as ISO date (YYYY-MM-DD) in the given IANA timezone.
 *
 * Why: Client machines can be in any timezone. Cockpit's "today" must match
 * the workspace's operational calendar (Europe/Oslo by default).
 *
 * @param date - Absolute moment in time.
 * @param timezone - IANA timezone name, e.g. "Europe/Oslo".
 * @returns ISO date string in the target timezone.
 */
export function toWorkspaceDate(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

/**
 * Returns the current workspace-local date as ISO (YYYY-MM-DD).
 *
 * @param timezone - IANA timezone name.
 * @returns Today's date in the workspace timezone.
 */
export function getWorkspaceToday(timezone: string): string {
  return toWorkspaceDate(new Date(), timezone);
}

/**
 * Shifts an ISO date by N days and returns a new ISO date.
 *
 * Why: Arrow navigation in DateAnchor needs pure, timezone-agnostic date math.
 * Operates on the date components only (no DST math), which is correct for
 * calendar-day navigation in a single timezone.
 *
 * @param isoDate - Date in YYYY-MM-DD format.
 * @param days - Signed day delta.
 * @returns Shifted ISO date.
 */
export function shiftIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Human-readable formatter for an ISO date in the workspace timezone.
 *
 * @param isoDate - Date in YYYY-MM-DD format.
 * @param locale - BCP-47 locale, default "nb-NO".
 * @returns E.g. "onsdag 15. april".
 */
export function formatAnchorLabel(isoDate: string, locale: string = "nb-NO"): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const utc = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(utc);
}
