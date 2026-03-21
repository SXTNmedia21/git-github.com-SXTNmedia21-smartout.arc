"use client";

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { dashboardKeys } from "./dashboard-keys";

export type BudgetPeriodType = "monthly" | "weekly" | "daily" | "hourly";

export type BudgetEntry = {
  id: string;
  period_type: BudgetPeriodType;
  period_date: string;
  hour_slot: number | null;
  location_id: string | null;
  department_id: string | null;
  revenue_target: number | null;
  labor_cost_target: number | null;
  food_cost_target: number | null;
  cost_of_sales_target: number | null;
  turnover_target: number | null;
  absence_threshold: number | null;
  time_to_job_target: number | null;
  notes: string | null;
};

type UpsertBudgetInput = Omit<BudgetEntry, "id"> & { id?: string };

/**
 * Fetches and persists workspace budget entries for a given period range.
 * Uses workspace_budget table with upsert on (workspace_id, period_type, period_date, hour_slot).
 * Connected to: BudgetSettingsPanel in StrategicView
 */
export function useBudget({
  periodType,
  startDate,
  endDate,
  locationId,
  departmentId,
}: {
  periodType: BudgetPeriodType;
  startDate: string;
  endDate: string;
  locationId?: string | null;
  departmentId?: string | null;
}) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: dashboardKeys.budgets(wsId ?? "none", periodType, startDate, endDate),
    queryFn: async (): Promise<BudgetEntry[]> => {
      let q = supabase
        .from("workspace_budget")
        .select("*")
        .eq("workspace_id", wsId!)
        .eq("period_type", periodType)
        .gte("period_date", startDate)
        .lte("period_date", endDate);

      if (locationId) {
        q = q.eq("location_id", locationId);
      }
      if (departmentId) {
        q = q.eq("department_id", departmentId);
      }

      const { data, error } = await q;

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000, // 5 minutes — semi-stable budget data
  });

  const upsertBudget = useMutation({
    mutationFn: async (entry: UpsertBudgetInput) => {
      const payload = {
        workspace_id: wsId!,
        period_type: entry.period_type,
        period_date: entry.period_date,
        hour_slot: entry.hour_slot,
        location_id: entry.location_id,
        department_id: entry.department_id,
        revenue_target: entry.revenue_target,
        labor_cost_target: entry.labor_cost_target,
        food_cost_target: entry.food_cost_target,
        cost_of_sales_target: entry.cost_of_sales_target,
        turnover_target: entry.turnover_target,
        absence_threshold: entry.absence_threshold,
        time_to_job_target: entry.time_to_job_target,
        notes: entry.notes,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("workspace_budget").upsert(payload, {
        onConflict: "workspace_id,period_type,period_date,hour_slot",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      void emit({
        event: "workspace_budget updated",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          data: { period_type: periodType, period_date: startDate },
        },
      });
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.budgets(wsId!, periodType, startDate, endDate),
      });
    },
  });

  return {
    budgets: query.data ?? [],
    isLoading: query.isLoading,
    upsertBudget,
  };
}
