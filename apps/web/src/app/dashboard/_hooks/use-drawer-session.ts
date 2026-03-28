"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";

export function useDrawerSession(sessionId: string) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: dashboardKeys.drawerSession(wsId ?? "none", sessionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("department_session")
        .select(
          "department_session_id, session_date, status, planned_shifts, actual_shifts, tasks_completed, tasks_total, planned_open, planned_close, department:department!department_id(name)",
        )
        .eq("department_session_id", sessionId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!wsId && !!sessionId,
    staleTime: 30_000,
  });
}
