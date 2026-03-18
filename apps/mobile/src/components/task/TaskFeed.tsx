/**
 * TaskFeed — Sorted list of active tasks for the current shift/session.
 *
 * Tasks are sorted by priority:
 *   1. Compliance tasks (HACCP) — red indicator
 *   2. Deadline approaching (< 30 min) — yellow indicator
 *   3. General tasks — neutral indicator
 *
 * Tapping a task opens the universal TaskModal. Empty state shows an
 * encouraging "Alt klart" message with next shift info.
 */
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { EmptyState } from "@/components/ui";
import { createStyles, useTheme } from "@/theme";
import { strings } from "@/constants/strings";
import { TaskModal, type SessionTask } from "./TaskModal";

type TaskFeedProps = {
  /** Session tasks to display (pre-fetched by parent) */
  tasks: SessionTask[];
  /** Current user's profile ID — passed to TaskModal */
  profileId: string;
};

/** Priority levels for sort order and visual indicators */
type Priority = "compliance" | "deadline" | "general";

/** Minutes threshold for "deadline approaching" status */
const DEADLINE_THRESHOLD_MINUTES = 30;

export function TaskFeed({ tasks, profileId }: TaskFeedProps) {
  const styles = useStyles();
  const [selectedTask, setSelectedTask] = useState<SessionTask | null>(null);

  /** Sort tasks: compliance first, then approaching deadline, then general */
  const sortedTasks = useMemo(() => {
    const now = Date.now();

    return [...tasks]
      .filter((t) => t.status !== "completed" && t.status !== "skipped")
      .sort((a, b) => {
        const priorityA = getTaskPriority(a, now);
        const priorityB = getTaskPriority(b, now);
        return PRIORITY_ORDER[priorityA] - PRIORITY_ORDER[priorityB];
      });
  }, [tasks]);

  const handleSelectTask = useCallback((task: SessionTask) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTask(task);
  }, []);

  const handleDismiss = useCallback(() => {
    setSelectedTask(null);
  }, []);

  if (sortedTasks.length === 0) {
    return (
      <EmptyState
        title={strings.tasks.noTasks}
        subtitle="Ingen ventende oppgaver akkurat nå."
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sortedTasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TaskRow task={item} onPress={() => handleSelectTask(item)} />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <TaskModal
        task={selectedTask}
        profileId={profileId}
        onDismiss={handleDismiss}
      />
    </View>
  );
}

/** A single task row with priority indicator, label, and optional deadline */
function TaskRow({ task, onPress }: { task: SessionTask; onPress: () => void }) {
  const styles = useStyles();
  const now = Date.now();
  const priority = getTaskPriority(task, now);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${task.title}, ${priorityLabel(priority)}`}
    >
      <View style={[styles.indicator, indicatorColor(priority)]} />
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {task.title}
        </Text>
        {task.description && (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {task.description}
          </Text>
        )}
      </View>
      {priority === "deadline" && (
        <Text style={styles.deadlineLabel}>{strings.tasks.dueSoon}</Text>
      )}
    </Pressable>
  );
}

/** Priority sort weights — lower number = higher priority */
const PRIORITY_ORDER: Record<Priority, number> = {
  compliance: 0,
  deadline: 1,
  general: 2,
};

/** Determines priority based on compliance flag and time proximity */
function getTaskPriority(task: SessionTask, now: number): Priority {
  if (task.is_compliance_required) return "compliance";

  /* session_task doesn't have a deadline field yet — when it does, check here.
     For now, tasks from hooks with offsets could be compared to session timing.
     Placeholder logic: all non-compliance tasks are 'general'. */
  return "general";
}

/** Hex colors for priority indicators — red/yellow/gray from the design token palette */
const PRIORITY_COLORS: Record<Priority, string> = {
  compliance: "#dc2626",
  deadline: "#d97706",
  general: "#a3a3a3",
};

/** Color for the priority dot indicator */
function indicatorColor(priority: Priority): { backgroundColor: string } {
  return { backgroundColor: PRIORITY_COLORS[priority] };
}

/** Accessibility label for priority level */
function priorityLabel(priority: Priority): string {
  switch (priority) {
    case "compliance":
      return "Lovpålagt";
    case "deadline":
      return "Forfaller snart";
    case "general":
      return "Oppgave";
  }
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
  },
  list: {
    gap: theme.spacing.tight,
    paddingBottom: theme.spacing.section,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.element,
    gap: theme.spacing.element,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rowPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  indicator: {
    width: 10,
    height: 10,
    borderRadius: theme.radius.full,
  },
  rowContent: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  rowTitle: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
  },
  rowSubtitle: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  deadlineLabel: {
    ...theme.typography.caption,
    color: PRIORITY_COLORS.deadline,
    fontWeight: theme.fontWeights.semibold,
  },
}));
