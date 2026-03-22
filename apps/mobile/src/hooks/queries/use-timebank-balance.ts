/**
 * Fetches the employee's timebank entries and computes the current balance.
 *
 * Timebank tracks overtime hours owed to the employee (credits) vs hours
 * taken as time off or paid out (debits). Balance is computed client-side
 * from the entry log — no separate balance column exists on the table.
 *
 * Credit entry types: accrual, carry_over, adjustment
 * Debit entry types:  withdrawal, expiry, payout
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

type TimebankEntry = Database["payroll"]["Tables"]["timebank_entry"]["Row"];

export type TimebankBalanceResult = {
  /** Net hours available in timebank (credits minus debits) */
  balance: number;
  entries: TimebankEntry[];
};

/** How long before timebank data is considered stale (5 minutes) */
const STALE_TIME_MS = 5 * 60 * 1000;

/** Entry types that add hours to the timebank */
const CREDIT_TYPES: TimebankEntry["entry_type"][] = ["accrual", "carry_over", "adjustment"];

/** Entry types that consume hours from the timebank */
const DEBIT_TYPES: TimebankEntry["entry_type"][] = ["withdrawal", "expiry", "payout"];

function computeBalance(entries: TimebankEntry[]): number {
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

async function fetchTimebankBalance(): Promise<TimebankBalanceResult> {
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

  const { data, error } = await supabase
    .schema("payroll")
    .from("timebank_entry")
    .select("*")
    .eq("profile_id", profile.profile_id)
    .order("effective_date", { ascending: false });

  if (error) throw error;

  const entries = data ?? [];
  const balance = computeBalance(entries);

  return { balance, entries };
}

/**
 * Hook: returns the timebank entry log and the computed net balance in hours.
 * Balance is derived client-side: sum(credits) - sum(debits).
 */
export function useTimebankBalance() {
  return useQuery<TimebankBalanceResult>({
    queryKey: ["timebank-balance"],
    queryFn: fetchTimebankBalance,
    staleTime: STALE_TIME_MS,
    retry: 1,
  });
}
