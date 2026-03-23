/**
 * Main data hook for the Min Lønn (My Salary) page.
 *
 * Fetches the logged-in employee's payslip list, absence quotas, timebank balance,
 * and absence type labels in a single parallel query. Suitable for the page's
 * initial render — detail lines are loaded separately via usePayslipLines.
 *
 * Trust tier: Settled — all data comes from closed payroll periods and generated
 * quota columns. Show with confidence, no disclaimers.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import type { Database } from "@smartout/supabase";

type Period = Database["payroll"]["Tables"]["period"]["Row"];
type Calculation = Database["payroll"]["Tables"]["calculation"]["Row"];
type AbsenceQuota = Database["payroll"]["Tables"]["absence_quota"]["Row"];
type TimebankEntry = Database["payroll"]["Tables"]["timebank_entry"]["Row"];
type AbsenceType = Database["payroll"]["Tables"]["absence_type"]["Row"];

/** Only periods in these statuses are settled payslips */
const SETTLED_STATUSES: Period["status"][] = ["closed" as Period["status"], "exported"];

/** Entry types that add hours to the timebank (credits) */
const CREDIT_TYPES: TimebankEntry["entry_type"][] = ["accrual", "carry_over", "adjustment"];

/** Entry types that consume hours from the timebank (debits) */
const DEBIT_TYPES: TimebankEntry["entry_type"][] = ["withdrawal", "expiry", "payout"];

export type PayslipEntry = {
  period: Period;
  calculation: Calculation | null;
};

export type MySalaryData = {
  payslips: PayslipEntry[];
  absenceQuotas: AbsenceQuota[];
  timebankBalance: number;
  timebankEntries: TimebankEntry[];
  absenceTypes: AbsenceType[];
};

/** Computes the net timebank balance from the entry ledger */
function computeTimebankBalance(entries: TimebankEntry[]): number {
  let balance = 0;
  for (const entry of entries) {
    if (CREDIT_TYPES.includes(entry.entry_type)) {
      balance += entry.hours;
    } else if (DEBIT_TYPES.includes(entry.entry_type)) {
      balance -= entry.hours;
    }
  }
  return balance;
}

async function fetchMySalary(): Promise<MySalaryData> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Resolve this employee's profile — needed for profile-scoped queries
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (profileError) throw profileError;

  const { profile_id: profileId, workspace_id: workspaceId } = profile;
  const currentYear = new Date().getFullYear();

  // Fetch all parallel data — no sequential dependencies between these queries
  const [periodsResult, absenceQuotasResult, timebankResult, absenceTypesResult] =
    await Promise.all([
      // Settled periods for this workspace, most recent first
      supabase
        .schema("payroll")
        .from("period")
        .select("*")
        .eq("workspace_id", workspaceId)
        .in("status", SETTLED_STATUSES)
        .order("start_date", { ascending: false }),

      // Absence quotas for the current year
      supabase
        .schema("payroll")
        .from("absence_quota")
        .select("*")
        .eq("profile_id", profileId)
        .eq("year", currentYear),

      // Timebank entries for balance computation — most recent first for the sidebar list
      supabase
        .schema("payroll")
        .from("timebank_entry")
        .select("*")
        .eq("profile_id", profileId)
        .order("effective_date", { ascending: false }),

      // Absence type labels for the workspace — used to label quota rows
      supabase
        .schema("payroll")
        .from("absence_type")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

  if (periodsResult.error) throw periodsResult.error;
  if (absenceQuotasResult.error) throw absenceQuotasResult.error;
  if (timebankResult.error) throw timebankResult.error;
  if (absenceTypesResult.error) throw absenceTypesResult.error;

  const periods = periodsResult.data ?? [];

  // Fetch calculations for all settled periods in one batch query, then match client-side
  let payslips: PayslipEntry[] = periods.map((p) => ({ period: p, calculation: null }));

  if (periods.length > 0) {
    const periodIds = periods.map((p) => p.id);

    const { data: calculations, error: calcError } = await supabase
      .schema("payroll")
      .from("calculation")
      .select("*")
      .eq("profile_id", profileId)
      .in("period_id", periodIds);

    if (calcError) throw calcError;

    const calcByPeriod = new Map((calculations ?? []).map((c) => [c.period_id, c]));

    payslips = periods.map((period) => ({
      period,
      calculation: calcByPeriod.get(period.id) ?? null,
    }));
  }

  const timebankEntries = (timebankResult.data ?? []) as TimebankEntry[];

  return {
    payslips,
    absenceQuotas: absenceQuotasResult.data ?? [],
    timebankBalance: computeTimebankBalance(timebankEntries),
    timebankEntries,
    absenceTypes: absenceTypesResult.data ?? [],
  };
}

/** 5 minutes — payslip data changes only when payroll is processed */
const STALE_TIME_MS = 5 * 60 * 1000;

/**
 * Hook: returns the current employee's payslips, absence quotas, and timebank balance.
 * All data is fetched in parallel via Promise.all. Suitable for the Min Lønn page's
 * initial render without a loading waterfall.
 */
export function useMySalary() {
  return useQuery<MySalaryData>({
    queryKey: ["my-salary"],
    queryFn: fetchMySalary,
    staleTime: STALE_TIME_MS,
    retry: 1,
  });
}
