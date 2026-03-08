"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";
import type { JourneyPhase, JourneyStep, ProtocolJourneyData } from "./dashboard-types";

/**
 * Fetches journey data for a specific protocol assignment: phases and steps.
 * Builds three phases: Laer (procedures), Test (knowledge_test), Signer (confirmation).
 * Queries real completion tables: procedure_step_completion, knowledge_test_attempt, confirmation_signature.
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

      // ── Completion queries ──────────────────────────────────
      // Query procedure_step_completion for completed steps
      const allStepIds: string[] = [];
      for (const proc of procedures ?? []) {
        const procSteps = (proc.procedure_step ?? []) as Array<{ step_id: string }>;
        for (const ps of procSteps) {
          allStepIds.push(ps.step_id);
        }
      }

      let completedStepIds: Set<string> = new Set();
      if (allStepIds.length > 0 && assignmentId) {
        const { data: completions } = await supabase
          .from("procedure_step_completion")
          .select("procedure_step_id")
          .eq("protocol_assignment_id", assignmentId!)
          .in("procedure_step_id", allStepIds);

        completedStepIds = new Set(
          (completions ?? []).map((c: { procedure_step_id: string }) => c.procedure_step_id),
        );
      }

      // Query knowledge_test_attempt for passed tests
      let passedTestCount = 0;
      if ((testCount ?? 0) > 0 && assignmentId) {
        const { count: passedCount } = await supabase
          .from("knowledge_test_attempt")
          .select("id", { count: "exact", head: true })
          .eq("protocol_assignment_id", assignmentId!)
          .eq("passed", true);

        passedTestCount = passedCount ?? 0;
      }

      // Query confirmation_signature for signed confirmations
      let signedConfirmCount = 0;
      if ((confirmCount ?? 0) > 0 && assignmentId) {
        const { count: signedCount } = await supabase
          .from("confirmation_signature")
          .select("id", { count: "exact", head: true })
          .eq("protocol_assignment_id", assignmentId!);

        signedConfirmCount = signedCount ?? 0;
      }

      // ── Build steps ─────────────────────────────────────────
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
            isCompleted: completedStepIds.has(step.step_id),
          });
        }
      }

      // Sort steps by step_order
      steps.sort((a, b) => a.stepOrder - b.stepOrder);

      // ── Compute readiness ───────────────────────────────────
      const completedSteps = completedStepIds.size;
      const totalTests = testCount ?? 0;
      const totalConfirmations = confirmCount ?? 0;
      const totalItems = totalProcedureSteps + totalTests + totalConfirmations;

      const readinessScore =
        totalItems > 0 ? (completedSteps + passedTestCount + signedConfirmCount) / totalItems : 0;

      // ── Build phases ────────────────────────────────────────
      const procedureStatus: JourneyPhase["status"] =
        totalProcedureSteps === 0
          ? "completed"
          : completedSteps === totalProcedureSteps
            ? "completed"
            : completedSteps > 0
              ? "in_progress"
              : "not_started";

      const testStatus: JourneyPhase["status"] =
        totalTests === 0
          ? "completed"
          : passedTestCount === totalTests
            ? "completed"
            : passedTestCount > 0
              ? "in_progress"
              : "not_started";

      const confirmStatus: JourneyPhase["status"] =
        totalConfirmations === 0
          ? "completed"
          : signedConfirmCount === totalConfirmations
            ? "completed"
            : signedConfirmCount > 0
              ? "in_progress"
              : "not_started";

      const phases: JourneyPhase[] = [
        {
          name: "Laer",
          type: "procedures",
          total: totalProcedureSteps,
          completed: completedSteps,
          status: procedureStatus,
        },
        {
          name: "Test",
          type: "test",
          total: totalTests,
          completed: passedTestCount,
          status: testStatus,
        },
        {
          name: "Signer",
          type: "confirmation",
          total: totalConfirmations,
          completed: signedConfirmCount,
          status: confirmStatus,
        },
      ];

      return { phases, steps, readinessScore, isCompleted: readinessScore === 1 };
    },
  });
}
