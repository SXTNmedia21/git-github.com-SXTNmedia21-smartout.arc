"use client";

/**
 * useMyHelpdeskCount — returns the count of open helpdesk tickets assigned
 * to the current profile.
 *
 * Replaces the legacy `useHelpRequests` stat card count. Reads from
 * engine_state (ADR-0165 canonical ticket model) instead of the deprecated
 * help_request table.
 *
 * Status filter: 'waiting' + 'active' — mirrors useMinKo's open-lifecycle
 * definition (L-0079). We filter by assignee_id because the Oversikt card
 * surfaces "my pending work", not all workspace tickets.
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

export function useMyHelpdeskCount(profileId: string) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: ["my-helpdesk-count", workspaceId, profileId],
    staleTime: 15_000,
    queryFn: async (): Promise<number> => {
      const supabase = createClient();
      const { count, error } = await supabase
        .from("engine_state")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("process_id", "helpdesk_query_lifecycle")
        .eq("assignee_id", profileId)
        .in("status", ["waiting", "active"]);

      if (error) throw error;
      return count ?? 0;
    },
  });
}
