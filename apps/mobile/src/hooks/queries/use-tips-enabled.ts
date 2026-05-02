/**
 * Reads tips_workspace_settings.tips_enabled for the current workspace.
 * Mobile mirror of the web hook — same opt-in default-false pattern.
 *
 * Per spec §22: Tips UI must hide entirely when disabled.
 * Mobile surface: only the employee share view (journey.run_guided BFF path).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useMyProfile } from "./use-my-profile";

export function useTipsEnabled(): { enabled: boolean; isLoading: boolean } {
  const { data: profile } = useMyProfile();
  const workspaceId = profile?.workspace_id;

  const { data, isLoading } = useQuery({
    queryKey: ["tips-enabled", workspaceId],
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
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
