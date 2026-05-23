// ============================================
// day-control/SessionTasksTab.tsx
// Integrated day-session tasks tab with evidence capture and readiness warnings.
// Exists to unify operations tasks, HACCP evidence drafts, and training warnings.
// Connected to: DaySessionProvider.tsx and day-session-model.ts
// ============================================
"use client";

import { useEffect, useState } from "react";
import { CheckSquare, Loader2, Plus, Trash2 } from "lucide-react";

import { isTaskFieldFocused, isTaskFocused } from "./day-session-focus";
import { useDaySession } from "./use-day-session";

/**
 * Maps evidence state to a reusable badge tone.
 *
 * Why: evidence status needs a stable visual language across all task rows.
 *
 * Returns: the class names for the badge.
 */
function getEvidenceTone(state: "not_required" | "required" | "captured" | "missing"): string {
  if (state === "captured") {
    return "border-success/30 bg-success/10 text-success";
  }

  if (state === "missing") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }

  if (state === "required") {
    return "border-warning/30 bg-warning/10 text-warning";
  }

  return "border-border bg-muted/40 text-muted-foreground";
}

/**
 * Maps readiness warning levels to a reusable badge tone.
 *
 * Why: assignee risk should be scannable before a manager opens task details.
 *
 * Returns: the class names for the badge.
 */
function getReadinessTone(level: "none" | "info" | "warning" | "critical"): string {
  if (level === "critical") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }

  if (level === "warning") {
    return "border-warning/30 bg-warning/10 text-warning";
  }

  if (level === "info") {
    return "border-info/30 bg-info/10 text-info";
  }

  return "border-success/30 bg-success/10 text-success";
}

/**
 * Renders the filter pill used above the task list.
 *
 * Why: the integrated task tab still needs a compact way to narrow the list.
 *
 * Returns: a clickable filter badge.
 */
