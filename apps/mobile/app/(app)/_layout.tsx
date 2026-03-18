/**
 * App group layout — 4-tab navigation with center AI FAB.
 *
 * Tabs: Hjem, Vakter, Chat, Meg
 * Center: AI FAB (Botsson) — elevated circular button.
 *
 * Uses a custom TabBar component that renders the FAB in the center slot.
 * QuickActions overlay appears on FAB swipe-up with phase-aware shortcuts.
 */

import React, { useCallback, useState } from "react";
import { View, Linking } from "react-native";
import { Tabs } from "expo-router";
import { useSharedValue, withSpring } from "react-native-reanimated";
import { createStyles } from "@/theme";
import { TabBar } from "@/components/navigation/TabBar";
import { AIFab } from "@/components/navigation/AIFab";
import { QuickActions } from "@/components/navigation/QuickActions";
import { useShiftPhase } from "@/hooks/stores/use-shift-phase";
import { strings } from "@/constants/strings";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

export default function AppLayout() {
  const styles = useStyles();
  const { phase } = useShiftPhase();
  const [quickActionsVisible, setQuickActionsVisible] = useState(false);
  const quickActionsVisibility = useSharedValue(0);

  const showQuickActions = useCallback(() => {
    setQuickActionsVisible(true);
    quickActionsVisibility.value = withSpring(1, { damping: 15, stiffness: 200 });
  }, [quickActionsVisibility]);

  const hideQuickActions = useCallback(() => {
    quickActionsVisibility.value = withSpring(0, { damping: 15, stiffness: 200 });
    // Delay hiding the component until animation completes
    setTimeout(() => setQuickActionsVisible(false), 300);
  }, [quickActionsVisibility]);

  const handleFabPress = useCallback(() => {
    // Placeholder: opens Botsson sheet in Phase 11
    // For now, toggle quick actions as a preview
  }, []);

  const handleQuickAction = useCallback(
    (actionKey: string) => {
      hideQuickActions();

      // Map action keys to their handlers
      // Most of these will be wired to proper navigation/modals in later phases
      switch (actionKey) {
        case "call_leader":
          // Would need leader phone from context — placeholder
          break;
        default:
          // Other actions will be connected in Phase 7-11
          break;
      }
    },
    [hideQuickActions],
  );

  const renderTabBar = useCallback(
    (props: BottomTabBarProps) => (
      <TabBar
        {...props}
        centerFab={
          <AIFab
            onPress={handleFabPress}
            onSwipeUp={showQuickActions}
          />
        }
      />
    ),
    [handleFabPress, showQuickActions],
  );

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={renderTabBar}
      >
        <Tabs.Screen
          name="(home)"
          options={{ title: strings.tabs.home }}
        />
        <Tabs.Screen
          name="(shifts)"
          options={{ title: strings.tabs.shifts }}
        />
        <Tabs.Screen
          name="(chat)"
          options={{ title: strings.tabs.chat }}
        />
        <Tabs.Screen
          name="(me)"
          options={{ title: strings.tabs.me }}
        />
      </Tabs>

      {/* QuickActions overlay — positioned above the tab bar */}
      <QuickActions
        phase={phase}
        visible={quickActionsVisible}
        onAction={handleQuickAction}
        onDismiss={hideQuickActions}
        visibility={quickActionsVisibility}
      />
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));
