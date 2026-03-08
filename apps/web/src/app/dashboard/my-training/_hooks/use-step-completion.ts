"use client";

/**
 * TanStack Query mutations for completing training steps:
 * - Procedure step completion
 * - Knowledge test submission
 * - Confirmation signature
 *
 * Connected to: ProcedureStepper, KnowledgeTestView, ConfirmationSign
 */

import { useContext } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import type { Json } from "@smartout/supabase";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit } from "@smartout/telemetry";
import { myTrainingKeys } from "./use-assigned-protocols";

// ══════════════════════════════════════════════════════════════
// Mutation: Complete a procedure step
// ══════════════════════════════════════════════════════════════

type CompleteStepInput = {
  procedureStepId: string;
  protocolAssignmentId: string;
};

export function useCompleteStep() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  return useMutation({
    mutationFn: async ({ procedureStepId, protocolAssignmentId }: CompleteStepInput) => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("procedure_step_completion")
        .insert({
          procedure_step_id: procedureStepId,
          profile_id: profileId!,
          protocol_assignment_id: protocolAssignmentId,
          workspace_id: workspace.workspace_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    onSuccess: (_data, { procedureStepId }) => {
      void emit({
        event: "protocol step_completed",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          data: {
            procedure_step_id: procedureStepId,
            profile_id: profileId ?? "",
          },
        },
      });
      toast.success("Steg fullfort!");
      void queryClient.invalidateQueries({
        queryKey: myTrainingKeys.assignedProtocols(profileId ?? ""),
      });
    },

    onError: () => {
      toast.error("Kunne ikke fullore steg");
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Submit a knowledge test attempt
// ══════════════════════════════════════════════════════════════

type SubmitTestInput = {
  knowledgeTestId: string;
  protocolAssignmentId: string;
  answers: Record<string, string>;
  score: number;
  passed: boolean;
};

export function useSubmitTest() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  return useMutation({
    mutationFn: async ({
      knowledgeTestId,
      protocolAssignmentId,
      answers,
      score,
      passed,
    }: SubmitTestInput) => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("knowledge_test_attempt")
        .insert({
          knowledge_test_id: knowledgeTestId,
          profile_id: profileId!,
          protocol_assignment_id: protocolAssignmentId,
          answers: answers as unknown as Json,
          score,
          passed,
          workspace_id: workspace.workspace_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    onSuccess: (_data, { knowledgeTestId, passed }) => {
      void emit({
        event: "protocol test_submitted",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          data: {
            knowledge_test_id: knowledgeTestId,
            profile_id: profileId ?? "",
            passed,
          },
        },
      });
      if (passed) {
        toast.success("Bestatt! Godt jobbet.");
      } else {
        toast.warning("Ikke bestatt. Prov igjen.");
      }
      void queryClient.invalidateQueries({
        queryKey: myTrainingKeys.assignedProtocols(profileId ?? ""),
      });
    },

    onError: () => {
      toast.error("Kunne ikke sende inn test");
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Mutation: Sign a confirmation
// ══════════════════════════════════════════════════════════════

type SignConfirmationInput = {
  confirmationId: string;
  protocolAssignmentId: string;
  signatureData: Record<string, unknown>;
};

export function useSignConfirmation() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  return useMutation({
    mutationFn: async ({
      confirmationId,
      protocolAssignmentId,
      signatureData,
    }: SignConfirmationInput) => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("confirmation_signature")
        .insert({
          confirmation_id: confirmationId,
          profile_id: profileId!,
          protocol_assignment_id: protocolAssignmentId,
          signature_data: signatureData as unknown as Json,
          workspace_id: workspace.workspace_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    onSuccess: (_data, { confirmationId }) => {
      void emit({
        event: "protocol confirmation_signed",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          data: {
            confirmation_id: confirmationId,
            profile_id: profileId ?? "",
          },
        },
      });
      toast.success("Signatur registrert!");
      void queryClient.invalidateQueries({
        queryKey: myTrainingKeys.assignedProtocols(profileId ?? ""),
      });
    },

    onError: () => {
      toast.error("Kunne ikke registrere signatur");
    },
  });
}
