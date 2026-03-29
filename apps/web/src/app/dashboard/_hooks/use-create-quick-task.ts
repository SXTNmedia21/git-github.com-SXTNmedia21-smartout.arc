"use client";

/**
 * useCreateQuickTask — Inserts a session_task and emits a telemetry event.
 * Used by the inline task creation panel on the dashboard.
 * Invalidates all dashboard queries on success so related widgets refresh.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { emit } from "@smartout/telemetry";
import { toast } from "sonner";

type CreateTaskInput = {
  title: string;
  department_session_id: string;
  assigned_to?: string;
  due_date?: string;
  profileId: string;
};

export function useCreateQuickTask() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("session_task")
        .insert({
          department_session_id: input.department_session_id,
          workspace_id: workspace.workspace_id,
          title: input.title,
          assigned_to: input.assigned_to ?? null,
          due_at: input.due_date ?? null,
          task_status: "pending",
        })
        .select("session_task_id")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, input) => {
      void emit({
        event: "session_task.created",
        workspace_id: workspace.workspace_id,
        actor_id: input.profileId,
        properties: {
          entity: {
            entity_type: "session_task",
            entity_id: data.session_task_id,
            entity_label: input.title,
          },
          metadata: { source: "dashboard_inline" },
        },
      });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(input.title);
    },
  });
}
