/**
 * Fetches payroll periods and the employee's shift calculations within them.
 *
 * usePayslips — returns all closed/exported periods + the employee's calculation
 * (summary row) for each. Suitable for rendering a list of past payslips.
 *
 * usePayslipDetail — fetches individual calculation lines (base pay, supplements,
 * deductions) for a specific period. Call this only when the user taps a payslip
 * to avoid loading line-level data for all periods upfront.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

type Period = Database["payroll"]["Tables"]["period"]["Row"];
type Calculation = Database["payroll"]["Tables"]["calculation"]["Row"];
type CalculationLine = Database["payroll"]["Tables"]["calculation_line"]["Row"];

export type PayslipEntry = {
  period: Period;
  calculation: Calculation | null;
};

export type PayslipsResult = {
  payslips: PayslipEntry[];
};

export type PayslipDetailResult = {
  calculation: Calculation | null;
  lines: CalculationLine[];
};

/** Periods that represent settled pay — open/locked periods are not yet payslips */
const SETTLED_STATUSES: Period["status"][] = ["approved", "exported"];

/** How long before payslip list data is considered stale (5 minutes) */
const STALE_TIME_MS = 5 * 60 * 1000;

async function fetchPayslips(): Promise<PayslipsResult> {
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

  // Fetch closed + exported periods for this workspace, most recent first
  const { data: periods, error: periodsError } = await supabase
    .schema("payroll")
    .from("period")
    .select("*")
    .eq("workspace_id", profile.workspace_id)
    .in("status", SETTLED_STATUSES)
    .order("start_date", { ascending: false });

  if (periodsError) throw periodsError;
  if (!periods || periods.length === 0) return { payslips: [] };

  // Fetch all of this employee's calculations in one query, then match client-side
  const periodIds = periods.map((p) => p.id);
  const { data: calculations, error: calcError } = await supabase
    .schema("payroll")
    .from("calculation")
    .select("*")
    .eq("profile_id", profile.profile_id)
    .in("period_id", periodIds);

  if (calcError) throw calcError;

  const calcByPeriod = new Map((calculations ?? []).map((c) => [c.period_id, c]));

  const payslips: PayslipEntry[] = periods.map((period) => ({
    period,
    calculation: calcByPeriod.get(period.id) ?? null,
  }));

  return { payslips };
}

async function fetchPayslipDetail(periodId: string): Promise<PayslipDetailResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (profileError) throw profileError;

  const { data: calculation, error: calcError } = await supabase
    .schema("payroll")
    .from("calculation")
    .select("*")
    .eq("profile_id", profile.profile_id)
    .eq("period_id", periodId)
    .limit(1)
    .maybeSingle();

  if (calcError) throw calcError;
  if (!calculation) return { calculation: null, lines: [] };

  const { data: lines, error: linesError } = await supabase
    .schema("payroll")
    .from("calculation_line")
    .select("*")
    .eq("calculation_id", calculation.id)
    .order("line_type", { ascending: true });

  if (linesError) throw linesError;

  return {
    calculation,
    lines: lines ?? [],
  };
}

/**
 * Hook: returns all settled payroll periods with the employee's summary calculation.
 * Suitable for rendering the payslip list screen.
 */
export function usePayslips() {
  return useQuery<PayslipsResult>({
    queryKey: ["payslips"],
    queryFn: fetchPayslips,
    staleTime: STALE_TIME_MS,
    retry: 1,
  });
}

/**
 * Hook: returns the calculation detail (line items) for a specific payroll period.
 * Only fetches when the user opens a specific payslip — avoids loading all line data.
 *
 * `periodId` accepts null so callers don't have to mint an empty-string
 * fallback (ADR-0134 / L-0083). The query is gated by `enabled: !!periodId`.
 */
export function usePayslipDetail(periodId: string | null) {
  return useQuery<PayslipDetailResult>({
    queryKey: ["payslip-detail", periodId],
    // Safe cast: queryFn only runs when `enabled` is true (i.e. periodId is truthy).
    queryFn: () => fetchPayslipDetail(periodId as string),
    staleTime: STALE_TIME_MS,
    retry: 1,
    enabled: !!periodId,
  });
}
