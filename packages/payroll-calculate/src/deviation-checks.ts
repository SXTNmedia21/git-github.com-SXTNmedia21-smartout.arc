/**
 * packages/payroll-calculate/src/deviation-checks.ts
 *
 * WHAT: 14 deviation checks (W01–W14) on aggregated payroll data.
 *       Returns Deviation rows — no DB writes, no side effects.
 *
 * WHY: These checks enforce Norwegian labor law (Aml.) and tariff compliance.
 *      Errors block period approval; warnings are advisory; info is informational.
 *
 * CHECKS:
 *   W01 (ERROR)  — Hviletid violation: < 11h between consecutive shifts (Aml. §10-8)
 *   W02 (WARNING) — Daily OT cap: single shift > 9h worked (Aml. §10-4)
 *   W03 (WARNING) — Weekly OT cap: > 10h OT per week (Aml. §10-6)
 *   W04 (INFO)   — 4-week OT cap: > 25h OT in rolling 4 weeks (Aml. §10-6 §3)
 *   W05 (WARNING) — Missing tax card: tax_card_fetched_at is null or stale year
 *   W06 (WARNING) — TOIL max exceeded: banked hours > toil_max (if banked mode)
 *   W07 (ERROR)  — Deduction blocked: any computed deduction would bring pay below 0
 *   W08 (INFO)   — Punch-out missing: time_entry.punch_out was null (used scheduled end)
 *   W09 (WARNING) — OT pre-approval missing: overtime_requires_pre_approval=true but
 *                   no pre-approval recorded for OT minutes
 *   W10 (INFO)   — Forced break reminder: worked > forced_break_reminder_minutes without break
 *   W11 (WARNING) — Split shift threshold: gap between two shifts on same day
 *   W12 (INFO)   — Wellness quota exhausted: absence used more days than quota
 *   W13 (ERROR/WARNING) — Minstelønn check: effective hourly rate < Riksavtalen minstelønn
 *   W14 (INFO, auto-apply) — 90%-bedrift: industry average < 90% → auto-add 2 kr/t
 *
 * ASSUMPTION on W03/W04: these require week-level aggregation. The caller must supply
 * `shifts` sorted by date so we can group by ISO week. Phase 1 computes these
 * approximately: W03 checks if any week in the period has > 10h OT; W04 checks
 * rolling 4-week window from period start.
 *
 * ASSUMPTION on W05: tax_card_year vs current year. Caller supplies evaluated year.
 *
 * ASSUMPTION on W09: pre-approval is not stored in a dedicated table yet. W09 fires
 * when overtime_requires_pre_approval=true AND any shift has OT (W02 trigger).
 * This is conservative: it will produce a false-positive for shifts where OT was
 * verbally approved. Admin must acknowledge.
 *
 * Zero I/O. Pure function.
 */

import type {
  AggregatedPeriod,
  InterpretedShift,
  WorkspaceSettings,
  RegulatoryFrameworkInput,
  Deviation,
  PayrollProfile,
  TariffRateInput,
} from "./types.js";
import { resolveSeniorityTier } from "./seniority-resolver.js";
import { oreToNok } from "./cents.js";
import { osloDateString } from "./oslo-time.js";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function minutesBetweenISO(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 60_000);
}

function isoWeek(dateStr: string): number {
  // Tolerate both YYYY-MM-DD and full ISO datetime input.
  // Real callers pass shift.effective_start (full ISODateTime).
  // Strip to date portion before appending UTC noon anchor.
  const datePart = dateStr.slice(0, 10);
  const d = new Date(datePart + "T12:00:00Z");
  const dayOfYear = Math.floor(
    (d.getTime() - new Date(d.getFullYear() + "-01-01T12:00:00Z").getTime()) / 86_400_000,
  );
  const dayOfWeek = d.getUTCDay() || 7; // Mon=1 ... Sun=7
  return Math.floor((dayOfYear - dayOfWeek + 10) / 7);
}

function isoYear(dateStr: string): number {
  const datePart = dateStr.slice(0, 10);
  return new Date(datePart + "T12:00:00Z").getUTCFullYear();
}

