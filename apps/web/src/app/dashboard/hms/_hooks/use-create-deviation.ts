"use client";

import { useContext } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspace } from "@/lib/workspace-context";
import { DeviationPayloadSchema, type DeviationPayload } from "@smartout/hms";
import { toast } from "sonner";

export function useCreateDeviation() {
  const { profileId } = useContext(DashboardContext);
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<DeviationPayload, "workspace_id" | "reported_by">) => {
      const payload: DeviationPayload = {
        ...input,
        workspace_id: workspace.workspace_id,
        reported_by: profileId,
      };

      const validated = DeviationPayloadSchema.parse(payload);

      const supabase = createClient();
      const { data, error } = await supabase
        .from("deviation")
        .insert({
          title: validated.title,
          domain: validated.domain,
          severity: validated.severity,
          description: validated.description ?? null,
          workspace_id: validated.workspace_id,
          department_id: validated.department_id ?? null,
          session_id: validated.session_id ?? null,
          source_task_id: validated.source_task_id ?? null,
          procedure_id: validated.procedure_id ?? null,
          protocol_id: validated.protocol_id ?? null,
          linked_shift_id: validated.linked_shift_id ?? null,
          reported_by: validated.reported_by ?? null,
          status: "open",
          requires_action: true,
          blocks_day_approval: validated.severity === "critical",
          payroll_impact: false,
        })
        .select("deviation_id")
        .single();

      if (error) throw error;
      return data.deviation_id;
    },
    onSuccess: (deviationId, variables) => {
      void emit({
        event: "deviation reported",
        workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity: { entity_type: "deviation", entity_id: deviationId },
          data: { domain: variables.domain, severity: variables.severity },
        },
      });
      queryClient.invalidateQueries({ queryKey: ["hms", "deviations"] });
      toast.success("Avvik meldt");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke melde avvik: ${error.message}`);
    },
  });
}
