"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

export type ProcedureStepWithTraining = {
  stepId: string;
  title: string;
  description: string;
  trainingContent: string | null;
  mediaUrls: Array<{ type: "image" | "video"; url: string; caption: string }> | null;
  estimatedMinutes: number | null;
  isRequired: boolean;
  stepOrder: number;
};

export function useProcedureSteps(procedureId: string | undefined) {
  return useQuery({
    queryKey: ["procedure-steps", procedureId],
    enabled: !!procedureId,
    queryFn: async (): Promise<ProcedureStepWithTraining[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("procedure_step")
        .select(
          "step_id, title, description, training_content, media_urls, estimated_minutes, is_required, step_order",
        )
        .eq("procedure_id", procedureId!)
        .order("step_order");

      if (error) throw error;

      return (data ?? []).map((s) => ({
        stepId: s.step_id,
        title: s.title,
        description: s.description,
        trainingContent: s.training_content,
        mediaUrls: s.media_urls as ProcedureStepWithTraining["mediaUrls"],
        estimatedMinutes: s.estimated_minutes,
        isRequired: s.is_required,
        stepOrder: s.step_order,
      }));
    },
  });
}
