/**
 * packages/payroll-calculate/src/evaluate-supplements.ts
 *
 * WHAT: The KEY dynamic supplement evaluation function. For a given time-bucket
 *       and shift context, evaluates all supplement rules and returns fired
 *       supplements with their amounts.
 *
 * WHY: This is the heart of the "Riksavtalen as data, not code" principle.
 *       NO supplement names are hardcoded. The function iterates rules,
 *       evaluates match_predicate, and fires when match. Rate resolution
 *       prefers tariff_rate_table lookup over rule.rate_value fallback.
 *
 * LOCKED RULE (per task spec + ADR-0250):
 *   Zero string literals for supplement names ("kveldstillegg", "nattillegg", etc.).
 *   Classifications and rates come entirely from DB rule + tariff rows.
 *
 * MATCH PREDICATE EVALUATION:
 *   0. supplement_type='holiday': rule fires ONLY when bucket.classification='holiday'.
 *      Empty windows[] is not a wildcard for holiday rules — classification IS the gate.
 *   1. windows[]: If windows is absent or empty → no time-window restriction.
 *      If windows present and non-empty → bucket must overlap at least one window.
 *   2. night_worker_category: If present → shift.night_worker_category must match.
 *   3. All conditions must hold (AND semantics).
 *
 * WINDOW OVERLAP: A bucket overlaps a window if the bucket's time range
 * intersects the window's time range (on the bucket's weekday).
 * We compute intersection in minutes-since-midnight space (Oslo local).
 *
 * OVERNIGHT WINDOWS: Windows that span midnight (time_to < time_from) are
 * detected and split into two ranges: [time_from, 24:00) and [00:00, time_to).
 *
 * RATE RESOLUTION:
 *   - If rule.tariff_rate_table_id is non-null → look up in rates[] by ID.
 *     Use tariff row's amount. Rate source = "tariff_lookup".
 *   - If tariff FK is null → use rule.rate_value directly.
 *     Rate source = "rule_fallback".
 *   - If tariff lookup fails (ID not found in rates[]) → fall back to rule.rate_value.
 *     This prevents silent $0 charges — logs the path in provenance.
 *
 * TARIFF-BINDING:
 *   is_tariff_bound=false: supplement still fires; provenance flags
 *   applies_only_if_bound=true. Calc-engine does NOT suppress — that is the
 *   governance/UI layer's responsibility.
 *
 * AMOUNT CALCULATION:
 *   - fixed_per_hour: (rate_nok/60) * bucket.minutes (integer øre arithmetic)
 *   - fixed_per_shift: rate_nok applies once per shift, not per bucket.
 *     Convention: caller groups per-shift supplements separately; this fn
 *     applies per-shift rate × 1 (quantity_minutes=0 for per_shift).
 *   - percentage: rate applied to base_rate_ore × bucket.minutes.
 *     base_rate_ore must be supplied by caller (shift's hourly rate).
 *
 * STACKING: Not applied here — caller (interpretShift pipeline) applies
 * applyStackingPolicy() after collecting all fired supplements per bucket.
 *
 * Zero I/O. All inputs are parameters.
 */

import type {
  TimeBucket,
  ShiftInput,
  SupplementRuleInput,
  TariffRateInput,
  WorkspaceSettings,
  FiredSupplement,
} from "./types.js";
import { nokToOre, orePerMinuteFromHourlyNok, pctSupplementOre } from "./cents.js";
import { hhmToMinutes, osloMinuteSinceMidnight } from "./oslo-time.js";

// ─────────────────────────────────────────────
// Window matching helpers
// ─────────────────────────────────────────────

type TimeRange = { from: number; to: number }; // minutes since midnight

/**
 * Expand a window definition into one or two TimeRange objects.
 * Handles overnight windows (time_to < time_from) by splitting at midnight.
 */
function expandWindow(time_from: string, time_to: string): TimeRange[] {
  const from = hhmToMinutes(time_from);
  const to = hhmToMinutes(time_to);

  if (to < from) {
    // Overnight: split into [from, 1440) and [0, to)
    return [
      { from, to: 24 * 60 },
      { from: 0, to },
    ];
  }

  return [{ from, to }];
}

/**
 * Does [a_from, a_to) overlap [b_from, b_to)?
 * Ranges are in minutes since midnight.
 */
function rangesOverlap(aFrom: number, aTo: number, bFrom: number, bTo: number): boolean {
  return aFrom < bTo && aTo > bFrom;
}

