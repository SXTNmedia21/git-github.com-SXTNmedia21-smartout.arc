/**
 * App group layout — 4-tab navigation with center AI FAB.
 *
 * Tabs: Hjem, Vakter, Chat, Meg
 * Center: AI FAB — elevated circular button.
 *   Tap → WalkAi voice session
 *   Long press → Botsson text chat
 *
 * Uses a custom TabBar component that renders the FAB in the center slot.
 */

import React, { useCallback, useRef } from "react";
import { View } from "react-native";
import { Tabs } from "expo-router";
import type GorhomBottomSheet from "@gorhom/bottom-sheet";
import { createStyles } from "@/theme";
import { TabBar } from "@/components/navigation/TabBar";
import { AIFab } from "@/components/navigation/AIFab";
import { BotssonSheet } from "@/components/ai/BotssonSheet";
import { WalkAiSheet } from "@/components/ai/WalkAiSheet";
import { WalkAiProvider } from "@/providers/walkai-provider";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useUnreadCount } from "@/hooks/queries/use-notifications";
import { strings } from "@/constants/strings";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

export default function AppLayout() {
  const styles = useStyles();

  // Profile + unread count for the notification dot on the Meg tab
  const { data: profile } = useMyProfile();
  const { data: unreadNotificationCount = 0 } = useUnreadCount(profile?.profile_id);

  const botssonSheetRef = useRef<GorhomBottomSheet>(null);
  const walkAiSheetRef = useRef<GorhomBottomSheet>(null);

  // FAB tap → open WalkAi voice session
  const handleFabTap = useCallback(() => {
    walkAiSheetRef.current?.expand();
  }, []);

  // FAB long press → open Botsson text chat
  const handleFabLongPress = useCallback(() => {
    botssonSheetRef.current?.expand();
  }, []);

  const handleBotssonDismiss = useCallback(() => {
    botssonSheetRef.current?.close();
  }, []);

  const handleWalkAiDismiss = useCallback(() => {
    walkAiSheetRef.current?.close();
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
    <WalkAiProvider>
      <View style={styles.container}>
        <Tabs screenOptions={{ headerShown: false }} tabBar={renderTabBar}>
          <Tabs.Screen name="(home)" options={{ title: strings.tabs.home }} />
          <Tabs.Screen name="(shifts)" options={{ title: strings.tabs.shifts }} />
          <Tabs.Screen name="(chat)" options={{ title: strings.tabs.chat }} />
          <Tabs.Screen name="(komm)" options={{ title: "Komm", href: null }} />
          <Tabs.Screen name="(me)" options={{ title: strings.tabs.me }} />
        </Tabs>

        {/* WalkAi voice sheet — opened on FAB tap */}
        <WalkAiSheet ref={walkAiSheetRef} onDismiss={handleWalkAiDismiss} />

        {/* Botsson text chat sheet — opened on FAB long press */}
        <BotssonSheet ref={botssonSheetRef} onDismiss={handleBotssonDismiss} />
      </View>
    </WalkAiProvider>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));
