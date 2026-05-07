/**
 * Hook: fetch a single payroll period by ID.
 *
 * Reads the period row from payroll.period.
 * Workspace scope is verified: if the period belongs to a different workspace,
 * the supabase RLS policy will reject the read and the hook returns null data.
 *
 * Called from the period detail page as the top-level data source.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import type { Database } from "@smartout/supabase";
import { payrollKeys } from "../../_hooks/payroll-keys";

export type Period = Database["payroll"]["Tables"]["period"]["Row"];

async function fetchPeriod(periodId: string): Promise<Period | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema("payroll")
    .from("period")
    .select("*")
    .eq("id", periodId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function usePayrollPeriod(periodId: string) {
  return useQuery<Period | null>({
    queryKey: payrollKeys.period(periodId),
    queryFn: () => fetchPeriod(periodId),
    staleTime: 60 * 1000, // 1 minute
    retry: 1,
  });
}
