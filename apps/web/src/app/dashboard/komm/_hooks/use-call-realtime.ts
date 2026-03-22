"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { channelKeys } from "./channel-keys";

/** Subscribe to Realtime changes on channel_call_session + channel_call_participant */
export function useCallRealtime(channelId: string | null) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  useEffect(() => {
    if (!channelId) return;

    const supabase = createClient();
    const realtimeChannel = supabase
      .channel(`call-realtime:${workspaceId}:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channel_call_session",
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: channelKeys.callStatus(workspaceId, channelId),
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channel_call_participant",
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: channelKeys.callStatus(workspaceId, channelId),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [workspaceId, channelId, queryClient]);
}
