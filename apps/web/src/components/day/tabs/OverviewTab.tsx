"use client";

import { useMemo } from "react";
import type { UiPhase } from "@smartout/utils";
import type { DepartmentSessionRow } from "@/app/dashboard/hms/_hooks/use-department-sessions";
import { useDeviations } from "@/app/dashboard/hms/_hooks/use-deviations";
import { useLiveShifts } from "@/app/dashboard/_hooks/use-live-shifts";
import { KpiTile, DeviationCard } from "../widgets";
import type { DayKpi, DayDeviation } from "../widgets";

export function OverviewTab({
  session,
  phase,
  departmentId: _departmentId,
}: {
  session: DepartmentSessionRow;
  phase: UiPhase;
  departmentId: string;
}) {
  void phase;
  const live = useLiveShifts();
  const openDevs = useDeviations({ status: ["open", "acknowledged"] });

  const kpis: DayKpi[] = useMemo(
    () =>
      buildKpiTiles({
        tasksTotal: session.tasksTotal,
        tasksCompleted: session.tasksCompleted,
        clockedIn: live.data?.clockedIn ?? 0,
        onBreak: live.data?.onBreak ?? 0,
        openDeviations: (openDevs.data ?? []).length,
      }),
    [session.tasksTotal, session.tasksCompleted, live.data, openDevs.data],
  );

  const displayDeviations: DayDeviation[] = useMemo(
    () =>
      (openDevs.data ?? []).slice(0, 3).map((d) => ({
        id: d.deviationId,
        severity: d.severity,
        status: d.status,
        type: d.domain ?? "Avvik",
        title: d.title,
        desc: d.description ?? "",
        reporter: d.reporterName ?? "—",
        time: d.createdAt ? new Date(d.createdAt).toTimeString().slice(0, 5) : "",
        photos: Array.isArray(d.attachments) ? d.attachments.length : 0,
        assignedTo: null,
      })),
    [openDevs.data],
  );

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
      <div className="grid gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {kpis.map((k) => (
            <KpiTile key={k.key} tile={k} variant="compact" />
          ))}
        </div>

        {/* Dagens forløp — PhaseTimeline wired in PR 3 with session_hook data */}
        <div className="bg-card border-border rounded-[14px] border p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-heading text-[20px]">Dagens forløp</h3>
            <span className="text-muted-foreground font-mono text-[11px]">
              {session.tasksCompleted}/{session.tasksTotal} oppgaver
            </span>
          </div>
          <div className="text-muted-foreground text-[13px]">
            Tidslinje med session_hooks aktiveres når hook-dataen er tilgjengelig. Se{" "}
            <code className="font-mono text-[12px]">PR 3</code>.
          </div>
        </div>

        <div className="bg-card border-border rounded-[14px] border p-4.5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold">Aktiv bemanning nå</h3>
            <span className="text-muted-foreground text-[11px]">
              {live.data?.clockedIn ?? 0} innstemplet
            </span>
          </div>
          <LiveShiftList entries={live.data?.entries ?? []} />
        </div>
      </div>

      <aside className="grid content-start gap-3.5">
        {displayDeviations.length > 0 ? (
          displayDeviations.map((d) => <DeviationCard key={d.id} deviation={d} variant="compact" />)
        ) : (
          <div className="bg-card border-border text-muted-foreground rounded-[14px] border p-4 text-[12px]">
            Ingen åpne avvik akkurat nå.
          </div>
        )}
        <div className="bg-card border-border rounded-[14px] border p-4">
          <div className="text-muted-foreground mb-2.5 text-[11px] font-semibold tracking-[0.12em] uppercase">
            Siste meldinger
          </div>
          <div className="text-muted-foreground text-[12px]">
            Wires til komm &ldquo;news&rdquo;-kanal i PR 3.
          </div>
        </div>
      </aside>
    </div>
  );
}

function LiveShiftList({
  entries,
}: {
  entries: Array<{
    shiftId: string;
    employeeName: string;
    role: string;
    status: "clocked_in" | "on_break" | "waiting" | "late";
    duration?: string;
    startTime?: string;
  }>;
}) {
  if (entries.length === 0) {
    return (
      <div className="text-muted-foreground text-[12px]">Ingen innstempla vakter akkurat nå.</div>
    );
  }
  return (
    <ul className="grid gap-2">
      {entries.map((e) => (
        <li
          key={e.shiftId}
          className="bg-background border-border flex items-center justify-between gap-3 rounded-[10px] border px-3 py-2"
        >
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold">{e.employeeName}</div>
            <div className="text-muted-foreground text-[11px]">{e.role}</div>
          </div>
          <div className="text-muted-foreground font-mono text-[11px]">
            {e.duration ?? e.startTime ?? "—"}
          </div>
        </li>
      ))}
    </ul>
  );
}

function buildKpiTiles(data: {
  tasksTotal: number;
  tasksCompleted: number;
  clockedIn: number;
  onBreak: number;
  openDeviations: number;
}): DayKpi[] {
  return [
    {
      key: "revenue",
      label: "Omsetning",
      value: "—",
      unit: "kr",
      sub: "Kun etter dag-oppgjør",
      source: "post-reconciliation",
    },
    {
      key: "hours",
      label: "Arbeidstid",
      value: "—",
      unit: "t",
      sub: "Vises i Bemanning-fanen",
      source: "live",
    },
    {
      key: "laborcost",
      label: "Lønn",
      value: "—",
      unit: "kr",
      sub: "Kun etter dag-oppgjør",
      source: "post-reconciliation",
    },
    {
      key: "oncall",
      label: "På vakt nå",
      value: String(data.clockedIn),
      unit: data.onBreak > 0 ? `+ ${data.onBreak} pause` : "innstemplet",
      sub: "live fra time_entry",
      source: "live",
    },
    {
      key: "tasksdone",
      label: "Oppgaver",
      value: String(data.tasksCompleted),
      unit: `/ ${data.tasksTotal}`,
      sub: "session_task",
      source: "live",
    },
    {
      key: "deviations",
      label: "Avvik",
      value: String(data.openDeviations),
      unit: "åpne",
      sub: "deviation",
      source: "live",
    },
  ];
}
