/**
 * Fetches pending shift swap requests involving the current user.
 *
 * Queries engine_state where process_key = 'shift_swap' and status is active.
 * Filters client-side by checking if the current profile_id matches either
 * the requester or target in the context JSONB.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useWorkspaceStore } from "@/hooks/stores/use-workspace-store";
import type { ShiftSwapContext } from "@smartout/utils/swap/types";

export type SwapRequest = {
  engine_state_id: string;
  workspace_id: string;
  status: string;
  context: ShiftSwapContext;
  created_at: string;
  updated_at: string;
};

const STALE_TIME_MS = 30 * 1000; // 30 seconds — swaps are time-sensitive

async function fetchSwapRequests(profileId: string): Promise<SwapRequest[]> {
  // Fetch all active swap engine states for the workspace
  const { data, error } = await supabase
    .from("engine_state")
    .select("engine_state_id, workspace_id, status, context, created_at, updated_at")
    .eq("process_key", "shift_swap")
    .in("status", ["pending_recipient", "pending_manager"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!data) return [];

  // Filter client-side: only swaps involving the current user
  return data
    .filter((row) => {
      const ctx = row.context as unknown as ShiftSwapContext | null;
      if (!ctx) return false;
      return ctx.requester_profile_id === profileId || ctx.target_profile_id === profileId;
    })
    .map((row) => ({
      engine_state_id: row.engine_state_id,
      workspace_id: row.workspace_id,
      status: row.status,
      context: row.context as unknown as ShiftSwapContext,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
}

/**
 * Hook: returns pending swap requests for the current user (as requester or target).
 */
export function useSwapRequests() {
  const selectedProfileId = useWorkspaceStore((s) => s.selectedProfileId);

  return useQuery<SwapRequest[]>({
    queryKey: ["swap-requests", selectedProfileId],
    queryFn: () => fetchSwapRequests(selectedProfileId!),
    enabled: Boolean(selectedProfileId),
    staleTime: STALE_TIME_MS,
    refetchInterval: 60 * 1000, // Poll every minute for new swap requests
  });
}
