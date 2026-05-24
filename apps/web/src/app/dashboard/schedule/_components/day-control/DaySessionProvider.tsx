// ============================================
// day-control/DaySessionProvider.tsx
// Provides shared day-panel state and actions for the integrated schedule session view.
// Exists to keep tabs, panel chrome, and future agent tools on one state contract.
// Connected to: use-day-session.ts and use-day-session-data.ts
// ============================================
"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { DayTask } from "../schedule-types";
import type { DaySessionEvidenceDraft } from "../../_hooks/day-session-model";
import { useDaySessionData } from "../../_hooks/use-day-session-data";
import {
  useCreateDayTask,
  useDeleteDayTask,
  useUpdateDayTaskStatus,
} from "../../_hooks/use-day-content";
import { useWeekRange } from "../../_hooks/use-week-range";

export type DaySessionEvent = {
  actor: "user" | "agent" | "system";
  action: "field_update" | "task_focus" | "validation_fail" | "tool_execution" | "agent_correction";
  targetId: string;
  metadata: Record<string, unknown>;
  timestamp: number;
};

export type DaySessionContextValue = ReturnType<typeof useDaySessionData> & {
  dateId: string;
  evidenceDrafts: Record<string, DaySessionEvidenceDraft>;
  focusedTaskId: string | null;
  focusedFieldId: string | null;
  events: DaySessionEvent[];
  addTask: (label: string) => Promise<void>;
  cycleTaskStatus: (task: Pick<DayTask, "id" | "status">) => Promise<void>;
  updateTaskAssignment: (taskId: string, assignedTo: string | undefined) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  updateEvidenceDraft: (taskId: string, patch: DaySessionEvidenceDraft) => void;
  focusTask: (taskId: string | null, actor?: DaySessionEvent["actor"]) => void;
  focusField: (fieldId: string | null, actor?: DaySessionEvent["actor"]) => void;
  recordEvent: (
    actor: DaySessionEvent["actor"],
    action: DaySessionEvent["action"],
    targetId: string,
    metadata?: Record<string, unknown>,
  ) => void;
};

export const DaySessionContext = createContext<DaySessionContextValue | null>(null);

type DaySessionProviderProps = {
  dateId: string;
  children: ReactNode;
};

/**
 * Computes the next task status in the panel workflow.
 *
 * Why: the provider owns task state transitions so tabs can stay presentational.
 *
 * Returns: the next task status in the local task cycle.
 */
function getNextTaskStatus(current: DayTask["status"]): DayTask["status"] {
  if (current === "pending") {
    return "in_progress";
  }

  if (current === "in_progress") {
    return "completed";
  }

  return "pending";
}

/**
 * Hosts the shared day-session state and mutation actions.
 *
 * Why: the day panel needs one source of truth for evidence drafts, focus state,
 * and task mutations before any agent bridge can safely interact with it.
 *
 * Returns: a context provider for the selected day.
 */