// ─────────────────────────────────────────────
// W01: Hviletid (rest time) violation
// ─────────────────────────────────────────────

function checkW01(shifts: ReadonlyArray<InterpretedShift>): Deviation[] {
  const deviations: Deviation[] = [];

  // Group shifts by profile, sort by start time, check gaps
  const byProfile = new Map<string, InterpretedShift[]>();
  for (const shift of shifts) {
    const arr = byProfile.get(shift.profile_id) ?? [];
    arr.push(shift);
    byProfile.set(shift.profile_id, arr);
  }

  for (const [profileId, profileShifts] of byProfile) {
    const sorted = [...profileShifts].sort((a, b) =>
      a.effective_start.localeCompare(b.effective_start),
    );

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      const restMinutes = minutesBetweenISO(prev.effective_end, curr.effective_start);
      const restHours = restMinutes / 60;

      if (restHours < 11) {
        deviations.push({
          check_id: "W01",
          severity: "error",
          message: `Hviletid ${restHours.toFixed(1)}t mellom vakter (Aml. §10-8 krever minst 11t)`,
          profile_id: profileId,
          shift_id: curr.shift_id,
          period_id: null,
          suggested_action: "Endre vaktplan slik at ansatt har minst 11t hvile mellom vakter.",
          details: {
            prev_shift_id: prev.shift_id,
            prev_end: prev.effective_end,
            curr_start: curr.effective_start,
            rest_hours: restHours,
            threshold_hours: 11,
          },
        });
      }
    }
  }

  return deviations;
}

// ─────────────────────────────────────────────
// W02: Daily OT cap (> 9h)
// ─────────────────────────────────────────────

function checkW02(
  shifts: ReadonlyArray<InterpretedShift>,
  framework: RegulatoryFrameworkInput,
): Deviation[] {
  const deviations: Deviation[] = [];
  const maxMinutes = framework.max_daily_hours * 60;

  for (const shift of shifts) {
    if (shift.worked_minutes > maxMinutes) {
      const hours = shift.worked_minutes / 60;
      deviations.push({
        check_id: "W02",
        severity: "warning",
        message: `Vakt på ${hours.toFixed(1)}t overstiger daglig grense på ${framework.max_daily_hours}t (Aml. §10-4)`,
        profile_id: shift.profile_id,
        shift_id: shift.shift_id,
        period_id: null,
        suggested_action: "Verifiser at arbeidstidsavtale dekker denne arbeidstiden.",
        details: {
          worked_hours: hours,
          threshold_hours: framework.max_daily_hours,
        },
      });
    }
  }

  return deviations;
}

// ─────────────────────────────────────────────
// W03: Weekly OT cap (> 10h OT/week)
// ─────────────────────────────────────────────

function checkW03(
  shifts: ReadonlyArray<InterpretedShift>,
  framework: RegulatoryFrameworkInput,
): Deviation[] {
  const deviations: Deviation[] = [];
  const normalWeeklyMinutes = framework.max_weekly_hours * 60;
  const maxOtMinutesPerWeek = framework.max_weekly_ot_hours * 60;

  // Group by (profile, ISO week)
  const byProfileWeek = new Map<string, number>();
  for (const shift of shifts) {
    const weekKey = `${shift.profile_id}:${isoYear(shift.effective_start)}:W${isoWeek(shift.effective_start)}`;
    byProfileWeek.set(weekKey, (byProfileWeek.get(weekKey) ?? 0) + shift.worked_minutes);
  }

  const processedProfiles = new Set<string>();
  for (const [key, totalMinutes] of byProfileWeek) {
    const [profileId, , weekStr] = key.split(":");
    if (!profileId || !weekStr) continue;

    const otMinutes = Math.max(0, totalMinutes - normalWeeklyMinutes);
    if (otMinutes > maxOtMinutesPerWeek) {
      deviations.push({
        check_id: "W03",
        severity: "warning",
        message: `Overtid ${(otMinutes / 60).toFixed(1)}t i uke ${weekStr} overstiger ${framework.max_weekly_ot_hours}t grense (Aml. §10-6)`,
        profile_id: profileId,
        shift_id: null,
        period_id: null,
        suggested_action: "Reduser overtid eller innhent skriftlig avtale om utvidet grense.",
        details: {
          week: weekStr,
          ot_hours: otMinutes / 60,
          threshold_hours: framework.max_weekly_ot_hours,
        },
      });
      processedProfiles.add(profileId);
    }
  }

  return deviations;
}

