/**
 * resolveTariffRate — Cascade D3 Tariff Resolution
 *
 * Pure function: resolves effective tariff rate + supplements for a timestamp.
 * No DB access — caller provides pre-loaded TariffContext.
 *
 * All time boundary checks use workspace-local time (workspace.timezone or
 * "Europe/Oslo" fallback). UTC-based checks were a P0 bug — Riksavtalen TARO-79
 * §4-3 specifies clock times in Norwegian jurisdiction, not UTC.
 * (ADR-0262: tariff-resolver-uses-workspace-timezone)
 *
 * Supplement rules per §4-3 (in workspace-local time):
 * - kveldstillegg:     Mon–Fri 21:00–24:00
 * - nattillegg:        all days 00:00–06:00 (separate from kveldstillegg)
 * - helgetillegg:      Sat 14:00–24:00, Sun 06:00–24:00
 * - helligdagstillegg: public holiday — 100% of actual baseRate (§4-2)
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

/**
 * Convert a UTC ISO timestamp to local {hour, weekday} in the given IANA timezone.
 * Uses Intl.DateTimeFormat — available in all modern Node.js and browser runtimes.
 * weekday: 0=Sunday … 6=Saturday (matches Date.getDay() convention).
 */
function toLocalTimeParts(
  utcIso: string,
  timezone: string,
): { localHour: number; localWeekday: number } {
  // Intl.DateTimeFormat with individual part extraction is the safest cross-runtime approach.
  // We avoid date-fns-tz (not in dependencies) and avoid manual UTC arithmetic.
  const dt = new Date(utcIso);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    weekday: "short",
    hour12: false,
  });
  const parts = formatter.formatToParts(dt);

  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
  const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "Sun";

  // Intl hour12:false returns "24" for midnight in some runtimes — normalise to 0.
  const localHour = hourStr === "24" ? 0 : parseInt(hourStr, 10);

  // Map abbreviated English weekday names to 0-based Sunday convention.
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const localWeekday = weekdayMap[weekdayStr] ?? 0;

  return { localHour, localWeekday };
}

/**
 * Kveldstillegg — Mon–Fri 21:00–23:59 (§4-3 punkt 3.2).
 * Does NOT include 00:00–06:00 — that is nattillegg.
 */
function isEveningTime(localHour: number, localWeekday: number): boolean {
  const isWeekday = localWeekday >= 1 && localWeekday <= 5; // Mon–Fri
  return isWeekday && localHour >= 21; // 21:00–23:59
}

/**
 * Nattillegg — all days 00:00–05:59 (§4-3 punkt 3.3).
 * Applies every day of the week; SEPARATE sats from kveldstillegg.
 */
function isNightTime(localHour: number): boolean {
  return localHour < 6; // 00:00–05:59
}

/**
 * Lørdagstillegg — Saturday 14:00–23:59 (§4-3 punkt 3.1).
 * Prior code used 15:00 — off by 1 hour.
 */
function isSaturdayTime(localWeekday: number, localHour: number): boolean {
  return localWeekday === 6 && localHour >= 14;
}

/**
 * Søndagstillegg — Sunday 06:00–23:59 (§4-3 punkt 3.1).
 * Prior code used all-day — 00:00–05:59 Sunday is nattillegg, not helgetillegg.
 */
function isSundayTime(localWeekday: number, localHour: number): boolean {
  return localWeekday === 0 && localHour >= 6;
}

export function resolveTariffRate(
  context: TariffContext,
  effectiveTimestamp: string,
  /** IANA timezone string. Defaults to "Europe/Oslo". Override for non-Norwegian workspaces. */
  timezone = "Europe/Oslo",
): TariffResolution {
  const dateStr = effectiveTimestamp.split("T")[0]!;
  const supplements: TariffSupplement[] = [];

  // Convert UTC timestamp to workspace-local {hour, weekday}.
  // All §4-3 boundary checks operate in local time, not UTC.
  const { localHour, localWeekday } = toLocalTimeParts(effectiveTimestamp, timezone);

  // Determine which tariff rate set to use
  const hasWorkspaceRates = context.workspaceTariffRates.length > 0;
  const primaryRates = hasWorkspaceRates
    ? context.workspaceTariffRates
    : context.platformTariffRates;
  const sourceTier = hasWorkspaceRates ? ("workspace" as const) : ("platform" as const);

  // Base rate from payroll profile (not from tariff table — that's for supplements)
  const baseRate = context.baseRate ?? 0;
  const baseRateUnit = "hourly" as const;

  // §4-3.3.2 — Kveldstillegg: Mon–Fri 21:00–24:00
  if (isEveningTime(localHour, localWeekday)) {
    const rate =
      findRate(primaryRates, "kveldstillegg", dateStr) ??
      findRate(context.platformTariffRates, "kveldstillegg", dateStr);
    if (rate) {
      supplements.push({
        type: "kveldstillegg",
        amount: Number(rate.amount),
        unit: rate.unit as "kr/t" | "percent",
        reason: "Mon-Fri 21:00-24:00 evening supplement (§4-3.3.2)",
      });
    }
  }

  // §4-3.3.3 — Nattillegg: all days 00:00–06:00
  // Two rate types: nattvakt (lower) and øvrige (higher).
  // Select based on tariffCategory from payroll profile.
  if (isNightTime(localHour)) {
    const tariffCategory = context.payrollProfile?.tariffCategory ?? "ufaglart";
    // nattvakt employees get the lower nattillegg_nattvakt rate
    const nightRateType = tariffCategory === "nattvakt" ? "nattillegg_nattvakt" : "nattillegg";
    const rate =
      findRate(primaryRates, nightRateType, dateStr) ??
      findRate(context.platformTariffRates, nightRateType, dateStr);
    if (rate) {
      supplements.push({
        type: nightRateType,
        amount: Number(rate.amount),
        unit: rate.unit as "kr/t" | "percent",
        reason: `00:00-06:00 night supplement (§4-3.3.3, category: ${nightRateType})`,
      });
    }
  }

  // §4-3.3.1 — Helgetillegg: Sat 14:00–24:00 or Sun 06:00–24:00
  if (isSaturdayTime(localWeekday, localHour) || isSundayTime(localWeekday, localHour)) {
    const rate =
      findRate(primaryRates, "helgetillegg", dateStr) ??
      findRate(context.platformTariffRates, "helgetillegg", dateStr);
    if (rate) {
      supplements.push({
        type: "helgetillegg",
        amount: Number(rate.amount),
        unit: rate.unit as "kr/t" | "percent",
        reason: "Sat 14:00-24:00 / Sun 06:00-24:00 weekend supplement (§4-3.3.1)",
      });
    }
  }

  // §4-2 — Helligdagstillegg: 100% of actual baseRate (not a fixed seed amount).
  // Riksavtalen §4-2 specifies 100% of individual hourly rate, not a fixed tariff row.
  if (context.isPublicHoliday) {
    supplements.push({
      type: "helligdagstillegg",
      amount: baseRate,
      unit: "kr/t",
      reason: "Public holiday supplement: 100% of baseRate per §4-2",
    });
  }

  // Compute effective hourly rate.
  // kr/h supplements are additive; % supplements apply to base only.
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
