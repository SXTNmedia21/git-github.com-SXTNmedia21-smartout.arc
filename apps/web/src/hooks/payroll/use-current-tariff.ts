/**
 * Hook: fetch the current tariff binding for the workspace.
 *
 * Calls GET /api/payroll/tariff/current (BFF route from Phase 7e Track 1).
 * Response shape is owned by @smartout/types payroll-tariff-bff-contract.
 *
 * Returns:
 *  - data: CurrentTariffResponse if the BFF responded ok:true
 *  - isLoading / error: standard TanStack Query flags
 *
 * Key: ["payroll", "tariff", "current", workspaceId] — granular enough for
 * targeted invalidation from ChangeBindingForm / AddSupplementForm mutations
 * without blowing the entire payroll cache.
 *
 * ADR-0151: workspace_id comes from WorkspaceContext (server-resolved JWT path).
 * ADR-0152: BFF errors are parsed and surfaced via the error field.
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import type { CurrentTariffResponse } from "@smartout/types";
import { PAYROLL_TARIFF_BFF_ROUTES } from "@smartout/types";

export const tariffKeys = {
  all: ["payroll", "tariff"] as const,
  current: (workspaceId: string) => ["payroll", "tariff", "current", workspaceId] as const,
};

const STALE_TIME_MS = 5 * 60 * 1000; // 5 minutes — tariff changes are infrequent

async function fetchCurrentTariff(): Promise<CurrentTariffResponse> {
  const res = await fetch(PAYROLL_TARIFF_BFF_ROUTES.current, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: Kunne ikke hente tariffbinding`);
  }

  return (await res.json()) as CurrentTariffResponse;
}

export function useCurrentTariff() {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  return useQuery<CurrentTariffResponse>({
    queryKey: tariffKeys.current(workspaceId ?? "none"),
    queryFn: fetchCurrentTariff,
    enabled: !!workspaceId,
    staleTime: STALE_TIME_MS,
    retry: 1,
  });
}
