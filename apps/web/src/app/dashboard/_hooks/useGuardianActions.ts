"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "./dashboard-keys";

// ── Types ────────────────────────────────────────────────

type GuardianActionType = "acknowledge" | "resolve" | "dismiss";

type ActionResponse = {
  status: string;
  signal: Record<string, unknown>;
};

type AcknowledgeParams = { signalId: string; note?: string };
type ResolveParams = { signalId: string; resolution?: string };
type DismissParams = { signalId: string; reason?: string };

// ── Hook ─────────────────────────────────────────────────

/**
 * Provides mutations for guardian signal actions: acknowledge, resolve, dismiss.
 * Calls the guardian-actions Edge Function and invalidates the signals query on success.
 * Connected to: GuardianView signal feed
 */
export function useGuardianActions() {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;
  const queryClient = useQueryClient();

  const signalsQueryKey = dashboardKeys.guardianSignals(workspaceId ?? "none");

  async function invokeAction(
    action: GuardianActionType,
    signalId: string,
    extra?: Record<string, string | undefined>,
  ): Promise<ActionResponse> {
    const supabase = createClient();

    const { data, error } = await supabase.functions.invoke("guardian-actions", {
      body: { action, signalId, ...extra },
    });

    if (error) {
      throw new Error(error.message ?? "Guardian action failed");
    }

    return data as ActionResponse;
  }

  const acknowledgeMutation = useMutation({
    mutationFn: async ({ signalId, note }: AcknowledgeParams) =>
      invokeAction("acknowledge", signalId, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: signalsQueryKey });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ signalId, resolution }: ResolveParams) =>
      invokeAction("resolve", signalId, { resolution }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: signalsQueryKey });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async ({ signalId, reason }: DismissParams) =>
      invokeAction("dismiss", signalId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: signalsQueryKey });
    },
  });

  return {
    acknowledge: acknowledgeMutation.mutate,
    resolve: resolveMutation.mutate,
    dismiss: dismissMutation.mutate,
    isAcknowledging: acknowledgeMutation.isPending,
    isResolving: resolveMutation.isPending,
    isDismissing: dismissMutation.isPending,
    /** ID of the signal currently being acted on (for per-row loading states) */
    acknowledgingId: acknowledgeMutation.variables?.signalId ?? null,
    resolvingId: resolveMutation.variables?.signalId ?? null,
    dismissingId: dismissMutation.variables?.signalId ?? null,
  };
}