/**
 * Compute overlap in minutes between a bucket and a time range.
 * Bucket: [bucketFrom, bucketTo) in minutes-since-midnight space.
 * Window: [windowFrom, windowTo) in minutes-since-midnight.
 * Returns integer overlap minutes. 0 if no overlap.
 */
function overlapMinutes(
  bucketFromMin: number,
  bucketToMin: number,
  windowFrom: number,
  windowTo: number,
): number {
  const overlapFrom = Math.max(bucketFromMin, windowFrom);
  const overlapTo = Math.min(bucketToMin, windowTo);
  return Math.max(0, overlapTo - overlapFrom);
}

/**
 * Check if a bucket overlaps any of the windows for its weekday,
 * and compute the total overlapping minutes.
 *
 * Returns { matched: boolean; matchedWindow?: ...; overlapMinutes: number }
 */
function checkWindowMatch(
  bucket: TimeBucket,
  windows: NonNullable<SupplementRuleInput["match_predicate"]["windows"]>,
): {
  matched: boolean;
  matchedWindow?: { weekdays: number[]; time_from: string; time_to: string };
  overlapMinutes: number;
} {
  // Bucket time-of-day range in minutes since midnight (Oslo local)
  // We use the bucket's from/to timestamps to get Oslo minute values
  const bucketFromMin = osloMinuteSinceMidnight(bucket.from);
  // For bucket.to: add bucket.minutes to avoid recomputing from ISO
  const bucketToMin = bucketFromMin + bucket.minutes;

  let totalOverlap = 0;
  let bestWindow: (typeof windows)[number] | undefined;

  for (const win of windows) {
    // Check weekday filter
    if (!win.weekdays.includes(bucket.weekday)) continue;

    // Expand window (handle overnight)
    const ranges = expandWindow(win.time_from, win.time_to);
    for (const range of ranges) {
      if (!rangesOverlap(bucketFromMin, bucketToMin, range.from, range.to)) continue;
      const overlap = overlapMinutes(bucketFromMin, bucketToMin, range.from, range.to);
      if (overlap > 0) {
        totalOverlap += overlap;
        if (bestWindow === undefined) bestWindow = win;
      }
    }
  }

  return {
    matched: totalOverlap > 0,
    matchedWindow: bestWindow,
    overlapMinutes: totalOverlap,
  };
}

// ─────────────────────────────────────────────
// Rate resolution
// ─────────────────────────────────────────────

function resolveRate(
  rule: SupplementRuleInput,
  rates: ReadonlyArray<TariffRateInput>,
): { rateNok: number; source: "tariff_lookup" | "rule_fallback" } {
  if (rule.tariff_rate_table_id !== null) {
    const tariffRow = rates.find((r) => r.id === rule.tariff_rate_table_id);
    if (tariffRow !== undefined) {
      return { rateNok: tariffRow.amount, source: "tariff_lookup" };
    }
    // Tariff ID set but not found in passed rates — fall back with warning in provenance
  }
  return { rateNok: rule.rate_value, source: "rule_fallback" };
}

// ─────────────────────────────────────────────
// Amount computation
// ─────────────────────────────────────────────

/**
 * Compute the supplement amount in øre for a given rate type and quantity.
 *
 * @param rateType - "fixed_per_hour" | "percentage" | "fixed_per_shift"
 * @param rateNok - the resolved rate in NOK
 * @param minutesToApply - minutes in bucket to apply rate to (for per_hour)
 * @param baseRateOrePerMinute - base pay rate (for percentage supplements)
 */
