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
 * References:
 *   ADR-0099  (gate_action — enforced in BFF)
 *   ADR-0134  (emit on mutation — enforced in BFF)
 *   ADR-0151  (server-derived identity)
 *   ADR-0306  (shift_marketplace V1)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ManagerOffer, ManagerOffersResponse } from "@/app/api/marketplace/offers/route";

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
        toast.error(`Kansellering feilet: ${err.message}`);
      },
    },
  );
}

export type { ManagerOffer, ManagerOffersResponse };
