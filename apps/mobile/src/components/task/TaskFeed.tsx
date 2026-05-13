/**
 * TaskFeed — Sorted list of active tasks for the current shift/session.
 *
 * Tasks are sorted by priority:
 *   1. Compliance tasks (HACCP) — red indicator
 *   2. Deadline approaching (< 30 min) — yellow indicator
 *   3. General tasks — neutral indicator
 *
 * Maintenance tasks that share the same session_hook_id are grouped into
 * a single checklist card (cleaning checklists). Tapping that card opens
 * ChecklistView instead of individual TaskModals.
 *
 * Tapping a non-grouped task opens the universal TaskModal. Empty state
 * shows an encouraging "Alt klart" message with next shift info.
 */
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { ClipboardCheck } from "lucide-react-native";

import { EmptyState } from "@/components/ui";
import { createStyles, useTheme } from "@/theme";
import { withOpacity } from "@/theme/colors";
import { strings } from "@/constants/strings";
import { TaskModal, type SessionTask } from "./TaskModal";
import { ChecklistView } from "./ChecklistView";

type TaskFeedProps = {
  /** Session tasks to display (pre-fetched by parent) */
  tasks: SessionTask[];
  /** Current user's profile ID — passed to TaskModal */
  profileId: string;
};

/** Priority levels for sort order and visual indicators */
type Priority = "compliance" | "deadline" | "general";

/** A group of maintenance tasks sharing the same session_hook_id */
type ChecklistGroup = {
  hookId: string;
  tasks: SessionTask[];
  /** Derived from the first task's title or a generic label */
  procedureName: string;
};

/** Feed item — either a single task or a grouped checklist */
type FeedItem = { type: "task"; task: SessionTask } | { type: "checklist"; group: ChecklistGroup };

export function TaskFeed({ tasks, profileId }: TaskFeedProps) {
  const styles = useStyles();
  const [selectedTask, setSelectedTask] = useState<SessionTask | null>(null);
  const [activeChecklist, setActiveChecklist] = useState<ChecklistGroup | null>(null);

  /**
   * Group maintenance tasks by session_hook_id, then build a mixed feed
   * of individual tasks and checklist groups. Compliance tasks at top,
   * checklist groups next, then general tasks.
   */
  const feedItems = useMemo(() => {
    const now = Date.now();
    const activeTasks = tasks.filter((t) => t.status !== "completed" && t.status !== "skipped");

    /* Separate maintenance-linked tasks (have hook with procedure) from regular tasks */
    const hookGroups = new Map<string, SessionTask[]>();
    const individualTasks: SessionTask[] = [];

    for (const task of activeTasks) {
      // Group by hook_id (was session_hook_id). All hooked tasks are grouped here;
      // resolveTaskType() handles procedure/checklist distinction inside TaskModal.
      if (task.hook_id) {
        const group = hookGroups.get(task.hook_id) ?? [];
        group.push(task);
        hookGroups.set(task.hook_id, group);
      } else {
        individualTasks.push(task);
      }
    }

    /* Also include all tasks (including completed) for checklist groups
       so progress is accurate */
    const fullHookGroups = new Map<string, SessionTask[]>();
    for (const task of tasks) {
      if (task.hook_id) {
        const group = fullHookGroups.get(task.hook_id) ?? [];
        group.push(task);
        fullHookGroups.set(task.hook_id, group);
      }
    }

    const items: FeedItem[] = [];

    /* Sort individual tasks by priority */
    const sorted = [...individualTasks].sort((a, b) => {
      const priorityA = getTaskPriority(a, now);
      const priorityB = getTaskPriority(b, now);
      return PRIORITY_ORDER[priorityA] - PRIORITY_ORDER[priorityB];
    });

    for (const task of sorted) {
      items.push({ type: "task", task });
    }

    /* Add checklist groups (only if they have pending tasks) */
    for (const [hookId, pendingTasks] of hookGroups) {
      if (pendingTasks.length > 0) {
        const allTasks = fullHookGroups.get(hookId) ?? pendingTasks;
        const firstTask = allTasks[0];
        // Derive group label from first task title or a generic fallback.
        const derivedName = firstTask?.title ?? strings.cleaning.title;

        items.push({
          type: "checklist",
          group: {
            hookId,
            tasks: allTasks,
            procedureName: derivedName,
          },
        });
      }
    }

    return items;
  }, [tasks]);

  const handleSelectTask = useCallback((task: SessionTask) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTask(task);
  }, []);

  const handleOpenChecklist = useCallback((group: ChecklistGroup) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveChecklist(group);
  }, []);

  const handleDismiss = useCallback(() => {
    setSelectedTask(null);
  }, []);

  const handleCloseChecklist = useCallback(() => {
    setActiveChecklist(null);
  }, []);

  /* If a checklist is open, show ChecklistView full-screen */
  if (activeChecklist) {
    return (
      <ChecklistView
        tasks={activeChecklist.tasks}
        procedureName={activeChecklist.procedureName}
        profileId={profileId}
        onClose={handleCloseChecklist}
      />
    );
  }

  if (feedItems.length === 0) {
    return (
      <EmptyState
        title={strings.tasks.noTasks}
        subtitle="Ingen ventende oppgaver akkurat na. Oppgaver tildeles automatisk gjennom vakten."
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={feedItems}
        keyExtractor={(item) =>
          item.type === "task" ? item.task.id : `checklist-${item.group.hookId}`
        }
        renderItem={({ item }) => {
          if (item.type === "checklist") {
            return (
              <ChecklistGroupCard
                group={item.group}
                onPress={() => handleOpenChecklist(item.group)}
              />
            );
          }
          return <TaskRow task={item.task} onPress={() => handleSelectTask(item.task)} />;
        }}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <TaskModal task={selectedTask} profileId={profileId} onDismiss={handleDismiss} />
    </View>
  );
}

