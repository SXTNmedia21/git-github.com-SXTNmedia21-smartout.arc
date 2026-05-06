/**
 * App group layout — 5-tab navigation with center Add FAB.
 *
 * Canonical layout per ADR-0268 (Phase 3f, 2026-05-04 handoff):
 *   Kalender · Vakter · ⊕ FAB · Chat · Min Tid
 *
 * FAB is the center slot (position 3). It triggers AddSheet — NOT a route.
 * Tabs removed from config (folders kept): (home), digest, (komm).
 *
 * Each tab screen manages its own header.
 */

import React, { useCallback, useRef } from "react";
import { View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import type GorhomBottomSheet from "@gorhom/bottom-sheet";
import { createStyles } from "@/theme";
import { TabBar } from "@/components/navigation/TabBar";
import { AIFab } from "@/components/navigation/AIFab";
import { BotssonSheet } from "@/components/ai/BotssonSheet";
import { BotssonProvider } from "@/providers/botsson-provider";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useUnreadCount } from "@/hooks/queries/use-notifications";
import { strings } from "@/constants/strings";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

// Canonical Expo Router initial route declaration — more reliable than the
// initialRouteName prop on <Tabs> when the target screen has href: null.
// Ensures /(app) always resolves to (calendar) as the daily anchor tab.
// (home) is kept in the config with href:null so Expo Router doesn't 404 on
// the existing folder; it is not shown in the tab bar.
export const unstable_settings = {
  initialRouteName: "(calendar)",
};

export default function AppLayout() {
  const styles = useStyles();
  const router = useRouter();

  const { data: profile } = useMyProfile();
  const { data: unreadNotificationCount = 0 } = useUnreadCount(profile?.profile_id);

  const botssonSheetRef = useRef<GorhomBottomSheet>(null);

  const handleFabTap = useCallback(() => {
    botssonSheetRef.current?.expand();
  }, []);

  const handleFabLongPress = useCallback(() => {
    botssonSheetRef.current?.expand();
  }, []);

  const handleBotssonDismiss = useCallback(() => {
    botssonSheetRef.current?.close();
  }, []);

  const renderTabBar = useCallback(
    (props: BottomTabBarProps) => (
      <TabBar
        {...props}
        unreadNotificationCount={unreadNotificationCount}
        centerFab={<AIFab onTap={handleFabTap} onLongPress={handleFabLongPress} />}
      />
    ),
    [handleFabTap, handleFabLongPress, unreadNotificationCount],
  );

  return (
    <BotssonProvider>
      <View style={styles.container}>
        <Tabs
          screenOptions={{ headerShown: false }}
          initialRouteName="(calendar)"
          tabBar={renderTabBar}
        >
          {/* ── 5-tab canonical layout per ADR-0268 ─────────────────────── */}
          <Tabs.Screen name="(calendar)" options={{ title: strings.tabs.kalender }} />
          <Tabs.Screen name="(shifts)" options={{ title: strings.tabs.vakter }} />
          {/* FAB slot: center button in TabBar — no navigable route */}
          <Tabs.Screen name="(chat)" options={{ title: strings.tabs.chat }} />
          <Tabs.Screen name="(me)" options={{ title: strings.tabs.minTid }} />

          {/* ── Hidden legacy folders — DO NOT remove, folders still exist ─ */}
          {/* Expo Router shows 404 if a folder exists but no Tabs.Screen entry */}
          <Tabs.Screen name="(home)" options={{ href: null }} />
          <Tabs.Screen name="digest" options={{ href: null }} />
          <Tabs.Screen name="(komm)" options={{ href: null }} />
          <Tabs.Screen name="(queue)" options={{ href: null }} />
          <Tabs.Screen name="journey" options={{ href: null }} />
          {/* Suppress journey/[id]/guided dynamic route from auto-tab-leak. */}
          <Tabs.Screen name="journey/[id]/guided" options={{ href: null }} />
        </Tabs>

        <BotssonSheet ref={botssonSheetRef} onDismiss={handleBotssonDismiss} />
      </View>
    </BotssonProvider>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));
