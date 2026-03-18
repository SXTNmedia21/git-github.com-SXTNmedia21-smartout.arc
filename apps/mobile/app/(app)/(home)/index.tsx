/**
 * Home screen — renders different content based on the current shift phase.
 *
 * The shift phase (no_shift, before_shift, during_shift, after_shift) drives
 * everything: what the user sees, what actions are available, and what data
 * is loaded. This is the single entry point that delegates to phase-specific views.
 */

import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createStyles } from "@/theme";
import { SyncIndicator } from "@/components/common/SyncIndicator";
import { NoShiftView } from "@/components/home/NoShiftView";
import { BeforeShiftView } from "@/components/home/BeforeShiftView";
import { DuringShiftView } from "@/components/home/DuringShiftView";
import { AfterShiftView } from "@/components/home/AfterShiftView";
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

  // Load colleagues for the relevant shift date
  const relevantShiftDate = activeShift?.shift_date ?? nextShift?.shift_date ?? null;
  const { data: colleagues } = useShiftColleagues(relevantShiftDate, profile?.profile_id ?? null);

  const firstName = profile?.display_name?.split(" ")[0] ?? "";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <SyncIndicator />
      <View style={styles.content}>
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
      </View>
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
}));
