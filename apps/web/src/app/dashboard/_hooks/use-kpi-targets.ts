"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";

export type KpiMetric =
  | "cost_of_sales"
  | "turnover_90d"
  | "absence_rate"
  | "time_to_job_ready"
  | "task_completion"
  | "training_readiness";

export type KpiTargets = Record<KpiMetric, number>;

export const DEFAULT_KPI_TARGETS: KpiTargets = {
  cost_of_sales: 30,
  turnover_90d: 15,
  absence_rate: 4,
  time_to_job_ready: 7,
  task_completion: 90,
  training_readiness: 100,
};

type KpiRow = {
  metric: string;
  target_value: number;
  benchmark_value: number | null;
};

/**
 * Fetches and persists KPI targets for the workspace strategic view.
 * Uses workspace_kpi_target table with upsert on (workspace_id, metric).
 * Falls back to DEFAULT_KPI_TARGETS when no DB rows exist.
 * Connected to: StrategicView KPI cards and configure dialog
 */
export function useKpiTargets() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: dashboardKeys.kpiTargets(wsId ?? "none"),
    queryFn: async (): Promise<KpiTargets> => {
      const { data, error } = await supabase
        .from("workspace_kpi_target")
        .select("metric, target_value, benchmark_value")
        .eq("workspace_id", wsId!);

      if (error) throw error;

      const targets = { ...DEFAULT_KPI_TARGETS };
      for (const row of data ?? []) {
        if (row.metric in targets) {
          targets[row.metric as KpiMetric] = Number(row.target_value);
        }
      }
      return targets;
    },
    enabled: !!wsId,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.kpiTargets(wsId!) });
    },
  });

  return {
    targets: query.data ?? DEFAULT_KPI_TARGETS,
    isLoading: query.isLoading,
    updateTarget,
  };
}
