/**
 * App group layout — 4-tab navigation with center AI FAB.
 *
 * Tabs: Hjem, Vakter, Chat, Meg
 * Center: AI FAB — elevated circular button.
 *   Tap → WalkAi voice session
 *   Long press → Botsson text chat
 *
 * Each tab screen manages its own header:
 * - Home: burger menu (→ settings) + bell
 * - Other tabs: back arrow + title + contextual actions
 */

import React, { useCallback, useRef } from "react";
import { View } from "react-native";
import { Tabs, useRouter } from "expo-router";
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
  const router = useRouter();

  const { data: profile } = useMyProfile();
  const { data: unreadNotificationCount = 0 } = useUnreadCount(profile?.profile_id);

  const botssonSheetRef = useRef<GorhomBottomSheet>(null);
  const walkAiSheetRef = useRef<GorhomBottomSheet>(null);

  const handleFabTap = useCallback(() => {
    walkAiSheetRef.current?.expand();
  }, []);

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
        <Tabs
          screenOptions={{ headerShown: false }}
          initialRouteName="(home)"
          tabBar={renderTabBar}
        >
          <Tabs.Screen name="(home)" options={{ href: null }} />
          <Tabs.Screen name="digest" options={{ title: "Digest" }} />
          <Tabs.Screen name="(shifts)" options={{ title: "Kalender" }} />
          <Tabs.Screen name="(chat)" options={{ title: strings.tabs.chat }} />
          <Tabs.Screen name="(me)" options={{ title: "Min side" }} />
          <Tabs.Screen name="(payroll)" options={{ href: null }} />
        </Tabs>

        <WalkAiSheet ref={walkAiSheetRef} onDismiss={handleWalkAiDismiss} />
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
