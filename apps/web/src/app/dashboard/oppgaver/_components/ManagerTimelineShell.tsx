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
 *
 * Telemetry (L-0340 trust-gate — closes Task 5.2 registry commit ce10b93d7):
 *   oppgaver.view_opened       — on mount (useEffect)
 *   oppgaver.view_mode_changed — when viewMode segment changes
 *   oppgaver.area_filter_changed — when area chip is toggled
 *   oppgaver.date_changed      — when date stepper advances/retreats
 *   oppgaver.task_focused      — when a task card is focused (Phase 6 modal)
 *   oppgaver.context_pinned    — in OppgaverToolsBridge (debounced 800ms)
 *
 * L-0177: all emit() calls guarded by non-empty workspace_id + actor_id check.
 */

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useDayLinesForDate,
  useSessionTasksForDate,
  useRolesForPositions,
  sessionTaskKeys,
} from "@smartout/data";
import { DomainChatOwnership } from "@/app/Botsson/_components/DomainChatOwnership";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { emit, nonEmpty } from "@smartout/telemetry";
import { completeSessionTaskAction } from "@/app/dashboard/_actions/complete-session-task-action";
import { updateTaskScheduledAtAction } from "@/app/dashboard/_actions/update-task-scheduled-at";
import { OppgaverToolsBridge } from "../_tools/oppgaver-tools-bridge";
import { TimelineTopBar } from "./TimelineTopBar";
import { TimelineToolbar } from "./TimelineToolbar";
import { TaskEditModal } from "./TaskEditModal";
import { ManagerTimelineChart } from "../_chart/ManagerTimelineChart";
import type { Band } from "../_chart/AreaBand";
import type { Employee } from "../_chart/PersonLane";
import type { TimelineTask } from "../_chart/TaskBlock";
import type { DragDropResult } from "../_chart/useDragRetiming";
import type { ManagerTimelineTaskRow } from "@smartout/data";

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
  const { profileId } = useContext(DashboardContext);
  const queryClient = useQueryClient();

  const [dateISO, setDateISOState] = useState<string>(todayISO());
  const [viewMode, setViewModeState] = useState<ViewMode>("area");
  const [activeAreaIds, setActiveAreaIds] = useState<string[]>([]);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [deviationsOnly, setDeviationsOnly] = useState(false);
  const [zoom, setZoom] = useState<number>(48); // pxPerHour
  // Track focused task for oppgaver.task_focused emit + TaskEditModal (Phase 6 modal).
  const [selectedTask, setSelectedTask] = useState<TimelineTask | null>(null);
  // editModalMode: "view" = view-only panel; "edit" = re-timing form (keyboard a11y fallback)
  const [editModalMode, setEditModalMode] = useState<boolean>(false);

  // Stable ref for prev values used in from/to payloads.
  const prevDateRef = useRef<string>(dateISO);
  const prevViewModeRef = useRef<ViewMode>(viewMode);

  // ── oppgaver.view_opened — emitted once on mount ────────────────────────
  useEffect(() => {
    // L-0177: skip emit if either id is missing/empty.
    if (!workspaceId || !profileId) return; // L-0177
    void emit({
      event: "oppgaver.view_opened",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(profileId, "actor_id"),
      properties: {
        data: {
          date_iso: dateISO,
          // ManagerTimelineShell is an admin/manager surface — default to "manager".
          // Full role derivation (owner/admin/manager) is a follow-up when role is
          // exposed in DashboardContext or workspace context.
          viewer_role: "manager" as const,
        },
      },
    });
  }, []); // intentional mount-only — capture initial dateISO snapshot at open time

  // ── Instrumented state setters ──────────────────────────────────────────

  /** setDateISO — emits oppgaver.date_changed on stepper interaction. */
  const setDateISO = useCallback(
    (updater: string | ((prev: string) => string)) => {
      // Compute next from the ref-tracked prev (not from setState updater),
      // so emit() never fires inside React's state-updater pass. Calling emit
      // inside the updater triggered a setState-during-render error via the
      // emma-awareness subscription chain (BotssonProvider listens on emit).
      const prev = prevDateRef.current;
      const next = typeof updater === "function" ? updater(prev) : updater;
      setDateISOState(next);
      if (next !== prev) {
        prevDateRef.current = next;
        if (workspaceId && profileId) {
          void emit({
            event: "oppgaver.date_changed",
            workspace_id: nonEmpty(workspaceId, "workspace_id"),
            actor_id: nonEmpty(profileId, "actor_id"),
            properties: {
              data: {
                from_date: prev,
                to_date: next,
                triggered_by: "ui" as const,
              },
            },
          });
        }
      }
    },
    [workspaceId, profileId],
  );

  /** setViewMode — emits oppgaver.view_mode_changed on segment switch. */
  const setViewMode = useCallback(
    (next: ViewMode) => {
      // See setDateISO comment — emit must not fire inside the state-updater.
      const prev = prevViewModeRef.current;
      setViewModeState(next);
      if (next !== prev) {
        prevViewModeRef.current = next;
        if (workspaceId && profileId) {
          void emit({
            event: "oppgaver.view_mode_changed",
            workspace_id: nonEmpty(workspaceId, "workspace_id"),
            actor_id: nonEmpty(profileId, "actor_id"),
            properties: {
              data: {
                from: prev,
                to: next,
                triggered_by: "ui" as const,
              },
            },
          });
        }
      }
    },
    [workspaceId, profileId],
  );

  /** toggleArea — emits oppgaver.area_filter_changed on chip toggle. */
  const handleToggleArea = useCallback(
    (id: string) => {
      // Compute next from current activeAreaIds (closure), not from a
      // functional setState updater, so emit() never fires inside React's
      // state-updater pass. Same root cause as setDateISO above —
      // emma-awareness.notify() invoked via emit triggers a setState in
      // BotssonProvider, which React forbids during another component's
      // render or state update.
      const next = activeAreaIds.includes(id)
        ? activeAreaIds.filter((x) => x !== id)
        : [...activeAreaIds, id];
      setActiveAreaIds(next);
      if (workspaceId && profileId) {
        void emit({
          event: "oppgaver.area_filter_changed",
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            data: {
              active_area_count: next.length,
              triggered_by: "ui" as const,
            },
          },
        });
      }
    },
    [activeAreaIds, workspaceId, profileId],
  );

  /** focusTask — opens TaskEditModal in view mode + emits oppgaver.task_focused. */
  const handleFocusTask = useCallback(
    (task: TimelineTask) => {
      setEditModalMode(false);
      setSelectedTask(task);
      // L-0177: skip emit if either id is missing/empty.
      if (!workspaceId || !profileId) return; // L-0177
      void emit({
        event: "oppgaver.task_focused",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          data: {
            task_id: task.id,
            area_id: task.area ?? null, // resolved from task object per Phase 6 spec
          },
        },
      });
    },
    [workspaceId, profileId],
  );

  const dayLinesQ = useDayLinesForDate(workspaceId ?? "", dateISO);
  const tasksQ = useSessionTasksForDate(workspaceId, dateISO);
  // V1: roles stub. Reserved for V2 role-mode rendering. Disabled by hook.
  void useRolesForPositions(workspaceId, dateISO);

  const bands: Band[] = useMemo(() => {
    const rows = dayLinesQ.data ?? [];
    // Multiple day_line rows per (location, date) — one per department per
    // ADR-0367 §4.1. Use department_name as the chip label so each band is
    // distinguishable. Location is shown in the band's secondary slot only
    // when more than one location is present on the day.
    const locationCount = new Set(rows.map((r) => r.location_id)).size;
    return rows.map((dl) => {
      const dept = dl.department_name || dl.department_id;
      const label = locationCount > 1 && dl.location_name ? `${dl.location_name} · ${dept}` : dept;
      return {
        id: dl.day_line_id,
        name: label,
        short: dept.slice(0, 3).toUpperCase(),
        open: dl.planned_open.slice(0, 5),
        close: dl.planned_close.slice(0, 5),
      };
    });
  }, [dayLinesQ.data]);

  const tasks: TimelineTask[] = useMemo(() => {
    const rows = tasksQ.data ?? [];
    return rows.map((t) => ({
      id: t.id,
      title: t.title,
      // Wave 1a: read scheduled_at from the extended hook row type.
      // Tasks WITH scheduled_at: extract HH:mm from the ISO timestamp for start;
      // compute end as start + 60 min.
      // TODO duration column — session_task has no duration field yet; 60 min
      // hardcoded until the schema adds one.
      // Tasks WITHOUT scheduled_at: fall back to "12:00" / "13:00" placeholder.
      // TODO TA2 (Wave 1b DnD wiring): add `unscheduled` flag to TimelineTask and
      // pass it here so TaskBlock can dim unanchored tasks visually.
      ...(() => {
        if (t.scheduled_at) {
          const d = new Date(t.scheduled_at);
          const hh = d.getHours().toString().padStart(2, "0");
          const mm = d.getMinutes().toString().padStart(2, "0");
          const startMin = d.getHours() * 60 + d.getMinutes();
          const endMin = startMin + 60; // TODO duration column
          const endHH = Math.floor(endMin / 60)
            .toString()
            .padStart(2, "0");
          const endMM = (endMin % 60).toString().padStart(2, "0");
          return { start: `${hh}:${mm}`, end: `${endHH}:${endMM}` };
        }
        // V1 fallback: no scheduled_at → 12:00 placeholder
        return { start: "12:00", end: "13:00" };
      })(),
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

  // handleTaskDrop — DnD drop handler (Wave 1 Phase A.4).
  // 1. Optimistic: update TanStack Query cache immediately so the chart re-renders.
  // 2. Dispatch updateTaskScheduledAtAction (server action → capability tool).
  // 3. On error: revert optimistic update, show sonner toast.
  // 4. On success: invalidate to re-fetch authoritative data.
  const handleTaskDrop = useCallback(
    async (_empId: string | null, result: DragDropResult) => {
      if (!workspaceId) return;

      const queryKey = sessionTaskKeys.forDate(workspaceId, dateISO);

      // Optimistic update
      queryClient.setQueryData<ManagerTimelineTaskRow[]>(queryKey, (prev) => {
        if (!prev) return prev;
        return prev.map((row) => {
          if (row.id !== result.taskId) return row;
          return {
            ...row,
            scheduled_at: result.newScheduledAt,
            assigned_to: result.newAssignee ?? row.assigned_to,
          };
        });
      });

      // Dispatch server action
      const res = await updateTaskScheduledAtAction({
        task_id: result.taskId,
        scheduled_at: result.newScheduledAt,
        assignee_profile_id: result.newAssignee,
        fromIso: result.fromIso,
        fromAssignee: result.fromAssignee,
      });

      if (!res.ok) {
        // Revert: invalidate so cache re-fetches authoritative state
        await queryClient.invalidateQueries({ queryKey });
        toast.error(res.reason ?? "Kunne ikke flytte oppgaven.");
        return;
      }

      // Success: re-fetch authoritative data
      await queryClient.invalidateQueries({ queryKey });
    },
    [workspaceId, dateISO, queryClient],
  );

  // handleComplete — delegates to completeSessionTaskAction.
  // actor is derived from profileId + workspaceId resolved at call time (L-0177 fail-fast).
  const handleComplete = useCallback(
    async (taskId: string) => {
      if (!workspaceId || !profileId) return; // L-0177: skip if ids missing
      await completeSessionTaskAction(
        taskId,
        { userId: "", profileId, workspaceId, role: null },
        "chat",
      );
    },
    [workspaceId, profileId],
  );

  // Stable uiActions for the bridge — avoids re-creation on every render.
  // Bridge still expects focusTask: (taskId: string) => void (its tool contract).
  // We look up the full task from filteredTasks to open the modal with full data.
  const bridgeUiActions = useMemo(
    () => ({
      setDate: (iso: string) => setDateISO(iso),
      setViewMode,
      toggleArea: handleToggleArea,
      focusTask: (taskId: string) => {
        const t = filteredTasks.find((x) => x.id === taskId) ?? null;
        if (t) handleFocusTask(t);
      },
    }),
    [setDateISO, setViewMode, handleToggleArea, handleFocusTask, filteredTasks],
  );

  return (
    <>
      <DomainChatOwnership reason="oppgaver-timeline" />
      {/* OppgaverToolsBridge — registers Botsson tools + emits context_pinned (L-0340 #6) */}
      <OppgaverToolsBridge
        dateISO={dateISO}
        viewMode={viewMode}
        activeAreaIds={activeAreaIds}
        onlyOpen={onlyOpen}
        deviationsOnly={deviationsOnly}
        zoom={zoom}
        bands={bands}
        tasks={filteredTasks}
        uiActions={bridgeUiActions}
      />
      <TaskEditModal
        task={selectedTask}
        onClose={() => {
          setSelectedTask(null);
          setEditModalMode(false);
        }}
        onComplete={handleComplete}
        editMode={editModalMode}
        dateISO={dateISO}
        onTaskUpdated={() => {
          if (workspaceId) {
            void queryClient.invalidateQueries({
              queryKey: sessionTaskKeys.forDate(workspaceId, dateISO),
            });
          }
        }}
      />
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
          onToggleArea={handleToggleArea}
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
          onTaskClick={handleFocusTask}
          onTaskDrop={handleTaskDrop}
          dateISO={dateISO}
          onKeyboardEdit={(task) => {
            setEditModalMode(true);
            setSelectedTask(task);
          }}
        />
      </div>
    </>
  );
}
