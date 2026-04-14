/**
 * Shift swap mutation hooks — initiate, respond, and cancel.
 *
 * All three RPCs are SECURITY DEFINER and must be called with `as never` casts
 * since Supabase codegen doesn't expose them in the typed client.
 *
 * Follows the useCallback pattern used by existing mobile mutation hooks
 * (e.g. use-create-shift.ts) rather than useMutation.
 */

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useWorkspaceStore } from "@/hooks/stores/use-workspace-store";
import { emit } from "@smartout/telemetry";

// ── Initiate Swap ──────────────────────────────────────────────────────────

type InitiateSwapPayload = {
  requester_shift_id: string;
  target_shift_id: string;
  reason?: string;
};

type UseInitiateSwapReturn = {
  initiateSwap: (payload: InitiateSwapPayload) => Promise<void>;
  isSubmitting: boolean;
};

export function useInitiateSwap(): UseInitiateSwapReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const selectedProfileId = useWorkspaceStore((s) => s.selectedProfileId);

  const initiateSwap = useCallback(
    async (payload: InitiateSwapPayload): Promise<void> => {
      setIsSubmitting(true);

      try {
        const { error } = await supabase.rpc("initiate_shift_swap" as never, {
          p_requester_shift_id: payload.requester_shift_id,
          p_target_shift_id: payload.target_shift_id,
          p_reason: payload.reason ?? null,
        } as never);

        if (error) throw error;

        // Invalidate relevant queries
        void queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
        void queryClient.invalidateQueries({ queryKey: ["my-shifts"] });

        void emit({
          event: "shift swap_requested",
          workspace_id: "",
          actor_id: selectedProfileId ?? "",
          properties: {
            entity: { entity_type: "shift_swap", entity_id: payload.requester_shift_id },
            data: {
              requester_shift_id: payload.requester_shift_id,
              target_shift_id: payload.target_shift_id,
            },
          },
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [queryClient, selectedProfileId],
  );

  return { initiateSwap, isSubmitting };
}

// ── Respond to Swap ────────────────────────────────────────────────────────

type RespondToSwapPayload = {
  engine_state_id: string;
  accepted: boolean;
  rejection_reason?: string;
};

type UseRespondToSwapReturn = {
  respondToSwap: (payload: RespondToSwapPayload) => Promise<void>;
  isSubmitting: boolean;
};

export function useRespondToSwap(): UseRespondToSwapReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const selectedProfileId = useWorkspaceStore((s) => s.selectedProfileId);

  const respondToSwap = useCallback(
    async (payload: RespondToSwapPayload): Promise<void> => {
      setIsSubmitting(true);

      try {
        const { error } = await supabase.rpc("respond_to_shift_swap" as never, {
          p_engine_state_id: payload.engine_state_id,
          p_accepted: payload.accepted,
          p_rejection_reason: payload.rejection_reason ?? null,
        } as never);

        if (error) throw error;

        void queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
        void queryClient.invalidateQueries({ queryKey: ["my-shifts"] });

        const eventName = payload.accepted ? "shift swap_accepted" : "shift swap_rejected";
        void emit({
          event: eventName,
          workspace_id: "",
          actor_id: selectedProfileId ?? "",
          properties: {
            entity: { entity_type: "shift_swap", entity_id: payload.engine_state_id },
            data: { accepted: payload.accepted },
          },
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [queryClient, selectedProfileId],
  );

  return { respondToSwap, isSubmitting };
}

// ── Cancel Swap ────────────────────────────────────────────────────────────

type CancelSwapPayload = {
  engine_state_id: string;
};

type UseCancelSwapReturn = {
  cancelSwap: (payload: CancelSwapPayload) => Promise<void>;
  isSubmitting: boolean;
};

export function useCancelSwap(): UseCancelSwapReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const selectedProfileId = useWorkspaceStore((s) => s.selectedProfileId);

  const cancelSwap = useCallback(
    async (payload: CancelSwapPayload): Promise<void> => {
      setIsSubmitting(true);

      try {
        const { error } = await supabase.rpc("cancel_shift_swap" as never, {
          p_engine_state_id: payload.engine_state_id,
        } as never);

        if (error) throw error;

        void queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
        void queryClient.invalidateQueries({ queryKey: ["my-shifts"] });

        void emit({
          event: "shift swap_cancelled",
          workspace_id: "",
          actor_id: selectedProfileId ?? "",
          properties: {
            entity: { entity_type: "shift_swap", entity_id: payload.engine_state_id },
            data: {},
          },
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [queryClient, selectedProfileId],
  );

  return { cancelSwap, isSubmitting };
}
