/**
 * use-current-tariff — fetches the workspace's current tariff binding.
 *
 * Calls GET /api/payroll/tariff/current via the web BFF (ADR-0132 — mobile
 * thin client, never calls capabilities directly). The BFF derives workspace_id
 * from the authenticated Supabase JWT (ADR-0151) — no identity fields in request.
 *
 * Response shape is validated client-side with the shared Zod contract schema
 * from @smartout/types (Phase 7e / payroll-tariff-bff-contract.ts).
 *
 * READ-ONLY — this hook performs no writes. ADR-0133 forbids authoring on
 * D1-D5 surfaces (union binding, law_version) from mobile.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getWebApiUrl } from "@/lib/web-api";
import {
  currentTariffResponseSchema,
  PAYROLL_TARIFF_BFF_ROUTES,
  type CurrentTariffResponse,
} from "@smartout/types";

/** How long before tariff data is considered stale — tariff bindings are low-churn */
const STALE_TIME_MS = 10 * 60 * 1000;

/**
 * The successful data shape — extracted for convenience in consuming components.
 * null when is_bound = false.
 */
export type CurrentTariffData = Extract<CurrentTariffResponse, { ok: true }>["data"];

async function fetchCurrentTariff(): Promise<CurrentTariffData> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Ikke innlogget.");

  const url = `${getWebApiUrl()}${PAYROLL_TARIFF_BFF_ROUTES.current}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    throw new Error(`BFF ${res.status}: ugyldig JSON-respons`);
  }

  // Validate response shape against the shared Zod contract
  const validated = currentTariffResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`BFF svarte med uventet format: ${validated.error.message}`);
  }

  const data = validated.data;
  if (!data.ok) {
    throw new Error(`${data.error.code}: ${data.error.message}`);
  }

  return data.data;
}

/**
 * Hook: returns the current tariff binding for the authenticated user's workspace.
 *
 * - is_bound = false → unbound workspace (show soft "no tariff" state, NOT an error)
 * - error state → BFF unavailable or auth failure (show error UI)
 * - loading → show skeleton
 */
export function useCurrentTariff() {
  return useQuery<CurrentTariffData>({
    queryKey: ["payroll", "tariff", "current"],
    queryFn: fetchCurrentTariff,
    staleTime: STALE_TIME_MS,
    retry: 1,
  });
}
