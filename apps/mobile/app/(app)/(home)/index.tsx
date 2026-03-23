/**
 * Home screen — renders different content based on the current shift phase.
 *
 * Animations:
 * - Animated ScrollView for smooth native scroll
 * - Header scrolls with content (not sticky — more natural on mobile)
 * - Punch button enters with spring from below
 * - Phase content fades in with delay after header/punch settle
 * - Bottom sheets for notifications + settings
 */

import React, { useCallback, useRef } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import type GorhomBottomSheet from "@gorhom/bottom-sheet";
import { createStyles } from "@/theme";
import { SyncIndicator } from "@/components/common/SyncIndicator";
import { HomeHeader } from "@/components/home/HomeHeader";
import { NotificationSheet } from "@/components/home/NotificationSheet";
import { SettingsSheet } from "@/components/home/SettingsSheet";
import { NoShiftView } from "@/components/home/NoShiftView";
import { BeforeShiftView } from "@/components/home/BeforeShiftView";
import { DuringShiftView } from "@/components/home/DuringShiftView";
import { AfterShiftView } from "@/components/home/AfterShiftView";
import { PunchButton } from "@/components/shift/PunchButton";
import { useShiftPhase } from "@/hooks/stores/use-shift-phase";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useMyTasks } from "@/hooks/queries/use-my-tasks";
import { useDayInfo } from "@/hooks/queries/use-day-info";
import { useShiftColleagues } from "@/hooks/queries/use-shift-colleagues";

export default function HomeScreen() {
  const styles = useStyles();
  const { phase, activeShift, activeTimeEntry, nextShift } = useShiftPhase();
  const { data: profile } = useMyProfile();
  const { data: tasks } = useMyTasks();
  const { data: dayInfo } = useDayInfo();

  const notificationSheetRef = useRef<GorhomBottomSheet>(null);
  const settingsSheetRef = useRef<GorhomBottomSheet>(null);

  const relevantShiftDate = activeShift?.shift_date ?? nextShift?.shift_date ?? null;
  const { data: colleagues } = useShiftColleagues(relevantShiftDate, profile?.profile_id ?? null);

  const firstName = profile?.display_name?.split(" ")[0] ?? "";

  const handleNotificationPress = useCallback(() => {
    notificationSheetRef.current?.snapToIndex(0);
  }, []);

  const handleMenuPress = useCallback(() => {
    settingsSheetRef.current?.snapToIndex(0);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SyncIndicator />

      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {/* Header: avatar, greeting, quick actions */}
        <HomeHeader
          displayName={profile?.display_name ?? ""}
          avatarUrl={profile?.avatar_url}
          onNotificationPress={handleNotificationPress}
          onMenuPress={handleMenuPress}
        />

        {/* Punch button — enters from below with spring */}
        <Animated.View
          entering={FadeInUp.delay(500).duration(500).springify().damping(13)}
          style={styles.punchArea}
        >
          <PunchButton />
        </Animated.View>

        {/* Phase-specific content — fades in after punch settles */}
        <Animated.View entering={FadeIn.delay(700).duration(500)} style={styles.content}>
          {phase === "no_shift" && <NoShiftView firstName={firstName} nextShift={nextShift} />}
          {phase === "before_shift" && nextShift && (
            <BeforeShiftView
              shift={nextShift}
              colleagues={colleagues ?? []}
              dayInfo={dayInfo}
              tasks={tasks ?? []}
            />
          )}
          {phase === "during_shift" && activeTimeEntry && (
            <DuringShiftView shift={activeShift} timeEntry={activeTimeEntry} tasks={tasks ?? []} />
          )}
          {phase === "after_shift" && activeTimeEntry && (
            <AfterShiftView shift={activeShift} timeEntry={activeTimeEntry} />
          )}
        </Animated.View>
      </Animated.ScrollView>

      {/* Bottom sheets — mounted outside scroll */}
      <NotificationSheet ref={notificationSheetRef} />
      <SettingsSheet ref={settingsSheetRef} />
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: theme.spacing.xl + 20,
  },
  punchArea: {
    paddingTop: theme.spacing.section,
    paddingBottom: theme.spacing.element,
  },
  content: {
    flex: 1,
    paddingTop: theme.spacing.element,
  },
}));
