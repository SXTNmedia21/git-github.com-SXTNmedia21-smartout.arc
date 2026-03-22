/**
 * Fetches the employee's absence quotas and ledger entries.
 *
 * Quotas hold the annual entitlement + used/remaining days per absence type.
 * Ledger entries are the individual transactions (usage, adjustments, carry-overs)
 * that built up to the current quota state.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

type AbsenceQuota = Database["payroll"]["Tables"]["absence_quota"]["Row"];
type AbsenceLedgerEntry = Database["payroll"]["Tables"]["absence_ledger"]["Row"];

export type AbsenceBalanceResult = {
  quotas: AbsenceQuota[];
  ledgerEntries: AbsenceLedgerEntry[];
};

/** How long before absence balance is considered stale (5 minutes) */
const STALE_TIME_MS = 5 * 60 * 1000;

async function fetchAbsenceBalance(): Promise<AbsenceBalanceResult> {
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

  const currentYear = new Date().getFullYear();

  const [quotasResult, ledgerResult] = await Promise.all([
    supabase
      .schema("payroll")
      .from("absence_quota")
      .select("*")
      .eq("profile_id", profile.profile_id)
      .eq("year", currentYear),
    supabase
      .schema("payroll")
      .from("absence_ledger")
      .select("*")
      .eq("profile_id", profile.profile_id)
      .order("effective_date", { ascending: false })
      .limit(20),
  ]);

  if (quotasResult.error) throw quotasResult.error;
  if (ledgerResult.error) throw ledgerResult.error;

  return {
    quotas: quotasResult.data ?? [],
    ledgerEntries: ledgerResult.data ?? [],
  };
}

/**
 * Hook: returns the current employee's absence quotas and recent ledger entries.
 * Used to display vacation/sick leave balances on the payroll card and detail screen.
 */
export function useAbsenceBalance() {
  return useQuery<AbsenceBalanceResult>({
    queryKey: ["absence-balance"],
    queryFn: fetchAbsenceBalance,
    staleTime: STALE_TIME_MS,
    retry: 1,
  });
}
