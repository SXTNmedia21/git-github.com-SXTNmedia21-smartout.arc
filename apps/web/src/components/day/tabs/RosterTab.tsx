"use client";

import { useMemo } from "react";
import { useRoster } from "@/app/dashboard/_hooks/use-roster";
import { ShiftCard } from "../widgets";
import type { DayShift, DeptKey } from "../widgets";

export function RosterTab({ departmentId, dateISO }: { departmentId: string; dateISO: string }) {
  const q = useRoster(departmentId, dateISO);

  const shifts: DayShift[] = useMemo(
    () =>
      (q.data ?? []).map((r) => ({
        id: r.shiftId,
        displayName: r.employeeName,
        role: r.role,
        initials: r.initials,
        deptKey: "kitchen" as DeptKey, // TODO(PR 4): resolve from department metadata
        start: r.startTime,
        end: r.endTime,
        status: r.status,
        live: r.live,
        breakState: r.onBreak ? "pause" : null,
        plannedHours: r.plannedHours,
        actualHours: r.actualHours,
      })),
    [q.data],
  );

  if (q.isLoading) {
    return <div className="text-muted-foreground text-[13px]">Laster bemanning…</div>;
  }

  if (shifts.length === 0) {
    return (
      <div className="bg-card border-border rounded-[14px] border p-6 text-center">
        <h3 className="font-heading text-[18px]">Ingen vakter på denne dagen</h3>
        <p className="text-muted-foreground mt-2 text-[13px]">
          Legg til vakter via{" "}
          <code className="text-foreground font-mono text-[12px]">/dashboard/schedule</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border-border overflow-hidden rounded-[14px] border">
      <div className="text-muted-foreground bg-muted border-border grid grid-cols-[100px_1fr_120px_120px_110px] border-b px-4 py-2.5 text-[10px] font-semibold tracking-[0.12em] uppercase">
        <span>Tid</span>
        <span>Person</span>
        <span>Planlagt</span>
        <span>Faktisk</span>
        <span>Status</span>
      </div>
      <div className="grid gap-0">
        {shifts.map((s) => (
          <RosterRow key={s.id} shift={s} />
        ))}
      </div>
    </div>
  );
}

function RosterRow({ shift }: { shift: DayShift }) {
  const statusColor =
    shift.status === "active"
      ? "text-[color:var(--success)]"
      : shift.status === "completed"
        ? "text-muted-foreground"
        : "text-[color:var(--info)]";
  const statusDot =
    shift.status === "active"
      ? "bg-[color:var(--success)]"
      : shift.status === "completed"
        ? "bg-muted-foreground"
        : "bg-[color:var(--info)]";
  const statusLabel =
    shift.status === "active"
      ? shift.breakState === "pause"
        ? "Pause"
        : "Aktiv"
      : shift.status === "completed"
        ? "Ferdig"
        : "Kommer";
  return (
    <div className="border-border grid grid-cols-[100px_1fr_120px_120px_110px] items-center border-b px-4 py-3 text-[13px] last:border-b-0">
      <span className="font-mono text-[13px] font-semibold tabular-nums">
        {shift.start}–{shift.end}
      </span>
      <div>
        <div className="font-semibold">{shift.displayName}</div>
        <div className="text-muted-foreground text-[11px]">{shift.role}</div>
      </div>
      <span className="text-muted-foreground font-mono tabular-nums">
        {shift.plannedHours.toFixed(1)}t
      </span>
      <span className="font-mono font-semibold tabular-nums">{shift.actualHours.toFixed(1)}t</span>
      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${statusColor}`}>
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${statusDot} ${shift.live ? "motion-safe:animate-pulse" : ""}`}
        />
        {statusLabel}
      </span>
    </div>
  );
}
