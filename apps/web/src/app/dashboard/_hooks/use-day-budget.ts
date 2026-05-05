"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspaceOptional } from "@/lib/workspace-context";

export type DayBudget = {
  revenue: number | null;
  laborCost: number | null;
  laborHours: number | null;
};

/**
 * useDayBudget — resolves D4 demand-signal targets for a given department/date.
 *
 * Reads `workspace_budget` rows where `period_type='day'` and date matches.
 * If multiple hour-slot rows exist for that date, sums them (hour-granular
 * budgets aggregate to a daily figure). Falls back to workspace-level row
 * (`department_id IS NULL`) if no department-specific row exists.
 *
 * Returns `null` per field when no data — caller renders "—".
 */
export function useDayBudget(departmentId: string | null, dateISO: string) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: ["day-control", "day-budget", wsId, departmentId, dateISO],
    enabled: !!wsId && !!departmentId,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<DayBudget> => {
      const supabase = createClient();

      // Try department-specific rows first
      let { data: rows } = await supabase
        .from("workspace_budget")
        .select("revenue_target, labor_cost_target, labor_hours_target, hour_slot")
        .eq("workspace_id", wsId!)
        .eq("department_id", departmentId!)
        .eq("period_type", "daily")
        .eq("period_date", dateISO);

      // Fall back to workspace-level (department_id IS NULL)
      if (!rows || rows.length === 0) {
        const { data: wsRows } = await supabase
          .from("workspace_budget")
          .select("revenue_target, labor_cost_target, labor_hours_target, hour_slot")
          .eq("workspace_id", wsId!)
          .is("department_id", null)
          .eq("period_type", "daily")
          .eq("period_date", dateISO);
        rows = wsRows ?? [];
      }

      if (!rows || rows.length === 0) {
        return { revenue: null, laborCost: null, laborHours: null };
      }

      let revenue: number | null = null;
      let laborCost: number | null = null;
      let laborHours: number | null = null;

      for (const r of rows) {
        if (r.revenue_target != null) {
          revenue = (revenue ?? 0) + Number(r.revenue_target);
        }
        if (r.labor_cost_target != null) {
          laborCost = (laborCost ?? 0) + Number(r.labor_cost_target);
        }
        if (r.labor_hours_target != null) {
          laborHours = (laborHours ?? 0) + Number(r.labor_hours_target);
        }
      }

      return { revenue, laborCost, laborHours };
    },
  });
}
