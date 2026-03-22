/**
 * getTariffContext — Cascade D3 Tariff Context Loader
 *
 * DB query helper that loads all data needed by resolveTariffRate():
 * employee payroll profile, workspace + platform tariff rates, and holiday status.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TariffContext, TariffRateRow } from "./types";

function mapTariffRow(row: Record<string, unknown>): TariffRateRow {
  return {
    id: row.id as string,
    rateType: row.rate_type as string,
    amount: Number(row.amount),
    unit: row.unit as string,
    effectiveFrom: row.effective_from as string,
    effectiveUntil: (row.effective_until as string) ?? null,
  };
}

export async function getTariffContext(
  supabase: SupabaseClient,
  profileId: string,
  date: string,
): Promise<TariffContext> {
  // 1. Load employee payroll profile
  const { data: payrollRow } = await supabase
    .from("employee_payroll_profile")
    .select("tariff_override_id, tariff_category, seniority_start_date, has_fagbrev")
    .eq("profile_id", profileId)
    .lte("valid_from", date)
    .or(`valid_until.is.null,valid_until.gte.${date}`)
    .order("valid_from", { ascending: false })
    .limit(1)
    .single();

  const payrollProfile = payrollRow
    ? {
        tariffOverrideId: payrollRow.tariff_override_id,
        tariffCategory: payrollRow.tariff_category,
        seniorityStartDate: payrollRow.seniority_start_date,
        hasFagbrev: payrollRow.has_fagbrev,
      }
    : null;

  // 2. Load workspace-scoped tariff rates
  // Workspace ID comes from the profile's workspace
  const { data: profile } = await supabase
    .from("profile")
    .select("workspace_id")
    .eq("profile_id", profileId)
    .single();

  const workspaceId = profile?.workspace_id;

  let workspaceTariffRates: TariffRateRow[] = [];
  if (workspaceId) {
    const { data: wsRates } = await supabase
      .from("tariff_rate_table")
      .select("id, rate_type, amount, unit, effective_from, effective_until")
      .eq("workspace_id", workspaceId)
      .lte("effective_from", date)
      .or(`effective_until.is.null,effective_until.gte.${date}`);

    workspaceTariffRates = (wsRates ?? []).map(mapTariffRow);
  }

  // 3. Load platform-level tariff rates (NULL workspace_id)
  const { data: platformRates } = await supabase
    .from("tariff_rate_table")
    .select("id, rate_type, amount, unit, effective_from, effective_until")
    .is("workspace_id", null)
    .lte("effective_from", date)
    .or(`effective_until.is.null,effective_until.gte.${date}`);

  const platformTariffRates = (platformRates ?? []).map(mapTariffRow);

  // 4. Check if date is a public holiday
  const { count } = await supabase
    .from("public_holiday")
    .select("id", { count: "exact", head: true })
    .eq("date", date);

  const isPublicHoliday = (count ?? 0) > 0;

  return {
    payrollProfile,
    workspaceTariffRates,
    platformTariffRates,
    isPublicHoliday,
  };
}
