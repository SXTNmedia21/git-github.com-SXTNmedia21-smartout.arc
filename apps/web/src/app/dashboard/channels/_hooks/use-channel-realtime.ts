"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { channelKeys } from "./channel-keys";

export function useChannelRealtime(
  workspaceId: string,
  channelId: string | null,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!channelId) return;

    const supabase = createClient();
    const realtimeChannel = supabase
      .channel(`channel:${workspaceId}:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channel_message",
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: channelKeys.messages(workspaceId, channelId),
          });
          queryClient.invalidateQueries({
            queryKey: channelKeys.list(workspaceId),
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channel_message_reaction",
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: channelKeys.messages(workspaceId, channelId),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [workspaceId, channelId, queryClient]);
}
