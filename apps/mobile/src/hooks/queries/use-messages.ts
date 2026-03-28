/**
 * Fetches paginated messages for a channel.
 *
 * Calls the `get_channel_messages` RPC which returns messages with sender
 * profile info, reactions, attachments, and reply context. Uses cursor-based
 * pagination (created_at of last message) instead of offset.
 *
 * Cache: MMKV per channel with 1-minute stale time.
 */

import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/** Message with sender profile info from the get_channel_messages RPC */
export type MessageWithSender = {
  /** message_id from channel_message */
  id: string;
  channel_id: string;
  content: string;
  sender_id: string;
  senderName: string;
  senderAvatarUrl: string | null;
  created_at: string;
  reply_to_id: string | null;
  /** Replied-to message content (from RPC join) */
  reply_to_content: string | null;
  /** Replied-to message sender name (from RPC join) */
  reply_to_sender_name: string | null;
  reactions: unknown;
  attachments: unknown;
  is_pinned: boolean;
  message_type: string;
  origin_type: string;
  visibility_scope: string;
  sender_role: string | null;
  system_data: unknown;
  edited_at: string | null;
  deleted_at: string | null;
  client_message_id: string | null;
  /** Alias for channel_id — backward compatibility */
  conversation_id: string;
  /** Backward compat: derived from message_type === "system" */
  is_system: boolean;
  /** Backward compat fields for consumers still using old chat_message shape */
  updated_at: string;
};

const PAGE_SIZE = 50;
const STALE_TIME_MS = 60 * 1000;

/** Build the MMKV cache key for a specific channel */
function getCacheKey(channelId: string): string {
  return `cache:channel-messages:${channelId}`;
}

function getPlaceholderData(channelId: string): MessageWithSender[] | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    const cached = mmkvStorage?.getString(getCacheKey(channelId));
    return cached ? (JSON.parse(cached) as MessageWithSender[]) : undefined;
  } catch {
    return undefined;
  }
}

function persistToCache(channelId: string, data: MessageWithSender[]): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    // Only cache the first page (50 messages) to keep storage manageable
    const firstPage = data.slice(0, PAGE_SIZE);
    mmkvStorage?.set(getCacheKey(channelId), JSON.stringify(firstPage));
  } catch {
    // Cache module not available
  }
}

type FetchMessagesParams = {
  channelId: string;
  /** Cursor: created_at timestamp of the last message for pagination */
  cursor: string | undefined;
};

async function fetchMessages({
  channelId,
  cursor,
}: FetchMessagesParams): Promise<MessageWithSender[]> {
  const { data: messages, error } = await supabase.rpc("get_channel_messages", {
    p_channel_id: channelId,
    p_cursor: cursor ?? new Date().toISOString(),
    p_limit: PAGE_SIZE,
  });

  if (error) throw error;
  if (!messages || messages.length === 0) return [];

  // Map RPC result to MessageWithSender
  const result: MessageWithSender[] = messages.map((msg) => ({
    id: msg.message_id,
    channel_id: msg.channel_id,
    content: msg.content,
    sender_id: msg.sender_id,
    senderName: msg.sender_name ?? "Ukjent",
    senderAvatarUrl: msg.sender_avatar ?? null,
    created_at: msg.created_at,
    reply_to_id: msg.reply_to_id ?? null,
    reply_to_content: msg.reply_to_content ?? null,
    reply_to_sender_name: msg.reply_to_sender_name ?? null,
    reactions: msg.reactions ?? [],
    attachments: msg.attachments ?? [],
    is_pinned: msg.is_pinned ?? false,
    message_type: msg.message_type,
    origin_type: msg.origin_type,
    visibility_scope: msg.visibility_scope,
    sender_role: msg.sender_role ?? null,
    system_data: msg.system_data ?? null,
    edited_at: msg.edited_at ?? null,
    deleted_at: msg.deleted_at ?? null,
    client_message_id: msg.client_message_id ?? null,
    conversation_id: msg.channel_id,
    is_system: msg.message_type === "system",
    updated_at: msg.created_at,
  }));

  return result;
}

/**
 * Hook: returns cursor-paginated messages for a channel.
 *
 * Messages are ordered newest-first for inverted FlatList display.
 * Call `fetchNextPage()` when the user scrolls to load older messages.
 * Each message includes sender name + avatar for bubble rendering.
 */
export function useMessages(channelId: string) {
  const placeholderFirstPage = getPlaceholderData(channelId);

  const query = useInfiniteQuery<MessageWithSender[]>({
    queryKey: ["channel-messages", channelId],
    queryFn: ({ pageParam }) =>
      fetchMessages({
        channelId,
        cursor: pageParam as string | undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      // If last page returned fewer than PAGE_SIZE, there are no more pages
      if (lastPage.length < PAGE_SIZE) return undefined;
      // Use the created_at of the oldest message in the page as the cursor
      const oldestMessage = lastPage[lastPage.length - 1];
      return oldestMessage?.created_at;
    },
    staleTime: STALE_TIME_MS,
    enabled: !!channelId,
    placeholderData: placeholderFirstPage
      ? { pages: [placeholderFirstPage], pageParams: [undefined] }
      : undefined,
  });

  // Cache first page when data arrives
  const firstPage = query.data?.pages[0];
  if (firstPage && firstPage.length > 0) {
    persistToCache(channelId, firstPage);
  }

  return query;
}
