"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspaceOptional } from "@/lib/workspace-context";

export type ShiftDayStats = {
  total: number;
  onShift: number;
  coming: number;
  done: number;
  plannedHours: number;
};

/**
 * useShiftDayStats — workspace-wide counts of today's shifts grouped by punch state.
 *
 * Bypasses L-0064 trap (`schedule_shift.department_id` nullable) by NOT filtering
 * on `department_id`. Department-level breakdown lives in `useRoster` for now.
 *
 * Joins `timesheet.time_entry` to derive status:
 *   - active  → punch_in set, no punch_out
 *   - done    → punch_out set
 *   - coming  → no time_entry yet
 */
export function useShiftDayStats(dateISO: string) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: ["day-control", "shift-day-stats", wsId, dateISO],
    enabled: !!wsId && !!dateISO,
    staleTime: 20 * 1000,
    queryFn: async (): Promise<ShiftDayStats> => {
      const supabase = createClient();

      const { data: shifts } = await supabase
        .from("schedule_shift")
        .select("schedule_shift_id, status, work_hours")
        .eq("workspace_id", wsId!)
        .eq("shift_date", dateISO)
        .not("employee_id", "is", null);

      const list = shifts ?? [];
      if (list.length === 0) {
        return { total: 0, onShift: 0, coming: 0, done: 0, plannedHours: 0 };
      }

      const shiftIds = list.map((s) => s.schedule_shift_id);
      const { data: entries } = await supabase
        .schema("timesheet")
        .from("time_entry")
        .select("shift_id, punch_in, punch_out")
        .in("shift_id", shiftIds);

      const entryByShift = new Map((entries ?? []).map((e) => [e.shift_id, e] as const));

      let onShift = 0;
      let coming = 0;
      let done = 0;
      let plannedHours = 0;

      for (const s of list) {
        plannedHours += Number(s.work_hours ?? 0);
        const entry = entryByShift.get(s.schedule_shift_id);
        if (s.status === "completed" || entry?.punch_out) {
          done += 1;
        } else if (entry?.punch_in) {
          onShift += 1;
        } else {
          coming += 1;
        }
      }

      return { total: list.length, onShift, coming, done, plannedHours };
    },
  });
}
