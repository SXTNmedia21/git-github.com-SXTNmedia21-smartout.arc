/**
 * App group layout — 5-tab navigation with center Add FAB.
 *
 * Canonical layout per ADR-0268 (Phase 3f, 2026-05-04 handoff):
 *   Kalender · Vakter · ⊕ FAB · Chat · Min Tid
 *
 * FAB tap = return to Kalender (start anchor per ADR-0268).
 * FAB long-press = open BotssonSheet directly (AI discoverability — 2026-05-20).
 * FAB swipe up layer 1 (80px) = open AddSheet.
 * FAB swipe up layer 2 (160px) = open AddSheet + BotssonSheet stacked.
 *
 * FabHint renders a first-run tooltip above the FAB to advertise the long-press
 * AI entry. Auto-dismisses or marks-seen on first long-press / swipe-layer2.
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
import { FabHint } from "@/components/navigation/FabHint";
import { BotssonSheet } from "@/components/ai/BotssonSheet";
import { BotssonProvider } from "@/providers/botsson-provider";
import { useBotssonSettingsStore } from "@/hooks/stores/use-botsson-settings-store";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useUnreadCount } from "@/hooks/queries/use-notifications";
import { strings } from "@/constants/strings";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { AddSheet, type AddSheetHandle } from "@/components/calendar/AddSheet";

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
  const addSheetRef = useRef<AddSheetHandle>(null);
  const markFabHintSeen = useBotssonSettingsStore((s) => s.setHasSeenFabHint);

  /** Tap → return to Kalender (daily anchor per ADR-0268). */
  const handleFabTap = useCallback(() => {
    router.replace("/(app)/(calendar)");
  }, [router]);

  /** Long-press → open BotssonSheet directly (discoverable AI entry). */
  const handleFabLongPress = useCallback(() => {
    markFabHintSeen(true);
    botssonSheetRef.current?.expand();
  }, [markFabHintSeen]);

  /** Swipe layer 1 (≥80px up) → open AddSheet only. */
  const handleFabSwipeLayer1 = useCallback(() => {
    addSheetRef.current?.open();
  }, []);

  /** Swipe layer 2 (≥160px up) → open AddSheet + BotssonSheet stacked. */
  const handleFabSwipeLayer2 = useCallback(() => {
    markFabHintSeen(true);
    addSheetRef.current?.open();
    botssonSheetRef.current?.expand();
  }, [markFabHintSeen]);

  const handleBotssonDismiss = useCallback(() => {
    botssonSheetRef.current?.close();
  }, []);

  const renderTabBar = useCallback(
    (props: BottomTabBarProps) => (
      <TabBar
        {...props}
        unreadNotificationCount={unreadNotificationCount}
        centerFab={
          <AIFab
            onTap={handleFabTap}
            onLongPress={handleFabLongPress}
            onSwipeLayer1={handleFabSwipeLayer1}
            onSwipeLayer2={handleFabSwipeLayer2}
          />
        }
      />
    ),
    [
      handleFabTap,
      handleFabLongPress,
      handleFabSwipeLayer1,
      handleFabSwipeLayer2,
      unreadNotificationCount,
    ],
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
          {/* digest.tsx deleted 2026-05-14 (ADR-0318) — no suppression needed */}
          <Tabs.Screen name="(komm)" options={{ href: null }} />
          <Tabs.Screen name="(queue)" options={{ href: null }} />
          <Tabs.Screen name="journey" options={{ href: null }} />
          {/* Suppress journey/[id]/guided dynamic route from auto-tab-leak. */}
          <Tabs.Screen name="journey/[id]/guided" options={{ href: null }} />
        </Tabs>

        {/* AddSheet mounts before BotssonSheet so BotssonSheet renders on top (higher z-index). */}
        <AddSheet ref={addSheetRef} selectedDate={new Date()} />
        <BotssonSheet ref={botssonSheetRef} onDismiss={handleBotssonDismiss} />
        <FabHint message={strings.botsson.fabHint} />
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
