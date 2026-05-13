/**
 * TaskModal — Universal bottom sheet that renders the correct form
 * based on the resolved task type. One component, one switch, one task per screen.
 *
 * The modal receives a MyTaskRow (ADR-0298 normalized shape) and uses
 * resolveTaskType() to decide which form to show. Each form is self-contained
 * and handles its own submission via the sync queue.
 */
import React, { useCallback, useMemo, useRef } from "react";
import { View, Text } from "react-native";
import type GorhomBottomSheet from "@gorhom/bottom-sheet";

import { BottomSheet } from "@/components/ui";
import { createStyles } from "@/theme";
import { strings } from "@/constants/strings";
import { resolveTaskType, type TaskType, type TaskWithHook } from "@/lib/resolve-task-type";
import { HACCPForm } from "./HACCPForm";
import { DeviationForm } from "./DeviationForm";

/**
 * Normalized task shape for the TaskModal (ADR-0298).
 *
 * Field renames from the old PostgREST session_task query:
 *   is_compliance_required → compliance
 *   department_session_id  → session_id
 *   session_hook_id        → hook_id
 *
 * hook_linked_procedure_id and hook_linked_routine_id are inherited from
 * TaskWithHook (wired by fn_list_my_tasks v2, Sortie 3 §4.10).
 */
export type SessionTask = TaskWithHook & {
  id: string;
  title: string;
  description: string | null;
  status: string;
  /** session_id: was department_session_id. Nullable for non-session sources. */
  session_id: string | null;
  workspace_id: string;
  assigned_to: string | null;
  /** CCP reference for HACCP tasks — populated from task description or hook metadata */
  ccp_reference?: string;
};

type TaskModalProps = {
  /** The task to render a form for. Null = modal closed. */
  task: SessionTask | null;
  /** Current user's profile ID — passed to forms for payloads */
  profileId: string;
  /** Called when the form completes or the user dismisses the modal */
  onDismiss: () => void;
};

export function TaskModal({ task, profileId, onDismiss }: TaskModalProps) {
  const styles = useStyles();
  const sheetRef = useRef<GorhomBottomSheet>(null);

  const snapPoints = useMemo(() => ["75%", "90%"], []);

  const taskType = useMemo<TaskType | null>(() => (task ? resolveTaskType(task) : null), [task]);

  const handleDismiss = useCallback(() => {
    sheetRef.current?.close();
    onDismiss();
  }, [onDismiss]);

  if (!task || !taskType) return null;

  return (
    <BottomSheet ref={sheetRef} snapPoints={snapPoints} enablePanDownToClose onClose={onDismiss}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
          {task.title}
        </Text>
        {task.description && (
          <Text style={styles.description} numberOfLines={3}>
            {task.description}
          </Text>
        )}
      </View>

      <View style={styles.formContainer}>
        {renderForm(taskType, task, profileId, handleDismiss)}
      </View>
    </BottomSheet>
  );
}

/**
 * Renders the appropriate form component based on task type.
 * Each form is self-contained: handles its own state, validation, and queue submission.
 */
function renderForm(
  taskType: TaskType,
  task: SessionTask,
  profileId: string,
  onComplete: () => void,
): React.ReactNode {
  switch (taskType) {
    case "haccp":
      return <HACCPForm task={task} profileId={profileId} onComplete={onComplete} />;

    case "checklist":
      return <PlaceholderForm label="Sjekkboksliste" onComplete={onComplete} />;

    case "confirmation":
      return <PlaceholderForm label="Bekreftelse" onComplete={onComplete} />;

    case "procedure":
      return <PlaceholderForm label="Steg-for-steg" onComplete={onComplete} />;

    case "general":
      return <PlaceholderForm label="Fritekst" onComplete={onComplete} />;
  }
}

/**
 * Temporary placeholder for task types not yet implemented (checklist, confirmation,
 * procedure, general). Each will be replaced with a dedicated form component.
 */
function PlaceholderForm({ label, onComplete }: { label: string; onComplete: () => void }) {
  const styles = useStyles();

  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>{label}</Text>
      <Text style={styles.placeholderSubtext}>Kommer snart</Text>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  header: {
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },
  description: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },
  formContainer: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.tight,
  },
  placeholderText: {
    ...theme.typography.body,
    color: theme.colors.foreground,
  },
  placeholderSubtext: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
}));
