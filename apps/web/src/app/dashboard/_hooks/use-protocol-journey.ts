"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";
import type { JourneyPhase, JourneyStep, ProtocolJourneyData } from "./dashboard-types";

/**
 * Fetches journey data for a specific protocol assignment: phases and steps.
 * Builds three phases: Lær (procedures), Test (knowledge_test), Signér (confirmation).
 * NOTE: Step completion is NOT tracked in DB yet — isCompleted is always false for MVP.
 * Connected to: EmployeeJourneyMap component
 */
export function useProtocolJourney(protocolId: string | null, assignmentId: string | null) {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: dashboardKeys.protocolJourney(workspaceId ?? "none", assignmentId ?? "none"),
    enabled: !!workspaceId && !!protocolId && !!assignmentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    queryFn: async (): Promise<ProtocolJourneyData> => {
      const supabase = createClient();

      // Fetch procedures with steps
      const { data: procedures, error: procError } = await supabase
        .from("procedure")
        .select(
          "procedure_id, name, sort_order, procedure_step(step_id, title, description, step_order, is_required, estimated_minutes)",
        )
        .eq("protocol_id", protocolId!)
        .eq("is_active", true)
        .order("sort_order");

      if (procError) throw procError;

      // Fetch knowledge_test count
      const { count: testCount, error: testError } = await supabase
        .from("knowledge_test")
        .select("knowledge_test_id", { count: "exact", head: true })
        .eq("protocol_id", protocolId!)
        .eq("is_active", true);

      if (testError) throw testError;

      // Fetch confirmation count
      const { count: confirmCount, error: confirmError } = await supabase
        .from("confirmation")
        .select("confirmation_id", { count: "exact", head: true })
        .eq("protocol_id", protocolId!)
        .eq("is_active", true);

      if (confirmError) throw confirmError;

      // Build steps from all procedures
      const steps: JourneyStep[] = [];
      let totalProcedureSteps = 0;

      for (const proc of procedures ?? []) {
        const procSteps = (proc.procedure_step ?? []) as Array<{
          step_id: string;
          title: string;
          description: string;
          step_order: number;
          is_required: boolean;
          estimated_minutes: number | null;
        }>;

        totalProcedureSteps += procSteps.length;

        for (const step of procSteps) {
          steps.push({
            stepId: step.step_id,
            title: step.title,
            description: step.description,
            stepOrder: step.step_order,
            isRequired: step.is_required,
            estimatedMinutes: step.estimated_minutes,
            isCompleted: false, // MVP: not tracked in DB yet
          });
        }
      }

      // Sort steps by step_order
      steps.sort((a, b) => a.stepOrder - b.stepOrder);

      // Build phases
      const phases: JourneyPhase[] = [
        {
          name: "Lær",
          type: "procedures",
          total: totalProcedureSteps,
          completed: 0, // MVP: not tracked
          status: totalProcedureSteps > 0 ? "not_started" : "completed",
        },
        {
          name: "Test",
          type: "test",
          total: testCount ?? 0,
          completed: 0, // MVP: not tracked
          status: (testCount ?? 0) > 0 ? "not_started" : "completed",
        },
        {
          name: "Signér",
          type: "confirmation",
          total: confirmCount ?? 0,
          completed: 0, // MVP: not tracked
          status: (confirmCount ?? 0) > 0 ? "not_started" : "completed",
        },
      ];

      return { phases, steps };
    },
  });
}
