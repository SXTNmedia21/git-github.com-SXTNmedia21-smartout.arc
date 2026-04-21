/**
 * Custom tab bar — Nordic Split glass bar with center AI FAB.
 *
 * Layout: Kalender | [FAB] | Chat | Me
 * All items rendered in a flat flexbox row with flex:1 each.
 * FAB is inserted at the midpoint.
 */

import React from "react";
import { View, Text, Pressable, Platform, StyleSheet } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Sun, CalendarDays, MessageCircle, User, LifeBuoy } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useTheme, withOpacity } from "@/theme";
import { Badge } from "@/components/ui/Badge";
import { strings } from "@/constants/strings";
import type { LucideIcon } from "lucide-react-native";

const TAB_ICONS: Record<string, LucideIcon> = {
  digest: Sun,
  "(shifts)": CalendarDays,
  "(komm)": LifeBuoy,
  "(chat)": MessageCircle,
  "(me)": User,
};

const TAB_LABELS: Record<string, string> = {
  digest: "Digest",
  "(shifts)": "Vakter",
  "(komm)": "Min kø",
  "(chat)": strings.tabs.chat,
  "(me)": "Min side",
};

type TabBarProps = BottomTabBarProps & {
  unreadCount?: number;
  unreadNotificationCount?: number;
  centerFab: React.ReactNode;
};

export function TabBar({
  state,
  descriptors,
  navigation,
  unreadCount = 0,
  unreadNotificationCount = 0,
  centerFab,
}: TabBarProps) {
  const theme = useTheme();

  const hiddenTabs = new Set(["(home)"]);
  const visibleRoutes = state.routes.filter((r) => {
    if (hiddenTabs.has(r.name)) return false;
    const options = descriptors[r.key]?.options;
    return (options as Record<string, unknown>)?.href !== null;
  });

  const midpoint = Math.floor(visibleRoutes.length / 2);

  // Build flat list: tabs interleaved with FAB at midpoint
  const items: React.ReactNode[] = [];

  visibleRoutes.forEach((route, i) => {
    // Insert FAB before the midpoint tab
    if (i === midpoint) {
      items.push(
        <View key="__fab__" style={styles.slot}>
          {centerFab}
        </View>,
      );
    }

    const routeIndex = state.routes.findIndex((r) => r.key === route.key);
    const isFocused = state.index === routeIndex;
    const IconComponent = TAB_ICONS[route.name];
    const isChatTab = route.name === "(chat)";
    const isMeTab = route.name === "(me)";
    const label = TAB_LABELS[route.name] ?? route.name;
    const iconColor = isFocused
      ? theme.colors.brandOrange
      : withOpacity(theme.colors.mutedForeground, 0.45);

    items.push(
      <Pressable
        key={route.key}
        onPress={() => {
          Haptics.selectionAsync();
          if (!isFocused) {
            navigation.navigate(route.name, { screen: "index" });
          } else {
            navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            navigation.navigate(route.name, { screen: "index" });
          }
        }}
        style={styles.slot}
        accessibilityRole="tab"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={label}
      >
        <View style={styles.iconWrap}>
          {IconComponent && (
            <IconComponent size={24} color={iconColor} strokeWidth={isFocused ? 2 : 1.5} />
          )}
          {isChatTab && <Badge count={unreadCount} style={styles.badge} />}
          {isMeTab && unreadNotificationCount > 0 && (
            <View style={[styles.notificationDot, { borderColor: theme.colors.background }]} />
          )}
        </View>
        <Text
          style={[
            styles.label,
            {
              color: isFocused
                ? theme.colors.brandOrange
                : withOpacity(theme.colors.mutedForeground, 0.45),
            },
            isFocused && styles.labelActive,
          ]}
        >
          {label}
        </Text>
        {isFocused && (
          <View style={[styles.activeDot, { backgroundColor: theme.colors.brandOrange }]} />
        )}
      </Pressable>,
    );
  });

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: withOpacity(theme.colors.background, 0.88),
          borderTopColor: withOpacity(theme.colors.brandOrange, 0.08),
        },
      ]}
    >
      {items}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 0.5,
    minHeight: 80,
    paddingBottom: Platform.OS === "ios" ? 28 : 14,
    paddingTop: 14,
    // Shadow
    shadowColor: "#1c1c19",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 8,
  },
  slot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    gap: 4,
  },
  iconWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  labelActive: {
    fontWeight: "600",
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -12,
  },
  notificationDot: {
    position: "absolute",
    top: -3,
    right: -5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e85c0d",
    borderWidth: 1.5,
  },
});
