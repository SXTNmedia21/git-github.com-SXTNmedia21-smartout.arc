"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";
import type { DayCoverage } from "./dashboard-types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Fetches staffing coverage for 7 days starting from weekStart.
 * Groups shifts by date and calculates fill percentage.
 * Connected to: TacticalView staffing bars
 */
export function useStaffingCoverage(weekStart: string) {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: dashboardKeys.staffingCoverage(workspaceId ?? "none", weekStart),
    enabled: !!workspaceId,
    staleTime: 2 * 60 * 1000, // 2 minutes — volatile staffing coverage
    queryFn: async (): Promise<DayCoverage[]> => {
      const wsId = workspaceId!;
      const supabase = createClient();

      const startDate = new Date(weekStart);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      const weekEnd = endDate.toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("schedule_shift")
        .select("shift_date, employee_id")
        .eq("workspace_id", wsId)
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd!)
        .order("shift_date", { ascending: true });

      if (error) throw error;

      // Group by date
      const byDate = new Map<string, { total: number; assigned: number }>();

      // Initialize all 7 days
      for (let i = 0; i < 7; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        byDate.set(dateStr!, { total: 0, assigned: 0 });
      }

      for (const shift of data ?? []) {
        const entry = byDate.get(shift.shift_date);
        if (entry) {
          entry.total++;
          if (shift.employee_id) entry.assigned++;
        }
      }

      const result: DayCoverage[] = [];
      for (const [date, counts] of byDate) {
        const dayOfWeek = new Date(date).getUTCDay();
        result.push({
          date,
          dayLabel: DAY_LABELS[dayOfWeek]!,
          totalShifts: counts.total,
          assignedShifts: counts.assigned,
          fillPercent: counts.total > 0 ? Math.round((counts.assigned / counts.total) * 100) : 100,
        });
      }

      return result;
    },
  });
}

/**
 * Returns the ISO date string for the Monday of the current week.
 */
export function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  return monday.toISOString().split("T")[0]!;
}