// ─────────────────────────────────────────────
// W04: 4-week rolling OT cap (> 25h)
// ─────────────────────────────────────────────

function checkW04(
  shifts: ReadonlyArray<InterpretedShift>,
  framework: RegulatoryFrameworkInput,
): Deviation[] {
  const deviations: Deviation[] = [];
  const normalWeeklyMinutes = framework.max_weekly_hours * 60;
  const maxOt4WeekMinutes = 25 * 60; // Aml. §10-6 §3

  const byProfile = new Map<string, InterpretedShift[]>();
  for (const shift of shifts) {
    const arr = byProfile.get(shift.profile_id) ?? [];
    arr.push(shift);
    byProfile.set(shift.profile_id, arr);
  }

  for (const [profileId, profileShifts] of byProfile) {
    // Group by week
    const byWeek = new Map<string, number>();
    for (const shift of profileShifts) {
      const weekKey = `${isoYear(shift.effective_start)}:${isoWeek(shift.effective_start)}`;
      byWeek.set(weekKey, (byWeek.get(weekKey) ?? 0) + shift.worked_minutes);
    }

    const weekEntries = Array.from(byWeek.entries()).sort(([a], [b]) => a.localeCompare(b));

    // Rolling 4-week window
    for (let i = 0; i < weekEntries.length; i++) {
      const window = weekEntries.slice(Math.max(0, i - 3), i + 1);
      const totalOt = window.reduce(
        (acc, [, mins]) => acc + Math.max(0, mins - normalWeeklyMinutes),
        0,
      );
      if (totalOt > maxOt4WeekMinutes) {
        deviations.push({
          check_id: "W04",
          severity: "info",
          message: `Totalt ${(totalOt / 60).toFixed(1)}t overtid i 4-ukersperiode overstiger 25t grense (Aml. §10-6 §3)`,
          profile_id: profileId,
          shift_id: null,
          period_id: null,
          suggested_action: "Sjekk 4-ukersplanlegging — maks 25t OT per rullerende 4 uker.",
          details: {
            ot_hours: totalOt / 60,
            threshold_hours: 25,
            window_weeks: window.map(([w]) => w),
          },
        });
        break; // Only one W04 per profile per period
      }
    }
  }

  return deviations;
}

// ─────────────────────────────────────────────
// W05: Missing/stale tax card
// ─────────────────────────────────────────────

function checkW05(
  aggregated: ReadonlyArray<AggregatedPeriod>,
  profilesByProfileId: ReadonlyMap<string, PayrollProfile & { tax_card_year?: number | null }>,
  evaluationYear: number,
): Deviation[] {
  const deviations: Deviation[] = [];

  for (const agg of aggregated) {
    const profile = profilesByProfileId.get(agg.profile_id);
    if (!profile) continue;

    const taxYear = (profile as unknown as Record<string, unknown>)["tax_card_year"] as
      | number
      | null
      | undefined;
    if (taxYear === null || taxYear === undefined || taxYear < evaluationYear) {
      deviations.push({
        check_id: "W05",
        severity: "warning",
        message: `Skattekort mangler eller er utdatert (år ${taxYear ?? "ikke hentet"}, trengs ${evaluationYear})`,
        profile_id: agg.profile_id,
        shift_id: null,
        period_id: agg.period_id,
        suggested_action: "Hent skattekort fra Skatteetaten for inneværende år.",
        details: { tax_card_year: taxYear, required_year: evaluationYear },
      });
    }
  }

  return deviations;
}

// ─────────────────────────────────────────────
// W06: TOIL max exceeded
// ─────────────────────────────────────────────

