/**
 * dept-token-resolver.ts
 *
 * Maps DB-driven location_id strings to design-token keys.
 * Tokens (tokens.css) define 4 dept colors: kitchen, floor, bar, event.
 * Real DB location_id may use Norwegian names — this resolver normalises.
 *
 * Why: `var(--dept-<id>)` resolves at paint time using the token key. If
 * location_id is "kjøkken" the variable `--dept-kjøkken` is undefined, so the
 * band falls back to `var(--border)` (gray). This resolver maps known variants
 * to the 4 canonical token keys before the CSS variable is constructed.
 *
 * Strategy: map the 4 prototype key groups + common Norwegian variants.
 * Unknown values fall back to "default" (gray). A console.warn fires once per
 * unknown key (browser only, dev aid) so DB normalisaton work can be tracked.
 */

const NORM_MAP: Record<string, string> = {
  // kitchen
  kitchen: "kitchen",
  kjokken: "kitchen",
  kjøkken: "kitchen",
  kok: "kitchen",

  // floor
  floor: "floor",
  sal: "floor",
  spisesal: "floor",
  bistro: "floor",
  servering: "floor",

  // bar
  bar: "bar",

  // event
  event: "event",
  arrangement: "event",
};

const warnedKeys = new Set<string>();

/**
 * Resolves a DB-driven location_id to a design-token key.
 *
 * @param locationId - Raw location_id from `day_line` row (may be null/undefined).
 * @returns One of "kitchen" | "floor" | "bar" | "event" | "default".
 */
export function resolveDeptToken(locationId: string | null | undefined): string {
  if (!locationId) return "default";
  const key = locationId.toLowerCase().trim();
  const mapped = NORM_MAP[key];
  if (mapped) return mapped;
  if (typeof window !== "undefined" && !warnedKeys.has(key)) {
    warnedKeys.add(key);
    console.warn(
      `[dept-token-resolver] No mapping for location_id="${locationId}" — falling back to default (gray). Add an entry to NORM_MAP to fix.`,
    );
  }
  return "default";
}
