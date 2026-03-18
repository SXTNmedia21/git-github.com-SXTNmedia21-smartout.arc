/**
 * Fetches all conversations the current profile participates in.
 *
 * Joins chat_conversation via chat_participant to get only conversations
 * the user belongs to. Returns conversations sorted by last message timestamp
 * (most recent first). Groups are differentiated by source_type for sectioned display.
 *
 * Cache: MMKV with 5-minute stale time (spec 6.5).
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { Database } from "@smartout/supabase/database.types";

type ChatConversation = Database["public"]["Tables"]["chat_conversation"]["Row"];
type ChatParticipant = Database["public"]["Tables"]["chat_participant"]["Row"];
type ChatMessage = Database["public"]["Tables"]["chat_message"]["Row"];

/** Conversation with participant metadata and last message preview */
export type ConversationWithMeta = ChatConversation & {
  /** Current user's participant record — for last_read_at / is_muted */
  participant: Pick<ChatParticipant, "last_read_at" | "is_muted">;
  /** Most recent message in this conversation (null if no messages yet) */
  lastMessage: Pick<ChatMessage, "content" | "created_at" | "sender_id"> | null;
  /** Sender name for last message preview */
  lastMessageSenderName: string | null;
  /** Count of messages after last_read_at */
  unreadCount: number;
};

/** Cache key for MMKV persistence */
const CACHE_KEY = "cache:channels";

/** 5-minute stale time per spec */
const STALE_TIME_MS = 5 * 60 * 1000;

function getPlaceholderData(): ConversationWithMeta[] | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    const cached = mmkvStorage?.getString(CACHE_KEY);
    return cached ? (JSON.parse(cached) as ConversationWithMeta[]) : undefined;
  } catch {
    return undefined;
  }
}

function persistToCache(data: ConversationWithMeta[]): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    mmkvStorage?.set(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Cache module not available
  }
}

async function fetchConversations(): Promise<ConversationWithMeta[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get current profile
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (profileError) throw profileError;

  // Get all conversations this profile participates in, with participant metadata
  const { data: participants, error: partError } = await supabase
    .from("chat_participant")
    .select("conversation_id, last_read_at, is_muted")
    .eq("profile_id", profile.profile_id)
    .is("left_at", null);

  if (partError) throw partError;
  if (!participants || participants.length === 0) return [];

  const conversationIds = participants.map((p) => p.conversation_id);

  // Fetch conversations
  const { data: conversations, error: convError } = await supabase
    .from("chat_conversation")
    .select("*")
    .in("id", conversationIds)
    .eq("is_archived", false);

  if (convError) throw convError;
  if (!conversations) return [];

  // Build participant lookup for quick access
  const participantMap = new Map(
    participants.map((p) => [p.conversation_id, p]),
  );

  // Fetch last message for each conversation using a single query
  // We get the most recent message per conversation by ordering and using limit logic
  const { data: recentMessages, error: msgError } = await supabase
    .from("chat_message")
    .select("id, conversation_id, content, created_at, sender_id")
    .in("conversation_id", conversationIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (msgError) throw msgError;

  // Group by conversation — first occurrence is the most recent due to ordering
  const lastMessageMap = new Map<
    string,
    Pick<ChatMessage, "content" | "created_at" | "sender_id">
  >();
  for (const msg of recentMessages ?? []) {
    if (!lastMessageMap.has(msg.conversation_id)) {
      lastMessageMap.set(msg.conversation_id, {
        content: msg.content,
        created_at: msg.created_at,
        sender_id: msg.sender_id,
      });
    }
  }

  // Get sender names for last messages
  const senderIds = new Set(
    [...lastMessageMap.values()].map((m) => m.sender_id),
  );
  const senderNameMap = new Map<string, string>();

  if (senderIds.size > 0) {
    const { data: senderProfiles } = await supabase
      .from("profile")
      .select("profile_id, first_name, last_name")
      .in("profile_id", [...senderIds]);

    for (const sp of senderProfiles ?? []) {
      senderNameMap.set(
        sp.profile_id,
        [sp.first_name, sp.last_name].filter(Boolean).join(" ") || "Ukjent",
      );
    }
  }

  // Calculate unread counts per conversation
  const unreadCountMap = new Map<string, number>();
  for (const conv of conversations) {
    const participant = participantMap.get(conv.id);
    if (!participant) continue;

    const lastRead = participant.last_read_at;
    const messagesInConv = (recentMessages ?? []).filter(
      (m) =>
        m.conversation_id === conv.id &&
        m.sender_id !== profile.profile_id &&
        (!lastRead || m.created_at > lastRead),
    );
    unreadCountMap.set(conv.id, messagesInConv.length);
  }

  // Assemble results
  const results: ConversationWithMeta[] = conversations.map((conv) => {
    const participant = participantMap.get(conv.id)!;
    const lastMsg = lastMessageMap.get(conv.id) ?? null;
    const senderName = lastMsg
      ? senderNameMap.get(lastMsg.sender_id) ?? null
      : null;

    return {
      ...conv,
      participant: {
        last_read_at: participant.last_read_at,
        is_muted: participant.is_muted,
      },
      lastMessage: lastMsg,
      lastMessageSenderName: senderName,
      unreadCount: unreadCountMap.get(conv.id) ?? 0,
    };
  });

  // Sort by last message timestamp (newest first), conversations without messages last
  results.sort((a, b) => {
    const aTime = a.lastMessage?.created_at ?? a.created_at;
    const bTime = b.lastMessage?.created_at ?? b.created_at;
    return bTime.localeCompare(aTime);
  });

  persistToCache(results);
  return results;
}

/**
 * Hook: returns all conversations the current profile participates in.
 * Sorted by last message timestamp. Includes unread count and last message preview.
 */
export function useConversations() {
  return useQuery<ConversationWithMeta[]>({
    queryKey: ["conversations"],
    queryFn: fetchConversations,
    staleTime: STALE_TIME_MS,
    placeholderData: getPlaceholderData,
  });
}

/** Sections for the channel list screen */
export type ConversationSection = {
  title: string;
  data: ConversationWithMeta[];
};

/**
 * Groups conversations into display sections for the channel list:
 * - "Aktiv vakt" (session channels, only during shift)
 * - "Kanaler" (department + team groups)
 * - "Direktmeldinger" (DMs)
 *
 * AI conversations are excluded from the channel list (accessed via FAB).
 */
export function useGroupedConversations(isDuringShift: boolean) {
  const { data, ...rest } = useConversations();

  const sections = useMemo((): ConversationSection[] => {
    if (!data) return [];

    const sessionChannels = data.filter(
      (c) => c.type === "group" && c.source_type === "session",
    );
    const groupChannels = data.filter(
      (c) =>
        c.type === "group" &&
        (c.source_type === "department" || c.source_type === "team"),
    );
    const dmChannels = data.filter((c) => c.type === "dm");

    const result: ConversationSection[] = [];

    // Only show session channels if employee is on shift
    if (isDuringShift && sessionChannels.length > 0) {
      result.push({ title: "Aktiv vakt", data: sessionChannels });
    }

    if (groupChannels.length > 0) {
      result.push({ title: "Kanaler", data: groupChannels });
    }

    if (dmChannels.length > 0) {
      result.push({ title: "Direktmeldinger", data: dmChannels });
    }

    return result;
  }, [data, isDuringShift]);

  return { sections, data, ...rest };
}
