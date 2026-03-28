"use client";

/**
 * Query hook for workspace-wide pending absence requests.
 * Used by PendingAbsenceList to show admins what needs approval.
 * Fetches pending absences with employee profile data for display.
 */

import { useQuery } from "@tanstack/react-query";

import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";

import { scheduleKeys } from "./schedule-keys";

export type PendingAbsence = {
  id: string;
  employeeId: string;
  employeeName: string;
  absenceType: string;
  shiftDate: string;
  startDate: string;
  endDate: string;
  isFullDay: boolean;
  reason: string | null;
  createdAt: string;
};

export function usePendingAbsences() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: scheduleKeys.pendingAbsences(workspace.workspace_id),
    staleTime: 30 * 1000,
    queryFn: async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("schedule_absence")
        .select(`
          schedule_absence_id,
          employee_id,
          absence_type,
          shift_date,
          start_date,
          end_date,
          is_full_day,
          reason,
          created_at,
          profile:employee_id(display_name)
        `)
        .eq("workspace_id", workspace.workspace_id)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((row): PendingAbsence => ({
        id: row.schedule_absence_id,
        employeeId: row.employee_id,
        employeeName:
          (row.profile as unknown as { display_name: string | null })
            ?.display_name ?? "–",
        absenceType: row.absence_type,
        shiftDate: row.shift_date,
        startDate: row.start_date,
        endDate: row.end_date,
        isFullDay: row.is_full_day,
        reason: row.reason,
        createdAt: row.created_at,
      }));
    },
  });
}
