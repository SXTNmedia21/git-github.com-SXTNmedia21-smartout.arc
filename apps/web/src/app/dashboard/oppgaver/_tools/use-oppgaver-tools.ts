"use client";

/**
 * use-oppgaver-tools.ts — Botsson read tools for the oppgaver Manager Timeline surface.
 *
 * Exposes 6 read tools:
 *   getOppgaverSnapshot     — current date, view mode, active area filters, task counts
 *   getTasksForDate         — all session tasks visible on the timeline for the active date
 *   getAreasOverview        — day_lines (area bands) with open/close windows
 *   getActiveFilters        — current UI filter state (viewMode, activeAreaIds, toggles)
 *   focusTask               — instruct the UI to highlight a specific task card
 *   navigateDate            — move the timeline to a different date
 *
 * Pattern: mirrors use-oversikt-tools.ts (dataRef + stable memos per that pattern).
 * Tool implementations close over `dataRef.current` so they always read live data
 * without churning the harness registry.
 *
 * GATE NOTE: no write mutations here — oppgaver V1 is read-only for tools
 * (task mutations go through day-control / task capability). Nav tools are
 * pure client-side state setters with no audit trail required.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { Band } from "../_chart/AreaBand";
import type { TimelineTask } from "../_chart/TaskBlock";

type ViewMode = "area" | "role" | "person";

export type OppgaverToolInput = {
  /** Active ISO date on the timeline (YYYY-MM-DD). */
  dateISO: string;
  /** Current view mode: area / role / person. */
  viewMode: ViewMode;
  /** Array of area (day_line) IDs currently highlighted. Empty = all areas shown. */
  activeAreaIds: string[];
  /** Whether only open (non-done) tasks are visible. */
  onlyOpen: boolean;
  /** Whether deviations-only filter is active. */
  deviationsOnly: boolean;
  /** Current zoom level (px per hour). */
  zoom: number;
  /** All area bands on the timeline. */
  bands: Band[];
  /** All tasks currently visible on the timeline. */
  tasks: TimelineTask[];
  /** UI state setters — pure client-side navigation, no audit trail. */
  uiActions: {
    /** Step the timeline to a different ISO date. */
    setDate: (iso: string) => void;
    /** Switch the view mode segment. */
    setViewMode: (mode: ViewMode) => void;
    /** Toggle a specific area chip. */
    toggleArea: (id: string) => void;
    /** Focus a specific task (highlight / open detail). */
    focusTask: (taskId: string) => void;
  };
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useOppgaverTools(input: OppgaverToolInput): ClientToolKit {
  // Refresh ref on every render — implementations close over `dataRef.current`
  // so they always see the latest data without forcing tool re-registration.
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getOppgaverSnapshot",
          description:
            "Get the current state of the oppgaver Manager Timeline — active date, view mode, task counts, filter state. Call this first when the manager asks an open-ended question about tasks or the timeline.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getTasksForDate",
          description:
            "Get all session tasks visible on the timeline for the active date. Each task includes id, title, status, area, start/end time, and assigned employee. Use when manager asks 'hvilke oppgaver er i dag?', 'hva gjenstår?', or wants a task list.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getAreasOverview",
          description:
            "Get all area bands (day_lines) on the timeline — names, short codes, and planned open/close windows. Use when manager asks 'hvilke soner er åpne?' or wants an area summary.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getActiveFilters",
          description:
            "Get the current UI filter state on the timeline — view mode, active area chips, onlyOpen toggle, deviationsOnly toggle, zoom level. Use when manager asks 'hva viser du nå?' or to confirm filter context before answering.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "focusTask",
          description:
            "Highlight a specific task on the Manager Timeline. Use when manager says 'vis meg den oppgaven' or 'fokuser på X'. The UI will scroll to and highlight the task card.",
          dynamicParameters: [
            {
              name: "taskId",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "UUID of the session_task to highlight on the timeline.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "navigateDate",
          description:
            "Move the Manager Timeline to a different date. Accepts ISO date (YYYY-MM-DD) or relative ('yesterday', 'tomorrow', 'today'). Use when manager asks to look at another day.",
          dynamicParameters: [
            {
              name: "date",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description:
                  "Target date as ISO YYYY-MM-DD, or one of: 'today', 'yesterday', 'tomorrow'.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      getOppgaverSnapshot: () => {
        const d = dataRef.current;
        const doneTasks = d.tasks.filter((t) => t.status === "done").length;
        const pendingTasks = d.tasks.filter((t) => t.status !== "done").length;
        return JSON.stringify({
          date: d.dateISO,
          viewMode: d.viewMode,
          areaCount: d.bands.length,
          activeAreaCount: d.activeAreaIds.length === 0 ? d.bands.length : d.activeAreaIds.length,
          filters: {
            onlyOpen: d.onlyOpen,
            deviationsOnly: d.deviationsOnly,
          },
          tasks: {
            total: d.tasks.length,
            done: doneTasks,
            pending: pendingTasks,
          },
          zoom: d.zoom,
        });
      },

      getTasksForDate: () => {
        const d = dataRef.current;
        return JSON.stringify({
          date: d.dateISO,
          total: d.tasks.length,
          tasks: d.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            area: t.area ?? null,
            assignee: t.emp ?? null,
            start: t.start,
            end: t.end,
          })),
        });
      },

      getAreasOverview: () => {
        const d = dataRef.current;
        return JSON.stringify({
          count: d.bands.length,
          areas: d.bands.map((b) => ({
            id: b.id,
            name: b.name,
            short: b.short,
            open: b.open,
            close: b.close,
            active: d.activeAreaIds.length === 0 || d.activeAreaIds.includes(b.id),
          })),
        });
      },

      getActiveFilters: () => {
        const d = dataRef.current;
        return JSON.stringify({
          viewMode: d.viewMode,
          activeAreaIds: d.activeAreaIds,
          onlyOpen: d.onlyOpen,
          deviationsOnly: d.deviationsOnly,
          zoom: d.zoom,
        });
      },

      // ── NAV TOOL IMPLEMENTATIONS ──────────────────────────────────────────
      // No emit(), no gateAction — pure React state setters. No audit trail
      // needed for UI navigation (no data mutation, no authority gate required).

      focusTask: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const taskId = params.taskId as string;
        d.uiActions.focusTask(taskId);
        return JSON.stringify({ ok: true, focused_task_id: taskId });
      },

      navigateDate: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const raw = params.date as string;
        let resolvedISO: string;
        if (raw === "today") {
          resolvedISO = new Date().toISOString().slice(0, 10);
        } else if (raw === "yesterday") {
          const prev = new Date(d.dateISO + "T00:00:00");
          prev.setDate(prev.getDate() - 1);
          resolvedISO = prev.toISOString().slice(0, 10);
        } else if (raw === "tomorrow") {
          const next = new Date(d.dateISO + "T00:00:00");
          next.setDate(next.getDate() + 1);
          resolvedISO = next.toISOString().slice(0, 10);
        } else {
          resolvedISO = raw;
        }
        d.uiActions.setDate(resolvedISO);
        return JSON.stringify({ ok: true, navigated_to: resolvedISO });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
