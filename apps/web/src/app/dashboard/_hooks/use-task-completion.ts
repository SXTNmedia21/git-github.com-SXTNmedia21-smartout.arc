"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";

export type TaskCompletionData = {
  total: number;
  completed: number;
  rate: number;
};

/**
 * Fetches task completion rate from session_task for the current workspace.
 * Counts all tasks from today's department_sessions.
 */
export function useTaskCompletion() {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: dashboardKeys.taskCompletion(workspaceId ?? "none"),
    enabled: !!workspaceId,
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<TaskCompletionData> => {
      const supabase = createClient();
      const today = new Date().toISOString().split("T")[0]!;

      const { data, error } = await supabase
        .from("session_task")
        .select("task_status, department_session!inner(workspace_id, session_date)")
        .eq("department_session.workspace_id" as never, workspaceId!)
        .eq("department_session.session_date" as never, today);

      if (error) throw error;

      const tasks = (data ?? []) as unknown as { task_status: string }[]; // SAFETY: Supabase join returns union type; runtime shape matches the cast
      const total = tasks.length;
      const completed = tasks.filter((t) => t.task_status === "completed").length;

      return {
        total,
        completed,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    },
  });
}
