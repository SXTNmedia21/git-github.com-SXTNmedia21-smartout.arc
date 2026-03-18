/**
 * Conversation screen — displays messages in an inverted FlatList.
 *
 * Subscribes to Supabase Realtime for live message delivery.
 * Messages are paginated (50 per page, load older on scroll).
 * Keyboard-aware: input stays above the keyboard.
 *
 * Optimistic messages (from useSendMessage) show a clock icon
 * until the sync worker delivers them to Supabase and Realtime
 * echoes them back.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { createStyles, useTheme } from "@/theme";
import { EmptyState } from "@/components/ui";
import { strings } from "@/constants/strings";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageInput } from "@/components/chat/MessageInput";
import { ReactionBar } from "@/components/chat/ReactionBar";
import { useMessages, type MessageWithSender } from "@/hooks/queries/use-messages";
import { useSendMessage } from "@/hooks/mutations/use-send-message";
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

  const listRef = useRef<FlatList>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMessages(conversationId ?? "");
  const { sendMessage } = useSendMessage();

  // Flatten paginated data into a single array
  const messages = useMemo(
    () => (data?.pages.flat() ?? []) as PendingMessage[],
    [data],
  );

  // Load current profile and conversation name on mount
  useEffect(() => {
    if (!user || !conversationId) return;

    async function loadContext() {
      const { data: profile } = await supabase
        .from("profile")
        .select("profile_id, first_name, last_name, avatar_url")
        .eq("user_id", user!.id)
        .limit(1)
        .single();

      if (profile) {
        setProfileId(profile.profile_id);
        setProfileName(
          [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
            "Meg",
        );
        setProfileAvatarUrl(profile.avatar_url);
      }

      const { data: conv } = await supabase
        .from("chat_conversation")
        .select("name, type, source_type")
        .eq("id", conversationId!)
        .single();

      if (conv) {
        setConversationName(conv.name ?? "Samtale");
      }
    }

    loadContext();
  }, [user, conversationId]);

  // Supabase Realtime subscription for new messages
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_message",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Database["public"]["Tables"]["chat_message"]["Row"];

          // Skip if this message was our own optimistic update
          // (we already have it in cache from useSendMessage)
          if (newMsg.sender_id === profileId) {
            // Replace the optimistic version (which has _isPending) with the real one
            queryClient.setQueryData(
              ["messages", conversationId],
              (old: { pages: PendingMessage[][]; pageParams: number[] } | undefined) => {
                if (!old) return old;
                const newPages = old.pages.map((page) =>
                  page.map((msg) => {
                    if (msg.id === newMsg.id && (msg as PendingMessage)._isPending) {
                      // Fetch sender info from existing message (already has it)
                      return {
                        ...newMsg,
                        senderName: msg.senderName,
                        senderAvatarUrl: msg.senderAvatarUrl,
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

          // Message from someone else — fetch sender profile and add to cache
          const { data: senderProfile } = await supabase
            .from("profile")
            .select("profile_id, first_name, last_name, avatar_url")
            .eq("profile_id", newMsg.sender_id)
            .single();

          const messageWithSender: MessageWithSender = {
            ...newMsg,
            senderName: senderProfile
              ? [senderProfile.first_name, senderProfile.last_name]
                  .filter(Boolean)
                  .join(" ") || "Ukjent"
              : "Ukjent",
            senderAvatarUrl: senderProfile?.avatar_url ?? null,
          };

          queryClient.setQueryData(
            ["messages", conversationId],
            (old: { pages: MessageWithSender[][]; pageParams: number[] } | undefined) => {
              if (!old) {
                return { pages: [[messageWithSender]], pageParams: [0] };
              }
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
      if (!profileId || !conversationId) return;

      await sendMessage({
        conversationId,
        content,
        senderProfileId: profileId,
        senderName: profileName,
        senderAvatarUrl: profileAvatarUrl,
        replyToId: replyTo?.id ?? null,
      });

      setReplyTo(null);
    },
    [
      profileId,
      conversationId,
      profileName,
      profileAvatarUrl,
      replyTo,
      sendMessage,
    ],
  );

  const handleLongPress = useCallback((messageId: string) => {
    setSelectedMessageId((prev) => (prev === messageId ? null : messageId));
  }, []);

  const handleReaction = useCallback(
    async (emoji: string) => {
      if (!selectedMessageId || !profileId) return;

      // Update reactions on the message optimistically
      // Reactions are stored as JSON — add this reaction
      queryClient.setQueryData(
        ["messages", conversationId],
        (old: { pages: PendingMessage[][]; pageParams: number[] } | undefined) => {
          if (!old) return old;
          const newPages = old.pages.map((page) =>
            page.map((msg) => {
              if (msg.id === selectedMessageId) {
                const currentReactions = Array.isArray(msg.reactions)
                  ? (msg.reactions as { emoji: string; profileId: string }[])
                  : [];
                return {
                  ...msg,
                  reactions: [
                    ...currentReactions,
                    { emoji, profileId },
                  ],
                };
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
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
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
        {selectedMessageId === item.id && (
          <ReactionBar onReaction={handleReaction} />
        )}
      </View>
    ),
    [profileId, selectedMessageId, handleLongPress, handleSwipeReply, handleReaction],
  );

  const keyExtractor = useCallback(
    (item: PendingMessage) => item.id,
    [],
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backButton}>{"<"}</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {conversationName}
        </Text>
        <View style={styles.headerSpacer} />
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
        style={{ paddingBottom: insets.bottom || 8 }}
      />
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
    paddingHorizontal: theme.spacing.page,
    paddingBottom: theme.spacing.tight,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    gap: theme.spacing.element,
  },
  backButton: {
    ...theme.typography.headline,
    color: theme.colors.primary,
    paddingRight: theme.spacing.xs,
  },
  headerTitle: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
    flex: 1,
  },
  headerSpacer: {
    width: 24,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
  },
  messageList: {
    paddingHorizontal: theme.spacing.page,
    paddingVertical: theme.spacing.element,
  },
}));
