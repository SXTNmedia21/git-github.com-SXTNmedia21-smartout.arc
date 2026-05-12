/**
 * apps/web/src/app/api/payroll/snapshot-period-costs/resolver.ts
 *
 * WHAT: Pure function that resolves the base hourly rate for a payroll profile.
 *       Extracted from the route handler for testability (SMA-345).
 *
 * WHY: The route previously hardcoded baseHourlyRateNok = 0, causing all
 *      custom-rate workers to receive kr 0 base pay + kr 0 supplements.
 *      This resolver introduces the council-approved 4-tier resolution order
 *      (Council 2026-05-10 PM B2b).
 *
 * Resolution order:
 *   1. employee_payroll_profile.hourly_rate  (explicit column — highest authority)
 *   2. monthly_salary / monthlyToHourlyDivisor  (if remuneration_type = "monthly")
 *   3. tariff minimum from tariff_rate_table  (Riksavtalen minstelonn lookup)
 *   4. 0 with source="none"  (logged as warning — represents a config gap)
 *
 * Returns { rate, source } — source is used for telemetry and audit.
 * Source literals: "column" | "monthly_derived" | "tariff" | "none"
 * DO NOT change these literals — downstream consumers depend on the exact strings.
 */

import type { TariffRateInput } from "@smartout/payroll-calculate";

export type RateResolution = {
  rate: number;
  source: "column" | "monthly_derived" | "tariff" | "none";
};

export type ResolverInput = {
  payrollProfile: {
    hourly_rate: number | null;
    monthly_salary: number | null;
    remuneration_type?: string | null;
  };
  /** Pre-fetched tariff rates for the period. Used for minstelonn lookup when column is null. */
  tariffRates?: ReadonlyArray<TariffRateInput>;
  /** Profile's tariff_category (e.g. "voksen_ufaglart") — used to match minstelonn row. */
  tariffCategory?: string | null;
  /**
   * Divisor for monthly → hourly conversion.
   * Default: 162.5 = 37.5 h/week × 4.333 weeks/month (Norwegian standard).
   * Callers may supply profile.agreed_weekly_hours × 4.333 for a more precise figure.
   */
  monthlyToHourlyDivisor?: number;
};

/** Default monthly→hourly divisor: 37.5 h/week × 4.333 weeks/month */
const DEFAULT_MONTHLY_DIVISOR = 162.5;

/**
 * resolveBaseHourlyRate — pure function, zero I/O.
 *
 * @param input - ResolverInput containing profile columns + optional tariff rates array.
 * @returns { rate: number, source: "column"|"monthly_derived"|"tariff"|"none" }
 */
export function resolveBaseHourlyRate(input: ResolverInput): RateResolution {
  const {
    payrollProfile,
    tariffRates = [],
    tariffCategory = null,
    monthlyToHourlyDivisor = DEFAULT_MONTHLY_DIVISOR,
  } = input;

  // Tier 1 — explicit hourly_rate column (Wave 1A migration 20260519160100)
  if (
    payrollProfile.hourly_rate !== null &&
    payrollProfile.hourly_rate !== undefined &&
    payrollProfile.hourly_rate > 0
  ) {
    return { rate: Number(payrollProfile.hourly_rate), source: "column" };
  }

  // Tier 2 — monthly_salary ÷ divisor (only when remuneration_type = "monthly")
  if (
    payrollProfile.remuneration_type === "monthly" &&
    payrollProfile.monthly_salary !== null &&
    payrollProfile.monthly_salary !== undefined &&
    payrollProfile.monthly_salary > 0
  ) {
    const divisor = monthlyToHourlyDivisor > 0 ? monthlyToHourlyDivisor : DEFAULT_MONTHLY_DIVISOR;
    return {
      rate: Number(payrollProfile.monthly_salary) / divisor,
      source: "monthly_derived",
    };
  }

  // Tier 3 — tariff minstelonn lookup from pre-fetched tariff_rate_table rows.
  // Platform-level rows have workspace_id = null (Riksavtalen).
  // Workspace-specific rows override platform rows (workspace_id = workspaceId).
  // We prefer workspace-specific over platform, fall back to platform if none found.
  if (tariffRates.length > 0) {
    const tariffMinimum = findTariffMinimum(tariffRates, tariffCategory);
    if (tariffMinimum !== null) {
      return { rate: tariffMinimum, source: "tariff" };
    }
  }

  // Tier 4 — no rate resolvable (config gap — caller logs a warning)
  return { rate: 0, source: "none" };
}

/**
 * findTariffMinimum — extract the applicable minstelonn from a tariff rates array.
 *
 * Lookup strategy mirrors deviation-checks.ts W13 (same pattern, consistent behaviour):
 *   - rate_type must start with "minstelonn"
 *   - role_class must match tariffCategory OR be null (platform-level wildcard)
 *   - workspace-specific rows (workspace_id != null) win over platform rows (workspace_id = null)
 *   - If multiple platform rows remain, prefer the one whose role_class matches exactly.
 *
 * Returns the amount in NOK, or null if no matching row found.
 */
function findTariffMinimum(
  tariffRates: ReadonlyArray<TariffRateInput>,
  tariffCategory: string | null,
): number | null {
  const minstelonn = tariffRates.filter(
    (r) =>
      r.rate_type.startsWith("minstelonn") &&
      (r.role_class === tariffCategory || r.role_class === null),
  );

  if (minstelonn.length === 0) return null;

  // Prefer workspace-specific row over platform row
  const workspaceRows = minstelonn.filter((r) => r.workspace_id !== null);
  const platformRows = minstelonn.filter((r) => r.workspace_id === null);

  const candidates = workspaceRows.length > 0 ? workspaceRows : platformRows;

  // Among candidates, prefer exact role_class match over null wildcard
  const exactMatch = candidates.find((r) => r.role_class === tariffCategory);
  const winner = exactMatch ?? candidates[0];

  return winner ? winner.amount : null;
}
