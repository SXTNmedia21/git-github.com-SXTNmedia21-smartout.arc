/**
 * NotificationBell — bell icon button with animated unread badge.
 *
 * Used in HomeHeader as the primary entry point to the notification center.
 * The badge animates in/out using a spring scale so it feels alive.
 *
 * On press: navigates to (me)/notifications.
 *
 * The badge is hidden when unreadCount is 0, shows a number up to 99,
 * then "99+" — matching the web NotificationBell behaviour.
 */

import React, { useEffect } from "react";
import { View, Pressable } from "react-native";
import { Bell } from "lucide-react-native";
import { useRouter } from "expo-router";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { createStyles } from "@/theme";
import { Badge } from "@/components/ui/Badge";
import { useUnreadCount } from "@/hooks/queries/use-notifications";

type NotificationBellProps = {
  profileId: string | undefined;
  /** Icon size, defaults to 22 */
  size?: number;
  /** Icon stroke width, defaults to 1.6 */
  strokeWidth?: number;
};

export function NotificationBell({
  profileId,
  size = 22,
  strokeWidth = 1.6,
}: NotificationBellProps) {
  const styles = useStyles();
  const router = useRouter();

  const { data: unreadCount = 0 } = useUnreadCount(profileId);

  // Spring scale on the badge so it "pops" when a new notification arrives
  const badgeScale = useSharedValue(unreadCount > 0 ? 1 : 0);

  useEffect(() => {
    badgeScale.value = withSpring(unreadCount > 0 ? 1 : 0, {
      damping: 12,
      stiffness: 200,
      mass: 0.8,
    });
  }, [unreadCount, badgeScale]);

  const animatedBadgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  const handlePress = () => {
    Haptics.selectionAsync();
    router.push("/(app)/(me)/notifications");
  };

  return (
    <Pressable
      onPress={handlePress}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel={unreadCount > 0 ? `Varsler, ${unreadCount} uleste` : "Varsler"}
      hitSlop={8}
    >
      <View style={styles.iconContainer}>
        <Bell size={size} color={styles.iconColor.color} strokeWidth={strokeWidth} />

        {/* Animated badge — spring scales in when unreadCount goes above 0 */}
        <Animated.View style={[styles.badgeWrapper, animatedBadgeStyle]}>
          <Badge count={unreadCount} style={styles.badge} />
        </Animated.View>
      </View>
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  button: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  iconContainer: {
    position: "relative",
  },
  iconColor: {
    color: "rgba(0,0,0,0.35)",
  },
  badgeWrapper: {
    position: "absolute",
    top: -6,
    right: -8,
  },
  badge: {
    // Badge component handles its own sizing — no override needed
  },
}));