function checkW06(
  aggregated: ReadonlyArray<AggregatedPeriod>,
  profilesByProfileId: ReadonlyMap<string, PayrollProfile>,
  currentToilBankHours: ReadonlyMap<string, number>,
  workspaceSettings: WorkspaceSettings,
): Deviation[] {
  const deviations: Deviation[] = [];

  for (const agg of aggregated) {
    const profile = profilesByProfileId.get(agg.profile_id);
    if (!profile) continue;
    if (profile.overtime_mode !== "banked") continue;

    const maxHours =
      profile.toil_max_banked_hours ?? workspaceSettings.toil_default_max_banked_hours;
    const currentHours = currentToilBankHours.get(agg.profile_id) ?? 0;

    if (currentHours > maxHours) {
      deviations.push({
        check_id: "W06",
        severity: "warning",
        message: `Avspaseringsbank på ${currentHours.toFixed(1)}t overstiger maks ${maxHours}t`,
        profile_id: agg.profile_id,
        shift_id: null,
        period_id: agg.period_id,
        suggested_action: "Planlgg avspasering eller forhandle utvidet TOIL-grense med ansatt.",
        details: { current_hours: currentHours, max_hours: maxHours },
      });
    }
  }

  return deviations;
}

// ─────────────────────────────────────────────
// W07: Deduction blocked (net pay < 0)
// ─────────────────────────────────────────────

function checkW07(aggregated: ReadonlyArray<AggregatedPeriod>): Deviation[] {
  const deviations: Deviation[] = [];

  for (const agg of aggregated) {
    if (agg.total_ore < 0n) {
      deviations.push({
        check_id: "W07",
        severity: "error",
        message: "Netto lønn er negativ etter fradrag — lønnsutbetaling blokkert",
        profile_id: agg.profile_id,
        shift_id: null,
        period_id: agg.period_id,
        suggested_action: "Fjern eller reduser fradrag slik at netto lønn ikke er negativ.",
        details: { total_nok: oreToNok(agg.total_ore) },
      });
    }
  }

  return deviations;
}

// ─────────────────────────────────────────────
// W08: Missing punch-out (used scheduled end)
// ─────────────────────────────────────────────

function checkW08(
  shifts: ReadonlyArray<InterpretedShift>,
  punchOutMissingShiftIds: ReadonlySet<string>,
): Deviation[] {
  const deviations: Deviation[] = [];

  for (const shift of shifts) {
    if (punchOutMissingShiftIds.has(shift.shift_id)) {
      deviations.push({
        check_id: "W08",
        severity: "info",
        message: "Glemt utstempling — benyttet planlagt slutt-tid",
        profile_id: shift.profile_id,
        shift_id: shift.shift_id,
        period_id: null,
        suggested_action: "Verifiser faktisk slutt-tid med ansatt og korriger om nødvendig.",
        details: { effective_end: shift.effective_end },
      });
    }
  }

  return deviations;
}

// ─────────────────────────────────────────────
// W09: OT pre-approval missing
// ─────────────────────────────────────────────

function checkW09(
  shifts: ReadonlyArray<InterpretedShift>,
  workspaceSettings: WorkspaceSettings,
  framework: RegulatoryFrameworkInput,
  preApprovedShiftIds: ReadonlySet<string>,
): Deviation[] {
  if (!workspaceSettings.overtime_requires_pre_approval) return [];

  const deviations: Deviation[] = [];
  const otThresholdMinutes = framework.max_daily_hours * 60;

  for (const shift of shifts) {
    if (shift.worked_minutes > otThresholdMinutes && !preApprovedShiftIds.has(shift.shift_id)) {
      // BUG-SIM-15: severity downgraded from 'warning' to 'info' until the
      // ot_preapproval table + UI flow lands (manager_pre_approved_ot column
      // does not exist). W09 is advisory-only: operator must ack but it no
      // longer blocks every OT shift when overtime_requires_pre_approval=true.
      // Restore to 'warning' when the pre-approval UI ships (see GAP-A5-02).
      deviations.push({
        check_id: "W09",
        severity: "info",
        message: `Overtid på vakt ${shift.shift_id.slice(0, 8)}... — forhåndsgodkjenning ikke registrert (adviserende)`,
        profile_id: shift.profile_id,
        shift_id: shift.shift_id,
        period_id: null,
        suggested_action:
          "Verifiser at overtiden var godkjent. Registrer forhåndsgodkjenning når flyt er tilgjengelig.",
        details: {
          worked_hours: shift.worked_minutes / 60,
          threshold_hours: framework.max_daily_hours,
        },
      });
    }
  }

  return deviations;
}

