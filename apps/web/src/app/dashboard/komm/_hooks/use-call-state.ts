"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { getActiveCallSession } from "@smartout/walkie-talkie";
import { channelKeys } from "./channel-keys";

export function useCallState(channelId: string | null) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: channelKeys.callStatus(workspaceId, channelId ?? "none"),
    enabled: !!channelId,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      if (!channelId) return null;
      const supabase = createClient();
      return getActiveCallSession(supabase, channelId);
    },
  });
}
