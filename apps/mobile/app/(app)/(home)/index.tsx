/**
 * Home screen — Phase-aware view accessed via FAB tap.
 *
 * Shows different content based on shift phase:
 * - no_shift → NoShiftView (community, growth, news)
 * - before_shift → BeforeShiftView (upcoming shift details)
 * - during_shift → DuringShiftView (live timer, tasks, actions)
 * - after_shift → AfterShiftView (summary, hours confirm, handoff)
 *
 * Action bar (Oppgaver, Opplæring, Sikkerhet, Lønn) always visible.
 */

import React, { useMemo, useRef } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import type GorhomBottomSheet from "@gorhom/bottom-sheet";
import { Menu } from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";
import { SyncIndicator } from "@/components/common/SyncIndicator";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ActionBar } from "@/components/navigation/ActionBar";
import { NotificationSheet } from "@/components/home/NotificationSheet";
import { NoShiftView } from "@/components/home/NoShiftView";
import { BeforeShiftView } from "@/components/home/BeforeShiftView";
import { DuringShiftView as DuringShiftViewV1 } from "@/components/home/DuringShiftView";
import { DuringShiftViewV2 } from "@/components/home/DuringShiftView.v2";

// Feature flag: EXPO_PUBLIC_DURING_SHIFT_V2=true enables the M4 gradient-hero
// redesign. Default (unset) keeps the legacy DuringShiftView. Flag is read
// once at module-load via process.env — Expo inlines EXPO_PUBLIC_* at build.
const DURING_SHIFT_V2_ENABLED = process.env.EXPO_PUBLIC_DURING_SHIFT_V2 === "true";
const DuringShiftView = DURING_SHIFT_V2_ENABLED ? DuringShiftViewV2 : DuringShiftViewV1;
import { AfterShiftView } from "@/components/home/AfterShiftView";
import { useShiftPhase } from "@/hooks/stores/use-shift-phase";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useMyTasks } from "@/hooks/queries/use-my-tasks";
import { useShiftColleagues } from "@/hooks/queries/use-shift-colleagues";
import { useDayInfo } from "@/hooks/queries/use-day-info";
import { useDutyLeader } from "@/hooks/queries/use-duty-leader";

export default function HomeScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { phase, activeShift, activeTimeEntry, nextShift } = useShiftPhase();
  const { data: profile } = useMyProfile();
  const { data: tasks } = useMyTasks();
  const { data: dayInfo } = useDayInfo();

  const relevantShift = activeShift ?? nextShift;
  const { data: colleagues } = useShiftColleagues(
    relevantShift?.shift_date ?? null,
    profile?.profile_id ?? null,
  );

  const departmentId = activeShift?.department_id ?? nextShift?.department_id ?? null;
  const workspaceId = profile?.workspace_id ?? null;
  const { data: dutyLeader } = useDutyLeader(departmentId, workspaceId);

  const notificationSheetRef = useRef<GorhomBottomSheet>(null);
  const firstName = profile?.display_name?.split(" ")[0] ?? "";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SyncIndicator />

      {/* Top bar */}
      <Animated.View entering={FadeIn.delay(50).duration(300)} style={styles.topBar}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push("/(app)/(home)/settings");
          }}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="Meny"
        >
          <Menu size={22} color={withOpacity(theme.colors.foreground, 0.45)} strokeWidth={1.6} />
        </Pressable>
        <Text style={styles.brandName}>Smartout</Text>
        <NotificationBell profileId={profile?.profile_id} />
      </Animated.View>

      {/* Action bar */}
      <ActionBar />

      {/* Phase content */}
      <ScrollView
        style={styles.phaseScroll}
        contentContainerStyle={styles.phaseContent}
        showsVerticalScrollIndicator={false}
      >
        {phase === "no_shift" && <NoShiftView firstName={firstName} nextShift={nextShift} />}
        {phase === "missed_shift" && <NoShiftView firstName={firstName} nextShift={null} />}
        {phase === "before_shift" && nextShift && (
          <BeforeShiftView
            shift={nextShift}
            colleagues={colleagues ?? []}
            dayInfo={dayInfo}
            tasks={tasks ?? []}
            variant="before"
          />
        )}
        {phase === "awaiting_punch_in" && relevantShift && (
          <BeforeShiftView
            shift={relevantShift}
            colleagues={colleagues ?? []}
            dayInfo={dayInfo}
            tasks={tasks ?? []}
            variant="late"
          />
        )}
        {phase === "before_shift" && !nextShift && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
            <ActivityIndicator size="large" color={theme.colors.foreground} />
            <Text style={{ marginTop: 12, color: theme.colors.mutedForeground, fontSize: 14 }}>
              Laster vaktdata...
            </Text>
          </View>
        )}
        {phase === "during_shift" && activeTimeEntry && (
          <DuringShiftView
            shift={activeShift}
            timeEntry={activeTimeEntry}
            tasks={tasks ?? []}
            leaderPhone={dutyLeader?.phone}
          />
        )}
        {phase === "during_shift" && !activeTimeEntry && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
            <ActivityIndicator size="large" color={theme.colors.foreground} />
            <Text style={{ marginTop: 12, color: theme.colors.mutedForeground, fontSize: 14 }}>
              Kobler til vaktdata...
            </Text>
          </View>
        )}
        {phase === "after_shift" && activeTimeEntry && (
          <AfterShiftView shift={activeShift} timeEntry={activeTimeEntry} />
        )}
      </ScrollView>

      <NotificationSheet ref={notificationSheetRef} />
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  phaseScroll: {
    flex: 1,
  },
  phaseContent: {
    paddingHorizontal: theme.spacing.section,
    paddingBottom: 160,
  },
  topBar: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  brandName: {
    fontSize: 22,
    fontStyle: "italic",
    fontWeight: "300",
    color: theme.colors.foreground,
    letterSpacing: -0.5,
  },
}));
