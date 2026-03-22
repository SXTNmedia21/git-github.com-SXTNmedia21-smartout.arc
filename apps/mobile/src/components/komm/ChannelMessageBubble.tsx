/**
 * ChannelMessageBubble — Renders a single channel message.
 * Own messages align right with primary color. Others align left with sender name.
 * System messages render centered and muted.
 * Long-press triggers reaction bar. Swipe triggers reply.
 */
import React, { useCallback } from "react";
import { View, Text, Pressable, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { createStyles } from "@/theme";
import { Avatar } from "@/components/common/Avatar";
import type { ChannelMessageWithSender } from "@/hooks/queries/use-channel-messages";

const SYSTEM_TYPES = new Set(["system", "brief", "handoff", "announcement", "reminder", "summary"]);

type Props = {
  message: ChannelMessageWithSender & { _isPending?: boolean };
  isOwnMessage: boolean;
  onLongPress: () => void;
  onSwipeReply: () => void;
  style?: ViewStyle;
};

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

export function ChannelMessageBubble({
  message,
  isOwnMessage,
  onLongPress,
  onSwipeReply,
  style,
}: Props) {
  const styles = useStyles();

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress();
  }, [onLongPress]);

  // Deleted messages
  if (message.deleted_at) {
    return (
      <View style={[styles.systemContainer, style]}>
        <Text style={styles.systemText}>Melding slettet</Text>
      </View>
    );
  }

  // System messages
  if (SYSTEM_TYPES.has(message.message_type)) {
    return (
      <View style={[styles.systemContainer, style]}>
        <Text style={styles.systemText}>{message.content}</Text>
      </View>
    );
  }

  // Group reactions by emoji
  const groupedReactions = message.reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <View style={[styles.row, isOwnMessage ? styles.rowOwn : styles.rowOther, style]}>
      {!isOwnMessage && (
        <Avatar
          name={message.sender_name ?? "?"}
          imageUrl={message.sender_avatar}
          size="sm"
          style={styles.avatar}
        />
      )}

      <Pressable
        onLongPress={handleLongPress}
        delayLongPress={300}
        style={({ pressed }) => [
          styles.bubble,
          isOwnMessage ? styles.bubbleOwn : styles.bubbleOther,
          pressed && styles.bubblePressed,
        ]}
        accessibilityLabel={`${message.sender_name}: ${message.content}`}
      >
        {!isOwnMessage && <Text style={styles.senderName}>{message.sender_name ?? "Ukjent"}</Text>}

        {message.reply_to_id && message.reply_to_content && (
          <View style={styles.replyIndicator}>
            <Text style={styles.replyLabel}>{message.reply_to_sender_name}</Text>
            <Text style={styles.replyText} numberOfLines={1}>
              {message.reply_to_content}
            </Text>
          </View>
        )}

        <Text style={[styles.content, isOwnMessage ? styles.contentOwn : styles.contentOther]}>
          {message.content}
        </Text>

        <View style={styles.footer}>
          <Text
            style={[styles.timestamp, isOwnMessage ? styles.timestampOwn : styles.timestampOther]}
          >
            {formatTime(message.created_at)}
          </Text>
          {message._isPending && (
            <Text
              style={[
                styles.pendingIcon,
                isOwnMessage ? styles.timestampOwn : styles.timestampOther,
              ]}
            >
              {"\ud83d\udd51"}
            </Text>
          )}
        </View>
      </Pressable>

      {Object.keys(groupedReactions).length > 0 && (
        <View
          style={[
            styles.reactionsContainer,
            isOwnMessage ? styles.reactionsOwn : styles.reactionsOther,
          ]}
        >
          {Object.entries(groupedReactions).map(([emoji, count]) => (
            <View key={emoji} style={styles.reactionPill}>
              <Text style={styles.reactionEmoji}>
                {emoji} {count > 1 ? count : ""}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  row: {
    marginVertical: 2,
    maxWidth: "80%",
  },
  rowOwn: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  rowOther: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: theme.spacing.xs,
  },
  avatar: {
    marginBottom: 2,
  },
  bubble: {
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
    maxWidth: "100%",
  },
  bubbleOwn: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: theme.radius.sm,
  },
  bubbleOther: {
    backgroundColor: theme.colors.secondary,
    borderBottomLeftRadius: theme.radius.sm,
  },
  bubblePressed: {
    opacity: 0.85,
  },
  senderName: {
    ...theme.typography.caption,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.primary,
    marginBottom: 2,
  },
  replyIndicator: {
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.primary,
    paddingLeft: theme.spacing.xs,
    marginBottom: 4,
  },
  replyLabel: {
    ...theme.typography.micro,
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.primary,
  },
  replyText: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  content: {
    ...theme.typography.body,
  },
  contentOwn: {
    color: theme.colors.primaryForeground,
  },
  contentOther: {
    color: theme.colors.foreground,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 2,
  },
  timestamp: {
    ...theme.typography.micro,
  },
  timestampOwn: {
    color: theme.colors.primaryForeground,
    opacity: 0.7,
  },
  timestampOther: {
    color: theme.colors.mutedForeground,
  },
  pendingIcon: {
    fontSize: 10,
  },
  systemContainer: {
    alignSelf: "center",
    paddingVertical: theme.spacing.tight,
    paddingHorizontal: theme.spacing.element,
    marginVertical: theme.spacing.xs,
  },
  systemText: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    textAlign: "center",
    fontStyle: "italic",
  },
  reactionsContainer: {
    flexDirection: "row",
    gap: 4,
    marginTop: 2,
  },
  reactionsOwn: {
    justifyContent: "flex-end",
  },
  reactionsOther: {
    marginLeft: 40,
  },
  reactionPill: {
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reactionEmoji: {
    fontSize: 12,
  },
}));
