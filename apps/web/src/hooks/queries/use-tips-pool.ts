"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import type { Database } from "@smartout/supabase";
import { useWorkspaceOptional } from "@/lib/workspace-context";

// Row types from generated DB schema
type TipPool = Database["public"]["Tables"]["tip_pool"]["Row"];
type TipDistribution = Database["public"]["Tables"]["tip_distribution"]["Row"];

/**
 * Computed view over a single tip pool + its distributions.
 *
 * - `pool` is null when no pot has been recorded for the session yet.
 * - `distributions` is empty when no pool exists.
 * - `sumDistributed` uses `adjusted_amount` when set, otherwise `calculated_amount`.
 * - `diffFromPot` is zero when the distribution sums equal the pool amount.
 */
export type TipsPoolView = {
  pool: TipPool | null;
  distributions: TipDistribution[];
  sumDistributed: number;
  diffFromPot: number;
} | null;

/**
 * useTipsPool — loads the tip_pool and its tip_distribution rows for a
 * given department_session_id. Returns null while loading or when the
 * argument is null.
 *
 * queryKey: ["tips-pool", departmentSessionId]
 * staleTime: 30 s
 */
export function useTipsPool(departmentSessionId: string | null): {
  data: TipsPoolView;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
} {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  const result = useQuery({
    queryKey: ["tips-pool", departmentSessionId],
    enabled: !!departmentSessionId && !!workspaceId,
    staleTime: 30_000,
    queryFn: async (): Promise<TipsPoolView> => {
      const supabase = createClient();

      // Load the pool for this session (UNIQUE constraint on department_session_id).
      const { data: poolRow, error: poolErr } = await supabase
        .from("tip_pool")
        .select("*")
        .eq("department_session_id", departmentSessionId!)
        .eq("workspace_id", workspaceId!)
        .maybeSingle();

      if (poolErr) throw poolErr;

      // No pool yet — return the zero-state view.
      if (!poolRow) {
        return { pool: null, distributions: [], sumDistributed: 0, diffFromPot: 0 };
      }

      // Load all distributions for this pool.
      const { data: distRows, error: distErr } = await supabase
        .from("tip_distribution")
        .select("*")
        .eq("pool_id", poolRow.id)
        .eq("workspace_id", workspaceId!)
        .order("profile_id");

      if (distErr) throw distErr;

      const distributions = distRows ?? [];

      // Sum using adjusted_amount when present; fall back to calculated_amount.
      const sumDistributed = distributions.reduce<number>((acc, d) => {
        const effective =
          d.adjusted_amount !== null && d.adjusted_amount !== undefined
            ? Number(d.adjusted_amount)
            : Number(d.calculated_amount);
        return acc + effective;
      }, 0);

      const diffFromPot = Math.round((Number(poolRow.amount_nok) - sumDistributed) * 100) / 100;

      return {
        pool: poolRow,
        distributions,
        sumDistributed: Math.round(sumDistributed * 100) / 100,
        diffFromPot,
      };
    },
  });

  return {
    data: result.data ?? null,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
  };
}
