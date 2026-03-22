"use client";

import { useContext } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspace } from "@/lib/workspace-context";
import { toast } from "sonner";

type SignoffInput = {
  sessionId: string;
  departmentId: string;
  signoffNotes: string | null;
  date: string;
};

export function useSignoffSession() {
  const { profileId } = useContext(DashboardContext);
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, signoffNotes }: SignoffInput) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("department_session")
        .update({
          status: "closed" as const,
          closed_at: new Date().toISOString(),
          closed_by: profileId,
          signoff_notes: signoffNotes,
        })
        .eq("department_session_id", sessionId);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      void emit({
        event: "session closed",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          data: { department_id: variables.departmentId, date: variables.date },
        },
      });
      queryClient.invalidateQueries({
        queryKey: ["hms", "department-sessions"],
      });
      toast.success("Okt signert og lukket");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke signere okt: ${error.message}`);
    },
  });
}
