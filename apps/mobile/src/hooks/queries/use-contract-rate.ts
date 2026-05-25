/**
 * use-contract-rate — fetches the authenticated employee's hourly rate
 * from `employee_payroll_profile`.
 *
 * Used by AfterShiftView + DuringShiftViewV2 to show an accurate
 * earnings estimate instead of the hardcoded 220 kr/h fallback.
 *
 * Returns null when:
 *  - No `employee_payroll_profile` row exists for this profile (e.g. contract
 *    not fully set up yet).
 *  - The row has `hourly_rate = null` (monthly-salary worker, tariff only,
 *    or not yet configured).
 *
 * In both null cases callers should show a "Beregner lønn…" placeholder
 * rather than a misleading number.
 *
 * Workspace scope: the query filters by `profile_id` which is 1:1 to a
 * workspace — no cross-workspace data risk. Law 1 (workspace scope) is
 * satisfied because `profile_id` is the workspace-scoped identity anchor
 * and the query is the employee's own row (RLS = owner read).
 *
 * ADR-0151: profile_id derived from `getProfileContext()`, never from
 * forgeable client input.
 *
 * L-0176: body verified before docstring written.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getProfileContext } from "@/lib/profile-context";
import type { Database } from "@smartout/supabase/database.types";

type EmployeePayrollProfileRow = Database["public"]["Tables"]["employee_payroll_profile"]["Row"];

/** Minimal fields needed for rate display */
export type ContractRate = {
  /** Hourly rate in NOK, or null when not configured */
  hourly_rate: number | null;
  /** Remuneration type hint for UI labelling */
  remuneration_type: string | null;
};

const STALE_TIME_MS = 10 * 60 * 1000; // 10 min — rate doesn't change mid-shift

async function fetchContractRate(): Promise<ContractRate> {
  // ADR-0151: derive profile_id server-side; throw on missing IDs.
  const { profileId } = await getProfileContext();

  const { data, error } = await supabase
    .from("employee_payroll_profile")
    .select("hourly_rate, remuneration_type")
    .eq("profile_id", profileId)
    .maybeSingle();

  // L-0177: fail fast — do not silently fall back to a default.
  if (error) throw error;

  // No row = contract not yet set up. Return null hourly_rate.
  if (!data) return { hourly_rate: null, remuneration_type: null };

  const row = data as Pick<EmployeePayrollProfileRow, "hourly_rate" | "remuneration_type">;

  return {
    hourly_rate: row.hourly_rate ?? null,
    remuneration_type: row.remuneration_type ?? null,
  };
}

/**
 * Returns the authenticated employee's contracted hourly rate.
 *
 * `data.hourly_rate` is null when not configured — callers must handle
 * this with a placeholder, never silently fall back to a magic number.
 */
export function useContractRate(): UseQueryResult<ContractRate> {
  return useQuery<ContractRate>({
    queryKey: ["contract-rate"],
    queryFn: fetchContractRate,
    staleTime: STALE_TIME_MS,
    retry: 1,
  });
}
