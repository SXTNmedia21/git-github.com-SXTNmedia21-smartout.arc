/**
 * timeMath — pure helpers for Manager Timeline day-line math.
 *
 * Day-line spans 06:00 → 02:00 next day (20h, 1200 minutes), per design
 * spec docs/domains/day-session/day-planner/project/timeline-chart.jsx
 * (DAY_MINUTES constant + derivation).
 *
 * `hmToMin` / `minToHM` are wall-clock conversions, NOT pixel calculations.
 * Pixel-per-minute math lives on the chart root via inline CSS custom
 * properties (--hour-h) — those are runtime layout values, not design
 * tokens. Keep that distinction.
 */

export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 26; // 02:00 next day expressed as hour 26
export const DAY_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60; // 1200

export function hmToMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minToHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
