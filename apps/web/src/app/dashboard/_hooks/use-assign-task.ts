"use client";

/**
 * useAssignTask — Updates a session_task's assigned_to field and emits telemetry.
 * Used by the task assignment control on the dashboard.
 * Invalidates all dashboard queries on success so related widgets reflect the change.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { emit } from "@smartout/telemetry";
import { toast } from "sonner";

type AssignTaskInput = {
  taskId: string;
  assignedTo: string;
  assigneeName: string;
  profileId: string;
};

export function useAssignTask() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AssignTaskInput) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("session_task")
        .update({ assigned_to: input.assignedTo })
        .eq("session_task_id", input.taskId);

      if (error) throw error;
    },
    onSuccess: (_data, input) => {
      void emit({
        event: "session_task.assigned",
        workspace_id: workspace.workspace_id,
        actor_id: input.profileId,
        properties: {
          entity: {
            entity_type: "session_task",
            entity_id: input.taskId,
          },
          metadata: { source: "dashboard_inline", assigned_to: input.assignedTo },
        },
      });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(input.assigneeName);
    },
  });
}
