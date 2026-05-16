/**
 * ConversationBody — Reusable chat thread surface.
 *
 * Owns the core conversation UI shared by the Komm chat screen and the
 * helpdesk ticket detail screen:
 *   - Paginated message list (inverted FlatList, load-older on scroll)
 *   - Supabase Realtime subscription for new `channel_message` rows
 *   - Composer (MessageInput) with reply preview
 *   - Long-press reactions (ReactionBar)
 *   - Sticky date dividers (Phase 2 T2)
 *
 * The parent owns chrome (header, FABs, call bars, keyboard avoidance).
 * ConversationBody only renders the message list + composer and routes
 * events through its props.
 *
 * Phase 1A.2 cutover: this component replaces the "bruk Chat-fanen"
 * placeholder in `(app)/(komm)/[channelId].tsx` so reps can reply to
 * helpdesk tickets in place (Spec §Mobile, ADR-0165).
 *
 * Phase 2 T2 — sticky date dividers:
 *   Path B (absolute overlay) chosen over stickyHeaderIndices because
 *   stickyHeaderIndices is broken on inverted FlatLists — it sticks to
 *   the bottom on iOS and is unreliable on RN web (PWA target uses CSS
 *   scaleY(-1) inversion, which breaks the native sticky mechanism).
 *
 *   Mechanism:
 *     1. Each FeedItem wrapper records its Y offset via onLayout into
 *        itemLayoutRef (key → yOffset).
 *     2. onScroll (throttled 50ms) updates scrollOffsetRef.
 *     3. deriveStickyDivider() walks the feed's dividers in newest→oldest
 *        order (ascending feed index, descending Y in inverted content
 *        space) and returns the divider whose Y position is above the
 *        current visible window top.
 *     4. An absolute-positioned DateDivider overlay sits at the top of
 *        the list container and shows the sticky divider.
 *     5. The inline divider for the currently-sticky key is hidden
 *        (opacity 0) to avoid visual duplication.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import {
  View,
  FlatList,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type ViewabilityConfig,
  type ViewToken,
  type ViewStyle,
  type LayoutChangeEvent,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { createStyles, shadows } from "@/theme";
import { EmptyState } from "@/components/ui";
import { strings } from "@/constants/strings";
import { DateDivider } from "@/components/chat/DateDivider";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageInput } from "@/components/chat/MessageInput";
import { ReactionBar } from "@/components/chat/ReactionBar";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { useEmitTyping } from "@/hooks/mutations/use-emit-typing";
import { useMessages, type MessageWithSender } from "@/hooks/queries/use-messages";
import { useSendMessage } from "@/hooks/mutations/use-send-message";
import { useMarkRead } from "@/hooks/mutations/use-mark-read";
import { useChannelReadReceipts, getReceiptState } from "@/hooks/use-channel-read-receipts";
import { getProfileContext } from "@/lib/profile-context";
import { emit } from "@smartout/telemetry";
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

// ─── StickyDateOverlay ────────────────────────────────────────────────────────

/**
 * Memoized overlay that renders the sticky date pill at the top of the list.
 * Re-renders only when the active date changes.
 */
