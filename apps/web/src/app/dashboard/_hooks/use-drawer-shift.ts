"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";

export function useDrawerShift(shiftId: string) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: dashboardKeys.drawerShift(wsId ?? "none", shiftId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_shift")
        .select(
          "schedule_shift_id, shift_date, start_time, end_time, work_hours, breaks, status, role, indicator, is_published, department_id, employee_id, position_id, employee:profile!employee_id(display_name), department:department!department_id(name)",
        )
        .eq("schedule_shift_id", shiftId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!wsId && !!shiftId,
    staleTime: 30_000,
  });
}
