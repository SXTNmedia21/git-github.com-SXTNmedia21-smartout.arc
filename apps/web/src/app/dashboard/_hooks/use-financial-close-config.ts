"use client";

/**
 * useFinancialCloseConfig — provides financial close tolerance and approval settings.
 *
 * The financial_close_config table is created by migration 20260328120100.
 * Until database.types.ts is regenerated from local Supabase, this hook
 * returns hardcoded defaults. After type regen, swap in real .from() queries.
 */

import { useWorkspace } from "@/lib/workspace-context";

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

/**
 * Returns financial close config for the current workspace.
 * Currently returns defaults — will read from DB after types are regenerated.
 */
export function useFinancialCloseConfig() {
  const { workspace } = useWorkspace();
  const wsId = workspace.workspace_id;

  const config: FinancialCloseConfig = {
    config_id: "",
    workspace_id: wsId,
    ...DEFAULTS,
  };

  return { config, isLoading: false, upsert: { mutate: () => {}, isPending: false } };
}
