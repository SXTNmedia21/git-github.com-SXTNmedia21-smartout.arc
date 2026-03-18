/**
 * Fetches paginated messages for a conversation.
 *
 * Uses TanStack Query's infinite query for "load more" pagination.
 * 50 messages per page, newest first (for inverted FlatList).
 * Includes sender profile info for avatar + name display.
 *
 * Cache: MMKV per conversation with 1-minute stale time (spec 6.5).
 */

import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

type ChatMessage = Database["public"]["Tables"]["chat_message"]["Row"];

/** Message with sender profile info attached */
export type MessageWithSender = ChatMessage & {
  senderName: string;
  senderAvatarUrl: string | null;
};

const PAGE_SIZE = 50;
const STALE_TIME_MS = 60 * 1000;

/** Build the MMKV cache key for a specific conversation */
function getCacheKey(conversationId: string): string {
  return `cache:chat:${conversationId}`;
}

function getPlaceholderData(
  conversationId: string,
): MessageWithSender[] | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    const cached = mmkvStorage?.getString(getCacheKey(conversationId));
    return cached ? (JSON.parse(cached) as MessageWithSender[]) : undefined;
  } catch {
    return undefined;
  }
}

function persistToCache(
  conversationId: string,
  data: MessageWithSender[],
): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    // Only cache the first page (50 messages) to keep storage manageable
    const firstPage = data.slice(0, PAGE_SIZE);
    mmkvStorage?.set(getCacheKey(conversationId), JSON.stringify(firstPage));
  } catch {
    // Cache module not available
  }
}

type FetchMessagesParams = {
  conversationId: string;
  pageParam: number;
};

async function fetchMessages({
  conversationId,
  pageParam,
}: FetchMessagesParams): Promise<MessageWithSender[]> {
  const { data: messages, error } = await supabase
    .from("chat_message")
    .select("*")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

  if (error) throw error;
  if (!messages || messages.length === 0) return [];

  // Collect unique sender IDs for profile lookup
  const senderIds = [...new Set(messages.map((m) => m.sender_id))];

  const { data: profiles, error: profileError } = await supabase
    .from("profile")
    .select("profile_id, first_name, last_name, avatar_url")
    .in("profile_id", senderIds);

  if (profileError) throw profileError;

  // Build sender lookup
  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.profile_id,
      {
        name:
          [p.first_name, p.last_name].filter(Boolean).join(" ") || "Ukjent",
        avatarUrl: p.avatar_url,
      },
    ]),
  );

  const result = messages.map((msg) => {
    const sender = profileMap.get(msg.sender_id);
    return {
      ...msg,
      senderName: sender?.name ?? "Ukjent",
      senderAvatarUrl: sender?.avatarUrl ?? null,
    };
  });

  // Cache first page for offline reads
  if (pageParam === 0) {
    persistToCache(conversationId, result);
  }

  return result;
}

/**
 * Hook: returns paginated messages for a conversation.
 *
 * Messages are ordered newest-first for inverted FlatList display.
 * Call `fetchNextPage()` when the user scrolls to load older messages.
 * Each message includes sender name + avatar for bubble rendering.
 */
export function useMessages(conversationId: string) {
  const placeholderFirstPage = getPlaceholderData(conversationId);

  return useInfiniteQuery<MessageWithSender[]>({
    queryKey: ["messages", conversationId],
    queryFn: ({ pageParam }) =>
      fetchMessages({ conversationId, pageParam: pageParam as number }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      // If last page returned fewer than PAGE_SIZE, there are no more pages
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length;
    },
    staleTime: STALE_TIME_MS,
    enabled: !!conversationId,
    placeholderData: placeholderFirstPage
      ? { pages: [placeholderFirstPage], pageParams: [0] }
      : undefined,
  });
}
