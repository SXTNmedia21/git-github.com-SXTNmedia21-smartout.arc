/**
 * Fetches workspace supplement rules and public holidays.
 *
 * Rules define when and how wage supplements apply (evening, weekend, holiday rates).
 * Holidays are fetched for the current calendar year — used by the supplement engine
 * to determine which dates trigger holiday rate calculations.
 *
 * staleTime: Infinity — rules and holidays change rarely (admin-managed config).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

type SupplementRule = Database["payroll"]["Tables"]["supplement_rule"]["Row"];
type HolidayEntry = Database["payroll"]["Tables"]["holiday_entry"]["Row"];

export type SupplementRulesResult = {
  rules: SupplementRule[];
  holidays: string[]; // ISO date strings: "2026-05-17"
};

async function fetchSupplementRules(): Promise<SupplementRulesResult> {
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

  const startOfYear = `${new Date().getFullYear()}-01-01`;

  const [rulesResult, holidaysResult] = await Promise.all([
    supabase
      .schema("payroll")
      .from("supplement_rule")
      .select("*")
      .eq("workspace_id", profile.workspace_id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .schema("payroll")
      .from("holiday_entry")
      .select("holiday_date, name")
      .eq("workspace_id", profile.workspace_id)
      .gte("holiday_date", startOfYear),
  ]);

  if (rulesResult.error) throw rulesResult.error;
  if (holidaysResult.error) throw holidaysResult.error;

  const holidays = (holidaysResult.data ?? []).map((h) => h.holiday_date);

  return {
    rules: rulesResult.data ?? [],
    holidays,
  };
}

/**
 * Hook: returns active supplement rules and holiday dates for the workspace.
 * Infinite stale time — supplement rules are admin-managed config, not volatile data.
 */
export function useSupplementRules() {
  return useQuery<SupplementRulesResult>({
    queryKey: ["supplement-rules"],
    queryFn: fetchSupplementRules,
    staleTime: Infinity,
    retry: 1,
  });
}
