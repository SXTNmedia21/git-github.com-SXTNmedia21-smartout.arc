"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { getCallHistory } from "@smartout/walkie-talkie";
import { channelKeys } from "./channel-keys";

export function useCallHistory(channelId: string | null) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: channelKeys.callHistory(workspaceId, channelId ?? "none"),
    enabled: !!channelId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!channelId) return [];
      const supabase = createClient();
      return getCallHistory(supabase, channelId);
    },
  });
}
