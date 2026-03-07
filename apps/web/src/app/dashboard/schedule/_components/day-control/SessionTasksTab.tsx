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
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  }

  if (state === "missing") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-400";
  }

  if (state === "required") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-400";
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
    return "border-rose-500/30 bg-rose-500/10 text-rose-400";
  }

  if (level === "warning") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-400";
  }

  if (level === "info") {
    return "border-sky-500/30 bg-sky-500/10 text-sky-400";
  }

  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
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
      } hover:bg-orange-500/20 hover:text-orange-400`}
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
          <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
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
        <div className="min-h-[220px] rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
          <p className="text-sm font-black text-rose-400">Could not load day-session tasks.</p>
          <p className="mt-2 text-xs text-rose-300/80">
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
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
            {snapshot?.summary.tasksReadyForSignoff ?? 0} signoff-ready
          </span>
          <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400">
            {snapshot?.summary.tasksMissingEvidence ?? 0} missing evidence
          </span>
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
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
          className="border-input placeholder:text-muted-foreground flex-1 rounded-xl border bg-transparent p-3 text-xs shadow-inner focus:border-orange-500/50 focus:outline-none"
        />
        <button
          onClick={() => void handleAddTask()}
          className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-3 text-xs font-bold text-emerald-500 transition-all hover:bg-emerald-500/30 md:px-4"
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
                    ? "border-rose-500/20 bg-rose-500/5"
                    : isCompleted
                      ? "border-border bg-muted/30"
                      : "border-border bg-background"
                } ${isFocused ? "ring-1 ring-orange-500/40" : ""}`}
                onFocus={() => focusTask(task.id)}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => void cycleTaskStatus({ id: task.id, status: task.status })}
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      isCompleted
                        ? "border-emerald-500 bg-emerald-500 text-[#050505]"
                        : task.status === "in_progress"
                          ? "border-blue-500 bg-blue-500/20 text-blue-400"
                          : "border-muted-foreground/30 text-transparent hover:border-orange-500"
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
                            ? "border border-orange-500/40 bg-orange-500/5 text-orange-300"
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
                              ? "border-orange-500/50 ring-1 ring-orange-500/30"
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
                            ? "border-orange-500/40 ring-1 ring-orange-500/20"
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
                                ? "border-orange-500/50 ring-1 ring-orange-500/30"
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
                                ? "border-orange-500/50 ring-1 ring-orange-500/30"
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
                    className="text-muted-foreground shrink-0 transition-colors hover:text-rose-400"
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
