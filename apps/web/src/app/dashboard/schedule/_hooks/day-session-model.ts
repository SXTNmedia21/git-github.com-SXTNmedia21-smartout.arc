// ============================================
// day-session-model.ts
// Builds the shared day-session view model for the schedule day panel.
// Exists to keep evidence and readiness rules testable outside React.
// Connected to: DaySessionProvider.tsx and day-session-model.test.ts
// ============================================

import type { DayTask, Shift } from "../_components/schedule-types";

export type EmployeeReadinessSummary = {
  profileId: string;
  readinessPercent: number;
  completedAssignments: number;
  pendingAssignments: number;
  expiredAssignments: number;
};

export type DaySessionEvidenceDraft = {
  note?: string;
  measurement?: string;
  photoCount?: number;
};

export type DaySessionEvidenceKind = "none" | "note" | "measurement";
export type DaySessionEvidenceState = "not_required" | "required" | "captured" | "missing";
export type DaySessionWarningLevel = "none" | "info" | "warning" | "critical";

export type DaySessionTaskEvidence = {
  kind: DaySessionEvidenceKind;
  required: boolean;
  state: DaySessionEvidenceState;
  hint: string | null;
};

export type DaySessionTaskReadiness = {
  level: DaySessionWarningLevel;
  label: string;
  detail: string | null;
};

export type DaySessionTaskSnapshot = {
  id: string;
  label: string;
  status: DayTask["status"];
  category: DayTask["category"];
  assignedTo?: string;
  evidence: DaySessionTaskEvidence;
  readiness: DaySessionTaskReadiness;
};

export type DaySessionSummary = {
  staffCount: number;
  taskCount: number;
  completedTaskCount: number;
  tasksMissingEvidence: number;
  tasksReadyForSignoff: number;
  criticalWarnings: number;
  warningCount: number;
};

export type DaySessionSnapshot = {
  dateId: string;
  shifts: Shift[];
  tasks: DaySessionTaskSnapshot[];
  summary: DaySessionSummary;
};

type BuildDaySessionSnapshotInput = {
  dateId: string;
  shifts: Shift[];
  tasks: DayTask[];
  readinessByProfile: Map<string, EmployeeReadinessSummary>;
  evidenceDrafts: Record<string, DaySessionEvidenceDraft>;
};

/**
 * Collects the profile IDs relevant to a day-session readiness query.
 *
 * Why: task assignees can differ from the people already scheduled on shift,
 * especially during reassignment and day-planning workflows.
 *
 * Returns: a sorted deduplicated list of relevant profile IDs.
 */
export function collectDaySessionProfileIds(shifts: Shift[], tasks: DayTask[]): string[] {
  const profileIds = new Set<string>();

  for (const shift of shifts) {
    if (shift.employeeId) {
      profileIds.add(shift.employeeId);
    }
  }

  for (const task of tasks) {
    if (task.assignedTo) {
      profileIds.add(task.assignedTo);
    }
  }

  return Array.from(profileIds).sort();
}

/**
 * Detects whether a task label implies a temperature-style HACCP reading.
 *
 * Why: measurement tasks need a stronger evidence rule than generic routine work.
 *
 * Returns: true when the task label looks like a temperature check.
 */
function isMeasurementTask(label: string): boolean {
  return /(temp|temperatur|temperature|malar temperatur|mal temperatur)/i.test(label);
}

/**
 * Detects whether a task label implies a signed or documented control.
 *
 * Why: a generic note is enough evidence for signoff-oriented work in V1.
 *
 * Returns: true when the task label sounds like a signed checklist or control.
 */
function isNoteTask(label: string): boolean {
  return /(signer|sign|kontroll|hygiene|clean|renhold|sjekk|check)/i.test(label);
}

/**
 * Determines the evidence rule for a day task.
 *
 * Why: the day panel needs one explicit rule set before richer backend evidence
 * schemas exist.
 *
 * Returns: the required evidence kind and operator hint for the task.
 */
function getEvidenceRule(
  task: DayTask,
): Pick<DaySessionTaskEvidence, "kind" | "required" | "hint"> {
  if (isMeasurementTask(task.label)) {
    return {
      kind: "measurement",
      required: true,
      hint: "Record a measurement before signoff.",
    };
  }

  if (task.category === "routine" || task.highlight || isNoteTask(task.label)) {
    return {
      kind: "note",
      required: true,
      hint: "Add a short operator note before signoff.",
    };
  }

  return {
    kind: "none",
    required: false,
    hint: null,
  };
}

/**
 * Resolves whether a task currently has enough evidence to count as captured.
 *
 * Why: V1 stores evidence drafts in shared React state, so the model must infer
 * completeness from the draft content.
 *
 * Returns: true when the draft satisfies the current evidence rule.
 */
