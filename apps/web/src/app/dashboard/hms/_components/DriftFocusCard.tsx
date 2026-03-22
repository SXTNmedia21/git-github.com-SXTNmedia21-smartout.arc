"use client";

import { useContext, useMemo } from "react";
import Link from "next/link";
import { ClipboardCheck, ChevronRight, Loader2 } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDepartmentSessions } from "../_hooks/use-department-sessions";
import { useSessionTasks } from "../_hooks/use-session-tasks";

// TODO: move to i18n
const STRINGS = {
  noTasks: "Ingen aktive oppgaver",
  nextTask: "Neste oppgave",
  goToDrift: "Ga til Drift",
  tasksOf: "oppgaver",
} as const;

export function DriftFocusCard() {
  const { profileId } = useContext(DashboardContext);
  const today = new Date().toISOString().split("T")[0];
  const { data: sessions, isLoading: sessionsLoading } = useDepartmentSessions(today);
  const activeSession = sessions?.find((s) => s.status === "active");
  const { data: tasks, isLoading: tasksLoading } = useSessionTasks(
    activeSession?.sessionId,
    profileId,
  );

  const nextTask = useMemo(() => {
    if (!tasks) return null;
    const priority: Record<string, number> = {
      overdue: 0,
      escalated: 1,
      in_progress: 2,
      pending: 3,
      available: 4,
    };
    return (
      tasks
        .filter((t) => t.status !== "completed" && t.status !== "skipped")
        .sort((a, b) => (priority[a.status] ?? 9) - (priority[b.status] ?? 9))[0] ?? null
    );
  }, [tasks]);

  const totalTasks = tasks?.length ?? 0;
  const completedTasks = tasks?.filter((t) => t.status === "completed").length ?? 0;

  if (sessionsLoading || tasksLoading) {
    return (
      <div className="border-border bg-card flex items-center justify-center rounded-xl border p-6">
        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (!activeSession || !nextTask) {
    return (
      <div className="border-border bg-card/50 flex items-center gap-3 rounded-xl border p-4">
        <ClipboardCheck className="text-muted-foreground h-8 w-8" />
        <p className="text-muted-foreground text-sm">{STRINGS.noTasks}</p>
      </div>
    );
  }

  const isOverdue = nextTask.status === "overdue" || nextTask.status === "escalated";

  return (
    <div className="border-border bg-card w-full rounded-xl border p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-muted-foreground text-xs font-medium">{STRINGS.nextTask}</p>
        {isOverdue && (
          <Badge className="bg-red-500/15 text-[10px] text-red-600 hover:bg-red-500/15">
            Forfalt
          </Badge>
        )}
      </div>
      <p className="text-foreground mb-2 font-semibold">{nextTask.title}</p>
      {nextTask.description && (
        <p className="text-muted-foreground mb-3 truncate text-xs">{nextTask.description}</p>
      )}

      {/* Progress dots */}
      <div className="mb-3 flex items-center gap-1">
        {Array.from({ length: totalTasks }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${
              i < completedTasks ? "bg-green-500" : "bg-muted"
            }`}
          />
        ))}
        <span className="text-muted-foreground ml-2 text-[10px]">
          {completedTasks}/{totalTasks} {STRINGS.tasksOf}
        </span>
      </div>

      <Button asChild size="sm" className="w-full">
        <Link href="/dashboard/hms/drift">
          {STRINGS.goToDrift}
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}
