"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspaceOptional } from "@/lib/workspace-context";

/**
 * Reads tips_workspace_settings.tips_enabled for the current workspace.
 * Defaults to false when no row exists (opt-in pattern — Phase 1.7).
 *
 * Per spec §22: Tips UI must hide entirely when disabled.
 */
export function useTipsEnabled(): { enabled: boolean; isLoading: boolean } {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  const { data, isLoading } = useQuery({
    queryKey: ["tips-enabled", workspaceId],
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient();
      const { data: row } = await supabase
        .from("tips_workspace_settings")
        .select("tips_enabled")
        .eq("workspace_id", workspaceId!)
        .maybeSingle();
      // No row = workspace has not opted in → default false
      return Boolean(row?.tips_enabled);
    },
  });

  return { enabled: data ?? false, isLoading };
}
