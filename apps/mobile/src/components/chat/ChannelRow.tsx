/**
 * ChannelRow — Chat/Channel list row.
 *
 * Prototype parity: docs/design/smartout-design-helpdesk/project/prototype/chat-screens.jsx:199-232
 * and (for direct messages) lines 234-270.
 *
 * Regular channel: 36×36 rounded-sm muted chip with channel glyph (Hash /
 * UtensilsCrossed / Wine / BellRing depending on name) → channel name +
 * uppercase mono timestamp → `sender: preview` row → optional unread pill
 * (brand-orange w/ white count).
 *
 * Direct message: reuses `DMItem` so card styling + online-dot is consistent
 * with the prototype DIREKTE section.
 */
import React, { useCallback } from "react";
import { View, Text, Pressable, type ViewStyle, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { Hash, UtensilsCrossed, Wine, BellRing, type LucideIcon } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import type { ConversationWithMeta } from "@/hooks/queries/use-conversations";
import { DMItem } from "./DMItem";

type ChannelRowProps = {
  conversation: ConversationWithMeta;
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

function getChannelName(conversation: ConversationWithMeta): string {
  if (conversation.source_type === "session") return "dagvakt";
  return (conversation.name ?? "kanal").toLowerCase();
}

function getChannelIcon(conversation: ConversationWithMeta): LucideIcon {
  const name = (conversation.name ?? "").toLowerCase();
  if (name.includes("kjøkken") || name.includes("kokk")) return UtensilsCrossed;
  if (name.includes("bar")) return Wine;
  if (name.includes("service") || name.includes("servitør")) return BellRing;
  return Hash;
}

export function ChannelRow({ conversation, onPress, onLongPress, style }: ChannelRowProps) {
  const styles = useStyles();
  const theme = useTheme();

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  // DMs delegate to the DMItem card style.
  if (conversation.type === "direct") {
    const dmName = conversation.name ?? "Samtale";
    const timestamp = conversation.lastMessage
      ? formatTimestamp(conversation.lastMessage.created_at)
      : "";
    const preview = conversation.lastMessage
      ? truncate(conversation.lastMessage.content, 50)
      : "Ingen meldinger ennå";
    const hasUnread = conversation.unreadCount > 0;
    return (
      <DMItem
        name={dmName}
        time={timestamp}
        preview={preview}
        imageUrl={conversation.avatar_url}
        unread={hasUnread}
        read={!hasUnread}
        onPress={onPress}
        onLongPress={onLongPress}
        style={style}
      />
    );
  }

  const name = getChannelName(conversation);
  const Icon = getChannelIcon(conversation);
  const hasUnread = conversation.unreadCount > 0;

  const sender = conversation.lastMessageSenderName;
  const preview = conversation.lastMessage
    ? truncate(conversation.lastMessage.content, 45)
    : "Ingen meldinger ennå";
  const timestamp = conversation.lastMessage
    ? formatTimestamp(conversation.lastMessage.created_at)
    : "";

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
      accessibilityLabel={`${name}, ${preview}`}
    >
      <View style={styles.chip}>
        <Icon size={16} color={withOpacity(theme.colors.mutedForeground, 0.6)} strokeWidth={1.6} />
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={1}>
            {name}
          </Text>
          {timestamp ? <Text style={styles.timestamp}>{timestamp}</Text> : null}
        </View>
        <Text style={styles.preview} numberOfLines={1}>
          {sender ? `${sender}: ${preview}` : preview}
        </Text>
      </View>

      {hasUnread && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{conversation.unreadCount}</Text>
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
