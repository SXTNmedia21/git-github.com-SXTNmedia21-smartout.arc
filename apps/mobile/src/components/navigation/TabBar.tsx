/**
 * Custom tab bar with 4 tabs and a center AI FAB cutout.
 *
 * Tabs: Hjem, Vakter, [FAB], Chat, Meg
 * The FAB occupies the center position — it's not a tab but a floating
 * circular button that breaks the tab bar line upward.
 * Unread badge shown on the Chat tab.
 * Notification dot shown on the Meg tab when there are unread notifications.
 */

import React from "react";
import { View, Text, Pressable, Platform } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Home, CalendarDays, Radio, MessageCircle, User } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { createStyles } from "@/theme";
import { Badge } from "@/components/ui/Badge";
import { strings } from "@/constants/strings";
import type { LucideIcon } from "lucide-react-native";

/** Tab icon mapping — Lucide icons for crisp, scalable rendering */
const TAB_ICONS: Record<string, LucideIcon> = {
  "(home)": Home,
  "(shifts)": CalendarDays,
  "(komm)": Radio,
  "(chat)": MessageCircle,
  "(me)": User,
};

const TAB_LABELS: Record<string, string> = {
  "(home)": strings.tabs.home,
  "(shifts)": strings.tabs.shifts,
  "(komm)": "Komm",
  "(chat)": strings.tabs.chat,
  "(me)": strings.tabs.me,
};

type TabBarProps = BottomTabBarProps & {
  /** Unread chat message count for badge */
  unreadCount?: number;
  /** Unread notification count — shows a dot on the Meg tab when > 0 */
  unreadNotificationCount?: number;
  /** Center FAB component — rendered in the middle slot */
  centerFab: React.ReactNode;
};

export function TabBar({
  state,
  navigation,
  unreadCount = 0,
  unreadNotificationCount = 0,
  centerFab,
}: TabBarProps) {
  const styles = useStyles();

  // Filter out hidden tabs (href: null) and split into left/right around FAB
  const visibleRoutes = state.routes.filter((r) => r.name !== "(chat)");
  const leftRoutes = visibleRoutes.slice(0, 2);
  const rightRoutes = visibleRoutes.slice(2);

  function renderTab(route: (typeof state)["routes"][number]) {
    const routeIndex = state.routes.findIndex((r) => r.key === route.key);
    const isFocused = state.index === routeIndex;
    const IconComponent = TAB_ICONS[route.name];
    const isKommTab = route.name === "(komm)";
    const isMeTab = route.name === "(me)";
    const label = isKommTab ? "Komm" : (TAB_LABELS[route.name] ?? route.name);

    return (
      <Pressable
        key={route.key}
        onPress={() => {
          Haptics.selectionAsync();
          if (!isFocused) {
            navigation.navigate(route.name);
          }
        }}
        style={styles.tab}
        accessibilityRole="tab"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={label}
      >
        <View style={styles.tabIconContainer}>
          {IconComponent && (
            <IconComponent
              size={22}
              color={isFocused ? styles.tabIconActiveColor.color : styles.tabIconColor.color}
              strokeWidth={isFocused ? 2.2 : 1.8}
            />
          )}
          {isKommTab && <Badge count={unreadCount} style={styles.badge} />}
          {/* Notification dot on the Meg tab — shows when there are unread notifications */}
          {isMeTab && unreadNotificationCount > 0 && <View style={styles.notificationDot} />}
        </View>
        <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.barBackground}>
        {/* Left tabs */}
        {leftRoutes.map((route) => renderTab(route))}

        {/* Center FAB placeholder — takes up tab width but the FAB overflows upward */}
        <View style={styles.fabSlot}>{centerFab}</View>

        {/* Right tabs */}
        {rightRoutes.map((route) => renderTab(route))}
      </View>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    position: "relative",
  },
  barBackground: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingBottom: Platform.OS === "ios" ? 20 : 8,
    paddingTop: 8,
    ...theme.shadows.md,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 4,
  },
  tabIconContainer: {
    position: "relative",
  },
  /** Color-only styles used to pass color values to Lucide components */
  tabIconColor: {
    color: theme.colors.mutedForeground,
  },
  tabIconActiveColor: {
    color: theme.colors.brandOrange,
  },
  tabLabel: {
    ...theme.typography.micro,
    color: theme.colors.mutedForeground,
  },
  tabLabelActive: {
    color: theme.colors.brandOrange,
    fontWeight: theme.fontWeights.semibold,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
  },
  /** Small filled dot on the Meg tab when unread notifications exist */
  notificationDot: {
    position: "absolute",
    top: -3,
    right: -5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e85c0d",
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  fabSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
}));
