"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";
import type { KpiMetric } from "./use-kpi-targets";

/**
 * Provides KPI explanation copy for strategic cards.
 * Why: copy should be editable from data storage instead of hardcoded UI strings.
 * Returns a metric-keyed map with DB overrides merged on top of defaults.
 */
export type KpiCopyMap = Record<KpiMetric, string>;

const DEFAULT_KPI_COPY: KpiCopyMap = {
  cost_of_sales:
    "Beregnes ved å dele totale lønnskostnader på total omsetning i valgt periode (rullerende 30 dager). Juster målet for å utløse tidligere varsler.",
  turnover_90d:
    "Beregnes ved å dele antall ansatte som har sluttet på gjennomsnittlig antall ansatte over 90 dager. Måles mot ditt satte mål.",
  absence_rate:
    "Totale registrerte fraværstimer delt på totale forventede arbeidstimer hittil denne måneden. Brukes til å oppdage tidlige tegn på teamutmattelse.",
  time_to_job_ready:
    "Gjennomsnittlig antall dager mellom en ansatts første vakt og fullføring av alle påkrevde onboarding-løp inkludert samsvarskontroller.",
  task_completion:
    "Andel tildelte arbeidsoppgaver (åpning, stenging, vedlikehold) fullført på tvers av alle vakter som matcher lokasjonsfilter.",
  training_readiness:
    "Andel protokolltildelinger fullført av aktive ansatte. Måler den totale bemanningsberedskapen.",
};

type KpiCopyRow = {
  metric: string;
  explanation: string;
};

/**
 * Fetches workspace KPI explanation copy for one locale.
 * Why: lets product teams update explanatory text without redeploying frontend code.
 * @returns A query result with `copy` map and loading/error flags.
 */
export function useKpiCopy(locale = "nb") {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  const query = useQuery({
    queryKey: dashboardKeys.kpiCopy(workspaceId ?? "none", locale),
    enabled: !!workspaceId,
    staleTime: 10 * 60 * 1000, // 10 minutes — editorial copy changes infrequently
    queryFn: async (): Promise<KpiCopyMap> => {
      const wsId = workspaceId!;
      const supabase = createClient();
      const { data, error } = await supabase
        .from("workspace_kpi_copy")
        .select("metric, explanation")
        .eq("workspace_id", wsId)
        .eq("locale", locale);

      if (error) throw error;

      const merged: KpiCopyMap = { ...DEFAULT_KPI_COPY };
      for (const row of (data ?? []) as KpiCopyRow[]) {
        if (row.metric in merged && row.explanation.trim().length > 0) {
          merged[row.metric as KpiMetric] = row.explanation;
        }
      }
      return merged;
    },
  });

  return {
    copy: query.data ?? DEFAULT_KPI_COPY,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  };
}