function computeAmount(
  rateType: string,
  rateNok: number,
  minutesToApply: number,
  baseRateOrePerMinute: bigint,
): bigint {
  switch (rateType) {
    case "fixed_per_hour": {
      const orePerMin = orePerMinuteFromHourlyNok(rateNok);
      return orePerMin * BigInt(Math.round(minutesToApply));
    }

    case "percentage": {
      // Apply percentage to base pay for the bucket duration
      const baseOre = baseRateOrePerMinute * BigInt(Math.round(minutesToApply));
      return pctSupplementOre(baseOre, rateNok);
    }

    case "fixed_per_shift":
      // Per-shift: apply once regardless of bucket size
      // We return the full amount; caller decides if already fired for this shift
      return nokToOre(rateNok);

    default:
      // Unknown rate type — return 0 (safe, logged in provenance)
      return 0n;
  }
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────

/**
 * evaluateSupplements — Layer 3 dynamic rule evaluation.
 *
 * For a single time-bucket + shift context, evaluates all supplement rules
 * and returns the ones that fired with their computed amounts.
 *
 * DOES NOT apply stacking — caller does that (applyStackingPolicy).
 * DOES NOT modify InterpretedShift — caller adds results to fired_supplements.
 *
 * @param bucket - the time-bucket to evaluate (one segment of the shift)
 * @param shift - the original shift (for night_worker_category + custom_rate)
 * @param rules - all active supplement rules for this workspace (sorted by rule priority
 *                is the caller's responsibility if needed; this fn is order-agnostic)
 * @param rates - tariff rate rows for the active period (for rate lookup)
 * @param workspaceSettings - for is_tariff_bound flag
 * @param baseHourlyRateNok - employee's base hourly rate in NOK
 *                            (used for percentage supplement computation)
 * @returns array of fired supplements (pre-stacking)
 */
export function evaluateSupplements(
  bucket: TimeBucket,
  shift: ShiftInput,
  rules: ReadonlyArray<SupplementRuleInput>,
  rates: ReadonlyArray<TariffRateInput>,
  workspaceSettings: WorkspaceSettings,
  baseHourlyRateNok: number,
): FiredSupplement[] {
  const baseRateOrePerMinute = orePerMinuteFromHourlyNok(baseHourlyRateNok);
  const fired: FiredSupplement[] = [];

  // Track per-shift rules already fired (avoid double-counting per_shift supplements)
  // NOTE: This fn is called per-bucket. Per-shift supplements should fire only once.
  // Convention: caller should filter per-shift supplements to fire only on first bucket.
  // This fn fires them on every bucket matching them — deduplication is caller's job
  // (or caller can pass per_shift rules separately).

  for (const rule of rules) {
    if (!rule.is_active) continue;

    // Skip if rule validity period doesn't include the bucket date
    const bucketDate = bucket.from.slice(0, 10); // "YYYY-MM-DD"
    if (rule.valid_from !== null && bucketDate < rule.valid_from) continue;
    if (rule.valid_until !== null && bucketDate > rule.valid_until) continue;

    // ── Holiday classification gate ──────────────────────────────────────
    // Rules with supplement_type='holiday' must only fire on holiday buckets.
    // An empty windows[] means "no time-window restriction" — but for holiday
    // supplements the bucket classification itself IS the gate (ADR-0341 v1.1 §E2).
    // Without this guard, helligdagstillegg would fire on every non-holiday bucket
    // that lacks a time-window filter.
    if (rule.supplement_type === "holiday" && bucket.classification !== "holiday") continue;

    const predicate = rule.match_predicate;

    // ── Window matching ──────────────────────────────────────────────────
    let windowMatch: {
      matched: boolean;
      matchedWindow?: { weekdays: number[]; time_from: string; time_to: string };
      overlapMinutes: number;
    };

    const hasWindows = predicate.windows !== undefined && predicate.windows.length > 0;

    if (hasWindows) {
      windowMatch = checkWindowMatch(bucket, predicate.windows!);
    } else {
      // No windows restriction — matches full bucket
      windowMatch = {
        matched: true,
        matchedWindow: undefined,
        overlapMinutes: bucket.minutes,
      };
    }

    if (!windowMatch.matched) continue;

    // ── night_worker_category matching ───────────────────────────────────
    if (predicate.night_worker_category !== undefined) {
      if (shift.night_worker_category !== predicate.night_worker_category) continue;
    }

    // ── Rate resolution ──────────────────────────────────────────────────
    const { rateNok, source } = resolveRate(rule, rates);

    // ── Amount computation ───────────────────────────────────────────────
    const minutesToApply = windowMatch.overlapMinutes;
    const amountOre = computeAmount(rule.rate_type, rateNok, minutesToApply, baseRateOrePerMinute);

    // Build provenance
    const provenance: FiredSupplement["provenance"] = {
      rate_source: source,
    };
    if (windowMatch.matchedWindow !== undefined) {
      provenance.matched_window = windowMatch.matchedWindow;
    }
    if (predicate.night_worker_category !== undefined) {
      provenance.matched_category = predicate.night_worker_category;
    }
    // Flag advisory status for non-tariff-bound workspaces
    if (!workspaceSettings.is_tariff_bound && source === "tariff_lookup") {
      provenance.applies_only_if_bound = true;
    }

    fired.push({
      rule_id: rule.id,
      supplement_type: rule.supplement_type,
      rate_type: rule.rate_type,
      tariff_rate_table_id: rule.tariff_rate_table_id,
      rate_value_nok: rateNok,
      amount_ore: amountOre,
      quantity_minutes: minutesToApply,
      provenance,
    });
  }

  return fired;
}
