/**
 * Channel conversation screen — displays messages in an inverted FlatList.
 *
 * Subscribes to Supabase Realtime for live message delivery.
 * Messages paginated via get_channel_messages() RPC (50 per page, load older on scroll).
 * Keyboard-aware: input stays above keyboard.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, FlatList, KeyboardAvoidingView, Platform, Pressable, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";
import { createStyles } from "@/theme";
import { EmptyState } from "@/components/ui";
import { ChannelMessageBubble } from "@/components/channels/ChannelMessageBubble";
import { MessageInput } from "@/components/chat/MessageInput";
import { ReactionBar } from "@/components/chat/ReactionBar";
import {
  useChannelMessages,
  type ChannelMessageWithSender,
} from "@/hooks/queries/use-channel-messages";
import { useSendChannelMessage } from "@/hooks/mutations/use-send-channel-message";

type PendingMessage = ChannelMessageWithSender & { _isPending?: boolean };

export default function ChannelConversationScreen() {
  const { id: channelId } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [replyTo, setReplyTo] = useState<ChannelMessageWithSender | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [channelName, setChannelName] = useState("");

  const listRef = useRef<FlatList>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useChannelMessages(
    channelId ?? null,
  );
  const { sendMessage } = useSendChannelMessage();

  const messages = useMemo(() => (data?.pages.flat() ?? []) as PendingMessage[], [data]);

  // Load profile and channel info on mount
  useEffect(() => {
    if (!user || !channelId) return;

    async function loadContext() {
      const { data: profile } = await supabase
        .from("profile")
        .select("profile_id, workspace_id, display_name, avatar_url")
        .eq("user_id", user!.id)
        .limit(1)
        .single();

      if (profile) {
        setProfileId(profile.profile_id);
        setProfileName(profile.display_name || "Meg");
        setProfileAvatarUrl(profile.avatar_url);
        setWorkspaceId(profile.workspace_id);
      }

      const { data: channel } = await supabase
        .from("channel")
        .select("name, channel_type")
        .eq("id", channelId!)
        .single();

      if (channel) {
        setChannelName(channel.name ?? "Kanal");
      }
    }

    loadContext();
  }, [user, channelId]);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!channelId) return;

    const channel = supabase
      .channel(`mobile-channel:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channel_message",
          filter: `channel_id=eq.${channelId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["channels", "messages", channelId] });
          queryClient.invalidateQueries({ queryKey: ["channels", "list"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, queryClient]);

  const handleSend = useCallback(
    async (content: string) => {
      if (!profileId || !channelId || !workspaceId) return;

      await sendMessage({
        channelId,
        workspaceId,
        content,
        senderProfileId: profileId,
        senderName: profileName,
        senderAvatarUrl: profileAvatarUrl,
        replyToId: replyTo?.message_id ?? null,
      });

      setReplyTo(null);
    },
    [profileId, channelId, workspaceId, profileName, profileAvatarUrl, replyTo, sendMessage],
  );

  const handleLongPress = useCallback((messageId: string) => {
    setSelectedMessageId((prev) => (prev === messageId ? null : messageId));
  }, []);

  const handleReaction = useCallback(async (_emoji: string) => {
    // Reaction toggle will be wired to the channel_message_reaction table
    setSelectedMessageId(null);
  }, []);

  const handleSwipeReply = useCallback((message: ChannelMessageWithSender) => {
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

  // Adapt replyTo to the shape MessageInput expects
  const replyToForInput = replyTo
    ? {
        id: replyTo.message_id,
        content: replyTo.content,
        sender_id: replyTo.sender_id,
        senderName: replyTo.sender_name ?? "Ukjent",
        senderAvatarUrl: replyTo.sender_avatar,
      }
    : null;

  const renderMessage = useCallback(
    ({ item }: { item: PendingMessage }) => (
      <View>
        <ChannelMessageBubble
          message={item}
          isOwnMessage={item.sender_id === profileId}
          onLongPress={() => handleLongPress(item.message_id)}
          onSwipeReply={() => handleSwipeReply(item)}
        />
        {selectedMessageId === item.message_id && <ReactionBar onReaction={handleReaction} />}
      </View>
    ),
    [profileId, selectedMessageId, handleLongPress, handleSwipeReply, handleReaction],
  );

  const keyExtractor = useCallback((item: PendingMessage) => item.message_id, []);

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
          {channelName}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Messages */}
      {messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState title="Ingen meldinger enna. Start samtalen!" />
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

      {/* Input — reuse existing MessageInput component */}
      <MessageInput
        onSend={handleSend}
        replyTo={replyToForInput as never}
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
