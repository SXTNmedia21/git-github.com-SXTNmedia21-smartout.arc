/**
 * ConversationBody — Reusable chat thread surface.
 *
 * Owns the core conversation UI shared by the Komm chat screen and the
 * helpdesk ticket detail screen:
 *   - Paginated message list (inverted FlatList, load-older on scroll)
 *   - Supabase Realtime subscription for new `channel_message` rows
 *   - Composer (MessageInput) with reply preview
 *   - Long-press reactions (ReactionBar)
 *
 * The parent owns chrome (header, FABs, call bars, keyboard avoidance).
 * ConversationBody only renders the message list + composer and routes
 * events through its props.
 *
 * Phase 1A.2 cutover: this component replaces the "bruk Chat-fanen"
 * placeholder in `(app)/(komm)/[channelId].tsx` so reps can reply to
 * helpdesk tickets in place (Spec §Mobile, ADR-0165).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  FlatList,
  type ViewabilityConfig,
  type ViewToken,
  type ViewStyle,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { createStyles } from "@/theme";
import { EmptyState } from "@/components/ui";
import { strings } from "@/constants/strings";
import { DateDivider } from "@/components/chat/DateDivider";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageInput } from "@/components/chat/MessageInput";
import { ReactionBar } from "@/components/chat/ReactionBar";
import { useMessages, type MessageWithSender } from "@/hooks/queries/use-messages";
import { useSendMessage } from "@/hooks/mutations/use-send-message";
import { useMarkRead } from "@/hooks/mutations/use-mark-read";
import { useChannelReadReceipts, getReceiptState } from "@/hooks/use-channel-read-receipts";
import type { Database } from "@smartout/supabase/database.types";

type PendingMessage = MessageWithSender & { _isPending?: boolean };

/**
 * Discriminated union for FlatList feed items.
 * `divider` rows separate day-groups; `message` rows render message bubbles.
 */
type FeedItem =
  | { kind: "message"; message: PendingMessage }
  | { kind: "divider"; date: Date; key: string };

export type ConversationBodyProps = {
  /** Channel (conversation) to render. */
  channelId: string;
  /** Current user's profile id — determines own-message bubble styling. */
  profileId: string | null;
  /** Current user's display name — stamped on optimistic sends. */
  profileName: string;
  /** Current user's avatar url — stamped on optimistic sends. */
  profileAvatarUrl: string | null;
  /** Workspace for the send path (required before send is enabled). */
  workspaceId: string | null;
  /** Paddings from the parent (e.g. call bar above composer). */
  composerStyle?: ViewStyle;
  /** Outer style override for the list area. */
  style?: ViewStyle;
};

