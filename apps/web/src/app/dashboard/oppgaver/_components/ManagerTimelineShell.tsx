"use client";

/**
 * ManagerTimelineShell — full-page Gantt-down Manager Timeline shell.
 *
 * Layout: CSS grid with three rows
 *   topbar  (60px) — brand + date stepper + manager pill + Lukk-dagen CTA
 *   toolbar (52px) — view-mode segments + area chips + filter chips + zoom
 *   body    (1fr)  — ManagerTimelineChart (scrolls internally)
 *
 * Outer wrapper is 100dvh + overflow:hidden so the chart owns its own scroll.
 * Layout escape via apps/web/src/app/dashboard/oppgaver/layout.tsx.
 *
 * DomainChatOwnership: declares "oppgaver-timeline" so the global Botsson Orb
 * suppresses to passive mode per ADR-0238 — the page does NOT embed a chat
 * surface, but the user mental-model around a Gantt + AI Orb dual-surface is
 * ambiguous enough that we declare ownership defensively (L-0178 prevention).
 *
 * Data wiring (Task 4.4):
 *   useDayLinesForDate         → bands (one per location/day_line)
 *   useSessionTasksForDate     → tasks (manager-scope, all areas)
 *   useRolesForPositions       → V1 stub (per Council C-B verdict)
 *
 * State (local React, no global store):
 *   dateISO, viewMode, activeAreaIds, onlyOpen, deviationsOnly, zoom,
 *   selectedTask (Phase 6 click-to-edit modal).
 */

import { useMemo, useState } from "react";
import { useDayLinesForDate, useSessionTasksForDate, useRolesForPositions } from "@smartout/data";
import { DomainChatOwnership } from "@/app/Botsson/_components/DomainChatOwnership";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { TimelineTopBar } from "./TimelineTopBar";
import { TimelineToolbar } from "./TimelineToolbar";
import { ManagerTimelineChart } from "../_chart/ManagerTimelineChart";
import type { Band } from "../_chart/AreaBand";
import type { Employee } from "../_chart/PersonLane";
import type { TimelineTask } from "../_chart/TaskBlock";

type ViewMode = "area" | "role" | "person";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function dateLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("nb-NO", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function shiftDate(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function ManagerTimelineShell() {
  const wsCtx = useWorkspaceOptional();
  const workspaceId = wsCtx?.workspace.workspace_id ?? null;

  const [dateISO, setDateISO] = useState<string>(todayISO());
  const [viewMode, setViewMode] = useState<ViewMode>("area");
  const [activeAreaIds, setActiveAreaIds] = useState<string[]>([]);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [deviationsOnly, setDeviationsOnly] = useState(false);
  const [zoom, setZoom] = useState<number>(48); // pxPerHour

  const dayLinesQ = useDayLinesForDate(workspaceId ?? "", dateISO);
  const tasksQ = useSessionTasksForDate(workspaceId, dateISO);
  // V1: roles stub. Reserved for V2 role-mode rendering. Disabled by hook.
  void useRolesForPositions(workspaceId, dateISO);

  const bands: Band[] = useMemo(() => {
    const rows = dayLinesQ.data ?? [];
    return rows.map((dl) => ({
      id: dl.day_line_id,
      name: dl.location_name || dl.location_id,
      short: (dl.location_name || dl.location_id).slice(0, 3).toUpperCase(),
      open: dl.planned_open.slice(0, 5),
      close: dl.planned_close.slice(0, 5),
    }));
  }, [dayLinesQ.data]);

  const tasks: TimelineTask[] = useMemo(() => {
    const rows = tasksQ.data ?? [];
    return rows.map((t) => ({
      id: t.id,
      title: t.title,
      // V1: session_task has no scheduled_at on the manager-scope row type.
      // Display tasks at session_hook anchor when available; otherwise stack
      // them at 12:00 placeholder. Full time-anchored render lands when the
      // useSessionTasksForDate row is extended to expose scheduled_at.
      start: "12:00",
      end: "13:00",
      status:
        t.status === "completed"
          ? "done"
          : t.status === "in_progress"
            ? "in_progress"
            : t.status === "overdue"
              ? "missed"
              : "upcoming",
      area: t.department_id,
      emp: t.assigned_to,
    }));
  }, [tasksQ.data]);

  const employees: Employee[] = useMemo(() => {
    // V1: derive from assigned_to in tasks (placeholder — Phase 4 follow-up
    // should add useEmployeesForDate hook reading schedule_shift + profile)
    const seen = new Map<string, Employee>();
    for (const t of tasks) {
      if (t.emp && !seen.has(t.emp)) {
        seen.set(t.emp, {
          id: t.emp,
          name: t.emp.slice(0, 8),
          role: "—",
          area: t.area ?? "",
          shift: null,
        });
      }
    }
    return Array.from(seen.values());
  }, [tasks]);

  const dimmedBandIds = useMemo(() => {
    if (activeAreaIds.length === 0) return undefined;
    return bands.filter((b) => !activeAreaIds.includes(b.id)).map((b) => b.id);
  }, [bands, activeAreaIds]);

  const filteredTasks = useMemo(() => {
    let out = tasks;
    if (onlyOpen) out = out.filter((t) => t.status !== "done");
    if (deviationsOnly) out = out.filter((t) => t.status === "missed");
    return out;
  }, [tasks, onlyOpen, deviationsOnly]);

  const areas = bands.map((b) => ({ id: b.id, label: b.name }));
  const managerName = wsCtx?.workspace.name ?? "—";
  const deviationsCount = tasks.filter((t) => t.status === "missed").length;

  return (
    <>
      <DomainChatOwnership reason="oppgaver-timeline" />
      <div
        className="bg-background grid h-[100dvh] grid-rows-[60px_52px_1fr] overflow-hidden"
        role="region"
        aria-label="Manager Timeline"
      >
        <TimelineTopBar
          dateISO={dateISO}
          dateLabel={dateLabel(dateISO)}
          managerName={managerName}
          onPrevDay={() => setDateISO((d) => shiftDate(d, -1))}
          onNextDay={() => setDateISO((d) => shiftDate(d, 1))}
        />
        <TimelineToolbar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          areas={areas}
          activeAreaIds={activeAreaIds}
          onToggleArea={(id) =>
            setActiveAreaIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
            )
          }
          onlyOpen={onlyOpen}
          onToggleOnlyOpen={() => setOnlyOpen((v) => !v)}
          deviationsOnly={deviationsOnly}
          deviationsCount={deviationsCount}
          onToggleDeviations={() => setDeviationsOnly((v) => !v)}
          zoom={zoom}
          onZoomChange={setZoom}
        />
        <ManagerTimelineChart
          bands={bands}
          employees={employees}
          tasks={filteredTasks}
          mode={viewMode}
          pxPerHour={zoom}
          nowMinutes={nowMinutes()}
          dimmedBandIds={dimmedBandIds}
        />
      </div>
    </>
  );
}
