/**
 * BeforeShiftView — Home screen content when an upcoming shift is within
 * the "before_shift" window (default 4 hours).
 *
 * Shows: rich shift card with confirm button, day brief (bookings + deviations),
 * pre-shift tasks. When the shift has already started but the employee hasn't
 * punched in, shows a prominent late punch-in warning.
 */

import React, { useCallback, useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import { createStyles, withOpacity } from "@/theme";
import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/common/SectionHeader";
import { ShiftCardRich } from "@/components/shift/ShiftCardRich";
import { strings } from "@/constants/strings";
import { formatTime } from "@/components/shift/ShiftCard";
import type { Colleague } from "@/hooks/queries/use-shift-colleagues";
import type { DayInfo } from "@/hooks/queries/use-day-info";
import type { Database } from "@smartout/supabase/database.types";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];
type SessionTask = Database["public"]["Tables"]["session_task"]["Row"];

type BeforeShiftViewProps = {
  shift: ScheduleShift;
  colleagues?: Colleague[];
  dayInfo?: DayInfo | null;
  tasks?: SessionTask[];
  onConfirm?: (shiftId: string) => void;
  confirming?: boolean;
  onPunchIn?: () => void;
};

/**
 * Calculates minutes since the shift started (for late punch warning).
 * Returns 0 if the shift hasn't started yet.
 */
function minutesSinceShiftStart(shift: ScheduleShift): number {
  const cleanTime = shift.start_time.replace(/[Z+-].*$/, "");
  const shiftStart = new Date(`${shift.shift_date}T${cleanTime}Z`);
  const now = new Date();
  const diffMs = now.getTime() - shiftStart.getTime();
  return diffMs > 0 ? Math.floor(diffMs / 60_000) : 0;
}

export function BeforeShiftView({
  shift,
  colleagues = [],
  dayInfo,
  tasks = [],
  onConfirm,
  confirming = false,
  onPunchIn,
}: BeforeShiftViewProps) {
  const styles = useStyles();
  const lateMinutes = useMemo(() => minutesSinceShiftStart(shift), [shift]);
  const isLate = lateMinutes > 0;
  const pendingTasks = tasks.filter((t) => t.status === "pending" || t.status === "available");

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Shift time header */}
      <Text style={styles.header}>
        Vakt i dag kl. {formatTime(shift.start_time)}
      </Text>

      {/* Late punch-in warning — shift started but no punch */}
      {isLate && (
        <View style={styles.lateWarning}>
          <Text style={styles.lateText}>
            {strings.home.shiftStartedAgo} {lateMinutes} {strings.home.minutesAgo}
          </Text>
          {onPunchIn && (
            <Button
              title={strings.shift.punchIn}
              variant="primary"
              size="lg"
              fullWidth
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                onPunchIn();
              }}
            />
          )}
        </View>
      )}

      {/* Rich shift card with all details */}
      <ShiftCardRich
        shift={shift}
        colleagues={colleagues}
        dayInfo={dayInfo}
        onConfirm={onConfirm}
        confirming={confirming}
      />

      {/* Pre-shift tasks */}
      {pendingTasks.length > 0 && (
        <View style={styles.tasksSection}>
          <SectionHeader title={`${pendingTasks.length} oppgaver ${isLate ? "" : "for apning"}`} />
          {pendingTasks.map((task) => (
            <View key={task.id} style={styles.taskRow}>
              <View
                style={[
                  styles.taskDot,
                  task.is_compliance_required && styles.taskDotCompliance,
                ]}
              />
              <Text style={styles.taskTitle} numberOfLines={1}>
                {task.title}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.spacing.card,
    paddingTop: theme.spacing.section,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    ...theme.typography.title,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.element,
  },
  lateWarning: {
    backgroundColor: withOpacity(theme.colors.warning, 0.12),
    borderRadius: theme.radius.lg,
    padding: theme.spacing.card,
    marginBottom: theme.spacing.element,
    gap: theme.spacing.element,
  },
  lateText: {
    ...theme.typography.bodyBold,
    color: theme.colors.warning,
    textAlign: "center",
  },
  tasksSection: {
    marginTop: theme.spacing.section,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.tight,
    paddingVertical: theme.spacing.tight,
  },
  taskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.muted,
  },
  taskDotCompliance: {
    backgroundColor: theme.colors.destructive,
  },
  taskTitle: {
    ...theme.typography.body,
    color: theme.colors.foreground,
    flex: 1,
  },
}));
