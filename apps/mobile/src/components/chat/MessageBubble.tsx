/**
 * MessageBubble — Renders a single chat message.
 *
 * Own messages align right with brand color background.
 * Others' messages align left with secondary background + sender name + avatar.
 * Pending (offline-queued) messages show a clock icon.
 * System messages render centered and muted.
 *
 * Long-press triggers the reaction bar (handled by parent).
 * Swipe-right triggers reply context (handled by parent).
 */
import React, { useCallback } from "react";
import { View, Text, Pressable, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { createStyles, useTheme } from "@/theme";
import { Avatar } from "@/components/common/Avatar";
import type { MessageWithSender } from "@/hooks/queries/use-messages";

type MessageBubbleProps = {
  message: MessageWithSender;
  isOwnMessage: boolean;
  isPending: boolean;
  onLongPress: () => void;
  onSwipeReply: () => void;
  style?: ViewStyle;
};

/** Formats a message timestamp to HH:MM */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function MessageBubble({
  message,
  isOwnMessage,
  isPending,
  onLongPress,
  onSwipeReply,
  style,
}: MessageBubbleProps) {
  const styles = useStyles();
  const theme = useTheme();

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress();
  }, [onLongPress]);

  // System messages render differently
  if (message.is_system) {
    return (
      <View style={[styles.systemContainer, style]}>
        <Text style={styles.systemText}>{message.content}</Text>
      </View>
    );
  }

  // Render reactions if present
  const reactions = Array.isArray(message.reactions)
    ? (message.reactions as { emoji: string; profileId: string }[])
    : [];
  const groupedReactions = reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <View style={[styles.row, isOwnMessage ? styles.rowOwn : styles.rowOther, style]}>
      {/* Avatar — only for other people's messages */}
      {!isOwnMessage && (
        <Avatar
          name={message.senderName}
          imageUrl={message.senderAvatarUrl}
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
        accessibilityLabel={`${message.senderName}: ${message.content}`}
      >
        {/* Sender name — only for other people's messages */}
        {!isOwnMessage && <Text style={styles.senderName}>{message.senderName}</Text>}

        {/* Reply reference */}
        {message.reply_to_id && (
          <View style={styles.replyIndicator}>
            <Text style={styles.replyText} numberOfLines={1}>
              Svar
            </Text>
          </View>
        )}

        {/* Message content */}
        <Text style={[styles.content, isOwnMessage ? styles.contentOwn : styles.contentOther]}>
          {message.content}
        </Text>

        {/* Footer: timestamp + pending indicator */}
        <View style={styles.footer}>
          <Text
            style={[styles.timestamp, isOwnMessage ? styles.timestampOwn : styles.timestampOther]}
          >
            {formatTime(message.created_at)}
          </Text>
          {isPending && (
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

      {/* Reactions */}
      {Object.keys(groupedReactions).length > 0 && (
        <View
          style={[
            styles.reactionsContainer,
            isOwnMessage ? styles.reactionsContainerOwn : styles.reactionsContainerOther,
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
    borderBottomRightRadius: theme.radius.xs,
  },
  bubbleOther: {
    backgroundColor: theme.colors.secondary,
    borderBottomLeftRadius: theme.radius.xs,
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
  reactionsContainerOwn: {
    justifyContent: "flex-end",
  },
  reactionsContainerOther: {
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