// ─────────────────────────────────────────────
// W10: Forced break reminder
// ─────────────────────────────────────────────

function checkW10(
  shifts: ReadonlyArray<InterpretedShift>,
  workspaceSettings: WorkspaceSettings,
): Deviation[] {
  const deviations: Deviation[] = [];
  const threshold = workspaceSettings.forced_break_reminder_minutes;

  for (const shift of shifts) {
    if (shift.worked_minutes > threshold && shift.scheduled_break_minutes === 0) {
      deviations.push({
        check_id: "W10",
        severity: "info",
        message: `Vakt på ${(shift.worked_minutes / 60).toFixed(1)}t uten registrert pause (Aml. §10-9)`,
        profile_id: shift.profile_id,
        shift_id: shift.shift_id,
        period_id: null,
        suggested_action: "Legg til pauseregistrering for vakter > 5.5t.",
        details: {
          worked_minutes: shift.worked_minutes,
          threshold_minutes: threshold,
        },
      });
    }
  }

  return deviations;
}

// ─────────────────────────────────────────────
// W11: Split shift (gap between same-day shifts)
// ─────────────────────────────────────────────

function checkW11(
  shifts: ReadonlyArray<InterpretedShift>,
  workspaceSettings: WorkspaceSettings,
): Deviation[] {
  if (workspaceSettings.split_shift_threshold_minutes === 0) return [];

  const deviations: Deviation[] = [];
  const threshold = workspaceSettings.split_shift_threshold_minutes;

  // Group by (profile, date).
  // Oslo TZ matters for CEST shifts spanning midnight UTC — see Phase 1 close-out G3.
  // A shift starting 22:00 UTC = 00:00 Oslo (CEST) falls in the NEXT calendar day;
  // using UTC slice(0, 10) would bucket it in the wrong day.
  const byProfileDate = new Map<string, InterpretedShift[]>();
  for (const shift of shifts) {
    const key = `${shift.profile_id}:${osloDateString(shift.effective_start)}`;
    const arr = byProfileDate.get(key) ?? [];
    arr.push(shift);
    byProfileDate.set(key, arr);
  }

  for (const [, profileDateShifts] of byProfileDate) {
    if (profileDateShifts.length < 2) continue;
    const sorted = [...profileDateShifts].sort((a, b) =>
      a.effective_start.localeCompare(b.effective_start),
    );

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      const gapMinutes = minutesBetweenISO(prev.effective_end, curr.effective_start);

      if (gapMinutes >= threshold) {
        deviations.push({
          check_id: "W11",
          severity: "warning",
          message: `Delt vakt med ${(gapMinutes / 60).toFixed(1)}t gap — splittvakttillegg kan gjelde`,
          profile_id: curr.profile_id,
          shift_id: curr.shift_id,
          period_id: null,
          suggested_action: "Legg til splittvakttillegg om arbeidstidsavtale krever det.",
          details: {
            gap_minutes: gapMinutes,
            threshold_minutes: threshold,
          },
        });
      }
    }
  }

  return deviations;
}

// ─────────────────────────────────────────────
// W12: Wellness quota exhausted
// ─────────────────────────────────────────────

function checkW12(
  aggregated: ReadonlyArray<AggregatedPeriod>,
  wellnessUsedByProfile: ReadonlyMap<string, number>,
  wellnessQuotaByProfile: ReadonlyMap<string, number>,
): Deviation[] {
  const deviations: Deviation[] = [];

  for (const agg of aggregated) {
    const used = wellnessUsedByProfile.get(agg.profile_id) ?? 0;
    const quota = wellnessQuotaByProfile.get(agg.profile_id) ?? 0;

    if (used > quota) {
      deviations.push({
        check_id: "W12",
        severity: "info",
        message: `Velferdsdag-kvote på ${quota} dager overskredet (brukt ${used} dager)`,
        profile_id: agg.profile_id,
        shift_id: null,
        period_id: agg.period_id,
        suggested_action: "Avklar med ansatt — overskytende dager kan gi lønnskuttved.",
        details: { used_days: used, quota_days: quota },
      });
    }
  }

  return deviations;
}

