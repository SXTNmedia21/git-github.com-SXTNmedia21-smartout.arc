"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { channelKeys } from "./channel-keys";

type ActiveCallsByChannel = Record<string, { callSessionId: string; participantCount: number }>;

/**
 * Returns a map of channel_id → active-call metadata for every channel in
 * the workspace that has an active call session. Used by ChannelItem to
 * render a live indicator.
 *
 * Refetches every 15s as a safety net on top of realtime invalidations
 * driven by useWorkspaceCallAlerts.
 */
export function useWorkspaceActiveCalls() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: channelKeys.workspaceActiveCalls(workspaceId),
    staleTime: 10_000,
    refetchInterval: 15_000,
    queryFn: async (): Promise<ActiveCallsByChannel> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("channel_call_session")
        .select("id, channel_id, max_participants")
        .eq("workspace_id", workspaceId)
        .eq("status", "active");

      if (error || !data) return {};

      const map: ActiveCallsByChannel = {};
      for (const row of data) {
        map[row.channel_id] = {
          callSessionId: row.id,
          participantCount: row.max_participants ?? 0,
        };
      }
      return map;
    },
  });
}