export function ConversationBody({
  channelId,
  profileId,
  profileName,
  profileAvatarUrl,
  workspaceId,
  composerStyle,
  style,
}: ConversationBodyProps) {
  const styles = useStyles();
  const queryClient = useQueryClient();

  const [replyTo, setReplyTo] = useState<MessageWithSender | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  const listRef = useRef<FlatList>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useMessages(channelId);
  const { sendMessage } = useSendMessage();
  const { markRead } = useMarkRead();

  // Sender side: track read receipts for own messages via Realtime.
  const readReceipts = useChannelReadReceipts(channelId);

  // FlatList requires onViewableItemsChanged to be stable (wrapped in a ref).
  // Debounce 500ms: viewport events fire rapidly during scroll; batch IDs.
  const markReadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingViewableIdsRef = useRef<Set<string>>(new Set());

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    // Only mark messages sent by OTHER users as read on the receiver side.
    // profileId is captured in the closure via the outer component prop.
    for (const token of viewableItems) {
      const item = token.item as FeedItem;
      if (item.kind !== "message") continue;
      const msg = item.message;
      // Skip own messages (we don't mark-read our own) and pending optimistics.
      if (!msg.id || msg._isPending || msg.sender_id === profileId) continue;
      pendingViewableIdsRef.current.add(msg.id);
    }

    if (markReadDebounceRef.current) clearTimeout(markReadDebounceRef.current);
    markReadDebounceRef.current = setTimeout(() => {
      const ids = Array.from(pendingViewableIdsRef.current);
      pendingViewableIdsRef.current.clear();
      if (ids.length > 0) markRead(ids);
    }, 500);
  }).current;

  // Viewability threshold: 50% of item visible before counting as "read".
  const viewabilityConfig = useRef<ViewabilityConfig>({
    itemVisiblePercentThreshold: 50,
  }).current;

  /**
   * Build a FeedItem[] from paginated message pages.
   *
   * The FlatList is inverted, so index 0 renders at the bottom of the screen
   * (newest messages). We preserve that order and place each day's divider
   * at a higher index than its messages — i.e. right after the group's newest
   * message and before the next (older) group. When the list is flipped by
   * `inverted`, the divider appears above the group, between it and the
   * previous (newer) day, which is the WhatsApp convention.
   *
   * Steps:
   *   1. Flatten pages → PendingMessage[] (newest-first, as the RPC returns).
   *   2. Group by calendar day (yyyy-MM-dd in local TZ).
   *   3. Walk groups in newest-first order (preserving original sort).
   *      For each group: emit all messages for the day, then the divider.
   *   4. Drop the trailing divider for the most-recent day — it would float
   *      above the last visible message with no older content above it, which
   *      looks odd. Keep it only when there is more than one day-group so the
   *      divider meaningfully separates groups.
   */
  const feed = useMemo<FeedItem[]>(() => {
    const flat = (data?.pages.flat() ?? []) as PendingMessage[];
    if (flat.length === 0) return [];

    // Group messages by local calendar day, preserving newest-first order.
    const groups = new Map<string, PendingMessage[]>();
    for (const msg of flat) {
      const dayKey = format(new Date(msg.created_at), "yyyy-MM-dd");
      const bucket = groups.get(dayKey);
      if (bucket) {
        bucket.push(msg);
      } else {
        groups.set(dayKey, [msg]);
      }
    }

    const result: FeedItem[] = [];
    const dayKeys = Array.from(groups.keys()); // insertion order = newest-first

    for (let i = 0; i < dayKeys.length; i++) {
      const dayKey = dayKeys[i];
      const dayMessages = groups.get(dayKey) ?? [];

      // Emit messages for this day group (newest-first within the group).
      for (const msg of dayMessages) {
        result.push({ kind: "message", message: msg });
      }

      // Emit divider after the group's messages (will render above the group
      // when FlatList is inverted). Skip the divider for the newest day when
      // it's the only group — nothing older to separate from.
      if (dayKeys.length > 1 || i > 0) {
        result.push({
          kind: "divider",
          date: new Date(dayKey + "T00:00:00"),
          key: `div-${dayKey}`,
        });
      }
    }

    return result;
  }, [data]);

  // Realtime subscription: new messages in this channel land here.
  // Own messages dedupe the optimistic version by client_message_id.
  useEffect(() => {
    if (!channelId) return;

    const channel = supabase
      .channel(`channel:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "channel_message",
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Database["public"]["Tables"]["channel_message"]["Row"];

          // Our own echo — collapse optimistic row.
          if (newMsg.sender_id === profileId) {
            queryClient.setQueryData(
              ["channel-messages", channelId],
              (
                old: { pages: PendingMessage[][]; pageParams: (string | undefined)[] } | undefined,
              ) => {
                if (!old) return old;
                const newPages = old.pages.map((page) =>
                  page.map((msg) => {
                    if (
                      msg.client_message_id === newMsg.client_message_id &&
                      (msg as PendingMessage)._isPending
                    ) {
                      return {
                        ...msg,
                        id: newMsg.id,
                        created_at: newMsg.created_at,
                        _isPending: false,
                      };
                    }
                    return msg;
                  }),
                );
                return { ...old, pages: newPages };
              },
            );
            return;
          }

          // Someone else — fetch sender and prepend.
          const { data: senderProfile } = await supabase
            .from("profile")
            .select("profile_id, display_name, avatar_url")
            .eq("profile_id", newMsg.sender_id)
            .single();

          const messageWithSender: MessageWithSender = {
            id: newMsg.id,
            channel_id: newMsg.channel_id,
            content: newMsg.content,
            sender_id: newMsg.sender_id,
            senderName: senderProfile?.display_name || "Ukjent",
            senderAvatarUrl: senderProfile?.avatar_url ?? null,
            created_at: newMsg.created_at,
            reply_to_id: newMsg.reply_to_id ?? null,
            reply_to_content: null,
            reply_to_sender_name: null,
            reactions: [],
            attachments: [],
            is_pinned: newMsg.is_pinned,
            message_type: newMsg.message_type,
            origin_type: newMsg.origin_type,
            visibility_scope: newMsg.visibility_scope,
            sender_role: null,
            system_data: newMsg.system_data,
            edited_at: newMsg.edited_at,
            deleted_at: newMsg.deleted_at,
            client_message_id: newMsg.client_message_id,
            conversation_id: newMsg.channel_id,
            is_system: newMsg.message_type === "system",
            updated_at: newMsg.created_at,
          };

          queryClient.setQueryData(
            ["channel-messages", channelId],
            (
              old: { pages: MessageWithSender[][]; pageParams: (string | undefined)[] } | undefined,
            ) => {
              if (!old) return { pages: [[messageWithSender]], pageParams: [undefined] };
              const newPages = [...old.pages];
              newPages[0] = [messageWithSender, ...(newPages[0] ?? [])];
              return { ...old, pages: newPages };
            },
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, profileId, queryClient]);

  const handleSend = useCallback(
    async (
      content: string,
      attachments?: { uri: string; type: "image" | "video"; fileName?: string }[],
    ) => {
      if (!profileId || !channelId || !workspaceId) return;
      await sendMessage({
        channelId,
        content,
        senderProfileId: profileId,
        senderName: profileName,
        senderAvatarUrl: profileAvatarUrl,
        replyToId: replyTo?.id ?? null,
        workspaceId,
        attachments,
      });
      setReplyTo(null);
    },
    [profileId, channelId, workspaceId, profileName, profileAvatarUrl, replyTo, sendMessage],
  );

  const handleLongPress = useCallback((messageId: string) => {
    setSelectedMessageId((prev) => (prev === messageId ? null : messageId));
  }, []);

  const handleReaction = useCallback(
    async (emoji: string) => {
      if (!selectedMessageId || !profileId) return;
      queryClient.setQueryData(
        ["channel-messages", channelId],
        (old: { pages: PendingMessage[][]; pageParams: (string | undefined)[] } | undefined) => {
          if (!old) return old;
          const newPages = old.pages.map((page) =>
            page.map((msg) => {
              if (msg.id === selectedMessageId) {
                const currentReactions = Array.isArray(msg.reactions)
                  ? (msg.reactions as { emoji: string; profileId: string }[])
                  : [];
                return { ...msg, reactions: [...currentReactions, { emoji, profileId }] };
              }
              return msg;
            }),
          );
          return { ...old, pages: newPages };
        },
      );
      setSelectedMessageId(null);
    },
    [selectedMessageId, profileId, channelId, queryClient],
  );

  const handleSwipeReply = useCallback((message: MessageWithSender) => {
    setReplyTo(message);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => {
      if (item.kind === "divider") {
        return <DateDivider date={item.date} />;
      }
      const { message } = item;
      const isOwn = message.sender_id === profileId;
      const isPending = !!message._isPending;
      // Resolve receipt state for own messages — passed to MessageBubble once
      // T2 lands the `readReceiptState` prop (feat/mobile-chat-whatsapp-phase1 T2).
      // Computed here so T2 can wire it without changing this logic.
      const _readReceiptState = isOwn
        ? getReceiptState(message.id, isPending, readReceipts)
        : undefined;
      return (
        <View>
          <MessageBubble
            message={message}
            isOwnMessage={isOwn}
            isPending={isPending}
            onLongPress={() => handleLongPress(message.id)}
            onSwipeReply={() => handleSwipeReply(message)}
            readReceiptState={_readReceiptState}
          />
          {selectedMessageId === message.id && <ReactionBar onReaction={handleReaction} />}
        </View>
      );
    },
    [profileId, selectedMessageId, readReceipts, handleLongPress, handleSwipeReply, handleReaction],
  );

  const keyExtractor = useCallback(
    (item: FeedItem) => (item.kind === "message" ? item.message.id : item.key),
    [],
  );

  return (
    <View style={[styles.root, style]}>
      {feed.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState title={strings.chat.noMessages} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={feed}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          inverted
          contentContainerStyle={styles.messageList}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      )}

      <MessageInput
        onSend={handleSend}
        replyTo={replyTo}
        onCancelReply={handleCancelReply}
        style={composerStyle}
      />
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
  },
  messageList: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.element,
  },
}));
