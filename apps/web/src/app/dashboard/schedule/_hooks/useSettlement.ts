"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { emit, nonEmpty } from "@smartout/telemetry";
export type SettlementInput = {
  departmentId: string;
  reconciliationDate: string;
  revenueTotal: number;
  revenueCard?: number | null;
  revenueCash?: number | null;
  revenueVat?: number | null;
  revenueTransactions?: number | null;
  cashCounted?: number | null;
};

/** Fetch existing reconciliation for a date + department (if any). */
export function useSettlementForDate(departmentId: string | undefined, date: string | null) {
  const { workspace } = useWorkspace();
  const supabase = createClient();

  return useQuery({
    queryKey: ["settlement", workspace.workspace_id, departmentId, date],
    enabled: !!departmentId && !!date,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_reconciliation")
        .select(
          "reconciliation_id, status, revenue_total, revenue_card, revenue_cash, revenue_vat, revenue_transactions, cash_counted, cash_expected, cash_difference, settled_by, settled_at, approved_by, approved_at, total_labor_cost, revenue_per_worked_hour, labor_percentage",
        )
        .eq("workspace_id", workspace.workspace_id)
        .eq("department_id", departmentId!)
        .eq("reconciliation_date", date!)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}

/** Submit a new settlement or update an existing one. */
export function useSubmitSettlement() {
  const { workspace } = useWorkspace();
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ input, profileId }: { input: SettlementInput; profileId: string }) => {
      const cashExpected = input.revenueCash ?? null;
      const cashDiff =
        input.cashCounted != null && cashExpected != null ? input.cashCounted - cashExpected : null;

      const { data, error } = await supabase
        .from("daily_reconciliation")
        .upsert(
          {
            workspace_id: workspace.workspace_id,
            department_id: input.departmentId,
            reconciliation_date: input.reconciliationDate,
            revenue_total: input.revenueTotal,
            revenue_card: input.revenueCard ?? null,
            revenue_cash: input.revenueCash ?? null,
            revenue_vat: input.revenueVat ?? null,
            revenue_transactions: input.revenueTransactions ?? null,
            cash_counted: input.cashCounted ?? null,
            cash_expected: cashExpected,
            cash_difference: cashDiff,
            revenue_source: "manual" as const,
            status: "submitted" as const,
            settled_by: profileId,
            settled_at: new Date().toISOString(),
          },
          { onConflict: "workspace_id,department_id,reconciliation_date" },
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { profileId, input }) => {
      void emit({
        event: "reconciliation submitted",
        workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          data: {
            reconciliation_id: _data.reconciliation_id,
          },
        },
      });
      queryClient.invalidateQueries({ queryKey: ["settlement"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-list"] });
    },
  });
}
