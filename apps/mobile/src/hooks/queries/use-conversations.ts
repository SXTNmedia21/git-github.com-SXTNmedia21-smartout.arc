/**
 * Fetches all channels the current profile is a member of.
 *
 * Calls the `get_my_channels` RPC which returns channels with last message
 * preview, unread count, member count, and media policies. Maps the result
 * to `ConversationWithMeta` for backward compatibility with existing UI.
 *
 * Cache: MMKV with 5-minute stale time.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useMyProfile } from "@/hooks/queries/use-my-profile";

/** Channel data mapped for UI consumption — compatible with existing list components */
export type ConversationWithMeta = {
  /** channel_id from the channel table */
  id: string;
  name: string | null;
  /** Maps to comm_channel_type: department, team, session, custom, direct, news, skill */
  type: string;
  /** Channel type used for section grouping (mirrors channel_type for new schema) */
  source_type: string | null;
  /** Not available in new channel schema — always false */
  is_featured: boolean;
  created_at: string;
  /** Current user's membership metadata */
  participant: { last_read_at: string | null; is_muted: boolean };
  /** Most recent message preview (null if no messages yet) */
  lastMessage: { content: string; created_at: string; sender_id: string } | null;
  /** Sender name for last message preview */
  lastMessageSenderName: string | null;
  /** Count of unread messages */
  unreadCount: number;
  /** Channel audio policy (open_mic, push_to_talk, muted) */
  audio_policy: string;
  /** Channel video policy (off, optional, required) */
  video_policy: string;
  /** Number of active members */
  member_count: number;
  /** Channel avatar URL */
  avatar_url: string | null;
  /** For DMs: the other member's display name */
  other_member_name: string | null;
  /** For DMs: the other member's avatar URL */
  other_member_avatar: string | null;
  /** For DMs: the other member's profile ID */
  other_member_profile_id: string | null;
  /** Workspace this channel belongs to */
  workspace_id: string;
};

/** Cache key for MMKV persistence */
const CACHE_KEY = "cache:channels";

/** 5-minute stale time */
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

async function fetchChannels(workspaceId: string): Promise<ConversationWithMeta[]> {
  const { data, error } = await supabase.rpc("get_my_channels", {
    p_workspace_id: workspaceId,
  });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Map RPC result to ConversationWithMeta for backward compatibility
  const results: ConversationWithMeta[] = data.map((ch) => ({
    id: ch.channel_id,
    name: ch.channel_type === "direct" ? (ch.other_member_name ?? ch.name) : ch.name,
    type: ch.channel_type,
    source_type: ch.channel_type,
    is_featured: false,
    created_at: ch.last_message_at ?? "",
    participant: {
      // RPC doesn't expose last_read_at directly — null is safe for UI
      last_read_at: null,
      is_muted: false,
    },
    lastMessage: ch.last_message_content
      ? {
          content: ch.last_message_content,
          created_at: ch.last_message_at ?? "",
          sender_id: "",
        }
      : null,
    lastMessageSenderName: ch.last_message_sender_name ?? null,
    unreadCount: ch.unread_count ?? 0,
    audio_policy: ch.audio_policy,
    video_policy: ch.video_policy,
    member_count: ch.member_count ?? 0,
    avatar_url: ch.avatar_url ?? null,
    other_member_name: ch.other_member_name ?? null,
    other_member_avatar: ch.other_member_avatar ?? null,
    other_member_profile_id: ch.other_member_profile_id ?? null,
    workspace_id: ch.workspace_id,
  }));

  // RPC already returns sorted by last message timestamp (newest first)
  persistToCache(results);
  return results;
}

/**
 * Hook: returns all channels the current profile is a member of.
 * Sorted by last message timestamp. Includes unread count and last message preview.
 */
export function useConversations() {
  const { data: myProfile } = useMyProfile();
  const workspaceId = myProfile?.workspace_id;

  const query = useQuery<ConversationWithMeta[]>({
    queryKey: ["channels", workspaceId],
    queryFn: () => fetchChannels(workspaceId!),
    staleTime: STALE_TIME_MS,
    enabled: !!workspaceId,
    placeholderData: getPlaceholderData,
  });

  return query;
}

/** Sections for the channel list screen */
export type ConversationSection = {
  title: string;
  data: ConversationWithMeta[];
};

/**
 * Groups channels into display sections for the channel list:
 * - "Festet" (pinned by user, local MMKV)
 * - "Aktiv vakt" (session channels, only during shift)
 * - "Kanaler" (department + team + custom groups)
 * - "Direktmeldinger" (DMs — channel_type = 'direct')
 *
 * AI conversations are excluded from the channel list (accessed via FAB).
 */
export function useGroupedConversations(isDuringShift: boolean, pinnedIds: string[] = []) {
  const { data, ...rest } = useConversations();

  const sections = useMemo((): ConversationSection[] => {
    if (!data) return [];

    const pinnedSet = new Set(pinnedIds);

    const pinned = data.filter((c) => pinnedSet.has(c.id));
    const unpinned = data.filter((c) => !pinnedSet.has(c.id));

    // Group by channel_type instead of source_type
    const sessionChannels = unpinned.filter((c) => c.type === "session");
    const groupChannels = unpinned.filter(
      (c) =>
        c.type === "department" ||
        c.type === "team" ||
        c.type === "custom" ||
        c.type === "news" ||
        c.type === "skill",
    );
    const dmChannels = unpinned.filter((c) => c.type === "direct");

    const result: ConversationSection[] = [];

    if (pinned.length > 0) {
      result.push({ title: "Festet", data: pinned });
    }

    // Show session channels during shift, or always in dev mode for previewing
    if ((isDuringShift || __DEV__) && sessionChannels.length > 0) {
      result.push({ title: "Aktive vakter", data: sessionChannels });
    }

    if (groupChannels.length > 0) {
      result.push({ title: "Kanaler", data: groupChannels });
    }

    if (dmChannels.length > 0) {
      result.push({ title: "Direktmeldinger", data: dmChannels });
    }

    return result;
  }, [data, isDuringShift, pinnedIds]);

  return { sections, data, ...rest };
}
