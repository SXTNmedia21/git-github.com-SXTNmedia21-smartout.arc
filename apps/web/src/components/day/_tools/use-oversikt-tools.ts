"use client";

/**
 * use-oversikt-tools.ts — Botsson read tools for the day-control surface.
 *
 * Exposes 7 read tools (no writes — those need C4 authority + a confirmation
 * flow and ship in a follow-up sortie):
 *
 *   getDaySnapshot       — phase + bemanning/oppgaver/avvik/budget summary
 *   getRosterForDay      — staff scheduled for the date
 *   getOpenDeviations    — open + acknowledged + escalated deviations
 *   getSessionTasks      — session_task rows grouped by hook
 *   getDayBudget         — revenue + labor cost + labor hours
 *   getDayActivity       — timeline events (bookings, notes, tasks, deviations, punches)
 *   getCascadeMustDo     — cascade-derived urgent items (D1-D6 + C1-C4) marked critical or should-do
 *
 * Pattern follows use-schedule-voice-tools.ts: tools are memoised once with
 * stable refs, while a `dataRef` is refreshed every render so implementations
 * always read live data without churning the harness registry.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { RosterRow } from "@/app/dashboard/_hooks/use-roster";
import type { DeviationRow } from "@smartout/hms";
import type { DayBudget } from "@/app/dashboard/_hooks/use-day-budget";
import type { DayEvent } from "@/app/dashboard/_hooks/use-day-timeline-events";
import type { DayHookRow } from "@/app/dashboard/_hooks/use-session-hooks-with-tasks";
import type { UiPhase } from "@smartout/utils";
import type { CascadeTask, TaskUrgency } from "@smartout/types";

export type OversiktToolInput = {
  /** Selected ISO date (YYYY-MM-DD). */
  dateISO: string;
  /** Resolved phase from session.status + reconciliation. */
  phase: UiPhase;
  /** Department display name. */
  departmentName: string;
  /** Active session id — null when no session for the date. */
  sessionId: string | null;
  /** Roster rows for the date (from useRoster). */
  roster: RosterRow[];
  /** Deviations grouped: open+acknowledged + escalated. */
  deviationsOpen: DeviationRow[];
  deviationsEscalated: DeviationRow[];
  /** Hook + task aggregate (from useSessionHooksWithTasks). */
  sessionHooks: DayHookRow[];
  /** Budget snapshot for the date. */
  dayBudget: DayBudget | null;
  /** Timeline events for the day. */
  timelineEvents: DayEvent[];
  /** Cascade-derived urgent items (from useCascadeTasks). */
  cascadeTasks: CascadeTask[];
};

