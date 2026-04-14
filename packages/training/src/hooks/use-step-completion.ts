// packages/training/src/hooks/use-step-completion.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@smartout/supabase";
import { emit } from "@smartout/telemetry";
import { trainingKeys } from "./keys.js";

type TrainingMutationContext = {
  supabase: SupabaseClient;
  workspaceId: string;
  profileId: string;
};

// ── Complete a procedure step ───────────────────────────────────

type CompleteStepInput = {
  procedureStepId: string;
  protocolAssignmentId: string;
};

export function useCompleteStep(ctx: TrainingMutationContext) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ procedureStepId, protocolAssignmentId }: CompleteStepInput) => {
      const { data, error } = await ctx.supabase
        .from("procedure_step_completion")
        .insert({
          procedure_step_id: procedureStepId,
          profile_id: ctx.profileId,
          protocol_assignment_id: protocolAssignmentId,
          workspace_id: ctx.workspaceId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { procedureStepId }) => {
      void emit({
        event: "protocol step_completed",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: { data: { procedure_step_id: procedureStepId, profile_id: ctx.profileId } },
      });
      toast.success("Steg fullført!");
      void queryClient.invalidateQueries({
        queryKey: trainingKeys.assignedProtocols(ctx.profileId),
      });
    },
    onError: () => {
      toast.error("Kunne ikke fullføre steg");
    },
  });
}

// ── Submit a knowledge test ─────────────────────────────────────

type SubmitTestInput = {
  knowledgeTestId: string;
  protocolAssignmentId: string;
  answers: Record<string, string>;
  score: number;
  passed: boolean;
};

export function useSubmitTest(ctx: TrainingMutationContext) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      knowledgeTestId,
      protocolAssignmentId,
      answers,
      score,
      passed,
    }: SubmitTestInput) => {
      const { data, error } = await ctx.supabase
        .from("knowledge_test_attempt")
        .insert({
          knowledge_test_id: knowledgeTestId,
          profile_id: ctx.profileId,
          protocol_assignment_id: protocolAssignmentId,
          answers: answers as unknown as Json,
          score,
          passed,
          workspace_id: ctx.workspaceId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { knowledgeTestId, passed }) => {
      void emit({
        event: "protocol test_submitted",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          data: { knowledge_test_id: knowledgeTestId, profile_id: ctx.profileId, passed },
        },
      });
      if (passed) {
        toast.success("Bestått! Godt jobbet.");
      } else {
        toast.warning("Ikke bestått. Prøv igjen.");
      }
      void queryClient.invalidateQueries({
        queryKey: trainingKeys.assignedProtocols(ctx.profileId),
      });
    },
    onError: () => {
      toast.error("Kunne ikke sende inn test");
    },
  });
}

// ── Sign a confirmation ─────────────────────────────────────────

type SignConfirmationInput = {
  confirmationId: string;
  protocolAssignmentId: string;
  signatureData: Record<string, unknown>;
};

export function useSignConfirmation(ctx: TrainingMutationContext) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      confirmationId,
      protocolAssignmentId,
      signatureData,
    }: SignConfirmationInput) => {
      const { data, error } = await ctx.supabase
        .from("confirmation_signature")
        .insert({
          confirmation_id: confirmationId,
          profile_id: ctx.profileId,
          protocol_assignment_id: protocolAssignmentId,
          signature_data: signatureData as unknown as Json,
          workspace_id: ctx.workspaceId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { confirmationId }) => {
      void emit({
        event: "protocol confirmation_signed",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: { data: { confirmation_id: confirmationId, profile_id: ctx.profileId } },
      });
      toast.success("Signatur registrert!");
      void queryClient.invalidateQueries({
        queryKey: trainingKeys.assignedProtocols(ctx.profileId),
      });
    },
    onError: () => {
      toast.error("Kunne ikke registrere signatur");
    },
  });
}
