"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import type { Database } from "@smartout/supabase";
import { useWorkspaceOptional } from "@/lib/workspace-context";

type TipAdjustmentLog = Database["public"]["Tables"]["tip_adjustment_log"]["Row"];

/**
 * useTipAdjustmentLog — loads the INSERT-only audit log for a single
 * tip_distribution row, ordered by `changed_at DESC` (most recent first).
 *
 * Returns an empty array when no adjustments exist for the distribution.
 *
 * queryKey: ["tip-adjustment-log", distributionId]
 * staleTime: 30 s (log is append-only; changes only when an adjustment is made)
 */
export function useTipAdjustmentLog(distributionId: string | null): {
  data: TipAdjustmentLog[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
} {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  const result = useQuery({
    queryKey: ["tip-adjustment-log", distributionId],
    enabled: !!distributionId && !!workspaceId,
    staleTime: 30_000,
    queryFn: async (): Promise<TipAdjustmentLog[]> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("tip_adjustment_log")
        .select("*")
        .eq("distribution_id", distributionId!)
        .eq("workspace_id", workspaceId!)
        .order("changed_at", { ascending: false });

      if (error) throw error;

      return data ?? [];
    },
  });

  return {
    data: result.data ?? [],
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
  };
}