/* ━━━ Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function summarizeRoster(roster: RosterRow[]) {
  return {
    total: roster.length,
    onShift: roster.filter((r) => r.status === "active").length,
    upcoming: roster.filter((r) => r.status === "upcoming").length,
    completed: roster.filter((r) => r.status === "completed").length,
    plannedHours: Number(roster.reduce((sum, r) => sum + (r.plannedHours || 0), 0).toFixed(1)),
    actualHours: Number(roster.reduce((sum, r) => sum + (r.actualHours || 0), 0).toFixed(1)),
  };
}

function summarizeTasks(hooks: DayHookRow[]) {
  const all = hooks.flatMap((h) => h.tasks);
  return {
    total: all.length,
    done: all.filter((t) => t.done).length,
    active: all.filter((t) => !t.done && t.active).length,
    overdue: all.filter((t) => t.overdue).length,
  };
}

function summarizeCascadeTasks(tasks: CascadeTask[]) {
  return {
    critical: tasks.filter((t) => t.urgency === "critical").length,
    should: tasks.filter((t) => t.urgency === "should").length,
    total: tasks.length,
  };
}

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useOversiktTools(input: OversiktToolInput): ClientToolKit {
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
          modelToolName: "getDaySnapshot",
          description:
            "Get the full day snapshot — phase, bemanning, oppgaver, avvik, lønn og omsetning. Call this first when the manager asks any open-ended question about today.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getRosterForDay",
          description:
            "Get the staff roster for the active date — who is on shift, who is upcoming, who has finished. Use when manager asks 'kor mange er på vakt?', 'hvem jobber i dag?', or wants a name list.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getOpenDeviations",
          description:
            "List open, acknowledged and escalated deviations for the workspace. Use when manager asks 'hva må jeg fikse?', 'hvilke avvik er åpne?', or wants to triage incidents.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getSessionTasks",
          description:
            "List session tasks grouped by hook (pre_open / open / scheduled / pre_close / close) with done vs active counts. Use when manager asks 'hvilke oppgaver gjenstår?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getDayBudget",
          description:
            "Get budgeted revenue, labor cost and labor hours for the active date. Use when manager asks 'hva er omsetning i dag?' or 'kor mye lønn er planlagt?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getDayActivity",
          description:
            "Get the timeline of events for the day — bookings, notes, tasks, deviations, punch-ins, punch-outs. Use when manager asks 'hva har skjedd så langt?' or wants a chronological recap.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getCascadeMustDo",
          description:
            "Get cascade-derived urgent items (D1-D6 + C1-C4 dimensions) marked critical or should-do. Drives the MustDoCard on the day-control surface. Use when the manager asks 'hva må jeg fikse i dag?' or 'hvilke saker haster?'.",
          dynamicParameters: [
            {
              name: "severity",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                enum: ["critical", "should", "all"],
                description:
                  "Filter by urgency level: 'critical', 'should', or 'all'. Defaults to 'all' (returns both critical and should).",
              },
              required: false,
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
      getDaySnapshot: () => {
        const d = dataRef.current;
        return JSON.stringify({
          date: d.dateISO,
          department: d.departmentName,
          phase: d.phase,
          hasSession: d.sessionId !== null,
          roster: summarizeRoster(d.roster),
          tasks: summarizeTasks(d.sessionHooks),
          deviations: {
            open: d.deviationsOpen.filter((x) => x.status === "open").length,
            acknowledged: d.deviationsOpen.filter((x) => x.status === "acknowledged").length,
            escalated: d.deviationsEscalated.length,
          },
          budget: d.dayBudget
            ? {
                revenueNok: d.dayBudget.revenue,
                laborCostNok: d.dayBudget.laborCost,
                laborHours: d.dayBudget.laborHours,
              }
            : null,
        });
      },

      getRosterForDay: () => {
        const d = dataRef.current;
        return JSON.stringify({
          date: d.dateISO,
          department: d.departmentName,
          summary: summarizeRoster(d.roster),
          shifts: d.roster.map((r) => ({
            name: r.employeeName,
            role: r.role,
            start: r.startTime,
            end: r.endTime,
            status: r.status,
            live: r.live,
            onBreak: r.onBreak,
            plannedHours: r.plannedHours,
            actualHours: r.actualHours,
          })),
        });
      },

      getOpenDeviations: () => {
        const d = dataRef.current;
        const merge = [...d.deviationsOpen, ...d.deviationsEscalated];
        return JSON.stringify({
          counts: {
            open: d.deviationsOpen.filter((x) => x.status === "open").length,
            acknowledged: d.deviationsOpen.filter((x) => x.status === "acknowledged").length,
            escalated: d.deviationsEscalated.length,
          },
          deviations: merge.map((dv) => ({
            id: dv.deviationId,
            title: dv.title,
            domain: dv.domain,
            severity: dv.severity,
            status: dv.status,
            department: dv.departmentName,
            reporter: dv.reporterName,
            createdAt: dv.createdAt,
            blocksDayApproval: dv.blocksDayApproval,
            requiresAction: dv.requiresAction,
          })),
        });
      },

      getSessionTasks: () => {
        const d = dataRef.current;
        return JSON.stringify({
          sessionId: d.sessionId,
          summary: summarizeTasks(d.sessionHooks),
          hooks: d.sessionHooks.map((h) => ({
            hookId: h.hookId,
            label: h.typeLabel,
            kind: h.hookType,
            title: h.title,
            time: h.time,
            state: h.state,
            progress: h.progress,
            tasks: h.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              done: t.done,
              active: t.active,
              overdue: t.overdue,
            })),
          })),
        });
      },

      getDayBudget: () => {
        const d = dataRef.current;
        if (!d.dayBudget) {
          return JSON.stringify({
            date: d.dateISO,
            department: d.departmentName,
            available: false,
            reason: "Ingen budsjett satt for denne dagen.",
          });
        }
        return JSON.stringify({
          date: d.dateISO,
          department: d.departmentName,
          available: true,
          revenueNok: d.dayBudget.revenue,
          laborCostNok: d.dayBudget.laborCost,
          laborHours: d.dayBudget.laborHours,
        });
      },

      getDayActivity: () => {
        const d = dataRef.current;
        return JSON.stringify({
          date: d.dateISO,
          department: d.departmentName,
          eventCount: d.timelineEvents.length,
          events: d.timelineEvents.map((e) => ({
            id: e.id,
            type: e.type,
            time: e.time,
            iso: e.iso,
            title: e.title,
            actor: e.actor,
            severity: e.severity,
          })),
        });
      },

      getCascadeMustDo: (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const severity = (params.severity as TaskUrgency | "all" | undefined) ?? "all";

        const filtered =
          severity === "all"
            ? d.cascadeTasks.filter((t) => t.urgency === "critical" || t.urgency === "should")
            : d.cascadeTasks.filter((t) => t.urgency === severity);

        return JSON.stringify({
          counts: summarizeCascadeTasks(filtered),
          items: filtered.map((t) => ({
            dimension: t.dimension,
            severity: t.urgency,
            label: t.title_key,
            source_entity_id: t.entity_id ?? null,
            group: t.group,
            href: t.href,
          })),
        });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