/** A single task row with priority indicator, label, and optional deadline */
function TaskRow({ task, onPress }: { task: SessionTask; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const now = Date.now();
  const priority = getTaskPriority(task, now);
  const priorityColor = (colors as Record<string, string>)[PRIORITY_COLOR_KEYS[priority]];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${task.title}, ${priorityLabel(priority)}`}
    >
      <View style={[styles.indicator, { backgroundColor: priorityColor }]} />
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
      {priority === "deadline" && <Text style={styles.deadlineLabel}>{strings.tasks.dueSoon}</Text>}
    </Pressable>
  );
}

/** A grouped checklist card showing progress and procedure name */
function ChecklistGroupCard({ group, onPress }: { group: ChecklistGroup; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();

  const completedCount = group.tasks.filter((t) => t.status === "completed").length;
  const totalCount = group.tasks.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.checklistCard, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${group.procedureName}, ${strings.cleaning.progress(completedCount, totalCount)}`}
    >
      <View style={[styles.checklistIcon, { backgroundColor: withOpacity(colors.primary, 0.08) }]}>
        <ClipboardCheck size={18} color={colors.primary} />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {group.procedureName}
        </Text>
        <Text style={styles.rowSubtitle}>
          {strings.cleaning.progress(completedCount, totalCount)}
        </Text>

        {/* Progress bar */}
        <View style={styles.checklistProgress}>
          <View
            style={[
              styles.checklistProgressFill,
              {
                width: `${progressPercent}%` as `${number}%`,
                backgroundColor: completedCount === totalCount ? colors.success : colors.primary,
              },
            ]}
          />
        </View>
      </View>
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
  if (task.compliance) return "compliance";

  /* session_task doesn't have a deadline field yet — when it does, check here.
     For now, tasks from hooks with offsets could be compared to session timing.
     Placeholder logic: all non-compliance tasks are 'general'. */
  return "general";
}

const PRIORITY_COLOR_KEYS: Record<Priority, string> = {
  compliance: "destructive",
  deadline: "warning",
  general: "mutedForeground",
};

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
    color: theme.colors.warning,
    fontWeight: theme.fontWeights.semibold,
  },
  checklistCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.element,
    gap: theme.spacing.element,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.primary, 0.19),
  },
  checklistIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  checklistProgress: {
    height: 3,
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radius.full,
    overflow: "hidden",
    marginTop: theme.spacing.xxs,
  },
  checklistProgressFill: {
    height: "100%",
    borderRadius: theme.radius.full,
  },
}));
