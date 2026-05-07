/**
 * packages/payroll-calculate/src/snapshot-cost.ts
 *
 * WHAT: Layer 4 pure function. Converts an InterpretedShift (with fired
 *       supplements from Layer 3) into a SnapshottedShiftCost by:
 *         1. Freezing the tariff rates as a snapshot (JSONB equivalent)
 *         2. Computing base pay (hourly × worked minutes)
 *         3. Summing all supplement amounts
 *         4. Building per-pay-code lines for the payslip
 *
 * WHY: The tariff snapshot must be frozen at first calculation time so that
 *      re-running the calc engine later (after tariff updates) still produces
 *      an IDENTICAL result for the same frozen period. This is the "idempotence"
 *      guarantee from ADR-0252.
 *
 * BASE PAY:
 *   - salary_type="hourly": base = (hourlyRate / 60) * worked_minutes (integer øre)
 *   - salary_type="monthly": base = 0 at shift level (period aggregate handles monthly)
 *   - custom_rate on shift overrides profile rate (shift.custom_rate is non-null)
 *
 * PAY CODES:
 *   - Base pay → pay_code = "base_hourly" or "base_monthly"
 *   - Each unique (rule_id) supplement → pay_code = supplement_type + "-" + rule_id[0:8]
 *
 * Zero I/O. Pure function.
 */

import type {
  InterpretedShift,
  SnapshottedShiftCost,
  TariffRateInput,
  PayrollLine,
  PayrollProfile,
} from "./types.js";
import { nokToOre, orePerMinuteFromHourlyNok, sumOre, oreToNok } from "./cents.js";

/**
 * snapshotShiftCost — Layer 4 pure function.
 *
 * @param interpreted - output of interpretShift() with fired_supplements populated
 * @param rates - active tariff rates for the period (frozen into snapshot)
 * @param profile - employee payroll profile (for salary_type + hourly_rate)
 * @param baseHourlyRateNok - resolved base hourly rate in NOK
 *   (may come from profile, tariff minstelønn lookup, or custom_rate)
 */
export function snapshotShiftCost(
  interpreted: InterpretedShift,
  rates: ReadonlyArray<TariffRateInput>,
  profile: PayrollProfile,
  baseHourlyRateNok: number,
): SnapshottedShiftCost {
  const lines: PayrollLine[] = [];

  // ── 1. Base pay ─────────────────────────────────────────────────────────
  let basePayOre: bigint;

  if (profile.salary_type === "monthly") {
    // Monthly salary: base cost is 0 at shift level
    // (the monthly gross is computed at period-aggregate level)
    basePayOre = 0n;
    // Still emit a line for audit purposes
    lines.push({
      pay_code: "base_monthly",
      description: "Månedlig grunnlønn (per vakt)",
      hours: null,
      rate_nok: null,
      amount_ore: 0n,
      supplement_rule_id: null,
      provenance: { salary_type: "monthly", note: "aggregated at period level" },
    });
  } else {
    // Hourly: compute from worked_minutes
    const effectiveRateNok = baseHourlyRateNok;
    const orePerMin = orePerMinuteFromHourlyNok(effectiveRateNok);
    basePayOre = orePerMin * BigInt(Math.round(interpreted.worked_minutes));

    lines.push({
      pay_code: "base_hourly",
      description: "Grunnlønn timebasert",
      hours: interpreted.worked_minutes / 60,
      rate_nok: effectiveRateNok,
      amount_ore: basePayOre,
      supplement_rule_id: null,
      provenance: {
        salary_type: "hourly",
        worked_minutes: interpreted.worked_minutes,
        rate_nok: effectiveRateNok,
      },
    });
  }

  // ── 2. Supplement lines ─────────────────────────────────────────────────
  // Group fired_supplements by rule_id to sum them across buckets
  const supplementByRule = new Map<
    string,
    {
      amountOre: bigint;
      quantityMinutes: number;
      supplement: (typeof interpreted.fired_supplements)[0];
    }
  >();

  for (const sup of interpreted.fired_supplements) {
    const existing = supplementByRule.get(sup.rule_id);
    if (existing !== undefined) {
      existing.amountOre += sup.amount_ore;
      existing.quantityMinutes += sup.quantity_minutes;
    } else {
      supplementByRule.set(sup.rule_id, {
        amountOre: sup.amount_ore,
        quantityMinutes: sup.quantity_minutes,
        supplement: sup,
      });
    }
  }

  let totalSupplementsOre = 0n;

  for (const [ruleId, agg] of supplementByRule) {
    const { supplement, amountOre, quantityMinutes } = agg;
    totalSupplementsOre += amountOre;

    lines.push({
      pay_code: `${supplement.supplement_type}-${ruleId.slice(0, 8)}`,
      description: `Tillegg (${supplement.supplement_type}) regel ${ruleId.slice(0, 8)}`,
      hours: quantityMinutes / 60,
      rate_nok: supplement.rate_value_nok,
      amount_ore: amountOre,
      supplement_rule_id: ruleId,
      provenance: {
        rule_id: ruleId,
        rate_type: supplement.rate_type,
        tariff_rate_table_id: supplement.tariff_rate_table_id,
        ...supplement.provenance,
      },
    });
  }

  const totalOre = basePayOre + totalSupplementsOre;

  return {
    shift_id: interpreted.shift_id,
    profile_id: interpreted.profile_id,
    workspace_id: interpreted.workspace_id,
    // Shallow-clone each rate entry so the snapshot is independent of the caller's array.
    // TariffRateInput contains only primitive fields (string | number | null) — no nested
    // objects — so a spread clone produces a fully independent copy. A caller mutating
    // `rates` after this call will NOT affect the frozen snapshot, upholding the
    // idempotence guarantee from ADR-0252.
    tariff_rate_snapshot: rates.map((r) => ({ ...r })) as TariffRateInput[],
    base_pay_ore: basePayOre,
    total_supplements_ore: totalSupplementsOre,
    total_ore: totalOre,
    lines,
  };
}
