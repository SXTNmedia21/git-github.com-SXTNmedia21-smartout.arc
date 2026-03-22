"use client";

import { useContext, useMemo } from "react";
import { Loader2, ClipboardCheck } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useDepartmentSessions } from "../_hooks/use-department-sessions";
import { useSessionTasks, type SessionTask } from "../_hooks/use-session-tasks";
import { useCompleteTask } from "../_hooks/use-complete-task";
import { TaskCard } from "./TaskCard";

// TODO: move to i18n
const STRINGS = {
  noSession: "Ingen aktiv okt.",
  noTasks: "Ingen oppgaver.",
  now: "NA",
} as const;

function timeLabel(date: string): string {
  return new Date(date).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
}

export function DriftTimeline() {
  const { profileId } = useContext(DashboardContext);
  const today = new Date().toISOString().split("T")[0]!;
  const { data: sessions, isLoading: sessionsLoading } = useDepartmentSessions(today);
  const activeSession = sessions?.find((s) => s.status === "active");
  const { data: tasks, isLoading: tasksLoading } = useSessionTasks(
    activeSession?.sessionId,
    profileId,
  );
  const completeTask = useCompleteTask();

  const now = new Date();
  const nowStr = now.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });

  const sortedTasks = useMemo(() => {
    if (!tasks) return [];
    return [...tasks].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [tasks]);

  if (sessionsLoading || tasksLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!activeSession) {
    return (
      <div className="border-border bg-card/50 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12">
        <ClipboardCheck className="text-muted-foreground mb-3 h-10 w-10" />
        <p className="text-muted-foreground text-sm">{STRINGS.noSession}</p>
      </div>
    );
  }

  function handleComplete(taskId: string, evidence: Record<string, unknown>) {
    completeTask.mutate({ taskId, sessionId: activeSession!.sessionId, evidence });
  }

  function handleFlagDeviation(_task: SessionTask) {
    // Phase 2 Task 9 wires this
  }

  return (
    <div className="relative pl-8">
      {/* Timeline line */}
      <div className="bg-border absolute top-0 bottom-0 left-3 w-0.5" />

      {/* "Now" marker */}
      <div className="relative mb-4 flex items-center">
        <div className="absolute left-[-20px] h-3.5 w-3.5 rounded-full border-2 border-red-500 bg-red-500" />
        <span className="text-xs font-bold text-red-500">
          {STRINGS.now} — {nowStr}
        </span>
      </div>

      {/* Tasks on timeline */}
      {sortedTasks.map((task) => (
        <div key={task.id} className="relative mb-3">
          {/* Timeline dot */}
          <div
            className={`border-background absolute top-4 left-[-20px] h-2.5 w-2.5 rounded-full border-2 ${
              task.status === "completed"
                ? "bg-green-500"
                : task.status === "overdue" || task.status === "escalated"
                  ? "bg-red-500"
                  : task.status === "in_progress"
                    ? "bg-yellow-500"
                    : "bg-muted-foreground/30"
            }`}
          />
          {/* Time label */}
          <p className="text-muted-foreground mb-1 text-[10px]">{timeLabel(task.createdAt)}</p>
          {/* Task card */}
          <TaskCard task={task} onComplete={handleComplete} onFlagDeviation={handleFlagDeviation} />
        </div>
      ))}
    </div>
  );
}
