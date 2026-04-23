/**
 * use-seasons-seeded-state.ts
 *
 * Returns the set of season_ids (within the current workspace) that have
 * at least one `department_operating_hours` row pinned to them. A season
 * is "seeded" once its D1 fanout has populated season-scoped hours — i.e.
 * the activation RPC has already run and generated rows downstream.
 *
 * The SeasonSidebar uses this to render a "Seedet" pill next to seasons
 * whose hours are in place, so operators can distinguish "draft / no
 * hours yet" from "active / fully bootstrapped" at a glance.
 *
 * Design:
 *   - One query per page load — cheaper than per-season lookups.
 *   - Returns `Map<seasonId, boolean>` semantics via a memoised Set for
 *     O(1) `has()` membership checks without re-render churn.
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";

const EMPTY_SET: ReadonlySet<string> = new Set<string>();

export function useSeasonsSeededState(workspaceId: string | null) {
  const supabase = createClient();

  const query = useQuery({
    queryKey: ["year-wheel", "seasons-seeded-state", workspaceId ?? "none"] as const,
    queryFn: async (): Promise<string[]> => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("department_operating_hours")
        .select("season_id")
        .eq("workspace_id", workspaceId)
        .not("season_id", "is", null);
      if (error) throw new Error(error.message);
      return (data ?? [])
        .map((row) => row.season_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
    },
    // TanStack `select` caches by reference. Returning a new Set only when
    // `data` changes gives the consumer a stable identity across renders
    // without needing React hooks inside this package (which has no react
    // type dep on purpose — see packages/year-wheel/tsconfig.json).
    select: (rows): ReadonlySet<string> => new Set(rows),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });

  return {
    seededSet: query.data ?? EMPTY_SET,
    isLoading: query.isLoading,
  };
}
