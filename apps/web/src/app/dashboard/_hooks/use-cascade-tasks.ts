"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";
import type { CascadeTasksResult } from "@smartout/types";

const EMPTY_RESULT: CascadeTasksResult = {
  groups: [],
  total_tasks: 0,
  critical_count: 0,
  should_count: 0,
};

export function useCascadeTasks() {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: dashboardKeys.cascadeTasks(workspaceId ?? "none"),
    enabled: !!workspaceId,
    staleTime: 30_000,
    refetchInterval: 5 * 60_000,
    queryFn: async (): Promise<CascadeTasksResult> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("resolve_cascade_tasks", {
        p_workspace_id: workspaceId!,
      });
      if (error) throw error;
      return (data as CascadeTasksResult) ?? EMPTY_RESULT;
    },
  });
}
