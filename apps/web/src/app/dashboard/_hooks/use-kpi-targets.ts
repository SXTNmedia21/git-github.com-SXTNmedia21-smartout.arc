"use client";

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { dashboardKeys } from "./dashboard-keys";

export type KpiMetric =
  | "cost_of_sales"
  | "turnover_90d"
  | "absence_rate"
  | "time_to_job_ready"
  | "task_completion"
  | "training_readiness";

export type KpiTargets = Record<KpiMetric, number>;
export type KpiManualValueEntry = {
  value: number;
  unit: string | null;
  valueDate: string;
};
export type KpiManualValues = Partial<Record<KpiMetric, KpiManualValueEntry>>;

export const DEFAULT_KPI_TARGETS: KpiTargets = {
  cost_of_sales: 30,
  turnover_90d: 15,
  absence_rate: 4,
  time_to_job_ready: 7,
  task_completion: 90,
  training_readiness: 100,
};

/**
 * Fetches KPI targets + per-day manual-value time-series for the workspace
 * Innsikt view. Targets persist on `workspace_kpi_target`; manual values
 * persist on `workspace_kpi_manual_value` (one row per metric × date,
 * latest value_date wins for the live display).
 */
export function useKpiTargets() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: dashboardKeys.kpiTargets(wsId ?? "none"),
    queryFn: async (): Promise<{ targets: KpiTargets; manualValues: KpiManualValues }> => {
      const { data: targetRows, error: targetErr } = await supabase
        .from("workspace_kpi_target")
        .select("metric, target_value")
        .eq("workspace_id", wsId!);

      if (targetErr) throw targetErr;

      const targets = { ...DEFAULT_KPI_TARGETS };
      for (const row of targetRows ?? []) {
        if (row.metric in targets) {
          targets[row.metric as KpiMetric] = Number(row.target_value);
        }
      }

      // Latest manual value per metric — order DESC by value_date, take first.
      // `workspace_kpi_manual_value` exists in the DB (migration applied)
      // but not yet in generated types — cast through `any` until regen.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data: manualRows, error: manualErr } = await sb
        .from("workspace_kpi_manual_value")
        .select("metric, value, unit, value_date")
        .eq("workspace_id", wsId!)
        .order("value_date", { ascending: false });

      if (manualErr) throw manualErr;

      const manualValues: KpiManualValues = {};
      const rows = (manualRows ?? []) as unknown as Array<{
        metric: string;
        value: number;
        unit: string | null;
        value_date: string;
      }>;
      for (const row of rows) {
        if (manualValues[row.metric as KpiMetric]) continue;
        manualValues[row.metric as KpiMetric] = {
          value: Number(row.value),
          unit: row.unit,
          valueDate: row.value_date,
        };
      }
      return { targets, manualValues };
    },
    enabled: !!wsId,
    staleTime: 60 * 1000,
  });

  const updateTarget = useMutation({
    mutationFn: async ({ metric, value }: { metric: KpiMetric; value: number }) => {
      const { error } = await supabase.from("workspace_kpi_target").upsert(
        {
          workspace_id: wsId!,
          metric,
          target_value: value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,metric" },
      );
      if (error) throw error;
    },
    onSuccess: (_data, { metric, value }) => {
      void emit({
        event: "kpi_target updated",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          data: { metric, value },
        },
      });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.kpiTargets(wsId!) });
    },
  });

  const updateManualValue = useMutation({
    mutationFn: async ({
      metric,
      value,
      unit,
      valueDate,
    }: {
      metric: KpiMetric;
      value: number | null;
      unit?: string | null;
      /** ISO date (YYYY-MM-DD). Defaults to today. */
      valueDate?: string;
    }) => {
      const date = valueDate ?? new Date().toISOString().slice(0, 10);

      // Cast through `any` until generated types include the new table.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;

      if (value === null) {
        const { error } = await sb
          .from("workspace_kpi_manual_value")
          .delete()
          .eq("workspace_id", wsId!)
          .eq("metric", metric)
          .eq("value_date", date);
        if (error) throw error;
        return;
      }

      const { error } = await sb.from("workspace_kpi_manual_value").upsert(
        {
          workspace_id: wsId!,
          metric,
          value_date: date,
          value,
          unit: unit ?? null,
          created_by: profileId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,metric,value_date" },
      );
      if (error) throw error;
    },
    onSuccess: (_data, { metric, value }) => {
      void emit({
        event: "kpi_target updated",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          data: { metric, value: value ?? 0 },
        },
      });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.kpiTargets(wsId!) });
    },
  });

  return {
    targets: query.data?.targets ?? DEFAULT_KPI_TARGETS,
    manualValues: query.data?.manualValues ?? {},
    isLoading: query.isLoading,
    updateTarget,
    updateManualValue,
  };
}