function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-lg px-2 py-1.5 text-[9px] font-bold transition-colors ${
        active
          ? "bg-muted text-foreground"
          : "border-border text-muted-foreground border bg-transparent"
      } hover:bg-accent/20 hover:text-accent`}
    >
      {label}
    </button>
  );
}

/**
 * Renders the integrated task list for the active day-session snapshot.
 *
 * Why: this is the first place where tasks, evidence, and readiness must be
 * visible together instead of spread across separate UI surfaces.
 *
 * Returns: the integrated session task tab content.
 */
export function SessionTasksTab() {
  const {
    snapshot,
    isLoading,
    error,
    evidenceDrafts,
    focusedTaskId,
    focusedFieldId,
    addTask,
    cycleTaskStatus,
    updateTaskAssignment,
    deleteTask,
    updateEvidenceDraft,
    focusTask,
    focusField,
    dayEmployees,
    employees,
  } = useDaySession();
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [filter, setFilter] = useState<"all" | "routine" | "delegated">("all");

  const assigneeOptions = dayEmployees.length > 0 ? dayEmployees : employees;
  const taskList = snapshot?.tasks ?? [];
  const filteredTasks =
    filter === "all" ? taskList : taskList.filter((task) => task.category === filter);

  const routineCount = taskList.filter((task) => task.category === "routine").length;
  const delegatedCount = taskList.filter((task) => task.category === "delegated").length;

  const handleAddTask = async () => {
    await addTask(newTaskLabel);
    setNewTaskLabel("");
  };

  useEffect(() => {
    if (focusedFieldId) {
      const target = document.querySelector(`[data-day-session-field-id="${focusedFieldId}"]`);
      if (target instanceof HTMLElement) {
        target.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      return;
    }

    if (focusedTaskId) {
      const target = document.querySelector(`[data-day-session-task-id="${focusedTaskId}"]`);
      if (target instanceof HTMLElement) {
        target.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [focusedFieldId, focusedTaskId]);

  if (isLoading) {
    return (
      <section className="animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="border-border bg-muted/20 flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border">
          <Loader2 className="text-accent h-5 w-5 animate-spin" />
          <p className="text-muted-foreground text-xs font-medium">
            Loading integrated day-session state...
          </p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="border-destructive/20 bg-destructive/5 min-h-[220px] rounded-2xl border p-4">
          <p className="text-destructive text-sm font-black">Could not load day-session tasks.</p>
          <p className="text-destructive/80 mt-2 text-xs">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
            Session Tasks
          </h3>
          <p className="text-muted-foreground mt-1 text-[11px]">
            Capture operational proof and spot assignment risks before signoff.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="border-success/20 bg-success/10 text-success rounded-full border px-2 py-0.5 text-[10px] font-bold">
            {snapshot?.summary.tasksReadyForSignoff ?? 0} signoff-ready
          </span>
          <span className="border-destructive/20 bg-destructive/10 text-destructive rounded-full border px-2 py-0.5 text-[10px] font-bold">
            {snapshot?.summary.tasksMissingEvidence ?? 0} missing evidence
          </span>
          <span className="border-warning/20 bg-warning/10 text-warning rounded-full border px-2 py-0.5 text-[10px] font-bold">
            {snapshot?.summary.warningCount ?? 0} readiness risks
          </span>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <input
          type="text"
          placeholder="Add a day-session task..."
          value={newTaskLabel}
          onChange={(event) => setNewTaskLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void handleAddTask();
            }
          }}
          className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex-1 rounded-xl border bg-transparent p-3 text-xs shadow-inner focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
        />
        <button
          onClick={() => void handleAddTask()}
          className="border-success/30 bg-success/20 text-success hover:bg-success/30 flex items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-colors md:px-4"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      <div className="no-scrollbar mb-5 flex gap-1.5 overflow-x-auto pb-1">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All tasks" />
        <FilterChip
          active={filter === "routine"}
          onClick={() => setFilter("routine")}
          label={`Routine (${routineCount})`}
        />
        <FilterChip
          active={filter === "delegated"}
          onClick={() => setFilter("delegated")}
          label={`Delegated (${delegatedCount})`}
        />
      </div>

      {filteredTasks.length === 0 ? (
        <div className="border-border bg-muted/20 rounded-2xl border p-6 text-center">
          <p className="text-foreground text-sm font-bold">No integrated tasks for this day yet.</p>
          <p className="text-muted-foreground mt-2 text-xs">
            Add the first task to start capturing evidence and assignment warnings.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const draft = evidenceDrafts[task.id] ?? {};
            const isFocused = isTaskFocused(task.id, focusedTaskId);
            const isAssigneeFocused = isTaskFieldFocused(task.id, focusedFieldId, "assignee");
            const isMeasurementFocused = isTaskFieldFocused(task.id, focusedFieldId, "measurement");
            const isNoteFocused = isTaskFieldFocused(task.id, focusedFieldId, "note");
            const evidenceTone = getEvidenceTone(task.evidence.state);
            const readinessTone = getReadinessTone(task.readiness.level);
            const isCompleted = task.status === "completed";
            const assigneeName =
              assigneeOptions.find((employee) => employee.id === task.assignedTo)?.name ??
              "Unassigned";

            return (
              <article
                key={task.id}
                data-day-session-task-id={task.id}
                className={`rounded-2xl border p-4 transition-colors ${
                  task.evidence.state === "missing"
                    ? "border-destructive/20 bg-destructive/5"
                    : isCompleted
                      ? "border-border bg-muted/30"
                      : "border-border bg-background"
                } ${isFocused ? "ring-accent/40 ring-1" : ""}`}
                onFocus={() => focusTask(task.id)}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => void cycleTaskStatus({ id: task.id, status: task.status })}
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      isCompleted
                        ? "border-success bg-success text-background"
                        : task.status === "in_progress"
                          ? "border-info bg-info/20 text-info"
                          : "border-muted-foreground/30 hover:border-accent text-transparent"
                    }`}
                  >
                    {task.status === "in_progress" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckSquare className="h-3.5 w-3.5" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4
                        className={`text-sm font-bold ${isCompleted ? "text-muted-foreground line-through" : "text-foreground"}`}
                      >
                        {task.label}
                      </h4>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${evidenceTone}`}
                      >
                        {task.evidence.state.replace("_", " ")}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${readinessTone}`}
                      >
                        {task.readiness.label}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,220px)_1fr]">
                      <label
                        data-day-session-field-id={`assignee:${task.id}`}
                        className={`flex flex-col gap-1.5 rounded-xl p-2 text-[10px] font-bold tracking-widest uppercase transition-colors ${
                          isAssigneeFocused
                            ? "border-accent/40 bg-accent/5 text-accent/70 border"
                            : "text-muted-foreground"
                        }`}
                      >
                        Assignee
                        <select
                          value={task.assignedTo ?? ""}
                          onChange={(event) =>
                            void updateTaskAssignment(
                              task.id,
                              event.target.value ? event.target.value : undefined,
                            )
                          }
                          onFocus={() => focusField(`assignee:${task.id}`)}
                          className={`text-foreground rounded-xl border bg-transparent px-3 py-2 text-xs font-medium tracking-normal normal-case ${
                            isAssigneeFocused
                              ? "border-accent/50 ring-accent/30 ring-1"
                              : "border-input"
                          }`}
                        >
                          <option value="">Select assignee</option>
                          {assigneeOptions.map((employee) => (
                            <option key={employee.id} value={employee.id}>
                              {employee.name}
                            </option>
                          ))}
                        </select>
                        <span className="text-muted-foreground text-[11px] font-medium tracking-normal normal-case">
                          Current: {assigneeName}
                        </span>
                      </label>

                      <div
                        className={`bg-muted/20 rounded-xl border p-3 transition-colors ${
                          isMeasurementFocused || isNoteFocused
                            ? "border-accent/40 ring-accent/20 ring-1"
                            : "border-border"
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                            Evidence
                          </span>
                          <span className="text-muted-foreground text-[11px]">
                            {task.evidence.hint ?? "No evidence required."}
                          </span>
                        </div>

                        {task.evidence.kind === "measurement" && (
                          <input
                            data-day-session-field-id={`measurement:${task.id}`}
                            type="text"
                            value={draft.measurement ?? ""}
                            placeholder="Record reading, for example 4.0 C"
                            onChange={(event) =>
                              updateEvidenceDraft(task.id, {
                                measurement: event.target.value,
                              })
                            }
                            onFocus={() => focusField(`measurement:${task.id}`)}
                            className={`placeholder:text-muted-foreground w-full rounded-xl border bg-transparent px-3 py-2 text-xs ${
                              isMeasurementFocused
                                ? "border-accent/50 ring-accent/30 ring-1"
                                : "border-input"
                            }`}
                          />
                        )}

                        {task.evidence.kind === "note" && (
                          <textarea
                            data-day-session-field-id={`note:${task.id}`}
                            rows={2}
                            value={draft.note ?? ""}
                            placeholder="Write a short control note..."
                            onChange={(event) =>
                              updateEvidenceDraft(task.id, {
                                note: event.target.value,
                              })
                            }
                            onFocus={() => focusField(`note:${task.id}`)}
                            className={`placeholder:text-muted-foreground min-h-20 w-full rounded-xl border bg-transparent px-3 py-2 text-xs ${
                              isNoteFocused
                                ? "border-accent/50 ring-accent/30 ring-1"
                                : "border-input"
                            }`}
                          />
                        )}

                        {task.readiness.detail && (
                          <p className="text-muted-foreground mt-2 text-[11px]">
                            {task.readiness.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => void deleteTask(task.id)}
                    className="text-muted-foreground hover:text-destructive shrink-0 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
