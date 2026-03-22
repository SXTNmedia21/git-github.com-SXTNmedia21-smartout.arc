/**
 * ChannelRow — Row in the new channel list.
 * Shows channel name, last message preview, timestamp, and unread badge.
 * Uses the new channel schema types (ChannelWithPreview from get_my_channels RPC).
 */
import React, { useCallback } from "react";
import { View, Text, Pressable, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { createStyles } from "@/theme";
import { Badge } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import type { ChannelWithPreview } from "@/hooks/queries/use-channels";

type Props = {
  channel: ChannelWithPreview;
  onPress: () => void;
  style?: ViewStyle;
};

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "N\u00e5";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}t`;
  return `${date.getDate()}.${date.getMonth() + 1}`;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "\u2026";
}

const CHANNEL_ICONS: Record<string, string> = {
  department: "\ud83c\udfe2",
  team: "\ud83d\udc65",
  session: "\u26a1",
  custom: "#",
  direct: "",
  news: "\ud83d\udce2",
  skill: "\ud83d\udca1",
};

export function ChannelRow({ channel, onPress, style }: Props) {
  const styles = useStyles();

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  const hasUnread = channel.unread_count > 0;
  const icon = CHANNEL_ICONS[channel.channel_type] ?? "#";
  const displayName = channel.name ?? "Direktemelding";

  const lastMessageText = channel.last_message_content
    ? channel.channel_type === "direct"
      ? truncate(channel.last_message_content, 50)
      : `${channel.last_message_sender_name ?? "Ukjent"}: ${truncate(channel.last_message_content, 40)}`
    : "Ingen meldinger enn\u00e5";

  const timestamp = channel.last_message_at ? formatTimestamp(channel.last_message_at) : "";

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed, style]}
      accessibilityRole="button"
      accessibilityLabel={`${displayName}, ${lastMessageText}`}
    >
      {channel.channel_type === "direct" ? (
        <Avatar name={displayName} imageUrl={channel.last_message_sender_avatar} size="md" />
      ) : (
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>{icon}</Text>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={1}>
            {displayName}
          </Text>
          {timestamp ? (
            <Text style={[styles.timestamp, hasUnread && styles.timestampUnread]}>{timestamp}</Text>
          ) : null}
        </View>
        <View style={styles.bottomRow}>
          <Text style={[styles.preview, hasUnread && styles.previewUnread]} numberOfLines={1}>
            {lastMessageText}
          </Text>
          <Badge count={channel.unread_count} />
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
