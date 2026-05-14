"use client";

/**
 * use-oversikt-tools.ts — Botsson read + write tools for the day-control surface.
 *
 * Exposes 7 read tools + 8 write tools (total 15):
 *
 * READ (7):
 *   getDaySnapshot       — phase + bemanning/oppgaver/avvik/budget summary
 *   getRosterForDay      — staff scheduled for the date
 *   getOpenDeviations    — open + acknowledged + escalated deviations
 *   getSessionTasks      — session_task rows grouped by hook
 *   getDayBudget         — revenue + labor cost + labor hours
 *   getDayActivity       — timeline events (bookings, notes, tasks, deviations, punches)
 *   getCascadeMustDo     — cascade-derived urgent items (D1-D6 + C1-C4) marked critical or should-do
 *
 * WRITE (8):
 *   openSession          — create department_session for date
 *   transitionSession    — advance session through lifecycle phases
 *   signoffSession       — approve / close session after pending_signoff
 *   addShift             — add unplanned shift for last-minute coverage
 *   manualTimeEntry      — admin retro-records punch-in/out for a shift
 *   addSessionTask       — add ad-hoc task to a session hook
 *   toggleSessionTask    — mark session task done or undone
 *   sendBroadcast        — broadcast message to workspace members
 *
 * Pattern follows use-schedule-voice-tools.ts: tools are memoised once with
 * stable refs, while a `dataRef` is refreshed every render so implementations
 * always read live data without churning the harness registry.
 *
 * GATE NOTE: write tool wrappers do NOT call gateAction() directly — the Server
 * Actions already call gateAction() internally (ADR-0099 gate_action). Calling
 * it twice would be double-gating. Gate denial propagates as { ok: false, reason }.
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
import { openSessionAction } from "@/app/dashboard/_actions/open-session-action";
import { transitionSessionAction } from "@/app/dashboard/_actions/transition-session-action";
import { signoffSessionAction } from "@/app/dashboard/_actions/signoff-session-action";
import { addShiftAction } from "@/app/dashboard/_actions/add-shift-action";
import { manualTimeEntryAction } from "@/app/dashboard/_actions/manual-time-entry-action";
import { addTaskAction } from "@/app/dashboard/_actions/add-task-action";
import { toggleSessionTaskAction } from "@/app/dashboard/_actions/toggle-session-task-action";
import { sendBroadcastAction } from "@/app/dashboard/_actions/send-broadcast-action";

export type OversiktToolInput = {
  /** Selected ISO date (YYYY-MM-DD). */
  dateISO: string;
  /** Resolved phase from session.status + reconciliation. */
  phase: UiPhase;
  /** Department UUID — used by write tools (openSession, addShift, sendBroadcast). */
  departmentId: string;
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
      // ── WRITE TOOLS ───────────────────────────────────────────────────────
      {
        temporaryTool: {
          modelToolName: "openSession",
          description:
            "Open today's department_session — required before bemanning can clock in. Call when the manager says 'start dagen', 'åpne i dag', or 'open today'. Uses the active date and department from the day-control context.",
          dynamicParameters: [
            {
              name: "activateNow",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "boolean",
                description:
                  "If true (default), immediately mark the session as active. If false, create in upcoming status and let the cascade lifecycle progress it.",
              },
              required: false,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "transitionSession",
          description:
            "Move the active session to its next phase. Targets: 'active' (start service), 'pending_signoff' (close shift for review), 'closed' (lock day), 'missed' (mark abandoned). Use when the manager confirms a phase change verbally.",
          dynamicParameters: [
            {
              name: "sessionId",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description:
                  "UUID of the department_session to transition. Omit to use the active session from context.",
              },
              required: false,
            },
            {
              name: "target",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                enum: ["active", "pending_signoff", "closed", "missed"],
                description: "Target status to move the session to.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "signoffSession",
          description:
            "Sign off the day after it is pending_signoff. Use when the manager says 'godkjenn dagen', 'lukk vakt', or confirms reconciliation and hours are correct. 'pending' submits for review (manager); 'close' finalises (admin only).",
          dynamicParameters: [
            {
              name: "sessionId",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description:
                  "UUID of the department_session to sign off. Omit to use the active session from context.",
              },
              required: false,
            },
            {
              name: "confirm",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                enum: ["pending", "close"],
                description:
                  "'pending' = leder submits for signoff (active → pending_signoff). 'close' = admin finalises (pending_signoff → closed).",
              },
              required: true,
            },
            {
              name: "notes",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "Optional signoff notes or observations for the day.",
              },
              required: false,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "addShift",
          description:
            "Add an unplanned shift for last-minute coverage on the active date. Requires an employeeId and a reason string for the audit trail (e.g. 'sykmelding kø'). Start and end times in HH:MM format.",
          dynamicParameters: [
            {
              name: "employeeId",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "Profile UUID of the employee to assign the shift to.",
              },
              required: true,
            },
            {
              name: "startTime",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "Shift start time in HH:MM format (24h), e.g. '08:00'.",
              },
              required: true,
            },
            {
              name: "endTime",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "Shift end time in HH:MM format (24h), e.g. '16:00'.",
              },
              required: true,
            },
            {
              name: "reason",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description:
                  "Reason for the manual shift addition — minimum 8 characters. Required for audit trail.",
              },
              required: true,
            },
            {
              name: "role",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description:
                  "Position/role for this shift, e.g. 'Servitør', 'Kokk'. Defaults to 'Ansatt' if omitted.",
              },
              required: false,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "manualTimeEntry",
          description:
            "Admin retro-records a punch-in/out when the employee forgot or punch was lost. Requires a reason for audit. Provide punch times as full ISO 8601 timestamps.",
          dynamicParameters: [
            {
              name: "shiftId",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "UUID of the schedule_shift to record time for.",
              },
              required: true,
            },
            {
              name: "punchInISO",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "Punch-in time as ISO 8601 datetime, e.g. '2026-05-14T08:05:00.000Z'.",
              },
              required: true,
            },
            {
              name: "punchOutISO",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description:
                  "Punch-out time as ISO 8601 datetime. Optional — omit if employee has not yet clocked out.",
              },
              required: false,
            },
            {
              name: "reason",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description:
                  "Reason for manual entry — minimum 8 characters. Required for audit trail.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "addSessionTask",
          description:
            "Add an ad-hoc task to a session hook (e.g. 'sjekk frysere før close'). The task appears in the TasksTab list. Provide a hookId to attach it to a specific hook, or omit to add as a free-standing task.",
          dynamicParameters: [
            {
              name: "title",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "Task title — clear and actionable, max 200 characters.",
              },
              required: true,
            },
            {
              name: "hookId",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description:
                  "UUID of the session hook to attach the task to. Omit to create a free-standing task on the session.",
              },
              required: false,
            },
            {
              name: "assigneeProfileId",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description:
                  "Profile UUID of the employee to assign the task to. Omit to leave unassigned.",
              },
              required: false,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "toggleSessionTask",
          description:
            "Mark a session_task done or undone. Use when the manager confirms or reverses task completion. Provide the task UUID and the desired done state.",
          dynamicParameters: [
            {
              name: "taskId",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description: "UUID of the session_task to toggle.",
              },
              required: true,
            },
            {
              name: "done",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "boolean",
                description: "true = mark as completed; false = mark as pending (un-check).",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "sendBroadcast",
          description:
            "Broadcast a message to workspace members. Types: 'alert' (high-priority warning), 'reminder' (scheduled reminder), 'note' (informational). Voice-channel priority restrictions per ADR-0078 apply — gate denial is propagated back as ok:false.",
          dynamicParameters: [
            {
              name: "type",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                enum: ["alert", "reminder", "note"],
                description:
                  "Broadcast type: 'alert' for urgent warnings, 'reminder' for scheduled reminders, 'note' for general info.",
              },
              required: true,
            },
            {
              name: "body",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                description:
                  "Broadcast message body — max 4000 characters. No PII (Norwegian names, IDs).",
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

      // ── WRITE TOOL IMPLEMENTATIONS ────────────────────────────────────────
      // Gate note: each Server Action already calls gateAction() internally.
      // These wrappers do NOT call gateAction — that would be double-gating
      // (ADR-0099 / ADR-0204). Gate denial propagates as { ok: false, error }.

      openSession: async (params: Record<string, unknown>) => {
        const d = dataRef.current;
        // activateNow defaults true — tool intent is to open + activate the day.
        const activateNow = (params.activateNow as boolean | undefined) ?? true;
        const result = await openSessionAction({
          departmentId: d.departmentId,
          dateISO: d.dateISO,
          activateNow,
        });
        return JSON.stringify(result);
      },

      transitionSession: async (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const sessionId = (params.sessionId as string | undefined) ?? d.sessionId;
        if (!sessionId) {
          return JSON.stringify({ ok: false, error: "Ingen aktiv session for denne dagen." });
        }
        const target = params.target as "active" | "pending_signoff" | "closed" | "missed";
        const result = await transitionSessionAction({ sessionId, target });
        return JSON.stringify(result);
      },

      signoffSession: async (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const sessionId = (params.sessionId as string | undefined) ?? d.sessionId;
        if (!sessionId) {
          return JSON.stringify({ ok: false, error: "Ingen aktiv session for denne dagen." });
        }
        const confirm = params.confirm as "pending" | "close";
        const notes = (params.notes as string | undefined) ?? undefined;
        const result = await signoffSessionAction({ sessionId, confirm, notes });
        return JSON.stringify(result);
      },

      addShift: async (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const employeeId = params.employeeId as string;
        const startTime = params.startTime as string;
        const endTime = params.endTime as string;
        const reason = params.reason as string;
        const role = (params.role as string | undefined) ?? "Ansatt";

        // Build ISO datetimes from the active date + HH:MM times.
        // The Server Action expects UTC ISO; we construct using the date string
        // which is already YYYY-MM-DD. Combining with time produces a valid
        // ISO datetime that the action's datetime() validator accepts.
        const startAtISO = new Date(`${d.dateISO}T${startTime}:00`).toISOString();
        const endAtISO = new Date(`${d.dateISO}T${endTime}:00`).toISOString();

        const result = await addShiftAction({
          departmentSessionId: d.sessionId,
          departmentId: d.departmentId,
          profileId: employeeId,
          startAtISO,
          endAtISO,
          role,
          reason,
          channel: "chat",
        });
        return JSON.stringify(result);
      },

      manualTimeEntry: async (params: Record<string, unknown>) => {
        const shiftId = params.shiftId as string;
        const punchedInAt = params.punchInISO as string;
        const punchedOutAt = (params.punchOutISO as string | undefined) ?? null;
        const reason = params.reason as string;
        const result = await manualTimeEntryAction({ shiftId, punchedInAt, punchedOutAt, reason });
        return JSON.stringify(result);
      },

      addSessionTask: async (params: Record<string, unknown>) => {
        const d = dataRef.current;
        if (!d.sessionId) {
          return JSON.stringify({ ok: false, error: "Ingen aktiv session for denne dagen." });
        }
        const title = params.title as string;
        const hookId = (params.hookId as string | undefined) ?? null;
        const assigneeProfileId = (params.assigneeProfileId as string | undefined) ?? null;
        // Synthesise reason for audit trail from title when caller omits it.
        const reason = `Lagt til via Botsson: ${title}`.slice(0, 200);
        const result = await addTaskAction({
          sessionId: d.sessionId,
          title,
          ownerProfileId: assigneeProfileId,
          hookId,
          isComplianceRequired: false,
          reason,
        });
        return JSON.stringify(result);
      },

      toggleSessionTask: async (params: Record<string, unknown>) => {
        const taskId = params.taskId as string;
        const done = params.done as boolean;
        const result = await toggleSessionTaskAction({ taskId, done });
        return JSON.stringify(result);
      },

      sendBroadcast: async (params: Record<string, unknown>) => {
        const d = dataRef.current;
        const type = params.type as "alert" | "reminder" | "note";
        const body = params.body as string;
        // Use first 80 chars of body as title — matches BroadcastTab.handleSend pattern.
        const title = body.slice(0, 80);
        const result = await sendBroadcastAction({
          type,
          title,
          body,
          sessionId: d.sessionId ?? undefined,
          departmentId: d.departmentId,
        });
        return JSON.stringify(result);
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
