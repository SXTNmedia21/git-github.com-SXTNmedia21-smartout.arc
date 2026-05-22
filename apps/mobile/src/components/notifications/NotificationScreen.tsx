/**
 * NotificationScreen — full-screen notification center.
 *
 * Layout:
 *   SafeAreaView
 *     ↳ Header row: back button + "Varsler (N)" title + "Marker alle som lest"
 *     ↳ NotificationList (filter chips + infinite scroll)
 *
 * Profile is resolved via useMyProfile so the component is self-contained —
 * no props required from the parent route.
 *
 * Navigation: the screen lives at (me)/notifications and is pushed from
 * NotificationBell.onPress or HomeHeader.onNotificationPress.
 */

import React, { useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { ArrowLeft, CheckCheck } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { createStyles } from "@/theme";
import { mobileRouteForActionUrl } from "@/lib/deep-link";
import { NotificationList } from "./NotificationList";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useUnreadCount, useMarkAllAsRead } from "@/hooks/queries/use-notifications";
import type { Database } from "@smartout/supabase/database.types";

type Notification = Database["public"]["Tables"]["notification"]["Row"];

export function NotificationScreen() {
  const styles = useStyles();
  const router = useRouter();

  const { data: profile } = useMyProfile();
  const profileId = profile?.profile_id;

  const { data: unreadCount = 0 } = useUnreadCount(profileId);
  const { mutate: markAllAsRead, isPending: isMarkingAll } = useMarkAllAsRead(profileId);

  const handleBack = useCallback(() => {
    Haptics.selectionAsync();
    router.back();
  }, [router]);

  const handleMarkAll = useCallback(() => {
    if (isMarkingAll || unreadCount === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    markAllAsRead();
  }, [isMarkingAll, unreadCount, markAllAsRead]);

  /**
   * Handle tapping a notification row.
   * Mark-as-read is already handled inside NotificationList.
   * Navigate to the relevant screen based on action_url if present.
   * Uses router.push() so pressing back returns to notifications.
   */
  const handleNotificationPress = useCallback(
    (notification: Notification) => {
      if (!notification.action_url) return;
      const route = mobileRouteForActionUrl(notification.action_url);
      // Generic /dashboard or unknown → no navigation; the tap itself is the feedback.
      if (route) router.push(route as never);
    },
    [router],
  );

  // Title shows unread count badge when there are unread notifications
  const titleText = unreadCount > 0 ? `Varsler (${unreadCount})` : "Varsler";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Tilbake"
          hitSlop={8}
        >
          <ArrowLeft size={22} color={styles.iconColor.color} strokeWidth={2} />
        </Pressable>

        <Text style={styles.title}>{titleText}</Text>

        {/* Mark all as read — only tappable when there are unread notifications */}
        <Pressable
          onPress={handleMarkAll}
          style={[
            styles.markAllButton,
            (unreadCount === 0 || isMarkingAll) && styles.markAllDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Marker alle som lest"
          disabled={unreadCount === 0 || isMarkingAll}
          hitSlop={8}
        >
          <CheckCheck size={16} color={styles.markAllIconColor.color} strokeWidth={2} />
          <Text style={styles.markAllLabel}>Alle lest</Text>
        </Pressable>
      </View>

      {/* Notification list — handles filtering, infinite scroll, empty state */}
      <NotificationList profileId={profileId} onNotificationPress={handleNotificationPress} />
    </SafeAreaView>
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
    paddingHorizontal: theme.spacing.card,
    paddingVertical: theme.spacing.element,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.element,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.md,
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.foreground,
    flex: 1,
  },
  markAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.element,
    paddingVertical: theme.spacing.tight,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.muted,
  },
  markAllDisabled: {
    opacity: 0.4,
  },
  markAllLabel: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    fontWeight: theme.fontWeights.medium,
  },
  // Color-only styles for Lucide icons
  iconColor: {
    color: theme.colors.foreground,
  },
  markAllIconColor: {
    color: theme.colors.mutedForeground,
  },
}));
