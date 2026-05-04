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
 * Workspace-tz-aware date + clock parts for a given UTC instant.
 *
 * Returns YYYY-MM-DD + HH:MM:SS + weekday (0=Sun..6=Sat) + hour (0-23),
 * all resolved in the workspace IANA timezone. Use when server code
 * needs to derive `shift_date`, `start_time`, or `day_category` from a
 * UTC ISO instant in a way that matches the workspace's operational
 * calendar — NOT the server-process tz (which is UTC on Vercel by
 * default, so local getters silently drift at tariff boundaries like
 * kveldstillegg 21:00 and helgetillegg fredag/lørdag overhang).
 *
 * Mirrors the `Intl.DateTimeFormat('en-CA', ...)` + `formatToParts`
 * pattern already used by `toWorkspaceDate` and
 * `schedule-shift-lock.ts` so tariff / day_category derivation stays
 * consistent with the shift-lock trigger and cockpit anchoring.
 *
 * Caller contract: `timezone` must be a valid IANA name; callers
 * SHOULD fall back to `'Europe/Oslo'` when `workspace.timezone` is
 * NULL/empty — same fallback contract as
 * `schedule_shift_is_temporally_locked` in
 * `20260428130000_schedule_shift_temporal_lock.sql`.
 *
 * @param iso - Absolute moment in UTC ISO-8601.
 * @param timezone - IANA timezone name, e.g. "Europe/Oslo".
 * @returns Date / time / weekday / hour resolved in the target tz.
 */
export function toWorkspaceDateTimeParts(
  iso: string,
  timezone: string,
): { date: string; time: string; weekday: number; hour: number } {
  const d = new Date(iso);

  // `en-CA` gives YYYY-MM-DD numeric output; `weekday: short` gives
  // 3-letter English names (stable across Node/browsers) so we can map
  // to 0..6 without depending on locale-specific numeric weekday output.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(d);

  const pickStr = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const pickNum = (type: string) => Number(pickStr(type) || "0");

  const year = pickStr("year") || "1970";
  const month = pickStr("month") || "01";
  const day = pickStr("day") || "01";
  // Intl can emit "24" at midnight in some locales — normalise to 0..23.
  const hour = pickNum("hour") % 24;
  const minute = pickNum("minute");
  const second = pickNum("second");
  const pad = (n: number) => String(n).padStart(2, "0");

  const WEEKDAY_MAP: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = WEEKDAY_MAP[pickStr("weekday")] ?? 0;

  return {
    date: `${year}-${month}-${day}`,
    time: `${pad(hour)}:${pad(minute)}:${pad(second)}`,
    weekday,
    hour,
  };
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