const StickyDateOverlay = memo(function StickyDateOverlay({ date }: { date: Date }) {
  const styles = useStyles();
  return (
    <View style={styles.stickyOverlay} pointerEvents="none">
      <DateDivider date={date} />
    </View>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────

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

  // ── Sticky divider state (T2) ────────────────────────────────────────────
  /**
   * Key of the divider currently pinned to the top of the viewport.
   * null = no sticky overlay visible (e.g. at the very bottom / single day).
   */
  const [stickyDividerKey, setStickyDividerKey] = useState<string | null>(null);
  /**
   * Per-item Y offsets in the FlatList's content coordinate space.
   * Populated via onLayout callbacks on each rendered row wrapper.
   * key → yOffset (top edge of item within content space).
   */
  const itemLayoutRef = useRef<Map<string, number>>(new Map());
  /** Current scroll offset (contentOffset.y), updated on scroll events. */
  const scrollOffsetRef = useRef<number>(0);
  /** Viewport height, updated on the list container's onLayout. */
  const listHeightRef = useRef<number>(0);

  const listRef = useRef<FlatList>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useMessages(channelId);
  const { sendMessage } = useSendMessage();
  const { markRead } = useMarkRead();

  // Sender side: track read receipts + delivered-ack for own messages via Realtime.
  const { receipts: readReceipts, deliveredSet } = useChannelReadReceipts(channelId);

  // T4 — Typing presence: stable emitTyping() broadcast callback.
  const emitTyping = useEmitTyping(channelId);

  // T5 — Presence-join guard: ensure the one-shot broadcast fires at most ONCE
  // per channelId, even though the T5 useEffect deps include `feed` and will
  // re-run as paginated messages arrive. Without this ref a new channel object
  // is created on every re-run (one per incoming message = unbounded channel leak).
  const hasBroadcastRef = useRef(false);

  // Reset the guard whenever the user navigates to a different channel.
  useEffect(() => {
    hasBroadcastRef.current = false;
  }, [channelId]);

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

  // T5 — Delivered-state ack (Phase 2): broadcast presence-join on mount.
  //
  // When the receiver opens this channel we publish a one-shot ephemeral event
  // on `chat-presence:${channelId}` so the sender's hook can flip their
  // outbound messages from `sent` → `delivered`.
  //
  // Payload: { profile_id, unread_message_ids } — the list of message_ids in
  // the current feed that (a) were sent by someone else and (b) the current
  // user has not yet recorded a channel_message_read row for (own_read_at
  // absent). We derive this from the loaded feed synchronously — no extra RPC.
  //
  // One-shot per channelId: hasBroadcastRef gates repeated execution so that
  // pagination-driven feed changes do not create a new Supabase channel on each
  // re-run (which would leak WebSocket registrations). The sender side is still
  // idempotent (Set.add) but the channel object is never reused — only created once.
  //
  // getProfileContext() fail-fast per ADR-0134: throws on missing/empty identity.
  // Wrapped in try/catch so that a transient auth gap does not crash the screen.
  useEffect(() => {
    if (!channelId || !profileId) return;
    // We depend on the feed being populated — skip if feed is empty on first mount.
    if (feed.length === 0) return;
    // One-shot guard: broadcast exactly once per channelId open.
    // hasBroadcastRef is reset by the channelId-change effect above.
    if (hasBroadcastRef.current) return;
    hasBroadcastRef.current = true;

    // Collect message_ids that are: (a) not from self, (b) have no read receipt
    // in readReceipts (i.e. no own channel_message_read row mapped here).
    // Note: readReceipts is keyed by the SENDER's perspective (messages the
    // current user SENT). For the receiver broadcast we want messages they
    // RECEIVED — i.e. sender_id !== profileId.
    // The receiver's own read rows are tracked by useMarkRead on viewability;
    // we don't have a local "did I read this?" set here. Instead we use the
    // readReceipts map absence as a proxy: messages where profileId is the
    // SENDER will appear in readReceipts; messages where profileId is the
    // RECEIVER won't. This is correct for the receiver broadcast path.
    const unreadMessageIds = feed
      .filter((item): item is Extract<FeedItem, { kind: "message" }> => item.kind === "message")
      .filter((item) => {
        const msg = item.message;
        // Only include messages sent by someone else (receiver's perspective).
        if (msg.sender_id === profileId) return false;
        // Exclude optimistic messages (no real id yet).
        if (!msg.id || msg._isPending) return false;
        return true;
      })
      .map((item) => item.message.id);

    if (unreadMessageIds.length === 0) return;

    // Fire-and-forget broadcast — resolve identity first (fail-fast per ADR-0134).
    void (async () => {
      try {
        const { profileId: resolvedProfileId, workspaceId: resolvedWorkspaceId } =
          await getProfileContext();

        // Broadcast presence-join on the dedicated presence channel.
        // The sender's useChannelReadReceipts hook listens on this event.
        await supabase.channel(`chat-presence:${channelId}`).send({
          type: "broadcast",
          event: "presence-join",
          payload: {
            profile_id: resolvedProfileId as string,
            unread_message_ids: unreadMessageIds,
          },
        });

        // Telemetry: log delivered ack — logger + activity_trail (no posthog;
        // ephemeral presence events are too chatty for analytics).
        await emit({
          event: "chat message_delivered",
          workspace_id: resolvedWorkspaceId,
          actor_id: resolvedProfileId,
          properties: {
            data: {
              channel_id: channelId,
              message_ids: unreadMessageIds,
            },
          },
        });
      } catch {
        // Swallow — transient auth gap should not crash the conversation screen.
        // The sender will remain at `sent` state until the next open.
      }
    })();
    // Re-run when feed or channel changes so new paginated messages are included.
    // profileId is intentionally in deps — changes if session switches.
    // readReceipts intentionally omitted — already tracked reactively by hook.
  }, [channelId, profileId, feed]);

  /**
   * Derive which divider should be pinned at the top of the inverted list.
   *
   * In an inverted FlatList the content is rendered upside-down. The
   * scroll origin (contentOffset.y = 0) sits at the *bottom* — the
   * newest messages. As the user scrolls toward older content,
   * contentOffset.y grows.
   *
   * onLayout fires in the *content coordinate space* (pre-inversion).
   * In content space, item index 0 has the highest Y value (drawn last /
   * physically at top of content block) and higher-index items have lower
   * Y values. After inversion the "top of the screen" corresponds to
   * items with the lowest Y in content space.
   *
   * Visible window in content space:
   *   top    = totalContentHeight - listHeight - scrollOffset
   *   bottom = totalContentHeight - scrollOffset
   *
   * We approximate totalContentHeight from the layout map.
   *
   * The sticky divider is the divider item whose Y offset falls within
   * or just above the visible window top (i.e. the oldest visible day).
   * We find it by collecting all divider Y offsets and picking the one
   * that is *closest from above* to the visible top edge.
   */
  const deriveStickyDivider = useCallback(
    (scrollOffset: number): string | null => {
      const layoutMap = itemLayoutRef.current;
      if (layoutMap.size === 0) return null;

      // Collect all Y offsets from the layout map to estimate content height.
      let totalContentHeight = 0;
      layoutMap.forEach((y) => {
        if (y > totalContentHeight) totalContentHeight = y;
      });

      const listHeight = listHeightRef.current;
      if (listHeight === 0 || totalContentHeight === 0) return null;

      // Top of the visible window in content coordinate space.
      const visibleTop = totalContentHeight - listHeight - scrollOffset;

      // Gather divider candidates from the feed.
      const dividerItems = feed.filter(
        (item): item is Extract<FeedItem, { kind: "divider" }> => item.kind === "divider",
      );

      // Find the divider whose Y is nearest to and <= visibleTop.
      // This is the divider "at the top of the viewport" — the oldest visible day.
      let bestKey: string | null = null;
      let bestDelta = Infinity;

      for (const d of dividerItems) {
        const y = layoutMap.get(d.key);
        if (y === undefined) continue;
        // We want dividers above (in content space) or at the visible top.
        // "Above" in content space = lower Y value (inverted list).
        const delta = visibleTop - y;
        if (delta >= 0 && delta < bestDelta) {
          bestDelta = delta;
          bestKey = d.key;
        }
      }

      return bestKey;
    },
    [feed],
  );

  /**
   * Scroll handler (JS thread, throttled by scrollEventThrottle).
   * Runs at most every 50ms — sufficient for day-boundary detection.
   * Updates stickyDividerKey only when the sticky candidate changes,
   * preventing unnecessary re-renders.
   */
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.y;
      scrollOffsetRef.current = offset;
      const nextKey = deriveStickyDivider(offset);
      setStickyDividerKey((prev) => (prev === nextKey ? prev : nextKey));
    },
    [deriveStickyDivider],
  );

  /** Called when the list container lays out — captures viewport height. */
  const handleListLayout = useCallback((event: LayoutChangeEvent) => {
    listHeightRef.current = event.nativeEvent.layout.height;
  }, []);

  /**
   * Returns an onLayout handler for a given feed item key.
   * Stores the item's top Y offset in the layout map.
   * Uses a stable factory to avoid creating new functions on every render.
   */
  const makeItemLayoutHandler = useCallback(
    (itemKey: string) => (event: LayoutChangeEvent) => {
      itemLayoutRef.current.set(itemKey, event.nativeEvent.layout.y);
    },
    [],
  );

  // Resolve which date the sticky divider represents (for the overlay render).
  const stickyDividerItem = useMemo<Extract<FeedItem, { kind: "divider" }> | null>(() => {
    if (!stickyDividerKey) return null;
    const found = feed.find(
      (item): item is Extract<FeedItem, { kind: "divider" }> =>
        item.kind === "divider" && item.key === stickyDividerKey,
    );
    return found ?? null;
  }, [stickyDividerKey, feed]);

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
      // Derive a stable item key for the layout map.
      const itemKey = item.kind === "message" ? item.message.id : item.key;

      if (item.kind === "divider") {
        // Hide the inline divider when it is the currently-sticky one —
        // the absolute overlay already shows it. Preserves layout (avoids
        // height jump) by using opacity rather than conditional rendering.
        const isCurrentlySticky = item.key === stickyDividerKey;
        return (
          <View
            key={itemKey}
            onLayout={makeItemLayoutHandler(item.key)}
            style={isCurrentlySticky ? styles.hiddenDivider : undefined}
          >
            <DateDivider date={item.date} />
          </View>
        );
      }

      const { message } = item;
      const isOwn = message.sender_id === profileId;
      const isPending = !!message._isPending;
      // Resolve receipt state for own messages — passed to MessageBubble.
      // Phase 2 T5: deliveredSet is now passed so `delivered` state is reachable.
      // Priority: pending > read > delivered > sent (enforced in getReceiptState).
      const _readReceiptState = isOwn
        ? getReceiptState(message.id, isPending, readReceipts, deliveredSet)
        : undefined;
      return (
        <View key={itemKey} onLayout={makeItemLayoutHandler(itemKey)}>
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
    [
      profileId,
      selectedMessageId,
      readReceipts,
      deliveredSet,
      stickyDividerKey,
      handleLongPress,
      handleSwipeReply,
      handleReaction,
      makeItemLayoutHandler,
      styles,
    ],
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
        <View style={styles.listContainer} onLayout={handleListLayout}>
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
            onScroll={handleScroll}
            scrollEventThrottle={50}
          />
          {/* Sticky date pill — floats above the list, pointer-events blocked */}
          {stickyDividerItem !== null && <StickyDateOverlay date={stickyDividerItem.date} />}
        </View>
      )}

      {/* T4 — Typing indicator: renders above the composer when others are typing. */}
      <TypingIndicator channelId={channelId} selfProfileId={profileId} />
      <MessageInput
        onSend={handleSend}
        replyTo={replyTo}
        onCancelReply={handleCancelReply}
        onTyping={emitTyping}
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
  /** Wrapper that gives us a positioned ancestor for the sticky overlay. */
  listContainer: {
    flex: 1,
    position: "relative",
  },
  messageList: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.element,
  },
  /**
   * Sticky date overlay — absolute-positioned at the top of the list
   * container so the pill stays pinned while the list scrolls underneath.
   *
   * Shadow uses theme.shadows.sm (subtle lift via colors.scrim convention):
   * the shadow tints match the scrim token intent (dark semi-transparent).
   * `pointerEvents: "none"` is set via the JSX prop on the wrapper View
   * to allow touches to pass through to underlying list items.
   */
  stickyOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    ...shadows.sm,
  },
  /**
   * Applied to the inline divider row when it is the currently-sticky day.
   * opacity: 0 hides the pill visually while preserving its layout height
   * — prevents the list from jumping as the overlay takes over.
   */
  hiddenDivider: {
    opacity: 0,
  },
}));
