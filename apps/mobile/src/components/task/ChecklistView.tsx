/**
 * ChecklistView — Interactive cleaning checklist for mobile employees.
 *
 * Renders a full-height scrollable list of checkpoints as large checkboxes
 * (48px touch targets). Each checkpoint can be individually completed.
 * A "Signer og fullfør" button at the bottom signs off all remaining items.
 *
 * Emits "checklist started" on mount and uses offline-capable hooks
 * for checkpoint completion and signing.
 */

import React, { useCallback, useEffect, useMemo } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { Check } from "lucide-react-native";

import { createStyles, useTheme } from "@/theme";
import { strings } from "@/constants/strings";
import { useCompleteCheckpoint, useSignChecklist } from "@/hooks/mutations/use-checklist";
import { emit } from "@smartout/telemetry";
import type { SessionTask } from "./TaskModal";

type ChecklistViewProps = {
  /** Grouped maintenance tasks for this checklist */
  tasks: SessionTask[];
  /** Display name for the checklist (procedure name) */
  procedureName: string;
  /** Current user's profile ID */
  profileId: string;
  /** Called when the checklist is dismissed or completed */
  onClose: () => void;
};

export function ChecklistView({ tasks, procedureName, profileId, onClose }: ChecklistViewProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { completeCheckpoint, isSubmitting: isCompletingStep } = useCompleteCheckpoint();
  const { signChecklist, isSigning } = useSignChecklist();

  /* Sort tasks by title to maintain consistent order */
  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => a.title.localeCompare(b.title, "nb")),
    [tasks],
  );

  const completedCount = sortedTasks.filter((t) => t.status === "completed").length;
  const totalCount = sortedTasks.length;
  const allCompleted = completedCount === totalCount;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  /* Pending task IDs for batch sign-off */
  const pendingTaskIds = useMemo(
    () => sortedTasks.filter((t) => t.status !== "completed").map((t) => t.id),
    [sortedTasks],
  );

  /* Emit "checklist started" on mount */
  useEffect(() => {
    if (sortedTasks.length > 0) {
      void emit({
        event: "checklist started",
        workspace_id: sortedTasks[0]!.workspace_id,
        actor_id: profileId,
        properties: {
          data: {
            procedure_id: procedureName,
            session_id: sortedTasks[0]!.department_session_id,
          },
        },
      });
    }
    // Only fire on mount — intentionally empty deps
  }, []);

  const handleToggleCheckpoint = useCallback(
    async (task: SessionTask) => {
      if (task.status === "completed") return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await completeCheckpoint({
        taskId: task.id,
        profileId,
        workspaceId: task.workspace_id,
      });
    },
    [completeCheckpoint, profileId],
  );

  const handleSignAll = useCallback(async () => {
    if (pendingTaskIds.length === 0) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    await signChecklist({
      taskIds: pendingTaskIds,
      profileId,
      workspaceId: sortedTasks[0]!.workspace_id,
      procedureId: procedureName,
      sessionId: sortedTasks[0]!.department_session_id,
    });

    onClose();
  }, [signChecklist, pendingTaskIds, profileId, sortedTasks, procedureName, onClose]);

  return (
    <View style={styles.container}>
      {/* Header with progress */}
      <View style={styles.header}>
        <Text style={styles.title}>{procedureName}</Text>
        <Text style={styles.progress}>{strings.cleaning.progress(completedCount, totalCount)}</Text>

        {/* Progress bar */}
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${progressPercent}%` as `${number}%`,
                backgroundColor: allCompleted ? colors.success : colors.warning,
              },
            ]}
          />
        </View>
      </View>

      {/* Checkpoint list */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {sortedTasks.map((task) => (
          <CheckpointRow
            key={task.id}
            task={task}
            onToggle={() => handleToggleCheckpoint(task)}
            disabled={isCompletingStep}
          />
        ))}
      </ScrollView>

      {/* Sign button */}
      <View style={styles.footer}>
        <Pressable
          onPress={handleSignAll}
          disabled={allCompleted || isSigning}
          style={({ pressed }) => [
            styles.signButton,
            allCompleted && styles.signButtonCompleted,
            pressed && !allCompleted && styles.signButtonPressed,
            (allCompleted || isSigning) && styles.signButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={strings.cleaning.signAndComplete}
        >
          <Text style={[styles.signButtonText, allCompleted && styles.signButtonTextCompleted]}>
            {allCompleted ? strings.cleaning.completed : strings.cleaning.signAndComplete}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Individual checkpoint row with large touch target */
function CheckpointRow({
  task,
  onToggle,
  disabled,
}: {
  task: SessionTask;
  onToggle: () => void;
  disabled: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const isCompleted = task.status === "completed";

  return (
    <Pressable
      onPress={onToggle}
      disabled={isCompleted || disabled}
      style={({ pressed }) => [
        styles.checkpointRow,
        isCompleted && styles.checkpointRowCompleted,
        pressed && !isCompleted && styles.checkpointRowPressed,
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isCompleted }}
      accessibilityLabel={task.title}
    >
      {/* 48px touch target checkbox */}
      <View
        style={[
          styles.checkbox,
          isCompleted && {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
          },
        ]}
      >
        {isCompleted && <Check size={20} color={colors.primaryForeground} strokeWidth={3} />}
      </View>

      {/* Text content */}
      <View style={styles.checkpointContent}>
        <Text
          style={[styles.checkpointTitle, isCompleted && styles.checkpointTitleCompleted]}
          numberOfLines={2}
        >
          {task.title}
        </Text>
        {task.description && (
          <Text style={styles.checkpointDescription} numberOfLines={2}>
            {task.description}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.card,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.element,
    gap: theme.spacing.xs,
  },
  title: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },
  progress: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radius.full,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: theme.radius.full,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.card,
    paddingBottom: theme.spacing.section,
    gap: theme.spacing.tight,
  },
  checkpointRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.element,
    gap: theme.spacing.element,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 64,
  },
  checkpointRowCompleted: {
    opacity: 0.7,
  },
  checkpointRowPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  checkbox: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  checkpointContent: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  checkpointTitle: {
    ...theme.typography.bodyBold,
    color: theme.colors.foreground,
  },
  checkpointTitleCompleted: {
    textDecorationLine: "line-through",
    color: theme.colors.mutedForeground,
  },
  checkpointDescription: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  footer: {
    paddingHorizontal: theme.spacing.card,
    paddingVertical: theme.spacing.element,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  signButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.element,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  signButtonCompleted: {
    backgroundColor: theme.colors.muted,
  },
  signButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  signButtonDisabled: {
    opacity: 0.5,
  },
  signButtonText: {
    ...theme.typography.bodyBold,
    color: theme.colors.primaryForeground,
  },
  signButtonTextCompleted: {
    color: theme.colors.mutedForeground,
  },
}));
