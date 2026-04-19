"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { UiPhase } from "@smartout/utils";
import type { DepartmentSessionRow } from "@/app/dashboard/hms/_hooks/use-department-sessions";
import { useSessionHooksWithTasks } from "@/app/dashboard/_hooks/use-session-hooks-with-tasks";
import { toggleSessionTaskAction } from "@/app/dashboard/_actions/toggle-session-task-action";
import { PhaseTimeline, HookTile } from "../widgets";
import type { DayHook, DayTask } from "../widgets";

export function TimelineTab({
  session,
  phase: _phase,
}: {
  session: DepartmentSessionRow;
  phase: UiPhase;
}) {
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
          evidence: typeof t.evidence === "object" && t.evidence !== null ? null : null,
          note: t.note,
        })),
      })),
    [q.data, optimisticIds],
  );

  const nowPct = computeNowPct(session.plannedOpen, session.plannedClose);

  function handleToggle(task: DayTask) {
    const nextDone = !task.done;
    setOptimisticIds((prev) => ({ ...prev, [task.id]: nextDone }));
    startTransition(async () => {
      const res = await toggleSessionTaskAction({ taskId: task.id, done: nextDone });
      if (!res.ok) toast.error(res.error);
      await q.refetch();
      setOptimisticIds((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
    });
  }

  if (q.isLoading) {
    return <div className="text-muted-foreground text-[13px]">Laster tidslinjen…</div>;
  }

  return (
    <div className="grid gap-4">
      <div className="bg-card border-border rounded-[14px] border p-5">
        <PhaseTimeline
          hooks={hooks}
          nowPct={nowPct}
          startLabel={session.plannedOpen ?? undefined}
          endLabel={session.plannedClose ?? undefined}
        />
      </div>
      {hooks.map((h) => (
        <HookTile
          key={h.id}
          hook={h}
          defaultOpen={h.state === "in_progress"}
          onTaskToggle={handleToggle}
        />
      ))}
      {hooks.length === 0 ? (
        <div className="bg-card border-border text-muted-foreground rounded-[14px] border p-6 text-[13px]">
          Ingen hooks eller oppgaver registrert for denne sesjonen.
        </div>
      ) : null}
    </div>
  );
}

function computeNowPct(open: string | null, close: string | null): number {
  if (!open || !close) return 0;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const start = new Date(`${today}T${open}`);
  const end = new Date(`${today}T${close}`);
  const total = end.getTime() - start.getTime();
  if (total <= 0) return 0;
  const elapsed = now.getTime() - start.getTime();
  return Math.max(0, Math.min(100, (elapsed / total) * 100));
}
