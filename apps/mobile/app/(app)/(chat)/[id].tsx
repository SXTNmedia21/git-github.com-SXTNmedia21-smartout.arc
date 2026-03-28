/**
 * Conversation screen — Nordic Split chat detail.
 *
 * Header: back arrow, channel name (serif, orange), member count, avatar stack, search
 * Messages: inverted FlatList with date markers, received/sent bubbles, system messages
 * Input: attachment button, text area with emoji, contextual mic/send button
 *
 * Subscribes to Supabase Realtime on `channel_message` for live message delivery.
 * Messages are cursor-paginated (50 per page, load older on scroll).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, FlatList, KeyboardAvoidingView, Platform, Pressable, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { ArrowLeft, Search, Phone } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { EmptyState } from "@/components/ui";
import { strings } from "@/constants/strings";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageInput } from "@/components/chat/MessageInput";
import { ReactionBar } from "@/components/chat/ReactionBar";
import { CallBar } from "@/features/channels/components/CallBar";
import { CallSheet } from "@/features/channels/components/CallSheet";
import { useLiveKitCall } from "@/hooks/mutations/use-livekit-call";
import { useMessages, type MessageWithSender } from "@/hooks/queries/use-messages";
import { useSendMessage } from "@/hooks/mutations/use-send-message";
import { startCall, getLiveKitToken } from "@smartout/walkie-talkie";
import type { CallSession } from "@smartout/walkie-talkie";
import type { Database } from "@smartout/supabase/database.types";

type PendingMessage = MessageWithSender & { _isPending?: boolean };

export default function ConversationScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [replyTo, setReplyTo] = useState<MessageWithSender | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [conversationName, setConversationName] = useState("");
  const [memberCount, setMemberCount] = useState(0);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // ─── Call state ─────────────────────────────────────
  const [callSession, setCallSession] = useState<CallSession | null>(null);
  const [lkToken, setLkToken] = useState<string | null>(null);
  const [lkServerUrl, setLkServerUrl] = useState<string | null>(null);
  const [isCallSheetOpen, setIsCallSheetOpen] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);

  const {
    room,
    isConnected,
    isMicEnabled,
    activeSpeakers,
    participantCount,
    connect,
    disconnect,
    toggleMic,
  } = useLiveKitCall({
    token: lkToken,
    serverUrl: lkServerUrl,
    callSession,
    onDisconnected: () => {
      setCallSession(null);
      setLkToken(null);
      setLkServerUrl(null);
      setIsCallSheetOpen(false);
    },
  });

  const handleStartCall = useCallback(async () => {
    if (!conversationId || !workspaceId) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const result = await startCall(supabase, {
        channelId: conversationId,
        workspaceId,
        callType: "group",
      });
      const tokenResult = await getLiveKitToken(supabase, {
        channelId: conversationId,
        workspaceId,
      });
      setCallSession({
        id: result.callSessionId,
        channelId: conversationId,
        workspaceId,
        callType: result.callType,
        livekitRoomName: result.roomName,
        status: "active",
        audioPolicy: "open_mic",
        videoPolicy: "optional",
        startedBy: profileId,
        maxParticipants: 0,
        startedAt: new Date().toISOString(),
        endedAt: null,
      });
      setLkToken(tokenResult.token);
      setLkServerUrl(tokenResult.serverUrl);
    } catch (err) {
      console.error("[CallStart] Failed:", err);
    }
  }, [conversationId, workspaceId, profileId]);

  // Auto-connect when token is available
  useEffect(() => {
    if (lkToken && lkServerUrl && !isConnected) {
      connect();
    }
  }, [lkToken, lkServerUrl, isConnected, connect]);

  const handleEndCall = useCallback(async () => {
    await disconnect();
  }, [disconnect]);

  const handleToggleCamera = useCallback(async () => {
    if (!room) return;
    const next = !isCameraEnabled;
    await room.localParticipant.setCameraEnabled(next);
    setIsCameraEnabled(next);
  }, [room, isCameraEnabled]);

  const listRef = useRef<FlatList>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useMessages(
    conversationId ?? "",
  );
  const { sendMessage } = useSendMessage();

  const messages = useMemo(() => (data?.pages.flat() ?? []) as PendingMessage[], [data]);

  // Load current profile, channel name, and member count from channel schema
  useEffect(() => {
    if (!user || !conversationId) return;

    async function loadContext() {
      const { data: profile } = await supabase
        .from("profile")
        .select("profile_id, display_name, avatar_url, workspace_id")
        .eq("user_id", user!.id)
        .limit(1)
        .single();

      if (profile) {
        setProfileId(profile.profile_id);
        setProfileName(profile.display_name || "Meg");
        setProfileAvatarUrl(profile.avatar_url);
        setWorkspaceId(profile.workspace_id);
      }

      // Load channel info from the channel table
      const { data: conv } = await supabase
        .from("channel")
        .select("name, channel_type, workspace_id")
        .eq("channel_id", conversationId!)
        .single();

      if (conv) {
        setConversationName(conv.name ?? "Samtale");
      }

      // Get active member count from channel_member
      const { count } = await supabase
        .from("channel_member")
        .select("id", { count: "exact", head: true })
        .eq("channel_id", conversationId!)
        .is("left_at", null);

      setMemberCount(count ?? 0);
    }

    loadContext();
  }, [user, conversationId]);

  // Supabase Realtime subscription on channel_message
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`channel:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "channel_message",
          filter: `channel_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Database["public"]["Tables"]["channel_message"]["Row"];

          // If this is our own message, replace the optimistic version
          if (newMsg.sender_id === profileId) {
            queryClient.setQueryData(
              ["channel-messages", conversationId],
              (
                old: { pages: PendingMessage[][]; pageParams: (string | undefined)[] } | undefined,
              ) => {
                if (!old) return old;
                const newPages = old.pages.map((page) =>
                  page.map((msg) => {
                    // Match by client_message_id for dedup
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

          // Message from someone else — fetch sender profile and prepend
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
            ["channel-messages", conversationId],
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
  }, [conversationId, profileId, queryClient]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!profileId || !conversationId || !workspaceId) return;
      await sendMessage({
        channelId: conversationId,
        content,
        senderProfileId: profileId,
        senderName: profileName,
        senderAvatarUrl: profileAvatarUrl,
        replyToId: replyTo?.id ?? null,
        workspaceId,
      });
      setReplyTo(null);
    },
    [profileId, conversationId, workspaceId, profileName, profileAvatarUrl, replyTo, sendMessage],
  );

  const handleLongPress = useCallback((messageId: string) => {
    setSelectedMessageId((prev) => (prev === messageId ? null : messageId));
  }, []);

  const handleReaction = useCallback(
    async (emoji: string) => {
      if (!selectedMessageId || !profileId) return;
      queryClient.setQueryData(
        ["channel-messages", conversationId],
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
    [selectedMessageId, profileId, conversationId, queryClient],
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

  const renderMessage = useCallback(
    ({ item }: { item: PendingMessage }) => (
      <View>
        <MessageBubble
          message={item}
          isOwnMessage={item.sender_id === profileId}
          isPending={!!item._isPending}
          onLongPress={() => handleLongPress(item.id)}
          onSwipeReply={() => handleSwipeReply(item)}
        />
        {selectedMessageId === item.id && <ReactionBar onReaction={handleReaction} />}
      </View>
    ),
    [profileId, selectedMessageId, handleLongPress, handleSwipeReply, handleReaction],
  );

  const keyExtractor = useCallback((item: PendingMessage) => item.id, []);

  const channelPrefix = conversationName.startsWith("#") ? "" : "#";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              router.back();
            }}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Tilbake"
          >
            <ArrowLeft size={22} color={theme.colors.foreground} strokeWidth={1.8} />
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {channelPrefix}
              {conversationName.toLowerCase()}
            </Text>
            {memberCount > 0 && (
              <Text style={styles.headerSubtitle}>
                {memberCount} {memberCount === 1 ? "medlem" : "medlemmer"}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            onPress={isConnected ? undefined : handleStartCall}
            style={[styles.headerButton, isConnected && { opacity: 0.4 }]}
            accessibilityRole="button"
            accessibilityLabel={strings.call.startCall}
          >
            <Phone size={20} color={theme.colors.brandOrange} strokeWidth={1.6} />
          </Pressable>
          <Pressable
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Søk"
          >
            <Search size={20} color={theme.colors.foreground} strokeWidth={1.6} />
          </Pressable>
        </View>
      </View>

      {/* Messages */}
      {messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState title={strings.chat.noMessages} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          inverted
          contentContainerStyle={styles.messageList}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        replyTo={replyTo}
        onCancelReply={handleCancelReply}
        style={{ paddingBottom: isConnected ? 0 : insets.bottom || 8 }}
      />

      {/* Active Call Bar — shown at bottom when in a call */}
      {isConnected && (
        <CallBar
          participantCount={participantCount}
          isMicEnabled={isMicEnabled}
          activeSpeakers={activeSpeakers}
          onToggleMic={toggleMic}
          onEndCall={handleEndCall}
          onPress={() => setIsCallSheetOpen(true)}
        />
      )}

      {/* Call Sheet — expanded view */}
      {isConnected && isCallSheetOpen && callSession && (
        <CallSheet
          room={room}
          channelName={conversationName}
          channelId={conversationId ?? ""}
          audioPolicy={callSession.audioPolicy}
          videoPolicy={callSession.videoPolicy}
          isMicEnabled={isMicEnabled}
          isCameraEnabled={isCameraEnabled}
          callStartedAt={callSession.startedAt}
          onToggleMic={toggleMic}
          onToggleCamera={handleToggleCamera}
          onEndCall={handleEndCall}
          onClose={() => setIsCallSheetOpen(false)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.element,
    borderBottomWidth: 0.5,
    borderBottomColor: withOpacity(theme.colors.brandOrange, 0.1),
    backgroundColor: withOpacity(theme.colors.background, 0.88),
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    flex: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  headerInfo: {
    flex: 1,
    gap: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.brandOrange,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    textTransform: "uppercase",
    color: withOpacity(theme.colors.mutedForeground, 0.6),
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
