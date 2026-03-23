/**
 * Fetches the line-item breakdown for a specific payroll calculation.
 *
 * Only runs when a period is selected — avoids loading line data for all
 * periods upfront. Enabled flag ensures no query fires with a null ID.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import type { Database } from "@smartout/supabase";

export type CalculationLine = Database["payroll"]["Tables"]["calculation_line"]["Row"];

async function fetchPayslipLines(calculationId: string): Promise<CalculationLine[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .schema("payroll")
    .from("calculation_line")
    .select("*")
    .eq("calculation_id", calculationId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Hook: fetches calculation line items for the selected payslip.
 * Disabled when calculationId is null — safe to call unconditionally.
 */
export function usePayslipLines(calculationId: string | null) {
  return useQuery<CalculationLine[]>({
    queryKey: ["payslip-lines", calculationId],
    queryFn: () => fetchPayslipLines(calculationId!),
    enabled: !!calculationId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
