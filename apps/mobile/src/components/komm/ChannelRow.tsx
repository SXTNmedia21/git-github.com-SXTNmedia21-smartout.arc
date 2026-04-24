/**
 * ChannelRow (komm) — Row in the new channel-schema list (ChannelWithPreview).
 *
 * Prototype parity: docs/design/smartout-design-helpdesk/project/prototype/chat-screens.jsx:199-232
 * (regular channels) and lines 234-270 (direct messages).
 *
 * Uses the same visual primitives as chat/ChannelRow — 36×36 rounded-sm
 * muted chip + channel name + uppercase mono timestamp + sender preview +
 * brand-orange unread badge. Direct messages delegate to DMItem.
 */
import React, { useCallback } from "react";
import { View, Text, Pressable, Platform, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { Hash, UtensilsCrossed, Wine, BellRing, type LucideIcon } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { DMItem } from "@/components/chat/DMItem";
import type { ChannelWithPreview } from "@/hooks/queries/use-channels";

type Props = {
  channel: ChannelWithPreview;
  onPress: () => void;
  onLongPress?: () => void;
  style?: ViewStyle;
};

const MONO_FAMILY = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "NÅ";
  if (diffMins < 60) return `${diffMins}M`;
  if (diffHours < 24) return `${diffHours}T`;
  return `${date.getDate()}.${date.getMonth() + 1}`;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

function getChannelIcon(channel: ChannelWithPreview): LucideIcon {
  const name = (channel.name ?? "").toLowerCase();
  if (name.includes("kjøkken") || name.includes("kokk")) return UtensilsCrossed;
  if (name.includes("bar")) return Wine;
  if (name.includes("service") || name.includes("servitør")) return BellRing;
  return Hash;
}

export function ChannelRow({ channel, onPress, onLongPress, style }: Props) {
  const styles = useStyles();
  const theme = useTheme();

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  const hasUnread = channel.unread_count > 0;
  const displayName = (channel.name ?? "Direktemelding").toLowerCase();

  // DMs delegate to DMItem for consistent card styling.
  if (channel.channel_type === "direct") {
    const dmName = channel.name ?? "Direktemelding";
    const timestamp = channel.last_message_at ? formatTimestamp(channel.last_message_at) : "";
    const preview = channel.last_message_content
      ? truncate(channel.last_message_content, 50)
      : "Ingen meldinger ennå";
    return (
      <DMItem
        name={dmName}
        time={timestamp}
        preview={preview}
        imageUrl={channel.last_message_sender_avatar}
        unread={hasUnread}
        read={!hasUnread}
        onPress={onPress}
        onLongPress={onLongPress}
        style={style}
      />
    );
  }

  const Icon = getChannelIcon(channel);
  const sender = channel.last_message_sender_name;
  const preview = channel.last_message_content
    ? truncate(channel.last_message_content, 45)
    : "Ingen meldinger ennå";
  const timestamp = channel.last_message_at ? formatTimestamp(channel.last_message_at) : "";

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        !hasUnread && styles.rowRead,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${displayName}, ${preview}`}
    >
      <View style={styles.chip}>
        <Icon size={16} color={withOpacity(theme.colors.mutedForeground, 0.6)} strokeWidth={1.6} />
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={1}>
            {displayName}
          </Text>
          {timestamp ? <Text style={styles.timestamp}>{timestamp}</Text> : null}
        </View>
        <Text style={styles.preview} numberOfLines={1}>
          {sender ? `${sender}: ${preview}` : preview}
        </Text>
      </View>

      {hasUnread && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{channel.unread_count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowPressed: {
    opacity: 0.75,
    backgroundColor: withOpacity(theme.colors.muted, 0.4),
  },
  rowRead: {
    opacity: 0.7,
  },
  chip: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  name: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: "600",
    color: theme.colors.foreground,
    marginRight: 8,
  },
  nameUnread: {
    fontWeight: "700",
  },
  timestamp: {
    fontFamily: MONO_FAMILY,
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: theme.colors.mutedForeground,
  },
  preview: {
    fontSize: 13,
    color: theme.colors.mutedForeground,
  },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.brandOrange,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#ffffff",
  },
}));
