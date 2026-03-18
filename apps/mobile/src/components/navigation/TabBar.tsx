/**
 * Custom tab bar with 4 tabs and a center AI FAB cutout.
 *
 * Tabs: Hjem, Vakter, [FAB], Chat, Meg
 * The FAB occupies the center position — it's not a tab but a floating
 * circular button that breaks the tab bar line upward.
 * Unread badge shown on the Chat tab.
 */

import React from "react";
import { View, Text, Pressable, Platform } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { createStyles, withOpacity } from "@/theme";
import { Badge } from "@/components/ui/Badge";
import { strings } from "@/constants/strings";

/** Tab icons — using text emoji as placeholders (replace with Lucide in polish pass) */
const TAB_ICONS: Record<string, string> = {
  "(home)": "🏠",
  "(shifts)": "📅",
  "(chat)": "💬",
  "(me)": "👤",
};

const TAB_LABELS: Record<string, string> = {
  "(home)": strings.tabs.home,
  "(shifts)": strings.tabs.shifts,
  "(chat)": strings.tabs.chat,
  "(me)": strings.tabs.me,
};

type TabBarProps = BottomTabBarProps & {
  /** Unread chat message count for badge */
  unreadCount?: number;
  /** Center FAB component — rendered in the middle slot */
  centerFab: React.ReactNode;
};

export function TabBar({ state, navigation, unreadCount = 0, centerFab }: TabBarProps) {
  const styles = useStyles();

  // Split routes into left (first 2) and right (last 2) around the FAB
  const leftRoutes = state.routes.slice(0, 2);
  const rightRoutes = state.routes.slice(2);

  function renderTab(route: (typeof state.routes)[number], index: number) {
    const isFocused = state.index === index;
    const icon = TAB_ICONS[route.name] ?? "?";
    const label = TAB_LABELS[route.name] ?? route.name;
    const isChatTab = route.name === "(chat)";

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
          <Text style={[styles.tabIcon, isFocused && styles.tabIconActive]}>
            {icon}
          </Text>
          {isChatTab && <Badge count={unreadCount} style={styles.badge} />}
        </View>
        <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.barBackground}>
        {/* Left tabs */}
        {leftRoutes.map((route, i) => renderTab(route, i))}

        {/* Center FAB placeholder — takes up tab width but the FAB overflows upward */}
        <View style={styles.fabSlot}>{centerFab}</View>

        {/* Right tabs */}
        {rightRoutes.map((route, i) => renderTab(route, i + 2))}
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
  tabIcon: {
    fontSize: 22,
    opacity: 0.5,
  },
  tabIconActive: {
    opacity: 1,
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
  fabSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
}));
