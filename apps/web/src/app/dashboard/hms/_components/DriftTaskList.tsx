"use client";

import { useContext, useMemo } from "react";
import { Loader2, ClipboardCheck } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspace } from "@/lib/workspace-context";
import { useDepartmentSessions } from "../_hooks/use-department-sessions";
import { useSessionTasks, type SessionTask } from "../_hooks/use-session-tasks";
import { useCompleteTask } from "../_hooks/use-complete-task";
import { TaskCard } from "./TaskCard";

// TODO: move to i18n
const STRINGS = {
  noSession: "Ingen aktiv okt i dag.",
  noTasks: "Ingen oppgaver for denne okten.",
  completed: "fullfort",
  overdue: "forfalt",
} as const;

type Props = {
  /** Override session ID — used by admin drill-down */
  sessionId?: string;
  /** If true, show all tasks (admin). If false, filter by profile (employee). */
  showAll?: boolean;
};

export function DriftTaskList({ sessionId: overrideSessionId, showAll = false }: Props) {
  const { profileId } = useContext(DashboardContext);
  const { workspace } = useWorkspace();
  const today = new Date().toISOString().split("T")[0];

  const { data: sessions, isLoading: sessionsLoading } = useDepartmentSessions(today);

  // Find the employee's active session (first active session matching their department)
  const activeSessionId =
    overrideSessionId ?? sessions?.find((s) => s.status === "active")?.sessionId;

  const { data: tasks, isLoading: tasksLoading } = useSessionTasks(
    activeSessionId,
    showAll ? undefined : profileId,
  );
  const completeTask = useCompleteTask();

  const isLoading = sessionsLoading || tasksLoading;

  const sortedTasks = useMemo(() => {
    if (!tasks) return [];
    const priority: Record<string, number> = {
      overdue: 0,
      escalated: 1,
      in_progress: 2,
      pending: 3,
      available: 4,
      completed: 5,
      skipped: 6,
    };
    return [...tasks].sort((a, b) => (priority[a.status] ?? 9) - (priority[b.status] ?? 9));
  }, [tasks]);

  const completedCount = sortedTasks.filter((t) => t.status === "completed").length;
  const overdueCount = sortedTasks.filter(
    (t) => t.status === "overdue" || t.status === "escalated",
  ).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!activeSessionId) {
    return (
      <div className="border-border bg-card/50 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12">
        <ClipboardCheck className="text-muted-foreground mb-3 h-10 w-10" />
        <p className="text-muted-foreground text-sm">{STRINGS.noSession}</p>
      </div>
    );
  }

  if (sortedTasks.length === 0) {
    return (
      <div className="border-border bg-card/50 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12">
        <ClipboardCheck className="text-muted-foreground mb-3 h-10 w-10" />
        <p className="text-muted-foreground text-sm">{STRINGS.noTasks}</p>
      </div>
    );
  }

  function handleComplete(taskId: string, evidence: Record<string, unknown>) {
    completeTask.mutate({ taskId, sessionId: activeSessionId!, evidence });
  }

  function handleFlagDeviation(_task: SessionTask) {
    // Phase 2 Task 9 wires this to DeviationForm
  }

  return (
    <div className="space-y-2">
      {sortedTasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onComplete={handleComplete}
          onFlagDeviation={handleFlagDeviation}
        />
      ))}

      {/* Summary bar */}
      <div className="bg-muted/50 flex items-center justify-between rounded-lg px-4 py-2">
        <span className="text-muted-foreground text-xs">
          {completedCount}/{sortedTasks.length} {STRINGS.completed}
        </span>
        {overdueCount > 0 && (
          <span className="text-xs font-semibold text-red-500">
            {overdueCount} {STRINGS.overdue}
          </span>
        )}
      </div>
    </div>
  );
}
