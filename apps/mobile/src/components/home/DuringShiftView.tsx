/**
 * DuringShiftView — Home screen content when the employee is clocked in.
 *
 * Shows: timer since punch-in, full-width punch-out button, task feed sorted by
 * priority, deviation report button, chat shortcut, and ring leder button.
 * Everything critical is in the thumb zone (lower half of screen).
 */

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Linking } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { createStyles, withOpacity } from "@/theme";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/common/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { strings } from "@/constants/strings";
import { formatTime } from "@/components/shift/ShiftCard";
import type { Database } from "@smartout/supabase/database.types";

type ScheduleShift = Database["public"]["Tables"]["schedule_shift"]["Row"];
type TimeEntry = Database["timesheet"]["Tables"]["time_entry"]["Row"];
type SessionTask = Database["public"]["Tables"]["session_task"]["Row"];

type DuringShiftViewProps = {
  shift: ScheduleShift | null;
  timeEntry: TimeEntry;
  tasks?: SessionTask[];
  onPunchOut?: () => void;
  punchingOut?: boolean;
  /** Leader's phone number for the "Ring leder" button */
  leaderPhone?: string | null;
};

/** Formats elapsed time from punch-in to now as "Xt Ymin" */
function formatElapsedTime(punchIn: string): string {
  const start = new Date(punchIn).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - start);
  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}min`;
  return `${hours}t ${minutes}min`;
}

/** Priority sort: compliance first, then overdue, then pending */
function sortTasksByPriority(tasks: SessionTask[]): SessionTask[] {
  return [...tasks].sort((a, b) => {
    // Compliance-required tasks come first
    if (a.is_compliance_required !== b.is_compliance_required) {
      return a.is_compliance_required ? -1 : 1;
    }
    // Then sort by status: overdue > pending > in_progress > rest
    const statusOrder: Record<string, number> = {
      overdue: 0,
      pending: 1,
      available: 2,
      in_progress: 3,
    };
    const aOrder = statusOrder[a.status] ?? 99;
    const bOrder = statusOrder[b.status] ?? 99;
    return aOrder - bOrder;
  });
}

export function DuringShiftView({
  shift,
  timeEntry,
  tasks = [],
  onPunchOut,
  punchingOut = false,
  leaderPhone,
}: DuringShiftViewProps) {
  const styles = useStyles();
  const router = useRouter();

  // Live timer — recalculates every minute
  const [elapsed, setElapsed] = useState(() => formatElapsedTime(timeEntry.punch_in));
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(formatElapsedTime(timeEntry.punch_in));
    }, 60_000);
    return () => clearInterval(interval);
  }, [timeEntry.punch_in]);

  const activeTasks = tasks.filter(
    (t) => t.status !== "completed" && t.status !== "skipped",
  );
  const sortedTasks = sortTasksByPriority(activeTasks);

  const handleCallLeader = useCallback(() => {
    if (!leaderPhone) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(`tel:${leaderPhone}`);
  }, [leaderPhone]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Shift header with timer */}
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {strings.home.onShift} · {shift ? `${formatTime(shift.start_time)}–${formatTime(shift.end_time)}` : ""}
        </Text>
        <Text style={styles.timer}>{elapsed}</Text>
      </View>

      {/* Primary action: Punch out — full width, prominent */}
      <Button
        title={strings.shift.punchOut}
        variant="destructive"
        size="lg"
        fullWidth
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          onPunchOut?.();
        }}
        loading={punchingOut}
        style={styles.punchOutButton}
      />

      {/* Task feed */}
      <View style={styles.tasksSection}>
        <SectionHeader title={`${strings.tasks.title} (${activeTasks.length})`} />
        {sortedTasks.length > 0 ? (
          sortedTasks.map((task) => (
            <Card key={task.id} style={styles.taskCard}>
              <View style={styles.taskRow}>
                <View
                  style={[
                    styles.taskIndicator,
                    task.is_compliance_required && styles.taskIndicatorCompliance,
                    task.status === "overdue" && styles.taskIndicatorOverdue,
                  ]}
                />
                <View style={styles.taskContent}>
                  <Text style={styles.taskTitle} numberOfLines={1}>
                    {task.title}
                  </Text>
                  {task.description && (
                    <Text style={styles.taskDescription} numberOfLines={1}>
                      {task.description}
                    </Text>
                  )}
                </View>
              </View>
            </Card>
          ))
        ) : (
          <EmptyState
            title={strings.tasks.noTasks}
            subtitle="Ingen oppgaver akkurat na. Nye oppgaver dukker opp her nar de tildeles."
          />
        )}
      </View>

      {/* Quick action bar — thumb zone */}
      <View style={styles.actionBar}>
        <Button
          title={strings.tasks.reportDeviation}
          variant="secondary"
          size="md"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            // Deviation reporting handled by Phase 9
          }}
        />
        <Button
          title={strings.tabs.chat}
          variant="secondary"
          size="md"
          onPress={() => {
            Haptics.selectionAsync();
            router.push("/(app)/(chat)");
          }}
        />
      </View>

      {/* Call leader button */}
      {leaderPhone && (
        <Pressable style={styles.callLeader} onPress={handleCallLeader} accessibilityRole="button">
          <Text style={styles.callLeaderText}>{strings.me.callLeader}</Text>
        </Pressable>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.element,
  },
  headerText: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },
  timer: {
    ...theme.typography.headline,
    color: theme.colors.brandOrange,
    fontWeight: theme.fontWeights.bold,
  },
  punchOutButton: {
    marginBottom: theme.spacing.section,
  },
  tasksSection: {
    marginBottom: theme.spacing.section,
  },
  taskCard: {
    marginBottom: theme.spacing.tight,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
  },
  taskIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.muted,
  },
  taskIndicatorCompliance: {
    backgroundColor: theme.colors.destructive,
  },
  taskIndicatorOverdue: {
    backgroundColor: theme.colors.warning,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    ...theme.typography.body,
    color: theme.colors.foreground,
  },
  taskDescription: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  actionBar: {
    flexDirection: "row",
    gap: theme.spacing.element,
    marginBottom: theme.spacing.section,
  },
  callLeader: {
    alignItems: "center",
    paddingVertical: theme.spacing.element,
  },
  callLeaderText: {
    ...theme.typography.body,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.brandOrange,
  },
}));
