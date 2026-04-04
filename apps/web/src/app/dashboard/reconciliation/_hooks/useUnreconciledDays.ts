"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

export type UnreconciledDay = {
  reconciliationId: string;
  date: string;
  departmentId: string;
  departmentName: string;
};

/**
 * Returns days that have not been reconciled (status = 'open' and date < today).
 * Used for the daily prompt card on the admin dashboard.
 */
export function useUnreconciledDays(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["unreconciled-days", workspaceId],
    queryFn: async (): Promise<UnreconciledDay[]> => {
      if (!workspaceId) return [];

      const supabase = createClient();
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("daily_reconciliation")
        .select(
          "reconciliation_id, reconciliation_date, department_id, department:department_id(name)",
        )
        .eq("workspace_id", workspaceId)
        .eq("status", "open")
        .lt("reconciliation_date", today!)
        .order("reconciliation_date", { ascending: false })
        .limit(10);

      if (error) throw error;
      if (!data) return [];

      return data.map((row) => ({
        reconciliationId: row.reconciliation_id,
        date: row.reconciliation_date,
        departmentId: row.department_id,
        departmentName: (row.department as unknown as { name: string } | null)?.name ?? "", // SAFETY: Supabase join returns union type; runtime shape matches the cast
      }));
    },
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
