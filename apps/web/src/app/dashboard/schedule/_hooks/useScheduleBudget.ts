"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

export type DailyBudgetTarget = {
  date: string;
  targetRevenue: number;
  targetLaborCost: number;
  targetStaffHours: number;
};

/**
 * Fetches workspace_budget targets for a date range.
 * Returns daily labor cost and revenue targets from the active season's
 * propagated budget. Falls back to empty array if no budget exists.
 */
export function useScheduleBudget(
  workspaceId: string | undefined,
  startDate: string,
  endDate: string,
) {
  return useQuery({
    queryKey: ["schedule-budget", workspaceId, startDate, endDate],
    queryFn: async (): Promise<DailyBudgetTarget[]> => {
      if (!workspaceId) return [];

      const supabase = createClient();
      const { data, error } = await supabase
        .from("workspace_budget")
        .select("period_date, revenue_target, labor_cost_target, labor_hours_target")
        .eq("workspace_id", workspaceId)
        .gte("period_date", startDate)
        .lte("period_date", endDate)
        .order("period_date");

      if (error) throw error;
      if (!data || data.length === 0) return [];

      return data.map((row) => ({
        date: row.period_date,
        targetRevenue: row.revenue_target ?? 0,
        targetLaborCost: row.labor_cost_target ?? 0,
        targetStaffHours: row.labor_hours_target ?? 0,
      }));
    },
    enabled: !!workspaceId && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
  });
}
