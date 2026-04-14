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

export type SwapContext = {
  requester_profile_id: string;
  target_profile_id: string;
  requester_shift_id: string;
  target_shift_id: string;
  swap_type: string;
  reason: string;
  status: string;
};

export type SwapRequest = {
  id: string;
  workspace_id: string;
  engineStatus: string;
  context: SwapContext;
  created_at: string;
};

const STALE_TIME_MS = 30 * 1000;

async function fetchSwapRequests(profileId: string): Promise<SwapRequest[]> {
  const { data, error } = await supabase
    .from("engine_state")
    .select("id, workspace_id, status, context, started_at")
    .eq("process_key", "shift_swap")
    .in("status", ["active", "waiting"])
    .order("started_at", { ascending: false });

  if (error) throw error;
  if (!data) return [];

  return data
    .filter((row) => {
      const ctx = row.context as unknown as SwapContext | null;
      if (!ctx) return false;
      const swapStatus = ctx.status;
      if (!["pending_recipient", "pending_manager"].includes(swapStatus)) return false;
      return ctx.requester_profile_id === profileId || ctx.target_profile_id === profileId;
    })
    .map((row) => ({
      id: row.id,
      workspace_id: row.workspace_id ?? "",
      engineStatus: row.status,
      context: row.context as unknown as SwapContext,
      created_at: row.started_at,
    }));
}

export function useSwapRequests() {
  const selectedProfileId = useWorkspaceStore((s) => s.selectedProfileId);

  return useQuery<SwapRequest[]>({
    queryKey: ["swap-requests", selectedProfileId],
    queryFn: () => fetchSwapRequests(selectedProfileId!),
    enabled: Boolean(selectedProfileId),
    staleTime: STALE_TIME_MS,
    refetchInterval: 60 * 1000,
  });
}
