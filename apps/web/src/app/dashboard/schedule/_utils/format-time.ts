// format-time.ts
// Why: compact time display for density-compressed schedule cards.
// Drops ":00" suffix when both start and end are on the hour — keeps display tight
// without sacrificing precision for non-round shifts.

/**
 * "10:00"–"22:00" → "10–22"
 * "10:30"–"22:15" → "10:30–22:15"
 * "22:00"–"02:00" → "22–02" (cross-midnight; no special marker V1)
 *
 * Separator is EN-DASH U+2013, not a hyphen.
 */
export function formatTimeShort(start: string, end: string): string {
  const fmt = (t: string) => (t.endsWith(":00") ? t.slice(0, -3) : t);
  return `${fmt(start)}–${fmt(end)}`; // EN-DASH U+2013, not hyphen
}

/**
 * Always returns "HH:mm–HH:mm" for tooltip/accessibility use.
 * EN-DASH separator for consistency.
 */
export function formatTimeFull(start: string, end: string): string {
  return `${start}–${end}`; // EN-DASH U+2013
}
