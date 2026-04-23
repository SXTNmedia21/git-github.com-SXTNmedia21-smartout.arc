"use client";

/**
 * useFinancialCloseConfig — CRUD hook for per-workspace financial close settings.
 * Reads from financial_close_config table with workspace-scoped RLS.
 * Falls back to sensible industry defaults if no config exists.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { emit, nonEmpty } from "@smartout/telemetry";
export type FinancialCloseConfig = {
  config_id: string;
  workspace_id: string;
  tolerance_type: "fixed" | "percentage";
  tolerance_value: number;
  require_cash_count: boolean;
  cash_tolerance_type: "fixed" | "percentage";
  cash_tolerance_value: number;
  approval_required: boolean;
  approval_deadline_hours: number;
};

const DEFAULTS: Omit<FinancialCloseConfig, "config_id" | "workspace_id"> = {
  tolerance_type: "fixed",
  tolerance_value: 50,
  require_cash_count: true,
  cash_tolerance_type: "fixed",
  cash_tolerance_value: 20,
  approval_required: true,
  approval_deadline_hours: 24,
};

export function useFinancialCloseConfig() {
  const { workspace } = useWorkspace();
  const supabase = createClient();
  const queryClient = useQueryClient();
  const wsId = workspace.workspace_id;

  const query = useQuery({
    queryKey: ["financial-close-config", wsId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_close_config")
        .select("*")
        .eq("workspace_id", wsId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const upsert = useMutation({
    mutationFn: async (
      updates: Partial<Omit<FinancialCloseConfig, "config_id" | "workspace_id">>,
    ) => {
      const { data, error } = await supabase
        .from("financial_close_config")
        .upsert({ workspace_id: wsId, ...updates }, { onConflict: "workspace_id" })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void emit({
        event: "financial_close_config updated",
        workspace_id: nonEmpty(wsId, "workspace_id"),
        actor_id: nonEmpty("", "actor_id"),
        properties: { data: {} },
      });
      queryClient.invalidateQueries({ queryKey: ["financial-close-config", wsId] });
    },
  });

  // Generated types match FinancialCloseConfig shape — safe to use directly
  const row = query.data;
  const config: FinancialCloseConfig = row
    ? {
        config_id: row.config_id,
        workspace_id: row.workspace_id,
        tolerance_type: row.tolerance_type as "fixed" | "percentage",
        tolerance_value: Number(row.tolerance_value),
        require_cash_count: row.require_cash_count,
        cash_tolerance_type: row.cash_tolerance_type as "fixed" | "percentage",
        cash_tolerance_value: Number(row.cash_tolerance_value),
        approval_required: row.approval_required,
        approval_deadline_hours: row.approval_deadline_hours,
      }
    : { config_id: "", workspace_id: wsId, ...DEFAULTS };

  return { config, isLoading: query.isLoading, upsert };
}
