"use client";

/**
 * use-marketplace.ts
 *
 * TanStack Query hooks for the manager marketplace view.
 *
 * Queries:
 *   useMarketplaceOffers  — fetches open/claimed/approved offers from web BFF.
 *
 * Mutations:
 *   useApproveClaim       — manager approves a claimed offer (POST /api/marketplace/action).
 *   useCancelOffer        — manager cancels an open or claimed offer.
 *
 * Auth: cookie-session (web dashboard). BFF derives identity server-side (ADR-0151).
 * Telemetry: emit() runs inside the BFF after successful mutation (ADR-0134).
 *
 * ADR-0328: 409 PIPELINE_LOCK_HELD responses surface as a discriminated
 * sonner toast (5 s, dismiss button) instead of a generic error string.
 *
 * References:
 *   ADR-0099  (gate_action — enforced in BFF)
 *   ADR-0134  (emit on mutation — enforced in BFF)
 *   ADR-0151  (server-derived identity)
 *   ADR-0306  (shift_marketplace V1)
 *   ADR-0328  (Norwegian friendly errors for pipeline lock contention)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import type { ManagerOffer, ManagerOffersResponse } from "@/app/api/marketplace/offers/route";

// ── Pipeline lock error envelope (ADR-0328) ──────────────────────────────────

const PipelineLockEnvelopeSchema = z.object({
  ok: z.literal(false),
  error: z.literal("PIPELINE_LOCK_HELD"),
  locking_blueprint_id: z.string().optional(),
});

type PipelineLockEnvelope = z.infer<typeof PipelineLockEnvelopeSchema>;

export class PipelineLockError extends Error {
  public readonly lockingBlueprintId: string | undefined;
  constructor(envelope: PipelineLockEnvelope) {
    super("PIPELINE_LOCK_HELD");
    this.name = "PipelineLockError";
    this.lockingBlueprintId = envelope.locking_blueprint_id;
  }
}

/** Norwegian toast copy discriminated by locking blueprint (ADR-0328). */
function showPipelineLockToast(lockingBlueprintId: string | undefined): void {
  let message: string;

  if (lockingBlueprintId === "shift_swap_lifecycle") {
    // marketplace-on-swap: manager tried to act on an offer but the shift is
    // already in the shift-swap pipeline
    message = "Vakten er allerede i en bytteforespørsel";
  } else if (lockingBlueprintId === "marketplace_lifecycle") {
    // same-capability-double: two concurrent marketplace operations
    message = "Det finnes allerede en åpen flyt på denne vakten";
  } else {
    message = "Vakten er allerede i en aktiv flyt";
  }

  toast.error(message, { duration: 5000, dismissible: true });
}

// ── Query key ────────────────────────────────────────────────────────────────
const MARKETPLACE_KEY = ["dashboard", "schedule", "marketplace"] as const;

// ── BFF fetch helper ─────────────────────────────────────────────────────────
async function bffGet<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    let msg = `BFF ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

async function bffPost<TBody extends Record<string, unknown>, T = unknown>(
  path: string,
  body: TBody,
): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 409) {
    let envelope: unknown;
    try {
      envelope = await res.json();
    } catch {
      envelope = {};
    }
    const parsed = PipelineLockEnvelopeSchema.safeParse(envelope);
    if (parsed.success) {
      throw new PipelineLockError(parsed.data);
    }
    throw new Error(`BFF 409`);
  }

  if (!res.ok) {
    let msg = `BFF ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string; reason?: string };
      msg = j.reason ?? j.error ?? msg;
    } catch {
      const text = await res.text().catch(() => "");
      if (text) msg = text;
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function useMarketplaceOffers() {
  return useQuery<ManagerOffersResponse>({
    queryKey: MARKETPLACE_KEY,
    queryFn: () => bffGet<ManagerOffersResponse>("/api/marketplace/offers"),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useApproveClaim() {
  const qc = useQueryClient();

  return useMutation<{ ok: boolean; message?: string }, Error, { offerId: string }>({
    mutationFn: ({ offerId }) =>
      bffPost("/api/marketplace/action", {
        action: "approve_claim",
        offer_id: offerId,
      }),
    onSuccess: () => {
      toast.success("Krav godkjent — vakten er tildelt.");
      void qc.invalidateQueries({ queryKey: MARKETPLACE_KEY });
    },
    onError: (err) => {
      if (err instanceof PipelineLockError) {
        showPipelineLockToast(err.lockingBlueprintId);
        return;
      }
      toast.error(`Godkjenning feilet: ${err.message}`);
    },
  });
}

export function useCancelOffer() {
  const qc = useQueryClient();

  return useMutation<{ ok: boolean; message?: string }, Error, { offerId: string; reason: string }>(
    {
      mutationFn: ({ offerId, reason }) =>
        bffPost("/api/marketplace/action", {
          action: "cancel_offer",
          offer_id: offerId,
          reason,
        }),
      onSuccess: () => {
        toast.success("Tilbud kansellert.");
        void qc.invalidateQueries({ queryKey: MARKETPLACE_KEY });
      },
      onError: (err) => {
        if (err instanceof PipelineLockError) {
          showPipelineLockToast(err.lockingBlueprintId);
          return;
        }
        toast.error(`Kansellering feilet: ${err.message}`);
      },
    },
  );
}

export type { ManagerOffer, ManagerOffersResponse };
