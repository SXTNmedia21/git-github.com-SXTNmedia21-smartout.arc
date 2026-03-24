/**
 * NotificationRow — single row in the notification list.
 *
 * Layout:
 *   [icon circle] [title + body + time]  [unread dot]
 *
 * Title is semibold when the notification is unread.
 * The unread dot is a small filled circle on the right edge.
 * Tapping the row calls onPress — parent handles mark-as-read + navigation.
 *
 * icon_type → Lucide icon mapping mirrors the web NotificationBell component
 * so the visual language is consistent across surfaces.
 */

import React from "react";
import { View, Text, Pressable } from "react-native";
import {
  CalendarDays,
  CheckSquare,
  AlertTriangle,
  MessageCircle,
  BookOpen,
  Bell,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { createStyles } from "@/theme";
import type { LucideIcon } from "lucide-react-native";
import type { Database } from "@smartout/supabase/database.types";

type Notification = Database["public"]["Tables"]["notification"]["Row"];

/** Lucide icon for each notification icon_type */
const ICON_MAP: Record<string, LucideIcon> = {
  shift: CalendarDays,
  task: CheckSquare,
  deviation: AlertTriangle,
  message: MessageCircle,
  training: BookOpen,
};

/** Background tint color (15% opacity) for each icon_type */
const COLOR_MAP: Record<string, string> = {
  shift: "#3b82f6",
  task: "#22c55e",
  deviation: "#f59e0b",
  message: "#06b6d4",
  training: "#8b5cf6",
};

const DEFAULT_COLOR = "#e85c0d"; // brand orange fallback

/**
 * Returns a human-readable relative time string in Norwegian.
 * Examples: "nå", "5 min", "2 t", "3 d"
 */
function formatRelativeTime(isoStr: string): string {
  const diffMs = Date.now() - new Date(isoStr).getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "nå";
  if (diffMin < 60) return `${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} t`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} d`;
}

type NotificationRowProps = {
  notification: Notification;
  onPress: (notification: Notification) => void;
};

export function NotificationRow({ notification, onPress }: NotificationRowProps) {
  const styles = useStyles();

  const iconType = notification.icon_type ?? "bell";
  const Icon = ICON_MAP[iconType] ?? Bell;
  const color = COLOR_MAP[iconType] ?? DEFAULT_COLOR;
  const isUnread = !notification.is_read;
  const relativeTime = formatRelativeTime(notification.created_at);

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress(notification);
      }}
      style={({ pressed }) => [
        styles.row,
        isUnread && styles.rowUnread,
        pressed && styles.rowPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={notification.title ?? "Varsel"}
      accessibilityState={{ selected: !isUnread }}
    >
      {/* Icon circle with tinted background */}
      <View style={[styles.iconCircle, { backgroundColor: color + "18" }]}>
        <Icon size={18} color={color} strokeWidth={2} />
      </View>

      {/* Text content */}
      <View style={styles.textBlock}>
        <Text style={[styles.title, isUnread && styles.titleUnread]} numberOfLines={1}>
          {notification.title ?? "Varsel"}
        </Text>
        {notification.body ? (
          <Text style={styles.body} numberOfLines={2}>
            {notification.body}
          </Text>
        ) : null}
        <Text style={styles.time}>{relativeTime}</Text>
      </View>

      {/* Unread dot — only rendered when is_read is false */}
      {isUnread && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.element,
    paddingVertical: theme.spacing.element,
    paddingHorizontal: theme.spacing.card,
    borderRadius: theme.radius.md,
  },
  rowUnread: {
    backgroundColor: "rgba(0,0,0,0.025)",
  },
  rowPressed: {
    opacity: 0.75,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  textBlock: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  title: {
    ...theme.typography.subheadline,
    color: theme.colors.foreground,
  },
  titleUnread: {
    fontWeight: theme.fontWeights.semibold,
  },
  body: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    lineHeight: 18,
  },
  time: {
    ...theme.typography.micro,
    color: theme.colors.mutedForeground,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.brandOrange,
    marginTop: 6,
    flexShrink: 0,
  },
}));
