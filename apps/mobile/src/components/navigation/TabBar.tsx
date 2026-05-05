/**
 * Custom tab bar — Nordic Split glass bar with center Add FAB.
 *
 * 5-slot layout per ADR-0268 (2026-05-04 handoff):
 *   Kalender · Vakter · ⊕ FAB · Chat · Min Tid
 *
 * FAB is always the center slot (index 2). Tabs occupy slots 0-1 and 3-4.
 * Active state: orange icon + label + 4 px orange dot below label.
 *
 * Tap feedback uses Haptics.selectionAsync (matches springAmbient UX intent —
 * light, ambient acknowledgment without overshoot).
 */

import React from "react";
import { View, Text, Pressable, Platform, StyleSheet } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Calendar, Users, MessageCircle, Clock3 } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useTheme, withOpacity } from "@/theme";
import { Badge } from "@/components/ui/Badge";
import { strings } from "@/constants/strings";
import type { LucideIcon } from "lucide-react-native";

// Canonical 5-tab icon map per ADR-0268.
// Only the 4 navigable tabs appear here — FAB slot is handled separately.
const TAB_ICONS: Record<string, LucideIcon> = {
  "(calendar)": Calendar,
  "(shifts)": Users,
  "(chat)": MessageCircle,
  "(me)": Clock3,
};

const TAB_LABELS: Record<string, string> = {
  "(calendar)": strings.tabs.kalender,
  "(shifts)": strings.tabs.vakter,
  "(chat)": strings.tabs.chat,
  "(me)": strings.tabs.minTid,
};

// FAB is always inserted at visual slot index 2 (center of 5 slots).
const FAB_SLOT_INDEX = 2;

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

  // Filter to navigable routes only.
  // Two layers:
  // 1. options.href === null filter (declarative, set on _layout.tsx <Tabs.Screen>)
  // 2. Forced hide-set (defense in depth) — expo-router does NOT propagate
  //    `href: null` reliably to descriptors.options when a custom tabBar prop is used.
  //    Verified 2026-05-04: screenshot showed (home) + journey/[id]/guided rendering
  //    despite href:null on _layout.tsx side. Hardcode legacy + dynamic auto-leaks here.
  const hiddenTabs = new Set<string>([
    "(home)", // FAB-only access — Redirect via (home)/index.tsx → shift-hub
    "digest", // legacy hidden per ADR-0268 5-tab canonical
    "(komm)", // legacy hidden per ADR-0268 5-tab canonical
    "(queue)", // helpdesk-queue auto-leak (route dir exists, no href:null on _layout)
    "journey", // legacy hidden per ADR-0268 5-tab canonical
    "journey/[id]/guided", // dynamic-route auto-leak
  ]);
  const visibleRoutes = state.routes.filter((r) => {
    const options = descriptors[r.key]?.options;
    if ((options as Record<string, unknown>)?.href === null) return false;
    if (hiddenTabs.has(r.name)) return false;
    return true;
  });

  // Build the 5-slot row: tabs at slots 0-1 and 3-4, FAB fixed at slot 2.
  // We accumulate tab nodes and splice in the FAB at FAB_SLOT_INDEX.
  const tabNodes: React.ReactNode[] = visibleRoutes.map((route) => {
    const routeIndex = state.routes.findIndex((r) => r.key === route.key);
    const isFocused = state.index === routeIndex;
    const IconComponent = TAB_ICONS[route.name];
    const isChatTab = route.name === "(chat)";
    const isMeTab = route.name === "(me)";
    const label = TAB_LABELS[route.name] ?? route.name;
    const iconColor = isFocused
      ? theme.colors.brandOrange
      : withOpacity(theme.colors.mutedForeground, 0.45);

    return (
      <Pressable
        key={route.key}
        onPress={() => {
          // selectionAsync = ambient haptic — light, no overshoot (springAmbient feel)
          void Haptics.selectionAsync();
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
            <View
              style={[
                styles.notificationDot,
                {
                  backgroundColor: theme.colors.brandOrange,
                  borderColor: theme.colors.background,
                },
              ]}
            />
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
      </Pressable>
    );
  });

  // Splice FAB into the center slot.
  const fabNode = (
    <View key="__fab__" style={styles.slot}>
      {centerFab}
    </View>
  );
  const items = [...tabNodes.slice(0, FAB_SLOT_INDEX), fabNode, ...tabNodes.slice(FAB_SLOT_INDEX)];

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
    // backgroundColor set inline via theme.colors.brandOrange — no hardcoded hex
    borderWidth: 1.5,
  },
});
