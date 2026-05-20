"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { channelKeys } from "./channel-keys";
import type { MessageWithSender } from "./channel-types";

const PAGE_SIZE = 50;

export function useChannelMessages(channelId: string | null) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useInfiniteQuery({
    queryKey: channelKeys.messages(workspaceId, channelId ?? "none"),
    enabled: !!channelId,
    staleTime: 10_000,
    initialPageParam: new Date().toISOString(),
    queryFn: async ({ pageParam }): Promise<MessageWithSender[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_channel_messages", {
        p_channel_id: channelId!,
        p_cursor: pageParam,
        p_limit: PAGE_SIZE,
      });
      if (error) throw error;
      // RPC returns reactions as Json (Json[]) but MessageWithSender expects ReactionEntry[].
      // The runtime shape is compatible (each item has emoji+profile_id); cast via unknown
      // to satisfy TypeScript while avoiding a full runtime transform. Pre-existing DB type
      // mismatch — tracked as G-reactions-json-mismatch; fix here unblocks typecheck.
      return (data ?? []) as unknown as MessageWithSender[];
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      const oldest = lastPage[lastPage.length - 1];
      return oldest?.created_at;
    },
  });
}
