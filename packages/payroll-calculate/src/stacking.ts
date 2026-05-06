/**
 * packages/payroll-calculate/src/stacking.ts
 *
 * WHAT: Apply supplement stacking policy to a list of fired supplements
 *       for a given time-bucket.
 *
 * WHY: Multiple supplement rules can fire on the same time-bucket (e.g. an
 *      evening window + a night-worker category rule both match the same
 *      21:00–23:00 segment). The workspace stacking policy determines which
 *      supplements are retained:
 *
 *   all_stack: all fired supplements are retained — amounts sum.
 *   highest_only: only the supplement with the highest amount_ore is retained.
 *   category_exclusive: within each supplement_type ("normal", "holiday", etc.),
 *     only the highest-amount supplement is retained. Supplements of different
 *     types stack with each other.
 *
 * NOTE: This function operates per-bucket (called once per bucket in
 *       evaluate-supplements.ts). The FiredSupplement[] it receives are all
 *       supplements that matched the SAME bucket.
 *
 * Zero I/O. Pure function.
 */

import type { FiredSupplement } from "./types.js";

/**
 * Apply stacking policy to a set of fired supplements for a single bucket.
 *
 * @param fired - all supplements that matched this bucket (may be empty)
 * @param policy - workspace stacking policy
 * @returns filtered array of supplements that survive the policy
 */
export function applyStackingPolicy(
  fired: FiredSupplement[],
  policy: "all_stack" | "highest_only" | "category_exclusive",
): FiredSupplement[] {
  if (fired.length === 0) return [];

  switch (policy) {
    case "all_stack":
      // All supplements retained
      return fired;

    case "highest_only": {
      // Keep only the single supplement with the highest amount_ore
      const sorted = [...fired].sort((a, b) =>
        a.amount_ore > b.amount_ore ? -1 : a.amount_ore < b.amount_ore ? 1 : 0,
      );
      const best = sorted[0];
      return best !== undefined ? [best] : [];
    }

    case "category_exclusive": {
      // Within each supplement_type, keep only the highest-amount supplement.
      // Different supplement_types stack with each other.
      const byType = new Map<string, FiredSupplement>();
      for (const sup of fired) {
        const existing = byType.get(sup.supplement_type);
        if (existing === undefined || sup.amount_ore > existing.amount_ore) {
          byType.set(sup.supplement_type, sup);
        }
      }
      return Array.from(byType.values());
    }
  }
}
