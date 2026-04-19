"use client";

import { useMemo, useState, useTransition } from "react";
import type { DepartmentSessionRow } from "@/app/dashboard/hms/_hooks/use-department-sessions";
import { useSessionHooksWithTasks } from "@/app/dashboard/_hooks/use-session-hooks-with-tasks";
import { toggleSessionTaskAction } from "@/app/dashboard/_actions/toggle-session-task-action";
import { HookTile } from "../widgets";
import type { DayHook, DayTask } from "../widgets";

export function TasksTab({ session }: { session: DepartmentSessionRow }) {
  const [, startTransition] = useTransition();
  const [optimisticIds, setOptimisticIds] = useState<Record<string, boolean>>({});
  const q = useSessionHooksWithTasks(session.sessionId);

  const hooks: DayHook[] = useMemo(
    () =>
      (q.data ?? []).map((h, i) => ({
        id: h.hookId ?? `orphan-${i}`,
        type: (h.hookType as DayHook["type"]) ?? "scheduled",
        title: h.title,
        time: h.time,
        offset: h.offset,
        state: h.state,
        progress: h.progress,
        tasks: h.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          owner: t.owner ?? "—",
          done: optimisticIds[t.id] ?? t.done,
          active: t.active,
          overdue: t.overdue,
          compliance: t.isComplianceRequired,
          evidence: null,
          note: t.note,
        })),
      })),
    [q.data, optimisticIds],
  );

  function handleToggle(task: DayTask) {
    const nextDone = !task.done;
    setOptimisticIds((prev) => ({ ...prev, [task.id]: nextDone }));
    startTransition(async () => {
      await toggleSessionTaskAction({ taskId: task.id, done: nextDone });
      await q.refetch();
      setOptimisticIds((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
    });
  }

  if (q.isLoading) {
    return <div className="text-muted-foreground text-[13px]">Laster oppgaver…</div>;
  }

  if (hooks.length === 0) {
    return (
      <div className="bg-card border-border rounded-[14px] border p-6 text-center">
        <h3 className="font-heading text-[18px]">Ingen oppgaver registrert</h3>
        <p className="text-muted-foreground mt-2 text-[13px]">
          session_task-radene ankommer når hook-lifecycle kjører fra operating_hours eller cron.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {hooks.map((h) => (
        <HookTile
          key={h.id}
          hook={h}
          defaultOpen={h.state !== "completed"}
          onTaskToggle={handleToggle}
        />
      ))}
    </div>
  );
}