// ─────────────────────────────────────────────
// W13: Minstelønn check
// ─────────────────────────────────────────────

function checkW13(
  aggregated: ReadonlyArray<AggregatedPeriod>,
  profilesByProfileId: ReadonlyMap<string, PayrollProfile>,
  tariffRates: ReadonlyArray<TariffRateInput>,
  workspaceSettings: WorkspaceSettings,
  periodStartDate: string,
): Deviation[] {
  const deviations: Deviation[] = [];

  for (const agg of aggregated) {
    const profile = profilesByProfileId.get(agg.profile_id);
    if (!profile) continue;

    // Total worked hours in period
    const totalHours = agg.lines
      .filter((l) => l.pay_code === "base_hourly")
      .reduce((acc, l) => acc + (l.hours ?? 0), 0);

    if (totalHours === 0) continue; // Monthly salary — skip minstelønn check

    const effectiveHourlyNok = oreToNok(agg.gross_amount_ore) / totalHours;

    // Find minstelønn for this employee's seniority + role
    const seniorityTier = resolveSeniorityTier(profile.seniority_start_date, periodStartDate);
    const roleClass = profile.tariff_category;

    const minstelonn = tariffRates.find(
      (r) =>
        r.rate_type.startsWith("minstelonn") &&
        (r.seniority_level === seniorityTier || r.seniority_level === null) &&
        (r.role_class === roleClass || r.role_class === null) &&
        r.workspace_id === null, // platform-level
    );

    if (!minstelonn) continue; // No applicable minstelønn row found — skip

    if (effectiveHourlyNok < minstelonn.amount) {
      const severity = workspaceSettings.is_tariff_bound ? "error" : "warning";
      deviations.push({
        check_id: "W13",
        severity,
        message: `Effektiv timelønn ${effectiveHourlyNok.toFixed(2)} NOK/t er under Riksavtalen minstelønn ${minstelonn.amount} NOK/t`,
        profile_id: agg.profile_id,
        shift_id: null,
        period_id: agg.period_id,
        suggested_action: workspaceSettings.is_tariff_bound
          ? "Juster grunnlønn eller satser til over Riksavtalen minstelønn."
          : "Bransjenorm er " +
            minstelonn.amount +
            " NOK/t — du står fritt, men det er under norm.",
        details: {
          effective_hourly_nok: effectiveHourlyNok,
          minstelonn_nok: minstelonn.amount,
          seniority_tier: seniorityTier,
          role_class: roleClass,
          is_tariff_bound: workspaceSettings.is_tariff_bound,
        },
      });
    }
  }

  return deviations;
}

// ─────────────────────────────────────────────
// W14: 90%-bedrift (auto-apply 2 kr/t)
// ─────────────────────────────────────────────

/**
 * W14: If workspace.industri_average_pct < 90 AND is_tariff_bound=true,
 * auto-add 2 kr/t supplement to all hours. Emit INFO deviation.
 *
 * NOTE: The actual supplement application happens via the supplement_rule system.
 * This deviation check flags that the rule SHOULD be present. The auto-resolution
 * note directs admin to create the workspace rule.
 *
 * ASSUMPTION: industrAvgPct is a workspace-level setting passed by caller.
 * Not present in workspace_settings DB schema yet (Phase 1 scope).
 * If caller passes null, W14 is skipped.
 */
