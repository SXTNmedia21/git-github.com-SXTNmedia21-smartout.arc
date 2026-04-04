"use client";

import { useContext } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspace } from "@/lib/workspace-context";
import { toast } from "sonner";
type CompleteTaskInput = {
  taskId: string;
  sessionId: string;
  evidence?: Record<string, unknown>;
};

export function useCompleteTask() {
  const { profileId } = useContext(DashboardContext);
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, evidence }: CompleteTaskInput) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("session_task")
        .update({
          status: "completed" as const,
          completed_by: profileId,
          completed_at: new Date().toISOString(),
          evidence: (evidence ?? null) as unknown as Record<string, never>, // SAFETY: Supabase join returns union type; runtime shape matches the cast
        })
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      void emit({
        event: "session task_completed",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          data: { task_id: variables.taskId, profile_id: profileId ?? "" },
        },
      });
      queryClient.invalidateQueries({
        queryKey: ["hms", "session-tasks", variables.sessionId],
      });
      toast.success("Oppgave fullfort");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke fullforeoppgave: ${error.message}`);
    },
  });
}
