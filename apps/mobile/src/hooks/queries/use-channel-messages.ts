/**
 * Fetches messages for a channel via the get_channel_messages() RPC.
 * Cursor-based pagination for infinite scroll (inverted FlatList).
 */
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

type MessageType = Database["public"]["Enums"]["channel_message_type"];
type OriginType = Database["public"]["Enums"]["channel_origin_type"];

export type ChannelMessageWithSender = {
  message_id: string;
  channel_id: string;
  sender_id: string;
  sender_name: string | null;
  sender_avatar: string | null;
  sender_role: string | null;
  content: string;
  message_type: MessageType;
  origin_type: OriginType;
  visibility_scope: string;
  reply_to_id: string | null;
  reply_to_content: string | null;
  reply_to_sender_name: string | null;
  system_data: Record<string, unknown> | null;
  is_pinned: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  client_message_id: string | null;
  created_at: string;
  reactions: { emoji: string; profile_id: string }[];
  attachments: {
    id: string;
    file_type: string;
    url: string;
    filename: string;
    size_bytes: number;
  }[];
};

const PAGE_SIZE = 50;

export function useChannelMessages(channelId: string | null) {
  return useInfiniteQuery({
    queryKey: ["channels", "messages", channelId],
    enabled: !!channelId,
    initialPageParam: new Date().toISOString(),
    queryFn: async ({ pageParam }): Promise<ChannelMessageWithSender[]> => {
      const { data, error } = await supabase.rpc("get_channel_messages", {
        p_channel_id: channelId!,
        p_cursor: pageParam,
        p_limit: PAGE_SIZE,
      });
      if (error) throw error;
      return (data ?? []) as ChannelMessageWithSender[];
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      const oldest = lastPage[lastPage.length - 1];
      return oldest?.created_at;
    },
  });
}