export function DaySessionProvider({ dateId, children }: DaySessionProviderProps) {
  const { weekStart } = useWeekRange();
  const [evidenceDrafts, setEvidenceDrafts] = useState<Record<string, DaySessionEvidenceDraft>>({});
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [focusedFieldId, setFocusedFieldId] = useState<string | null>(null);
  const [events, setEvents] = useState<DaySessionEvent[]>([]);

  const data = useDaySessionData(dateId, evidenceDrafts);
  const snapshotRef = useRef(data.snapshot);
  const createDayTask = useCreateDayTask(weekStart);
  const updateDayTaskStatus = useUpdateDayTaskStatus(weekStart);
  const deleteDayTask = useDeleteDayTask(weekStart);

  useEffect(() => {
    snapshotRef.current = data.snapshot;
  }, [data.snapshot]);

  /**
   * Reads the latest snapshot without forcing voice-tool implementations to
   * re-register on every data refresh.
   *
   * Why: the provider needs stable agent actions backed by current shared state.
   *
   * Returns: the latest day-session snapshot.
   */
  const getLatestSnapshot = useCallback(() => snapshotRef.current, []);

  /**
   * Stores a structured day-session event for telemetry and future agent tracing.
   *
   * Why: agent-driven UI needs a local event log without coupling components to
   * external analytics APIs.
   *
   * Returns: nothing.
   */
  const recordEvent = useCallback<DaySessionContextValue["recordEvent"]>(
    (actor, action, targetId, metadata = {}) => {
      setEvents((current) => [
        ...current,
        {
          actor,
          action,
          targetId,
          metadata,
          timestamp: Date.now(),
        },
      ]);
    },
    [],
  );

  /**
   * Creates a new day task for the active date.
   *
   * Why: the integrated task tab should not own persistence details directly.
   *
   * Returns: a promise that resolves when the mutation finishes.
   */
  const addTask = useCallback<DaySessionContextValue["addTask"]>(
    async (label) => {
      const trimmedLabel = label.trim();
      if (!trimmedLabel) {
        recordEvent("user", "validation_fail", "new-task-label", {
          reason: "empty_label",
        });
        return;
      }

      await createDayTask.mutateAsync({
        id: crypto.randomUUID(),
        dateId,
        label: trimmedLabel,
        status: "pending",
        category: "all",
        highlight: false,
      });

      recordEvent("user", "field_update", "task-create", {
        label: trimmedLabel,
      });
    },
    [createDayTask, dateId, recordEvent],
  );

  /**
   * Moves a task through the standard pending → in progress → completed cycle.
   *
   * Why: tabs only need to request the transition, not reimplement patch logic.
   *
   * Returns: a promise that resolves when the mutation finishes.
   */
  const cycleTaskStatus = useCallback<DaySessionContextValue["cycleTaskStatus"]>(
    async (task) => {
      const nextStatus = getNextTaskStatus(task.status);
      await updateDayTaskStatus.mutateAsync({
        id: task.id,
        patch: {
          status: nextStatus,
          completedAt: nextStatus === "completed" ? new Date().toISOString() : null,
        },
      });

      recordEvent("user", "field_update", task.id, {
        field: "status",
        nextStatus,
      });
    },
    [recordEvent, updateDayTaskStatus],
  );

  /**
   * Updates the assignee for a task.
   *
   * Why: readiness warnings only matter when the task has a visible owner.
   *
   * Returns: a promise that resolves when the mutation finishes.
   */
  const updateTaskAssignment = useCallback<DaySessionContextValue["updateTaskAssignment"]>(
    async (taskId, assignedTo) => {
      await updateDayTaskStatus.mutateAsync({
        id: taskId,
        patch: {
          assignedTo: assignedTo ?? null,
        },
      });

      recordEvent("user", "field_update", taskId, {
        field: "assignedTo",
        assignedTo: assignedTo ?? null,
      });
    },
    [recordEvent, updateDayTaskStatus],
  );

  /**
   * Deletes a task from the active day.
   *
   * Why: the integrated task tab needs a provider-level delete action to keep
   * business logic out of the row component.
   *
   * Returns: a promise that resolves when the mutation finishes.
   */
  const deleteTask = useCallback<DaySessionContextValue["deleteTask"]>(
    async (taskId) => {
      await deleteDayTask.mutateAsync(taskId);
      setEvidenceDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[taskId];
        return nextDrafts;
      });
      recordEvent("user", "field_update", taskId, {
        field: "deleted",
        value: true,
      });
    },
    [deleteDayTask, recordEvent],
  );

  /**
   * Merges a new evidence draft patch for a task.
   *
   * Why: evidence is a structured local draft until the backend stores a richer
   * HACCP payload.
   *
   * Returns: nothing.
   */
  const updateEvidenceDraft = useCallback<
    (taskId: string, patch: DaySessionEvidenceDraft, actor?: DaySessionEvent["actor"]) => void
  >(
    (taskId, patch, actor = "user") => {
      setEvidenceDrafts((current) => ({
        ...current,
        [taskId]: {
          ...current[taskId],
          ...patch,
        },
      }));

      recordEvent(actor, actor === "agent" ? "tool_execution" : "field_update", taskId, {
        field: "evidenceDraft",
        patch,
      });
    },
    [recordEvent],
  );

  /**
   * Focuses a specific task row in shared state.
   *
   * Why: future agent tools should highlight the same task state the user sees.
   *
   * Returns: nothing.
   */
  const focusTask = useCallback<DaySessionContextValue["focusTask"]>(
    (taskId, actor = "user") => {
      setFocusedTaskId(taskId);
      if (taskId) {
        recordEvent(actor, actor === "agent" ? "tool_execution" : "task_focus", taskId, {});
      }
    },
    [recordEvent],
  );

  /**
   * Focuses a specific field in shared state.
   *
   * Why: field focus must be explicit before any agent bridge can point the UI.
   *
   * Returns: nothing.
   */
  const focusField = useCallback<DaySessionContextValue["focusField"]>(
    (fieldId, actor = "user") => {
      setFocusedFieldId(fieldId);
      if (fieldId) {
        recordEvent(actor, actor === "agent" ? "tool_execution" : "task_focus", fieldId, {});
      }
    },
    [recordEvent],
  );

  const value = useMemo<DaySessionContextValue>(
    () => ({
      dateId,
      evidenceDrafts,
      focusedTaskId,
      focusedFieldId,
      events,
      addTask,
      cycleTaskStatus,
      updateTaskAssignment,
      deleteTask,
      updateEvidenceDraft: (taskId, patch) => updateEvidenceDraft(taskId, patch),
      focusTask,
      focusField,
      recordEvent,
      ...data,
    }),
    [
      addTask,
      cycleTaskStatus,
      data,
      dateId,
      deleteTask,
      evidenceDrafts,
      events,
      focusField,
      focusTask,
      focusedFieldId,
      focusedTaskId,
      recordEvent,
      updateEvidenceDraft,
      updateTaskAssignment,
    ],
  );

  return <DaySessionContext.Provider value={value}>{children}</DaySessionContext.Provider>;
}
