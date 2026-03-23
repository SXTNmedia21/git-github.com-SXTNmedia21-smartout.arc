/**
 * ChannelRow — A single row in the channel list.
 *
 * Displays: channel name, last message preview (truncated), relative timestamp,
 * and an unread badge. Provides haptic feedback on press.
 *
 * Channel name mapping:
 * - department/team groups: use conversation.name
 * - session groups: "Dagvakt"
 * - DMs: show the other participant's name (falls back to conversation.name)
 */
import React, { useCallback } from "react";
import { View, Text, Pressable, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { createStyles } from "@/theme";
import { Badge } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import type { ConversationWithMeta } from "@/hooks/queries/use-conversations";

type ChannelRowProps = {
  conversation: ConversationWithMeta;
  onPress: () => void;
  style?: ViewStyle;
};

/** Formats a timestamp into a short relative or absolute string */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "N\u00e5";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}t`;

  // Show day and month for older messages
  return `${date.getDate()}.${date.getMonth() + 1}`;
}

/** Truncates a string to a max length with ellipsis */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "\u2026";
}

/** Returns a display name for the channel */
function getChannelName(conversation: ConversationWithMeta): string {
  if (conversation.source_type === "session") return "Dagvakt";
  return conversation.name ?? "Samtale";
}

/** Returns a suitable icon/emoji for the channel type */
function getChannelIcon(conversation: ConversationWithMeta): string {
  switch (conversation.source_type) {
    case "department":
      return "\ud83c\udfe2";
    case "team":
      return "\ud83d\udc65";
    case "session":
      return "\u26a1";
    default:
      return conversation.type === "dm" ? "" : "\ud83d\udcac";
  }
}

export function ChannelRow({ conversation, onPress, style }: ChannelRowProps) {
  const styles = useStyles();

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  const channelName = getChannelName(conversation);
  const channelIcon = getChannelIcon(conversation);
  const hasUnread = conversation.unreadCount > 0;

  const lastMessageText = conversation.lastMessage
    ? conversation.type === "dm"
      ? truncate(conversation.lastMessage.content, 50)
      : `${conversation.lastMessageSenderName ?? "Ukjent"}: ${truncate(conversation.lastMessage.content, 40)}`
    : "Ingen meldinger enn\u00e5";

  const timestamp = conversation.lastMessage
    ? formatTimestamp(conversation.lastMessage.created_at)
    : "";

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed, style]}
      accessibilityRole="button"
      accessibilityLabel={`${channelName}, ${lastMessageText}`}
    >
      {/* Avatar / icon area */}
      {conversation.type === "dm" ? (
        <Avatar name={channelName} imageUrl={conversation.avatar_url} size="md" />
      ) : (
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>{channelIcon}</Text>
        </View>
      )}

      {/* Content area */}
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={1}>
            {channelName}
          </Text>
          {timestamp ? (
            <Text style={[styles.timestamp, hasUnread && styles.timestampUnread]}>{timestamp}</Text>
          ) : null}
        </View>

        <View style={styles.bottomRow}>
          <Text style={[styles.preview, hasUnread && styles.previewUnread]} numberOfLines={1}>
            {lastMessageText}
          </Text>
          <Badge count={conversation.unreadCount} />
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.element,
    gap: theme.spacing.element,
  },
  pressed: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 18,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  name: {
    ...theme.typography.body,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.foreground,
    flex: 1,
  },
  nameUnread: {
    fontWeight: theme.fontWeights.bold,
  },
  timestamp: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  timestampUnread: {
    color: theme.colors.primary,
    fontWeight: theme.fontWeights.medium,
  },
  preview: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
    flex: 1,
  },
  previewUnread: {
    color: theme.colors.foreground,
    fontWeight: theme.fontWeights.medium,
  },
}));
