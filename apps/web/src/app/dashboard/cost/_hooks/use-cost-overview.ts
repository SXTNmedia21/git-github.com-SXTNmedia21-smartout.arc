"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";

/**
 * Query key factory for cost dashboard queries.
 * Scoped under "cost" namespace to avoid collisions with dashboard keys.
 */
export const costKeys = {
  all: ["cost"] as const,
  overview: (workspaceId: string, dateFrom: string, dateTo: string) =>
    ["cost", "overview", workspaceId, dateFrom, dateTo] as const,
};

/**
 * A single cost snapshot row joined with shift + department + profile data.
 * One row per calculation — append-only, so latest per shift is the "current" cost.
 */
export type CostSnapshot = {
  id: string;
  workspace_id: string;
  schedule_shift_id: string;
  profile_id: string | null;
  base_hours: number;
  base_rate: number;
  base_cost: number;
  supplements: unknown[];
  overtime_cost: number;
  total_cost: number;
  calculated_at: string;
  calculation_version: number;
  schedule_shift: {
    schedule_shift_id: string;
    shift_date: string;
    start_time: string;
    end_time: string;
    work_hours: number;
    status: string;
    department_id: string | null;
    employee_id: string | null;
    department: {
      department_id: string;
      name: string;
    } | null;
    profile: {
      profile_id: string;
      display_name: string;
    } | null;
  } | null;
};

/** Aggregated cost summary for a single department. */
export type DepartmentCostSummary = {
  departmentId: string;
  departmentName: string;
  plannedCost: number;
  actualCost: number;
  variance: number;
  variancePercent: number;
  totalHours: number;
  shiftCount: number;
};

/** Overall totals across all departments. */
export type CostTotals = {
  plannedCost: number;
  actualCost: number;
  variance: number;
  variancePercent: number;
  totalHours: number;
  shiftCount: number;
};

/**
 * Fetches shift_cost_snapshot rows for a date range, joined with
 * schedule_shift -> department + profile. Aggregates by department
 * for the cost dashboard overview.
 *
 * Uses DISTINCT ON equivalent: since shift_cost_snapshot is append-only,
 * we fetch all rows and deduplicate client-side by taking the latest
 * calculation_version per shift.
 *
 * Connected to: CostOverview, CostSummaryCards, DepartmentCostTable
 */
export function useCostOverview({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  const query = useQuery({
    queryKey: costKeys.overview(wsId ?? "none", dateFrom, dateTo),
    queryFn: async (): Promise<CostSnapshot[]> => {
      // Join shift_cost_snapshot -> schedule_shift -> department + profile
      // schedule_shift has department_id FK (added by cascade A1 alter migration)
      // schedule_shift.employee_id references profile(profile_id)
      const { data, error } = await supabase
        .from("shift_cost_snapshot")
        .select(
          `
          id,
          workspace_id,
          schedule_shift_id,
          profile_id,
          base_hours,
          base_rate,
          base_cost,
          supplements,
          overtime_cost,
          total_cost,
          calculated_at,
          calculation_version,
          schedule_shift:schedule_shift_id (
            schedule_shift_id,
            shift_date,
            start_time,
            end_time,
            work_hours,
            status,
            department_id,
            employee_id,
            department:department_id (
              department_id,
              name
            ),
            profile:employee_id (
              profile_id,
              display_name
            )
          )
        `,
        )
        .eq("workspace_id", wsId!)
        .gte("calculated_at", `${dateFrom}T00:00:00`)
        .lte("calculated_at", `${dateTo}T23:59:59`)
        .order("calculated_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as CostSnapshot[];
    },
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000, // 5 minutes — cost data changes on shift publish/completion
  });

  // Deduplicate: keep only the latest snapshot per shift (highest calculation_version)
  const latestSnapshots = useMemo(() => {
    if (!query.data) return [];

    const byShift = new Map<string, CostSnapshot>();
    for (const snap of query.data) {
      const existing = byShift.get(snap.schedule_shift_id);
      if (!existing || snap.calculation_version > existing.calculation_version) {
        byShift.set(snap.schedule_shift_id, snap);
      }
    }
    return Array.from(byShift.values());
  }, [query.data]);

  // Aggregate by department
  const byDepartment = useMemo((): DepartmentCostSummary[] => {
    const deptMap = new Map<
      string,
      {
        name: string;
        planned: number;
        actual: number;
        hours: number;
        count: number;
      }
    >();

    for (const snap of latestSnapshots) {
      const deptId = snap.schedule_shift?.department_id ?? "unassigned";
      const deptName = snap.schedule_shift?.department?.name ?? "Ikke tildelt";
      const shiftStatus = snap.schedule_shift?.status;

      const entry = deptMap.get(deptId) ?? {
        name: deptName,
        planned: 0,
        actual: 0,
        hours: 0,
        count: 0,
      };

      // Completed shifts have actual cost, published shifts have planned cost
      if (shiftStatus === "completed") {
        entry.actual += Number(snap.total_cost);
      } else {
        entry.planned += Number(snap.total_cost);
      }

      entry.hours += Number(snap.base_hours);
      entry.count += 1;
      deptMap.set(deptId, entry);
    }

    return Array.from(deptMap.entries()).map(([id, d]) => ({
      departmentId: id,
      departmentName: d.name,
      plannedCost: d.planned,
      actualCost: d.actual,
      variance: d.actual - d.planned,
      variancePercent: d.planned > 0 ? ((d.actual - d.planned) / d.planned) * 100 : 0,
      totalHours: d.hours,
      shiftCount: d.count,
    }));
  }, [latestSnapshots]);

  // Compute totals across all departments
  const totals = useMemo((): CostTotals => {
    const t = byDepartment.reduce(
      (acc, d) => ({
        plannedCost: acc.plannedCost + d.plannedCost,
        actualCost: acc.actualCost + d.actualCost,
        totalHours: acc.totalHours + d.totalHours,
        shiftCount: acc.shiftCount + d.shiftCount,
      }),
      { plannedCost: 0, actualCost: 0, totalHours: 0, shiftCount: 0 },
    );

    return {
      ...t,
      variance: t.actualCost - t.plannedCost,
      variancePercent:
        t.plannedCost > 0 ? ((t.actualCost - t.plannedCost) / t.plannedCost) * 100 : 0,
    };
  }, [byDepartment]);

  return {
    /** Raw query result from TanStack Query */
    ...query,
    /** Latest snapshot per shift (deduplicated) */
    snapshots: latestSnapshots,
    /** Cost summary aggregated by department */
    byDepartment,
    /** Overall totals across all departments */
    totals,
  };
}