function checkW14(
  aggregated: ReadonlyArray<AggregatedPeriod>,
  workspaceSettings: WorkspaceSettings,
  industryAveragePct: number | null,
): Deviation[] {
  if (
    industryAveragePct === null ||
    industryAveragePct >= 90 ||
    !workspaceSettings.is_tariff_bound
  ) {
    return [];
  }

  const deviations: Deviation[] = [];
  const profileIds = new Set(aggregated.map((a) => a.profile_id));

  for (const profileId of profileIds) {
    deviations.push({
      check_id: "W14",
      severity: "info",
      message: `Virksomhet under 90%-regelen (${industryAveragePct}%) — 2 kr/t tillegg bør legges til alle timer`,
      profile_id: profileId,
      shift_id: null,
      period_id: aggregated.find((a) => a.profile_id === profileId)?.period_id ?? null,
      suggested_action: "Opprett workspace supplement-regel med rate=2 NOK/t for alle timer.",
      auto_resolved: false, // admin must create the rule
      details: {
        industry_average_pct: industryAveragePct,
        threshold_pct: 90,
        recommended_add_nok_per_hour: 2,
      },
    });
    break; // One W14 per period is enough (not per-profile)
  }

  return deviations;
}

// ─────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────

export type DeviationChecksInput = {
  aggregated: ReadonlyArray<AggregatedPeriod>;
  shifts: ReadonlyArray<InterpretedShift>;
  workspaceSettings: WorkspaceSettings;
  framework: RegulatoryFrameworkInput;
  profilesByProfileId: ReadonlyMap<string, PayrollProfile>;
  tariffRates: ReadonlyArray<TariffRateInput>;
  periodStartDate: string; // "YYYY-MM-DD"
  evaluationYear: number; // for W05 tax card check
  /** Shift IDs where punch_out was missing (used scheduled end for W08) */
  punchOutMissingShiftIds?: ReadonlySet<string>;
  /** Shift IDs with pre-approved overtime (for W09) */
  preApprovedShiftIds?: ReadonlySet<string>;
  /** Current TOIL bank hours per profile (for W06) */
  currentToilBankHours?: ReadonlyMap<string, number>;
  /** Wellness days used per profile this year (for W12) */
  wellnessUsedByProfile?: ReadonlyMap<string, number>;
  /** Wellness quota per profile (for W12) */
  wellnessQuotaByProfile?: ReadonlyMap<string, number>;
  /** Industry average pct for W14 check (null = skip) */
  industryAveragePct?: number | null;
};

/**
 * runDeviationChecks — pure function.
 *
 * Runs all 14 deviation checks W01–W14 and returns an array of Deviation rows.
 * Results are not written to DB — the Day 4 RPC does the writes.
 *
 * Order: W01 (errors first), W02–W12 (warnings/info), W13 (tariff-critical), W14 (auto-advisory)
 */
export function runDeviationChecks(input: DeviationChecksInput): Deviation[] {
  const {
    aggregated,
    shifts,
    workspaceSettings,
    framework,
    profilesByProfileId,
    tariffRates,
    periodStartDate,
    evaluationYear,
    punchOutMissingShiftIds = new Set<string>(),
    preApprovedShiftIds = new Set<string>(),
    currentToilBankHours = new Map<string, number>(),
    wellnessUsedByProfile = new Map<string, number>(),
    wellnessQuotaByProfile = new Map<string, number>(),
    industryAveragePct = null,
  } = input;

  const deviations: Deviation[] = [
    ...checkW01(shifts),
    ...checkW02(shifts, framework),
    ...checkW03(shifts, framework),
    ...checkW04(shifts, framework),
    ...checkW05(
      aggregated,
      profilesByProfileId as ReadonlyMap<
        string,
        PayrollProfile & { tax_card_year?: number | null }
      >,
      evaluationYear,
    ),
    ...checkW06(aggregated, profilesByProfileId, currentToilBankHours, workspaceSettings),
    ...checkW07(aggregated),
    ...checkW08(shifts, punchOutMissingShiftIds),
    ...checkW09(shifts, workspaceSettings, framework, preApprovedShiftIds),
    ...checkW10(shifts, workspaceSettings),
    ...checkW11(shifts, workspaceSettings),
    ...checkW12(aggregated, wellnessUsedByProfile, wellnessQuotaByProfile),
    ...checkW13(aggregated, profilesByProfileId, tariffRates, workspaceSettings, periodStartDate),
    ...checkW14(aggregated, workspaceSettings, industryAveragePct ?? null),
  ];

  return deviations;
}
