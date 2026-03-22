"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { channelKeys } from "./channel-keys";
import type { UnreadCount } from "./channel-types";

export function useUnreadCounts() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: channelKeys.unread(workspaceId),
    refetchInterval: 30_000,
    queryFn: async (): Promise<UnreadCount[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_unread_counts", {
        p_workspace_id: workspaceId,
      });
      if (error) throw error;
      return (data ?? []) as UnreadCount[];
    },
  });
}