function hasCapturedEvidence(
  kind: DaySessionEvidenceKind,
  draft: DaySessionEvidenceDraft | undefined,
): boolean {
  if (!draft) {
    return false;
  }

  if (kind === "measurement") {
    return (draft.measurement ?? "").trim().length > 0;
  }

  if (kind === "note") {
    return (draft.note ?? "").trim().length > 0 || (draft.photoCount ?? 0) > 0;
  }

  return true;
}

/**
 * Resolves the current evidence state for a task.
 *
 * Why: the UI needs a stable state machine for badges, warnings, and signoff counts.
 *
 * Returns: the evidence capture state for the task.
 */
function getEvidenceState(
  task: DayTask,
  draft: DaySessionEvidenceDraft | undefined,
): DaySessionTaskEvidence {
  const rule = getEvidenceRule(task);

  if (!rule.required) {
    return {
      ...rule,
      state: "not_required",
    };
  }

  if (hasCapturedEvidence(rule.kind, draft)) {
    return {
      ...rule,
      state: "captured",
    };
  }

  return {
    ...rule,
    state: task.status === "completed" ? "missing" : "required",
  };
}

/**
 * Builds the readiness warning shown beside a task assignee.
 *
 * Why: warn-first qualification logic must be explainable and deterministic.
 *
 * Returns: the warning level, label, and optional explanation for the assignee.
 */
function getReadinessState(
  assignedTo: string | undefined,
  readinessByProfile: Map<string, EmployeeReadinessSummary>,
): DaySessionTaskReadiness {
  if (!assignedTo) {
    return {
      level: "info",
      label: "Missing owner",
      detail: "Assign someone before handoff.",
    };
  }

  const readiness = readinessByProfile.get(assignedTo);
  if (!readiness) {
    return {
      level: "info",
      label: "No readiness snapshot",
      detail: "Training data has not loaded for this assignee yet.",
    };
  }

  if (readiness.expiredAssignments > 0) {
    return {
      level: "critical",
      label: "Expired training",
      detail: `${readiness.expiredAssignments} expired assignment(s) require attention.`,
    };
  }

  if (readiness.pendingAssignments > 0 || readiness.readinessPercent < 100) {
    return {
      level: "warning",
      label: "Training incomplete",
      detail: `${readiness.pendingAssignments} pending assignment(s), ${readiness.readinessPercent}% ready.`,
    };
  }

  return {
    level: "none",
    label: "Ready",
    detail: null,
  };
}

/**
 * Builds the shared day-session snapshot used by the day panel.
 *
 * Why: the panel should consume one view model instead of each tab recomputing
 * evidence, warnings, and summary counts independently.
 *
 * Returns: the normalized day snapshot for UI and agent-safe shared state.
 */
export function buildDaySessionSnapshot({
  dateId,
  shifts,
  tasks,
  readinessByProfile,
  evidenceDrafts,
}: BuildDaySessionSnapshotInput): DaySessionSnapshot {
  const dayShifts = shifts.filter((shift) => shift.dateId === dateId);
  const dayTasks = tasks.filter((task) => task.dateId === dateId);

  const taskSnapshots = dayTasks.map((task) => {
    const evidence = getEvidenceState(task, evidenceDrafts[task.id]);
    const readiness = getReadinessState(task.assignedTo, readinessByProfile);

    return {
      id: task.id,
      label: task.label,
      status: task.status,
      category: task.category,
      assignedTo: task.assignedTo,
      evidence,
      readiness,
    } satisfies DaySessionTaskSnapshot;
  });

  const staffCount = new Set(dayShifts.map((shift) => shift.employeeId).filter(Boolean)).size;
  const tasksMissingEvidence = taskSnapshots.filter(
    (task) => task.evidence.state === "missing",
  ).length;
  const completedTaskCount = taskSnapshots.filter((task) => task.status === "completed").length;
  const tasksReadyForSignoff = taskSnapshots.filter(
    (task) =>
      task.status === "completed" &&
      (task.evidence.state === "captured" || task.evidence.state === "not_required"),
  ).length;
  const criticalWarnings = taskSnapshots.filter(
    (task) => task.readiness.level === "critical",
  ).length;
  const warningCount = taskSnapshots.filter(
    (task) => task.readiness.level === "warning" || task.readiness.level === "critical",
  ).length;

  return {
    dateId,
    shifts: dayShifts,
    tasks: taskSnapshots,
    summary: {
      staffCount,
      taskCount: taskSnapshots.length,
      completedTaskCount,
      tasksMissingEvidence,
      tasksReadyForSignoff,
      criticalWarnings,
      warningCount,
    },
  };
}
