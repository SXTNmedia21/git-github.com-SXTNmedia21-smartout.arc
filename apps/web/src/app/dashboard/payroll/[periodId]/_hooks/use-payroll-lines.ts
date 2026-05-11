/**
 * Hook: fetch per-profile payroll summary lines for a period.
 *
 * Aggregates the payroll.calculation rows by profile_id, computing total_pay,
 * total_supplements, and base_pay sums for the period detail LinesTable.
 *
 * Also joins profile to get the employee's display_name from user_identity
 * (first_name + last_name).
 *
 * Pattern: one batch query per period, joined client-side.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { payrollKeys } from "../../_hooks/payroll-keys";

export type PayrollLine = {
  profileId: string;
  displayName: string;
  basePay: number;
  supplements: number;
  deductions: number;
  totalPay: number;
  shiftCount: number;
  netMinutes: number;
  /**
   * ADR-0295: pct sourced from employee_payroll_profile.
   * Default 12 only as safe fallback when profile not yet seeded.
   * Over-60 employees use 14.3 %; 5th-week agreements may differ.
   */
  holidayAllowancePct: number;
};

async function fetchLines(periodId: string): Promise<PayrollLine[]> {
  const supabase = createClient();

  // ADR-0252: payroll.calculation is append-only. Every recalc inserts new rows
  // with an incremented calculation_version per shift. Order DESC so the first
  // occurrence of each schedule_shift_id we encounter is the latest version.
  // We dedup in the JS reduce below — Option C chosen for Phase 1 velocity
  // (no new DB view/RPC required). Phase 2 optimisation: dedicated DB view.
  const { data: calcs, error: calcErr } = await supabase
    .schema("payroll")
    .from("calculation")
    .select(
      "schedule_shift_id, profile_id, base_pay, total_supplements, total_deductions, total_pay, net_working_minutes, calculation_version",
    )
    .eq("period_id", periodId)
    .order("calculation_version", { ascending: false });

  if (calcErr) throw calcErr;
  if (!calcs?.length) return [];

  // Dedup: keep only the first (= highest version) row per schedule_shift_id.
  // Rows are already ordered calculation_version DESC, so the first occurrence
  // is always the latest. This prevents sum-multiplication when a manager
  // recalculates multiple times.
  const seenShifts = new Set<string>();
  const latestCalcs = calcs.filter((c) => {
    if (seenShifts.has(c.schedule_shift_id)) return false;
    seenShifts.add(c.schedule_shift_id);
    return true;
  });

  // Aggregate per profile client-side
  const profileMap = new Map<
    string,
    {
      basePay: number;
      supplements: number;
      deductions: number;
      totalPay: number;
      shiftCount: number;
      netMinutes: number;
    }
  >();

  for (const c of latestCalcs) {
    const existing = profileMap.get(c.profile_id) ?? {
      basePay: 0,
      supplements: 0,
      deductions: 0,
      totalPay: 0,
      shiftCount: 0,
      netMinutes: 0,
    };
    existing.basePay += c.base_pay;
    existing.supplements += c.total_supplements;
    existing.deductions += c.total_deductions;
    existing.totalPay += c.total_pay;
    existing.shiftCount += 1;
    existing.netMinutes += c.net_working_minutes;
    profileMap.set(c.profile_id, existing);
  }

  const profileIds = [...profileMap.keys()];

  // Fetch profile display names and feriepenger pct in parallel (ADR-0295)
  const [profileResult, payrollProfileResult] = await Promise.all([
    // Display names via identity join
    supabase
      .from("profile")
      .select("profile_id, user_identity(first_name, last_name)")
      .in("profile_id", profileIds),

    // ADR-0295: holiday_allowance_pct must come from employee_payroll_profile per profile.
    // Over-60 = 14.3 %, 5th-week agreements may differ — never hardcode 12 % at call site.
    supabase
      .from("employee_payroll_profile")
      .select("profile_id, holiday_allowance_pct")
      .in("profile_id", profileIds),
  ]);

  if (profileResult.error) throw profileResult.error;
  // payrollProfileResult: non-fatal — fall back to 12 % if profile not yet seeded

  const nameMap = new Map<string, string>();
  for (const p of profileResult.data ?? []) {
    const identity = Array.isArray(p.user_identity) ? p.user_identity[0] : p.user_identity;
    const first = identity?.first_name ?? "";
    const last = identity?.last_name ?? "";
    const name = [first, last].filter(Boolean).join(" ") || "Ukjent";
    nameMap.set(p.profile_id, name);
  }

  const pctMap = new Map<string, number>();
  for (const p of payrollProfileResult.data ?? []) {
    pctMap.set(p.profile_id, p.holiday_allowance_pct);
  }

  return profileIds
    .map((profileId) => {
      const agg = profileMap.get(profileId)!;
      return {
        profileId,
        displayName: nameMap.get(profileId) ?? "Ukjent",
        basePay: agg.basePay,
        supplements: agg.supplements,
        deductions: agg.deductions,
        totalPay: agg.totalPay,
        shiftCount: agg.shiftCount,
        netMinutes: agg.netMinutes,
        // ADR-0295: default 12 only as safe fallback
        holidayAllowancePct: pctMap.get(profileId) ?? 12,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "nb"));
}

const STALE_TIME_MS = 2 * 60 * 1000;

export function usePayrollLines(periodId: string) {
  return useQuery<PayrollLine[]>({
    queryKey: payrollKeys.lines(periodId),
    queryFn: () => fetchLines(periodId),
    staleTime: STALE_TIME_MS,
    retry: 1,
    enabled: !!periodId,
  });
}
