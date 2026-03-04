// ============================================
// day-control/OppgaverTab.tsx
// Tasks tab — daily tasks and routines.
// ============================================
"use client";

import { useContext, useState } from "react";
import { Plus, CheckSquare, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import type { DayTask, TaskStatus } from "../schedule-types";
import {
  useDayTasks,
  useCreateDayTask,
  useUpdateDayTaskStatus,
  useDeleteDayTask,
} from "../../_hooks/use-day-content";
import { useWeekRange } from "../../_hooks/use-week-range";
import { nextTaskStatus } from "./shared";

export function OppgaverTab({ dateId }: { dateId: string | null }) {
  const { isDark } = useContext(DashboardContext);
  const { weekStart, weekEnd } = useWeekRange();
  const { data: dayTasksData = [] as DayTask[] } = useDayTasks(weekStart, weekEnd);
  const createDayTask = useCreateDayTask(weekStart);
  const updateDayTaskStatus = useUpdateDayTaskStatus(weekStart);
  const deleteDayTask = useDeleteDayTask(weekStart);

  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [filter, setFilter] = useState<"all" | "routine" | "delegated">("all");

  const allTasks = dateId ? dayTasksData.filter((t: DayTask) => t.dateId === dateId) : [];
  const filteredTasks =
    filter === "all" ? allTasks : allTasks.filter((t: DayTask) => t.category === filter);

  const completedCount = allTasks.filter((t: DayTask) => t.status === "completed").length;
  const totalCount = allTasks.length;
  const routineCount = allTasks.filter((t: DayTask) => t.category === "routine").length;
  const delegatedCount = allTasks.filter((t: DayTask) => t.category === "delegated").length;

  // Progress percentage
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  function handleAddTask() {
    if (!dateId) return;
    if (!newTaskLabel.trim()) {
      toast.error("Skriv et oppgavenavn");
      return;
    }

    createDayTask.mutate({
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      dateId,
      label: newTaskLabel.trim(),
      status: "pending",
      category: "all",
      highlight: false,
    });

    toast.success("Oppgave lagt til");
    setNewTaskLabel("");
  }

  function statusIcon(status: TaskStatus) {
    switch (status) {
      case "completed":
        return {
          icon: <CheckSquare className="h-3.5 w-3.5" />,
          classes: "border-emerald-500 bg-emerald-500 text-[#050505]",
        };
      case "in_progress":
        return {
          icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
          classes: "border-blue-500 bg-blue-500/20 text-blue-400",
        };
      default:
        return {
          icon: <CheckSquare className="h-3.5 w-3.5" />,
          classes: "border-muted-foreground/30 text-transparent hover:border-orange-500",
        };
    }
  }

  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Header with progress */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
          Gjoremal &amp; Rutiner
        </h3>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
            {completedCount} / {totalCount} Utfort
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="mb-4">
          <div
            className={`h-1.5 w-full overflow-hidden rounded-full ${isDark ? "bg-muted" : "bg-muted"}`}
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        {/* New task input */}
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            placeholder="Planlegg nytt gjoremal for dagen..."
            value={newTaskLabel}
            onChange={(e) => setNewTaskLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddTask();
            }}
            className="border-input placeholder:text-muted-foreground flex-1 rounded-xl border bg-transparent p-3 text-xs shadow-inner focus:border-orange-500/50 focus:outline-none"
          />
          <button
            onClick={handleAddTask}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-3 text-xs font-bold text-emerald-500 transition-all hover:bg-emerald-500/30 md:px-4"
          >
            <Plus className="h-3.5 w-3.5" /> Legg til
          </button>
        </div>

        {/* Filter chips */}
        <div className="no-scrollbar mb-5 flex gap-1.5 overflow-x-auto pb-1">
          <FilterChip
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label="Alle oppgaver"
          />
          <FilterChip
            active={filter === "routine"}
            onClick={() => setFilter("routine")}
            label={`Faste Rutiner (${routineCount})`}
          />
          <FilterChip
            active={filter === "delegated"}
            onClick={() => setFilter("delegated")}
            label={`Delegert (${delegatedCount})`}
          />
        </div>

        {/* Task list */}
        {filteredTasks.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-xs">
            {filter === "all"
              ? "Ingen oppgaver for denne dagen"
              : "Ingen oppgaver i denne kategorien"}
          </p>
        ) : (
          filteredTasks.map((task: DayTask) => {
            const { icon, classes } = statusIcon(task.status);
            const isDone = task.status === "completed";
            const isInProgress = task.status === "in_progress";

            const base = isDone
              ? `border-border bg-muted/30 opacity-60`
              : task.highlight
                ? `border-orange-500/20 bg-orange-500/5`
                : isInProgress
                  ? `border-blue-500/20 bg-blue-500/5`
                  : `border-border bg-background`;

            return (
              <div
                key={task.id}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${base}`}
              >
                <button
                  onClick={() =>
                    updateDayTaskStatus.mutate({
                      id: task.id,
                      patch: { status: nextTaskStatus(task.status) },
                    })
                  }
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${classes}`}
                >
                  {icon}
                </button>

                <span
                  className={`truncate text-xs font-medium ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}
                >
                  {task.label}
                </span>

                {task.highlight && (
                  <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                )}

                <button
                  onClick={() => {
                    deleteDayTask.mutate(task.id);
                    toast("Oppgave slettet");
                  }}
                  className="text-muted-foreground ml-auto shrink-0 transition-colors hover:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

// ── Filter Chip ──────────────────────────────────────────────

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
    <span
      onClick={onClick}
      className={`shrink-0 cursor-pointer rounded-lg px-2 py-1.5 text-[9px] font-bold transition-colors ${
        active
          ? "bg-muted text-foreground"
          : "border-border text-muted-foreground border bg-transparent"
      } hover:bg-orange-500/20 hover:text-orange-400`}
    >
      {label}
    </span>
  );
}
