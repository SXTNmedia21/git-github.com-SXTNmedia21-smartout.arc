/**
 * packages/payroll-calculate/src/aggregate-period.ts
 *
 * WHAT: Layer 5 pure function. Aggregates all shift cost snapshots for a
 *       period into one AggregatedPeriod per profile, adding manual supplements
 *       and tip distributions.
 *
 * WHY: The period-level aggregate is the final number that appears on the
 *      payslip. This function:
 *        1. Groups snapshots by profile_id
 *        2. Sums all payroll lines by pay_code (deduplication)
 *        3. Adds manual supplements (admin-approved one-off amounts)
 *        4. Merges tip distributions (approved pool payouts per profile)
 *
 * TIPS (per O36 / spec):
 *   Tips come from tip_distribution rows where pool.status='approved'.
 *   They are NOT manual_supplement rows — they have their own DB table.
 *   The calc engine does NOT write to tip_distribution — it only reads.
 *   Tips are merged as a separate line type "tip_payout".
 *
 * MONTHLY SALARY:
 *   For monthly-salary employees, base_hourly=0 on each shift. The gross
 *   for the period is computed here from the profile.salary_type and
 *   period hours allocation. LIMITATION: in Phase 1, monthly salary gross
 *   must be provided by caller as a separate monthly_salary_ore parameter
 *   (the DB stores the monthly salary on employee_payroll_profile via
 *   payroll.employment_contract.gross_monthly — which is not part of the
 *   pure fn inputs to avoid I/O). The caller computes and passes it.
 *
 * Zero I/O. Pure function.
 */

import type {
  SnapshottedShiftCost,
  ManualSupplementInput,
  TipDistributionInput,
  PublicHoliday,
  AggregatedPeriod,
  PeriodLine,
} from "./types.js";
import { nokToOre, sumOre } from "./cents.js";

/**
 * aggregatePeriod — Layer 5 pure function.
 *
 * @param snapshots - all shift cost snapshots for this period (all profiles)
 * @param manualSupplements - admin-added one-off supplements for this period
 * @param tipDistributions - approved tip distribution rows for this period
 * @param periodId - the period being aggregated (for output labelling)
 * @param monthlySalaryByProfile - optional map of profile_id → monthly gross ore
 *   for monthly-salary employees (provided by caller from contract data)
 * @returns one AggregatedPeriod per profile
 */
