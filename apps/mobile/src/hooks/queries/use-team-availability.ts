/**
 * useTeamAvailability — peer availability for managers / schedulers.
 *
 * ADR-0132: routes through the BFF (`/api/availability/query`), which
 * gates on `availability.query_others` (chat-only per ADR-0202) and
 * re-derives identity server-side (ADR-0176 Invariant 3).
 *
 * Employees with the default read_only authority still see peer rows —
 * the capability itself is the gate (seeded in Task H). Managers will
 * typically use this from a roster-admin screen (Sortie 3), but the
 * hook lives here so any surface that needs team data can consume it
 * without a second query layer.
 *
 * Result shape mirrors `employee_availability` rows directly — the
 * consuming UI does its own grouping by profile / date.
 */
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { getAvailabilityQueryUrl } from "@/lib/web-api";
import type { AvailabilityRule } from "./use-my-availability";

export type UseTeamAvailabilityArgs = {
  startDate: string; // ISO date YYYY-MM-DD
  endDate: string; // ISO date YYYY-MM-DD
  /** Optional filter. Omit / empty = whole workspace (bounded by RLS). */
  profileIds?: string[];
  /** Disable the query when the caller is not ready (e.g. screen
   *  pre-mount). */
  enabled?: boolean;
};

type QueryResponse = {
  ok: boolean;
  rows?: AvailabilityRule[];
  error?: string;
};

async function fetchTeamAvailability(
  args: Required<Pick<UseTeamAvailabilityArgs, "startDate" | "endDate">> & {
    profileIds: string[] | undefined;
  },
): Promise<AvailabilityRule[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Ikke innlogget.");

  const body: Record<string, unknown> = {
    start_date: args.startDate,
    end_date: args.endDate,
  };
  if (args.profileIds && args.profileIds.length > 0) {
    body.profile_ids = args.profileIds;
  }

  const res = await fetch(getAvailabilityQueryUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  let parsed: QueryResponse | null = null;
  try {
    parsed = (await res.json()) as QueryResponse;
  } catch {
    /* ignore */
  }

  if (!res.ok || !parsed?.ok) {
    throw new Error(parsed?.error ?? `BFF ${res.status}`);
  }

  return parsed.rows ?? [];
}

export function useTeamAvailability(args: UseTeamAvailabilityArgs) {
  const { startDate, endDate, profileIds, enabled = true } = args;
  // Stable key so React Query can dedupe identical profile lists.
  const keyProfileIds = profileIds ? [...profileIds].sort() : [];

  return useQuery<AvailabilityRule[]>({
    queryKey: ["team-availability", startDate, endDate, keyProfileIds],
    queryFn: () =>
      fetchTeamAvailability({
        startDate,
        endDate,
        profileIds,
      }),
    enabled: enabled && Boolean(startDate) && Boolean(endDate),
    staleTime: 60_000,
  });
}
