/**
 * Shift swap mutation hooks — initiate, respond, and cancel.
 *
 * ADR-0132 (Mobile AI Routing): mobile MUST go through the web BFF. Direct
 * `supabase.rpc("initiate_shift_swap" | "respond_to_shift_swap" |
 * "cancel_shift_swap")` calls are FORBIDDEN from mobile — the BFF
 * re-derives identity server-side (ADR-0176 Invariant 3) and runs the C4
 * authority gate (ADR-0201) before invoking the underlying SECURITY
 * DEFINER RPC via a JWT-scoped client.
 *
 * ADR-0176 Invariant 3: the request body MUST NOT contain workspace_id,
 * profile_id, or actor_id. The server binds identity to the authenticated
 * Supabase session.
 *
 * Follows the useCallback pattern used by existing mobile mutation hooks
 * (e.g. use-create-shift.ts) rather than useMutation.
 *
 * NOTE: getProfileContext() is still used for LOCAL telemetry emit — the
 * server derives identity independently for the write path. Task D of
 * the shift-swap-harness sortie will fold telemetry into the BFF; this
 * hook continues to emit() on the client in the interim (no regression
 * vs pre-refactor behaviour).
 */

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { getProfileContext } from "@/lib/profile-context";
import {
  getShiftSwapCancelUrl,
  getShiftSwapInitiateUrl,
  getShiftSwapRespondUrl,
} from "@/lib/web-api";
import { emit } from "@smartout/telemetry";

// ── Shared Bearer fetch helper ─────────────────────────────────────────────
// Identity fields are NEVER part of the body (ADR-0176 Invariant 3). The
// BFF re-derives workspace_id + profile_id from the authenticated session.

async function bffPost<TBody extends Record<string, unknown>>(
  url: string,
  body: TBody,
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Ikke innlogget.");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let msg = `BFF ${res.status}`;
    try {
      const parsed = (await res.json()) as { error?: string };
      if (parsed?.error) msg = parsed.error;
    } catch {
      const text = await res.text().catch(() => "");
      if (text) msg = text;
    }
    throw new Error(msg);
  }
}

// ── Initiate Swap ──────────────────────────────────────────────────────────

type InitiateSwapPayload = {
  requester_shift_id: string;
  target_profile_id: string;
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

  const initiateSwap = useCallback(
    async (payload: InitiateSwapPayload): Promise<void> => {
      setIsSubmitting(true);

      try {
        // Resolve BEFORE BFF so broken attribution fails fast (ADR-0134).
        // Used for LOCAL emit only — server-side identity is re-derived by
        // the BFF (ADR-0176 Invariant 3).
        const { profileId, workspaceId } = await getProfileContext();

        await bffPost(getShiftSwapInitiateUrl(), {
          requester_shift_id: payload.requester_shift_id,
          target_profile_id: payload.target_profile_id,
          target_shift_id: payload.target_shift_id,
          reason: payload.reason ?? null,
        });

        // Invalidate relevant queries
        void queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
        void queryClient.invalidateQueries({ queryKey: ["my-shifts"] });

        void emit({
          event: "shift_swap.requested",
          workspace_id: workspaceId,
          actor_id: profileId,
          properties: {
            entity_type: "shift",
            entity_id: payload.requester_shift_id,
            data: {
              swap_id: payload.requester_shift_id,
              requester_shift_id: payload.requester_shift_id,
              target_shift_id: payload.target_shift_id,
              target_profile_id: payload.target_profile_id,
            },
          },
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [queryClient],
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

  const respondToSwap = useCallback(
    async (payload: RespondToSwapPayload): Promise<void> => {
      setIsSubmitting(true);

      try {
        // Resolve BEFORE BFF so broken attribution fails fast (ADR-0134).
        const { profileId, workspaceId } = await getProfileContext();

        await bffPost(getShiftSwapRespondUrl(), {
          swap_id: payload.engine_state_id,
          accepted: payload.accepted,
          reason: payload.rejection_reason ?? null,
        });

        void queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
        void queryClient.invalidateQueries({ queryKey: ["my-shifts"] });

        if (payload.accepted) {
          void emit({
            event: "shift_swap.accepted",
            workspace_id: workspaceId,
            actor_id: profileId,
            properties: {
              entity_type: "shift",
              entity_id: payload.engine_state_id,
              data: { swap_id: payload.engine_state_id },
            },
          });
        } else {
          void emit({
            event: "shift_swap.rejected",
            workspace_id: workspaceId,
            actor_id: profileId,
            properties: {
              entity_type: "shift",
              entity_id: payload.engine_state_id,
              data: { swap_id: payload.engine_state_id, rejected_by: profileId },
            },
          });
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [queryClient],
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

  const cancelSwap = useCallback(
    async (payload: CancelSwapPayload): Promise<void> => {
      setIsSubmitting(true);

      try {
        // Resolve BEFORE BFF so broken attribution fails fast (ADR-0134).
        const { profileId, workspaceId } = await getProfileContext();

        await bffPost(getShiftSwapCancelUrl(), {
          swap_id: payload.engine_state_id,
        });

        void queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
        void queryClient.invalidateQueries({ queryKey: ["my-shifts"] });

        void emit({
          event: "shift_swap.cancelled",
          workspace_id: workspaceId,
          actor_id: profileId,
          properties: {
            entity_type: "shift",
            entity_id: payload.engine_state_id,
            data: { swap_id: payload.engine_state_id },
          },
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [queryClient],
  );

  return { cancelSwap, isSubmitting };
}
