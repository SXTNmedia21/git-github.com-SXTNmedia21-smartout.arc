/**
 * Aggregates payroll data for the home card in a single parallel fetch.
 *
 * The home card needs data from 5 different payroll tables. Rather than
 * composing multiple hooks (which would cause sequential renders and
 * loading state conflicts), this hook fetches everything in one Promise.all.
 *
 * Data fetched:
 *   1. absence_quota    — vacation/sick leave balances for current year
 *   2. timebank_entry   — hours log for computing net timebank balance
 *   3. period + calculation — most recent settled period and its pay total
 *   4. supplement_rule  — active rules for the workspace
 *   5. holiday_entry    — holidays for current + next year
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

type AbsenceQuota = Database["payroll"]["Tables"]["absence_quota"]["Row"];
type TimebankEntry = Database["payroll"]["Tables"]["timebank_entry"]["Row"];
type SupplementRule = Database["payroll"]["Tables"]["supplement_rule"]["Row"];

/** How long before payroll summary data is considered stale (5 minutes) */
const STALE_TIME_MS = 5 * 60 * 1000;

/** Entry types that add hours to the timebank (credits) */
const TIMEBANK_CREDIT_TYPES: TimebankEntry["entry_type"][] = [
  "accrual",
  "carry_over",
  "adjustment",
];

export type AbsenceBalance = {
  /** Maps to absence_type_id */
  absenceTypeId: string;
  /** Total entitled days for the year */
  total: number;
  /** Days remaining (entitled + adjustments + carry-over - used - paid out) */
  remaining: number;
};

export type PayrollSummary = {
  /** Absence balances per absence type for the current year, or null if none found */
  absenceBalances: AbsenceBalance[] | null;
  /** Net timebank hours (credits minus debits), or null if no entries */
  timebankHours: number | null;
  /** Most recent exported payslip summary, or null if none exists */
  lastSettledPay: {
    amount: number;
    /** ISO start date of the period used as the display name: "2026-02" */
    periodName: string;
    /** ISO date when the period was exported */
    paymentDate: string;
  } | null;
  /** Active supplement rules for the workspace (used by SupplementBadges) */
  supplementRules: SupplementRule[];
  /** ISO holiday dates for current + next year: ["2026-05-17", ...] */
  holidays: string[];
  /** Employee's base hourly rate from their most recent calculation, or null */
  hourlyRate: number | null;
};

function computeTimebankBalance(entries: TimebankEntry[]): number {
  let balance = 0;
  for (const entry of entries) {
    if (TIMEBANK_CREDIT_TYPES.includes(entry.entry_type)) {
      balance += entry.hours;
    } else {
      balance -= entry.hours;
    }
  }
  return balance;
}

function mapQuotasToBalances(quotas: AbsenceQuota[]): AbsenceBalance[] {
  return quotas.map((q) => ({
    absenceTypeId: q.absence_type_id,
    total: q.entitled_days + q.adjusted_days + q.carried_over_days,
    remaining: q.remaining_days ?? 0,
  }));
}

async function fetchPayrollSummary(): Promise<PayrollSummary> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (profileError) throw profileError;

  const { profile_id: profileId, workspace_id: workspaceId } = profile;
  const currentYear = new Date().getFullYear();
  const startOfCurrentYear = `${currentYear}-01-01`;
  const endOfNextYear = `${currentYear + 1}-12-31`;

  // Fetch all payroll data in parallel — no sequential dependencies here
  const [quotasResult, timebankResult, latestPeriodResult, supplementRulesResult, holidaysResult] =
    await Promise.all([
      // 1. Absence quotas for the current year
      supabase
        .schema("payroll")
        .from("absence_quota")
        .select("*")
        .eq("profile_id", profileId)
        .eq("year", currentYear),

      // 2. Timebank entries (hours + type only needed for balance calc)
      supabase
        .schema("payroll")
        .from("timebank_entry")
        .select(
          "id, entry_type, hours, effective_date, workspace_id, profile_id, created_at, created_by, description, expiry_date, payroll_calculation_id, schedule_absence_id",
        )
        .eq("profile_id", profileId),

      // 3. Most recent exported period for this workspace
      supabase
        .schema("payroll")
        .from("period")
        .select("id, start_date, end_date, exported_at, status")
        .eq("workspace_id", workspaceId)
        .eq("status", "exported")
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle(),

      // 4. Active supplement rules for the workspace
      supabase
        .schema("payroll")
        .from("supplement_rule")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),

      // 5. Holidays for current + next year
      supabase
        .schema("payroll")
        .from("holiday_entry")
        .select("holiday_date")
        .eq("workspace_id", workspaceId)
        .gte("holiday_date", startOfCurrentYear)
        .lte("holiday_date", endOfNextYear),
    ]);

  if (quotasResult.error) throw quotasResult.error;
  if (timebankResult.error) throw timebankResult.error;
  if (latestPeriodResult.error) throw latestPeriodResult.error;
  if (supplementRulesResult.error) throw supplementRulesResult.error;
  if (holidaysResult.error) throw holidaysResult.error;

  // Derive absence balances — null if employee has no quotas yet
  const absenceBalances =
    quotasResult.data && quotasResult.data.length > 0
      ? mapQuotasToBalances(quotasResult.data)
      : null;

  // Compute timebank balance from entry log
  const timebankEntries = timebankResult.data ?? [];
  const timebankHours =
    timebankEntries.length > 0 ? computeTimebankBalance(timebankEntries as TimebankEntry[]) : null;

  // Resolve last settled pay — requires a second query for the calculation once we
  // know which period to look up. This is intentionally sequential (period → calc).
  let lastSettledPay: PayrollSummary["lastSettledPay"] = null;
  let hourlyRate: number | null = null;

  const latestPeriod = latestPeriodResult.data;
  if (latestPeriod) {
    const { data: calc, error: calcError } = await supabase
      .schema("payroll")
      .from("calculation")
      .select("total_pay, base_rate, period_id")
      .eq("profile_id", profileId)
      .eq("period_id", latestPeriod.id)
      .limit(1)
      .maybeSingle();

    if (calcError) throw calcError;

    if (calc) {
      lastSettledPay = {
        amount: calc.total_pay,
        // Use start_date as the human-readable period label (e.g. "2026-02")
        periodName: latestPeriod.start_date.substring(0, 7),
        paymentDate: latestPeriod.exported_at ?? latestPeriod.end_date,
      };
      hourlyRate = calc.base_rate;
    }
  }

  return {
    absenceBalances,
    timebankHours,
    lastSettledPay,
    supplementRules: supplementRulesResult.data ?? [],
    holidays: (holidaysResult.data ?? []).map((h) => h.holiday_date),
    hourlyRate,
  };
}

/**
 * Hook: aggregates all payroll data needed for the home card in one query.
 * Uses Promise.all internally — does NOT compose other payroll hooks.
 */
export function usePayrollSummary() {
  return useQuery<PayrollSummary>({
    queryKey: ["payroll-summary"],
    queryFn: fetchPayrollSummary,
    staleTime: STALE_TIME_MS,
    retry: 1,
  });
}
