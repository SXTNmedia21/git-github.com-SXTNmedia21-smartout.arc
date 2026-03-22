"use client";

import { useContext } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspace } from "@/lib/workspace-context";
import type { DeviationStatus } from "@smartout/hms";
import { toast } from "sonner";

type UpdateDeviationInput =
  | { deviationId: string; action: "status"; status: DeviationStatus }
  | { deviationId: string; action: "resolve"; resolutionNotes: string };

export function useUpdateDeviation() {
  const { profileId } = useContext(DashboardContext);
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateDeviationInput) => {
      const supabase = createClient();

      if (input.action === "resolve") {
        const { error } = await supabase
          .from("deviation")
          .update({
            status: "resolved" as const,
            resolution_notes: input.resolutionNotes,
            resolved_by: profileId,
            resolved_at: new Date().toISOString(),
          })
          .eq("deviation_id", input.deviationId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("deviation")
          .update({ status: input.status })
          .eq("deviation_id", input.deviationId);
        if (error) throw error;
      }

      return input;
    },
    onSuccess: (result) => {
      const eventName = result.action === "resolve" ? "deviation resolved" : "deviation updated";
      void emit({
        event: eventName,
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          entity: { entity_type: "deviation", entity_id: result.deviationId },
          data:
            result.action === "resolve"
              ? { resolution_notes: result.resolutionNotes }
              : { status: result.status },
        },
      });
      queryClient.invalidateQueries({ queryKey: ["hms", "deviations"] });
      toast.success(result.action === "resolve" ? "Avvik lukket" : "Avvik oppdatert");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke oppdatere avvik: ${error.message}`);
    },
  });
}
