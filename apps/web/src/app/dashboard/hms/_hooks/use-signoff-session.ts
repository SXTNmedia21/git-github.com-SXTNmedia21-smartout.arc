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

      // Step 1: Transition to pending_signoff (triggers engine event via DB trigger)
      const { error: pendingError } = await supabase
        .from("department_session")
        .update({
          status: "pending_signoff" as const,
          signoff_notes: signoffNotes,
        })
        .eq("department_session_id", sessionId);

      if (pendingError) throw pendingError;

      // Step 2: Transition to closed (completes the lifecycle)
      const { error: closeError } = await supabase
        .from("department_session")
        .update({
          status: "closed" as const,
          closed_at: new Date().toISOString(),
          closed_by: profileId,
        })
        .eq("department_session_id", sessionId);

      if (closeError) throw closeError;
    },
    onSuccess: (_data, variables) => {
      void emit({
        event: "session closed",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "department_session",
            entity_id: variables.sessionId,
            entity_label: variables.date,
          },
          data: { department_id: variables.departmentId, date: variables.date },
        },
      });
      queryClient.invalidateQueries({
        queryKey: ["hms", "department-sessions"],
      });
      toast.success("Økt signert og lukket");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke signere økt: ${error.message}`);
    },
  });
}
