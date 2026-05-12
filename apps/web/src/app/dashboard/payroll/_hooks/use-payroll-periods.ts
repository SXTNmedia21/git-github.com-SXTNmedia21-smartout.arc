/**
 * Hook: fetch the payroll period list for the current workspace.
 *
 * Returns periods ordered by end_date DESC so the most recent period appears
 * first. Includes deviation summary counts (error / warning / total) per
 * period, fetched in a batch join query to avoid N+1.
 *
 * Scope: manager/admin surface only — workspace_id comes from WorkspaceContext
 * (server-resolved, not client-supplied).
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import type { Database } from "@smartout/supabase";
import { payrollKeys } from "./payroll-keys";

type Period = Database["payroll"]["Tables"]["period"]["Row"];
type DeviationSeverity = Database["payroll"]["Enums"]["deviation_severity"];

export type PeriodSummary = {
  period: Period;
  deviationErrors: number;
  deviationWarnings: number;
  totalLines: number;
};

async function fetchPeriods(workspaceId: string): Promise<PeriodSummary[]> {
  const supabase = createClient();

  const { data: periods, error: periodsErr } = await supabase
    .schema("payroll")
    .from("period")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("end_date", { ascending: false });

  if (periodsErr) throw periodsErr;
  if (!periods?.length) return [];

  const periodIds = periods.map((p) => p.id);

  // Batch fetch deviations for all periods in one query
  const { data: deviations, error: devErr } = await supabase
    .schema("payroll")
    .from("deviation")
    .select("period_id, severity, acknowledged_at")
    .in("period_id", periodIds)
    .eq("workspace_id", workspaceId);

  if (devErr) throw devErr;

  // Batch fetch calculation_line counts per period (proxy for "total lines")
  // We count distinct profile_ids from calculation instead
  const { data: calcs, error: calcErr } = await supabase
    .schema("payroll")
    .from("calculation")
    .select("period_id, profile_id")
    .in("period_id", periodIds)
    .eq("workspace_id", workspaceId);

  if (calcErr) throw calcErr;

  // Build lookup maps
  const deviationsByPeriod = new Map<string, { errors: number; warnings: number }>();
  for (const d of deviations ?? []) {
    if (!d.period_id) continue;
    const existing = deviationsByPeriod.get(d.period_id) ?? { errors: 0, warnings: 0 };
    const sev = d.severity as DeviationSeverity;
    if (sev === "error") existing.errors += 1;
    if (sev === "warning") existing.warnings += 1;
    deviationsByPeriod.set(d.period_id, existing);
  }

  const profilesByPeriod = new Map<string, Set<string>>();
  for (const c of calcs ?? []) {
    if (!c.period_id) continue;
    const existing = profilesByPeriod.get(c.period_id) ?? new Set<string>();
    existing.add(c.profile_id);
    profilesByPeriod.set(c.period_id, existing);
  }

  return periods.map((period) => {
    const devCounts = deviationsByPeriod.get(period.id) ?? { errors: 0, warnings: 0 };
    const profiles = profilesByPeriod.get(period.id) ?? new Set<string>();
    return {
      period,
      deviationErrors: devCounts.errors,
      deviationWarnings: devCounts.warnings,
      totalLines: profiles.size,
    };
  });
}

const STALE_TIME_MS = 2 * 60 * 1000; // 2 minutes

export function usePayrollPeriods() {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  return useQuery<PeriodSummary[]>({
    queryKey: payrollKeys.periods(workspaceId ?? "none"),
    queryFn: () => fetchPeriods(workspaceId!),
    enabled: !!workspaceId,
    staleTime: STALE_TIME_MS,
    retry: 1,
  });
}
