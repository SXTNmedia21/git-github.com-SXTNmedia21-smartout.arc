/**
 * NotificationSheet — Bottom sheet for recent notifications.
 *
 * Triggered by the bell icon in HomeHeader. Queries real notifications
 * from the `notification` table for the current user's profile.
 * Falls back to an empty state when no notifications exist.
 */

import React, { forwardRef, useMemo, useCallback } from "react";
import { View, Text, Pressable, FlatList, ActivityIndicator } from "react-native";
import type GorhomBottomSheet from "@gorhom/bottom-sheet";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  MessageCircle,
  Inbox,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { createStyles, useTheme, type ThemeColors } from "@/theme";
import { useNotifications, useMarkAsRead } from "@/hooks/queries/use-notifications";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import type { LucideIcon } from "lucide-react-native";
import type { Database } from "@smartout/supabase/database.types";

type Notification = Database["public"]["Tables"]["notification"]["Row"];

/** Map icon_type values from the DB to display categories */
type NotificationType = "shift" | "message" | "deviation" | "task";

function resolveNotificationType(iconType: string): NotificationType {
  if (iconType.includes("shift") || iconType.includes("schedule")) return "shift";
  if (iconType.includes("message") || iconType.includes("chat")) return "message";
  if (iconType.includes("deviation") || iconType.includes("alert")) return "deviation";
  return "task";
}

const ICON_MAP: Record<NotificationType, LucideIcon> = {
  shift: Calendar,
  message: MessageCircle,
  deviation: AlertTriangle,
  task: CheckCircle2,
};

const COLOR_KEY_MAP: Record<NotificationType, keyof ThemeColors> = {
  shift: "info",
  message: "brandCyan",
  deviation: "warning",
  task: "success",
};

/** Formats a notification timestamp into a short relative string */
function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "nå";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} t`;
  const days = Math.floor(hours / 24);
  return `${days} d`;
}

export const NotificationSheet = forwardRef<GorhomBottomSheet>(
  function NotificationSheet(_props, ref) {
    const styles = useStyles();
    const snapPoints = useMemo(() => ["50%", "80%"], []);
    const { colors } = useTheme();
    const { data: profile } = useMyProfile();
    const { data, isLoading } = useNotifications(profile?.profile_id);
    const markAsRead = useMarkAsRead();

    /* Flatten paginated results into a single list */
    const notifications = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);

    const handlePress = useCallback(
      (item: Notification) => {
        Haptics.selectionAsync();
        if (!item.is_read) {
          markAsRead.mutate(item.id);
        }
      },
      [markAsRead],
    );

    const renderItem = useCallback(
      ({ item }: { item: Notification }) => {
        const type = resolveNotificationType(item.icon_type);
        const Icon = ICON_MAP[type];
        const color = colors[COLOR_KEY_MAP[type]] as string;

        return (
          <Pressable
            style={({ pressed }) => [
              styles.notificationRow,
              !item.is_read && styles.unread,
              pressed && styles.pressed,
            ]}
            onPress={() => handlePress(item)}
            accessibilityRole="button"
          >
            <View style={[styles.iconCircle, { backgroundColor: color + "15" }]}>
              <Icon size={18} color={color} strokeWidth={2} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.title, !item.is_read && styles.titleUnread]}>{item.title}</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {item.body ?? ""}
              </Text>
            </View>
            <Text style={styles.time}>{formatRelativeTime(item.created_at)}</Text>
          </Pressable>
        );
      },
      [styles, colors, handlePress],
    );

    return (
      <BottomSheet ref={ref} index={-1} snapPoints={snapPoints}>
        <View style={styles.header}>
          <Bell size={20} color={styles.headerIcon.color} strokeWidth={2} />
          <Text style={styles.headerTitle}>Varsler</Text>
        </View>
        {isLoading ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator size="small" color={colors.mutedForeground} />
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Inbox size={32} color={colors.mutedForeground} strokeWidth={1.2} />
            <Text style={styles.emptyText}>Ingen varsler</Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
          />
        )}
      </BottomSheet>
    );
  },
);

const useStyles = createStyles((theme) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
    paddingBottom: theme.spacing.element,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.element,
  },
  headerIcon: {
    color: theme.colors.foreground,
  },
  headerTitle: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },
  list: {
    paddingBottom: theme.spacing.xl,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.xl * 2,
    gap: theme.spacing.element,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
  },
  notificationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    paddingVertical: theme.spacing.element,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radius.md,
  },
  unread: {
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
  },
  pressed: {
    opacity: 0.7,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...theme.typography.subheadline,
    color: theme.colors.foreground,
  },
  titleUnread: {
    fontWeight: theme.fontWeights.semibold,
  },
  subtitle: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  time: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
}));