export function aggregatePeriod(
  snapshots: ReadonlyArray<SnapshottedShiftCost>,
  manualSupplements: ReadonlyArray<ManualSupplementInput>,
  tipDistributions: ReadonlyArray<TipDistributionInput>,
  periodId: string,
  monthlySalaryByProfile?: ReadonlyMap<string, bigint>,
): AggregatedPeriod[] {
  // ── 1. Group snapshots by profile ────────────────────────────────────────
  const byProfile = new Map<
    string,
    {
      workspace_id: string;
      snapshots: SnapshottedShiftCost[];
    }
  >();

  for (const snap of snapshots) {
    const existing = byProfile.get(snap.profile_id);
    if (existing !== undefined) {
      existing.snapshots.push(snap);
    } else {
      byProfile.set(snap.profile_id, {
        workspace_id: snap.workspace_id,
        snapshots: [snap],
      });
    }
  }

  // Collect all profile IDs (may have manual supplements with no shifts)
  const allProfileIds = new Set<string>([
    ...byProfile.keys(),
    ...manualSupplements.map((m) => m.profile_id),
    ...tipDistributions.map((t) => t.profile_id),
  ]);

  const results: AggregatedPeriod[] = [];

  for (const profileId of allProfileIds) {
    const profileData = byProfile.get(profileId);
    const workspace_id =
      profileData?.workspace_id ??
      manualSupplements.find((m) => m.profile_id === profileId)?.workspace_id ??
      tipDistributions.find((t) => t.profile_id === profileId)?.workspace_id ??
      "";

    const profileSnapshots = profileData?.snapshots ?? [];

    // ── 2. Aggregate shift lines per pay_code ────────────────────────────
    const linesByPayCode = new Map<
      string,
      {
        pay_code: string;
        description: string;
        amountOre: bigint;
        hours: number;
        shift_ids: string[];
        supplement_rule_id: string | null;
      }
    >();

    for (const snap of profileSnapshots) {
      for (const line of snap.lines) {
        const existing = linesByPayCode.get(line.pay_code);
        if (existing !== undefined) {
          existing.amountOre += line.amount_ore;
          existing.hours += line.hours ?? 0;
          if (!existing.shift_ids.includes(snap.shift_id)) {
            existing.shift_ids.push(snap.shift_id);
          }
        } else {
          linesByPayCode.set(line.pay_code, {
            pay_code: line.pay_code,
            description: line.description,
            amountOre: line.amount_ore,
            hours: line.hours ?? 0,
            shift_ids: [snap.shift_id],
            supplement_rule_id: line.supplement_rule_id,
          });
        }
      }
    }

    // ── 3. Monthly salary override ───────────────────────────────────────
    const monthlyOre = monthlySalaryByProfile?.get(profileId);
    if (monthlyOre !== undefined && monthlyOre > 0n) {
      // Replace base_monthly=0 with actual monthly gross
      linesByPayCode.set("base_monthly", {
        pay_code: "base_monthly",
        description: "Månedlig grunnlønn",
        amountOre: monthlyOre,
        hours: 0, // hours not applicable for monthly
        shift_ids: profileSnapshots.map((s) => s.shift_id),
        supplement_rule_id: null,
      });
    }

    // ── 4. Manual supplements ────────────────────────────────────────────
    const profileManuals = manualSupplements.filter((m) => m.profile_id === profileId);
    let manualSupplementOre = 0n;

    for (const manual of profileManuals) {
      const amountOre = nokToOre(manual.amount);
      manualSupplementOre += amountOre;

      const payCode = manual.salary_code ?? "manual_supplement";
      const existing = linesByPayCode.get(payCode);
      if (existing !== undefined) {
        existing.amountOre += amountOre;
      } else {
        linesByPayCode.set(payCode, {
          pay_code: payCode,
          description: manual.description,
          amountOre,
          hours: 0,
          shift_ids: [manual.schedule_shift_id],
          supplement_rule_id: manual.supplement_rule_id,
        });
      }
    }

    // ── 5. Tip distributions ─────────────────────────────────────────────
    // Only include approved tip distributions for this period
    const profileTips = tipDistributions.filter(
      (t) => t.profile_id === profileId && t.status === "approved",
    );

    let tipsOre = 0n;
    for (const tip of profileTips) {
      // Use adjusted_amount if present, else calculated_amount
      const tipNok = tip.adjusted_amount ?? tip.calculated_amount;
      const tipOre = nokToOre(tipNok);
      tipsOre += tipOre;

      const existing = linesByPayCode.get("tip_payout");
      if (existing !== undefined) {
        existing.amountOre += tipOre;
      } else {
        linesByPayCode.set("tip_payout", {
          pay_code: "tip_payout",
          description: "Tips fra godkjent basseng",
          amountOre: tipOre,
          hours: 0,
          shift_ids: [],
          supplement_rule_id: null,
        });
      }
    }

    // ── 6. Build period lines ────────────────────────────────────────────
    const periodLines: PeriodLine[] = Array.from(linesByPayCode.values()).map((l) => ({
      pay_code: l.pay_code,
      description: l.description,
      hours: l.hours > 0 ? l.hours : null,
      amount_ore: l.amountOre,
      shift_ids: l.shift_ids,
      supplement_rule_id: l.supplement_rule_id,
    }));

    // ── 7. Totals ────────────────────────────────────────────────────────
    const grossAmountOre = sumOre(profileSnapshots.map((s) => s.total_ore)) + (monthlyOre ?? 0n);

    const totalOre = grossAmountOre + manualSupplementOre + tipsOre;

    results.push({
      period_id: periodId,
      profile_id: profileId,
      workspace_id,
      gross_amount_ore: grossAmountOre,
      tips_amount_ore: tipsOre,
      manual_supplement_ore: manualSupplementOre,
      total_ore: totalOre,
      lines: periodLines,
      shift_ids: profileSnapshots.map((s) => s.shift_id),
    });
  }

  return results;
}
