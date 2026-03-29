/**
 * resolveTariffRate — Cascade D3 Tariff Resolution
 *
 * Pure function: resolves effective tariff rate + supplements for a timestamp.
 * No DB access — caller provides pre-loaded TariffContext.
 *
 * Supplement rules:
 * - kveldstillegg: 21:00-06:00
 * - helgetillegg: Saturday 15:00 - Sunday 24:00
 * - helligdagstillegg: public holiday dates
 * - kr/h supplements are additive on base
 * - % supplements apply to base rate ONLY (not base + prior supplements)
 */

import type { TariffContext, TariffRateRow, TariffResolution, TariffSupplement } from "./types";

/** Find the best matching rate row for a given type and date */
function findRate(rates: TariffRateRow[], rateType: string, dateStr: string): TariffRateRow | null {
  const matching = rates
    .filter((r) => r.rateType === rateType)
    .filter((r) => r.effectiveFrom <= dateStr)
    .filter((r) => !r.effectiveUntil || r.effectiveUntil >= dateStr);

  if (matching.length === 0) return null;
  // Latest effective_from wins
  return matching.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] ?? null;
}

/** Check if timestamp falls in evening supplement window (21:00-06:00) */
function isEveningTime(dt: Date): boolean {
  const hour = dt.getUTCHours();
  return hour >= 21 || hour < 6;
}

/** Check if timestamp falls in weekend supplement window (Sat 15:00 - Sun 24:00) */
function isWeekendTime(dt: Date): boolean {
  const day = dt.getUTCDay(); // 0=Sun, 6=Sat
  const hour = dt.getUTCHours();
  if (day === 6 && hour >= 15) return true; // Saturday 15:00+
  if (day === 0) return true; // All Sunday
  return false;
}

export function resolveTariffRate(
  context: TariffContext,
  effectiveTimestamp: string,
): TariffResolution {
  const dt = new Date(effectiveTimestamp);
  const dateStr = effectiveTimestamp.split("T")[0]!;
  const supplements: TariffSupplement[] = [];

  // Determine which tariff rate set to use
  const hasWorkspaceRates = context.workspaceTariffRates.length > 0;
  const primaryRates = hasWorkspaceRates
    ? context.workspaceTariffRates
    : context.platformTariffRates;
  const sourceTier = hasWorkspaceRates ? ("workspace" as const) : ("platform" as const);

  // Base rate from payroll profile (not from tariff table — that's for supplements)
  const baseRate = context.baseRate ?? 0;
  const baseRateUnit = "hourly" as const;

  // Check evening supplement
  if (isEveningTime(dt)) {
    const rate =
      findRate(primaryRates, "kveldstillegg", dateStr) ??
      findRate(context.platformTariffRates, "kveldstillegg", dateStr);
    if (rate) {
      supplements.push({
        type: "kveldstillegg",
        amount: Number(rate.amount),
        unit: rate.unit as "kr/t" | "percent",
        reason: "21:00-06:00 evening supplement",
      });
    }
  }

  // Check weekend supplement
  if (isWeekendTime(dt)) {
    const rate =
      findRate(primaryRates, "helgetillegg", dateStr) ??
      findRate(context.platformTariffRates, "helgetillegg", dateStr);
    if (rate) {
      supplements.push({
        type: "helgetillegg",
        amount: Number(rate.amount),
        unit: rate.unit as "kr/t" | "percent",
        reason: "Sat 15:00 - Sun 24:00 weekend supplement",
      });
    }
  }

  // Check holiday supplement
  if (context.isPublicHoliday) {
    const rate =
      findRate(primaryRates, "helligdagstillegg", dateStr) ??
      findRate(context.platformTariffRates, "helligdagstillegg", dateStr);
    if (rate) {
      supplements.push({
        type: "helligdagstillegg",
        amount: Number(rate.amount),
        unit: rate.unit as "kr/t" | "percent",
        reason: "Public holiday supplement",
      });
    }
  }

  // Compute effective hourly rate
  // kr/h supplements are additive, % supplements apply to base only
  let effectiveHourlyRate = baseRate;
  for (const s of supplements) {
    if (s.unit === "kr/t") {
      effectiveHourlyRate += s.amount;
    } else if (s.unit === "percent") {
      effectiveHourlyRate += baseRate * (s.amount / 100);
    }
  }

  return {
    baseRate,
    baseRateUnit,
    supplements,
    effectiveHourlyRate,
    sourceTier,
    tariffCategory: context.payrollProfile?.tariffCategory ?? null,
  };
}
