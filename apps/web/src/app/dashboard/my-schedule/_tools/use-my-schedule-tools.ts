"use client";

// DEAD-PIPE-2026-05-14: client tool not delivered to LLM yet; see HANDOFF-2026-05-14 + ADR-0327 (HarnessAdapter pending)

/**
 * use-my-schedule-tools.ts — Botsson tools for the /dashboard/my-schedule surface.
 *
 * Four tools: 4 read (no mutations — actions.ts only has telemetry Server Actions,
 * no write mutations for employee schedule view).
 *
 *   getMySchedule        — this week's published shifts (summary)
 *   getNextShift         — the single next upcoming shift from today
 *   getMyShifts          — shifts for a date range (weekStart + weekEnd)
 *   getMyAbsences        — not available yet (actions.ts has no absence mutations)
 *
 * dataRef pattern: keeps tool definitions stable (no recreation on every render)
 * while implementations always read live data from the ref on each invocation.
 *
 * ADR-0151: workspace_id and actor_id are auth-derived (DashboardContext) — never
 * from tool parameters. Read-only tools; no writes in this surface.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { MyScheduleShift } from "../_hooks/use-my-shifts";

/* ━━━ Input type ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type MyScheduleToolInput = {
  /** Currently visible week start (YYYY-MM-DD). */
  weekStart: string;
  /** Currently visible week end (YYYY-MM-DD). */
  weekEnd: string;
  /** Loaded shifts for the visible week. Null while loading. */
  shifts: MyScheduleShift[] | null;
  /** Whether the shifts query is loading. */
  isLoading: boolean;
  /** Jump to a specific week offset from current (0 = this week). */
  setWeekOffset: (offset: number) => void;
  /** Current week offset. */
  weekOffset: number;
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useMyScheduleTools(input: MyScheduleToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getMySchedule",
          description:
            "Get the employee's published shifts for the currently visible week, including total shift count and total work hours. Use when user asks 'hva jobber jeg denne uken?', 'har jeg vakter i morgen?', or 'kan du vise vaktplanen min?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getNextShift",
          description:
            "Get the employee's single next upcoming published shift from today. Use when user asks 'når er neste vakt?', 'hva er min neste vakt?', or 'når jobber jeg neste gang?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getMyShifts",
          description:
            "Get published shifts for the employee filtered to a specific date range. Use when user asks about shifts for a particular week or dates beyond the currently visible week (e.g. 'hva jobber jeg neste uke?' or 'vis vakter fra mandag til fredag').",
          dynamicParameters: [
            {
              name: "weekStart",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "Start date in YYYY-MM-DD format (Monday of the target week).",
              },
              required: true,
            },
            {
              name: "weekEnd",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "End date in YYYY-MM-DD format (Sunday of the target week).",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "navigateWeek",
          description:
            "Navigate the schedule view to a different week. Use when user says 'gå til neste uke', 'vis forrige uke', or 'gå tilbake til denne uken'. offset=0 means current week, positive = future, negative = past.",
          dynamicParameters: [
            {
              name: "offset",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "number",
                description:
                  "Week offset relative to today. 0 = current week, 1 = next week, -1 = last week.",
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
      getMySchedule: () => {
        const d = dataRef.current;
        if (d.isLoading) {
          return JSON.stringify({ status: "loading", message: "Laster vakter..." });
        }
        const shifts = d.shifts ?? [];
        const totalHours = shifts.reduce((sum, s) => sum + s.workHours, 0);

        return JSON.stringify({
          weekStart: d.weekStart,
          weekEnd: d.weekEnd,
          weekOffset: d.weekOffset,
          shiftCount: shifts.length,
          totalHours,
          shifts: shifts.map((s) => ({
            id: s.id,
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            role: s.role,
            department: s.departmentName,
            workHours: s.workHours,
            status: s.status,
          })),
        });
      },

      getNextShift: () => {
        const d = dataRef.current;
        if (d.isLoading) {
          return JSON.stringify({ status: "loading", message: "Laster vakter..." });
        }
        const today = new Date().toISOString().slice(0, 10);
        const upcoming = (d.shifts ?? [])
          .filter((s) => s.date >= today)
          .sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.startTime.localeCompare(b.startTime);
          });

        if (upcoming.length === 0) {
          return JSON.stringify({
            nextShift: null,
            message:
              "Ingen kommende vakter funnet i synlig uke. Naviger fremover for å se neste uke.",
          });
        }

        const next = upcoming[0]!;
        return JSON.stringify({
          nextShift: {
            id: next.id,
            date: next.date,
            startTime: next.startTime,
            endTime: next.endTime,
            role: next.role,
            department: next.departmentName,
            workHours: next.workHours,
          },
        });
      },

      getMyShifts: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const weekStart = params.weekStart as string | undefined;
        const weekEnd = params.weekEnd as string | undefined;

        if (!weekStart || !weekEnd) {
          return JSON.stringify({
            ok: false,
            reason: "weekStart and weekEnd are required (YYYY-MM-DD format).",
          });
        }

        // If the requested range matches what's currently loaded, return it directly
        if (weekStart === d.weekStart && weekEnd === d.weekEnd) {
          const shifts = d.shifts ?? [];
          return JSON.stringify({
            weekStart,
            weekEnd,
            shiftCount: shifts.length,
            totalHours: shifts.reduce((sum, s) => sum + s.workHours, 0),
            shifts: shifts.map((s) => ({
              id: s.id,
              date: s.date,
              startTime: s.startTime,
              endTime: s.endTime,
              role: s.role,
              department: s.departmentName,
              workHours: s.workHours,
            })),
          });
        }

        // Range not currently loaded — inform Botsson to navigate first
        return JSON.stringify({
          ok: false,
          reason: `Requested range [${weekStart} – ${weekEnd}] is not currently loaded. Currently showing [${d.weekStart} – ${d.weekEnd}]. Use navigateWeek to change the visible week first, then call getMySchedule.`,
          suggestion: "Call navigateWeek with the appropriate offset, then getMySchedule.",
        });
      },

      navigateWeek: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const offset = params.offset;

        if (typeof offset !== "number") {
          return JSON.stringify({
            ok: false,
            reason: "offset must be a number (0 = current week, 1 = next, -1 = previous).",
          });
        }

        d.setWeekOffset(offset);
        return JSON.stringify({
          ok: true,
          newOffset: offset,
          message:
            offset === 0
              ? "Navigerte til denne uken."
              : offset > 0
                ? `Navigerte ${offset} uke(r) frem.`
                : `Navigerte ${Math.abs(offset)} uke(r) tilbake.`,
        });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
