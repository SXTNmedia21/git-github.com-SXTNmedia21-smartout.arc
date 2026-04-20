"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspaceOptional } from "@/lib/workspace-context";

export type DailyReconciliationStatus =
  | "open"
  | "submitted"
  | "awaiting_approval"
  | "approved"
  | "locked"
  | "unreconciled";

export type DailyReconciliationRow = {
  reconciliationId: string;
  status: DailyReconciliationStatus;
  revenueTotal: number | null;
  totalLaborCost: number | null;
  totalActualHours: number | null;
};

/**
 * Returns the `daily_reconciliation` row for a given session + department + date.
 * Used by WebDayControl to feed `derivePhase(session, recon)` so the `locked`
 * UI phase can render (L-0064 — locked = closed session + recon.status=locked).
 *
 * Returns null while loading OR when no reconciliation exists yet (pre-signoff).
 */
export function useDailyReconciliation(departmentId: string | null, dateISO: string) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: ["day-control", "daily-reconciliation", wsId, departmentId, dateISO],
    enabled: !!wsId && !!departmentId,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<DailyReconciliationRow | null> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("daily_reconciliation")
        .select("reconciliation_id, status, revenue_total, total_labor_cost, total_actual_hours")
        .eq("workspace_id", wsId!)
        .eq("department_id", departmentId!)
        .eq("reconciliation_date", dateISO)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        reconciliationId: data.reconciliation_id,
        status: data.status as DailyReconciliationStatus,
        revenueTotal: data.revenue_total as number | null,
        totalLaborCost: data.total_labor_cost as number | null,
        totalActualHours: data.total_actual_hours as number | null,
      };
    },
  });
}
