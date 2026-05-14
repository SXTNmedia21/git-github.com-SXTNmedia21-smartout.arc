"use client";

/**
 * use-shift-clock-tools.ts — Botsson tools for the /dashboard/shift-clock surface.
 *
 * ADR-0133 MOBILE-CRITICAL: This is the primary employee clock-in/out surface.
 * It is the D6 production execute verb per ADR-0133 "Web composes, mobile executes."
 * These tools give Botsson voice+chat access to the employee's live shift state.
 *
 * 8 tools: 4 read + 3 write-propose (CustomEvent dispatch) + 1 nav.
 *
 *   getShiftClockState   — current phase: idle | clocked_in | on_break | summary
 *   getCurrentShift      — active shift details (id, punch-in time, break count)
 *   getTodayHours        — elapsed work minutes + break minutes for today
 *   getBreakStatus       — current break info (on break or not, duration so far)
 *   proposePunchIn       — dispatch CustomEvent to trigger punch-in flow
 *   proposePunchOut      — dispatch CustomEvent to trigger punch-out flow
 *   proposeStartBreak    — dispatch CustomEvent to start a break
 *   proposeEndBreak      — dispatch CustomEvent to end the current break
 *   switchClockTab       — switch active tab (tasks | chat | notes)
 *
 * dataRef pattern keeps definitions stable (useMemo [], []) while reading
 * live state on every invocation — same pattern as use-my-training-tools.ts.
 *
 * ADR-0151: write tools dispatch CustomEvents only — the UI renders the
 * confirmation UX. Botsson never writes directly to timesheet.time_entry.
 * workspace_id / profile_id are auth-derived from DashboardContext.
 *
 * ADR-0238: page does not own a domain chat surface.
 * Orb runs in interactive mode — no <DomainChatOwnership> needed.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { ShiftClockState, BreakEntry } from "@smartout/shift-clock";

/* ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export type ShiftClockToolInput = {
  /** Whether the clock query / mutation is still loading. */
  loading: boolean;
  /** Current shift clock state derived from the active time_entry. */
  state: ShiftClockState;
};

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useShiftClockTools(input: ShiftClockToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      /* ── READ ──────────────────────────────────────────────── */
      {
        temporaryTool: {
          modelToolName: "getShiftClockState",
          description:
            "Get the employee's current shift clock phase: idle (not clocked in), clocked_in (active shift), on_break (currently on break), or summary (shift completed, awaiting dismissal). Use when the user asks 'er jeg innstemplet?', 'er jeg på pause?', 'hva er vaktstatus min?', or any question about current clock state.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getCurrentShift",
          description:
            "Get details about the employee's current active shift — shift ID, punch-in time, break count, and time elapsed since punch-in. Use when the user asks 'hvilken vakt har jeg nå?', 'når stemplet jeg inn?', 'hvor lenge har jeg jobbet?', or wants shift-specific details.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getTodayHours",
          description:
            "Calculate elapsed work minutes and break minutes for the current shift. Returns total_minutes (raw elapsed), break_minutes (sum of all breaks), and work_minutes (total minus breaks). Use when the user asks 'hvor lenge har jeg jobbet i dag?', 'hvor mange timer er det blitt?', 'hva er arbeidstiden min?'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getBreakStatus",
          description:
            "Get current break status — whether the employee is on break right now, how long the break has lasted so far, and total breaks taken in this shift. Use when the user asks 'er jeg på pause?', 'hvor lenge har pausen vart?', 'hvor mange pauser har jeg tatt?'.",
          dynamicParameters: [],
          client: {},
        },
      },

      /* ── WRITE-PROPOSE (CustomEvent dispatch) ──────────────── */
      {
        temporaryTool: {
          modelToolName: "proposePunchIn",
          description:
            "Propose that the employee clocks in for their shift. Dispatches a UI event to trigger the punch-in confirmation flow. Only valid when the employee is in 'idle' phase. Use when the user says 'stemple inn', 'start vakten', 'jeg er klar til å jobbe', 'klokk inn'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "proposePunchOut",
          description:
            "Propose that the employee clocks out from their shift. Dispatches a UI event to trigger the punch-out confirmation flow. Only valid when the employee is in 'clocked_in' phase (not on break). Use when the user says 'stemple ut', 'avslutt vakten', 'jeg er ferdig', 'klokk ut'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "proposeStartBreak",
          description:
            "Propose starting a break. Dispatches a UI event to trigger the break-start flow. Only valid when the employee is 'clocked_in'. Use when the user says 'start pause', 'jeg tar en pause', 'ta pause nå'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "proposeEndBreak",
          description:
            "Propose ending the current break and returning to work. Dispatches a UI event to trigger the break-end flow. Only valid when the employee is 'on_break'. Use when the user says 'avslutt pause', 'jeg er tilbake', 'ferdig med pause', 'tilbake på jobb'.",
          dynamicParameters: [],
          client: {},
        },
      },

      /* ── NAV ───────────────────────────────────────────────── */
      {
        temporaryTool: {
          modelToolName: "switchClockTab",
          description:
            "Switch the active tab in the shift clock view. Available tabs: 'tasks' (session tasks), 'chat' (team chat + leader thread), 'notes' (shift notes). Use when the user says 'vis oppgaver', 'åpne chatten', 'vis notater', 'bytt til chat', 'bytt fane'.",
          dynamicParameters: [
            {
              name: "tab",
              location: "PARAMETER_LOCATION_BODY" as const,
              schema: {
                type: "string",
                enum: ["tasks", "chat", "notes"],
                description: "Which tab to activate: tasks, chat, or notes.",
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
      getShiftClockState: () => {
        const d = dataRef.current;
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            phase: d.state.phase,
            shiftId: d.state.shiftId,
            timeEntryId: d.state.timeEntryId,
          }),
        );
      },

      getCurrentShift: () => {
        const d = dataRef.current;
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        if (d.state.phase === "idle") {
          return Promise.resolve(
            JSON.stringify({ ok: true, activeShift: null, message: "Ingen aktiv vakt." }),
          );
        }
        const breaks = d.state.breaks as BreakEntry[];
        const punchInMs = d.state.punchInTime ? new Date(d.state.punchInTime).getTime() : null;
        const elapsedMinutes = punchInMs ? Math.round((Date.now() - punchInMs) / 60_000) : null;
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            activeShift: {
              shiftId: d.state.shiftId,
              timeEntryId: d.state.timeEntryId,
              phase: d.state.phase,
              punchInTime: d.state.punchInTime,
              punchOutTime: d.state.punchOutTime,
              elapsedMinutes,
              breakCount: breaks.length,
            },
          }),
        );
      },

      getTodayHours: () => {
        const d = dataRef.current;
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        if (!d.state.punchInTime) {
          return Promise.resolve(
            JSON.stringify({
              ok: true,
              total_minutes: 0,
              break_minutes: 0,
              work_minutes: 0,
              note: "Ikke innstemplet.",
            }),
          );
        }
        const punchInMs = new Date(d.state.punchInTime).getTime();
        const endMs = d.state.punchOutTime ? new Date(d.state.punchOutTime).getTime() : Date.now();
        const totalMinutes = Math.round((endMs - punchInMs) / 60_000);
        const breaks = d.state.breaks as BreakEntry[];
        const breakMinutes = breaks.reduce((sum, b) => {
          if (!b.end) return sum;
          return (
            sum + Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60_000)
          );
        }, 0);
        // Add ongoing break time if currently on break
        const ongoingBreak = (d.state.breaks as BreakEntry[]).find((b) => !b.end);
        const ongoingBreakMinutes = ongoingBreak
          ? Math.round((Date.now() - new Date(ongoingBreak.start).getTime()) / 60_000)
          : 0;
        const totalBreakMinutes = breakMinutes + ongoingBreakMinutes;
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            total_minutes: totalMinutes,
            break_minutes: totalBreakMinutes,
            work_minutes: totalMinutes - totalBreakMinutes,
          }),
        );
      },

      getBreakStatus: () => {
        const d = dataRef.current;
        if (d.loading) {
          return Promise.resolve(JSON.stringify({ ok: true, status: "loading" }));
        }
        const breaks = d.state.breaks as BreakEntry[];
        const isOnBreak = d.state.phase === "on_break";
        const currentBreakEntry = d.state.currentBreak as BreakEntry | null;
        const currentBreakMinutes =
          isOnBreak && currentBreakEntry
            ? Math.round((Date.now() - new Date(currentBreakEntry.start).getTime()) / 60_000)
            : 0;
        const completedBreaks = breaks.filter((b) => !!b.end);
        const completedBreakMinutes = completedBreaks.reduce((sum, b) => {
          if (!b.end) return sum;
          return (
            sum + Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60_000)
          );
        }, 0);
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            isOnBreak,
            currentBreakMinutes: isOnBreak ? currentBreakMinutes : null,
            completedBreaksCount: completedBreaks.length,
            totalCompletedBreakMinutes: completedBreakMinutes,
          }),
        );
      },

      proposePunchIn: () => {
        const d = dataRef.current;
        if (d.state.phase !== "idle") {
          return Promise.resolve(
            JSON.stringify({
              ok: false,
              reason: `Kan ikke stemple inn — nåværende fase er '${d.state.phase}'. Ansatt må være i 'idle'-fase.`,
            }),
          );
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("botsson:shift-clock:punch-in"));
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            action: "punch-in",
            message: "Innstemplingsflyt startet. Bekreft i appen.",
          }),
        );
      },

      proposePunchOut: () => {
        const d = dataRef.current;
        if (d.state.phase !== "clocked_in") {
          return Promise.resolve(
            JSON.stringify({
              ok: false,
              reason:
                d.state.phase === "on_break"
                  ? "Kan ikke stemple ut mens du er på pause. Avslutt pausen først."
                  : `Kan ikke stemple ut — nåværende fase er '${d.state.phase}'.`,
            }),
          );
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("botsson:shift-clock:punch-out"));
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            action: "punch-out",
            message: "Utstemplingsflyt startet. Bekreft i appen.",
          }),
        );
      },

      proposeStartBreak: () => {
        const d = dataRef.current;
        if (d.state.phase !== "clocked_in") {
          return Promise.resolve(
            JSON.stringify({
              ok: false,
              reason: `Kan ikke starte pause — nåværende fase er '${d.state.phase}'. Ansatt må være innstemplet.`,
            }),
          );
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("botsson:shift-clock:start-break"));
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            action: "start-break",
            message: "Pause startet. Bekreft i appen.",
          }),
        );
      },

      proposeEndBreak: () => {
        const d = dataRef.current;
        if (d.state.phase !== "on_break") {
          return Promise.resolve(
            JSON.stringify({
              ok: false,
              reason: `Kan ikke avslutte pause — nåværende fase er '${d.state.phase}'. Ansatt må være på pause.`,
            }),
          );
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("botsson:shift-clock:end-break"));
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            action: "end-break",
            message: "Pause avsluttet. Tilbake på jobb.",
          }),
        );
      },

      switchClockTab: (params: Record<string, unknown>) => {
        const tab = String(params.tab ?? "").trim();
        const validTabs = ["tasks", "chat", "notes"] as const;
        if (!validTabs.includes(tab as (typeof validTabs)[number])) {
          return Promise.resolve(
            JSON.stringify({
              ok: false,
              reason: `Ugyldig fane '${tab}'. Gyldige valg: tasks, chat, notes.`,
            }),
          );
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("botsson:shift-clock:switch-tab", { detail: { tab } }),
          );
        }
        return Promise.resolve(
          JSON.stringify({
            ok: true,
            action: "switch-tab",
            tab,
            message: `Bytter til fanen '${tab}'.`,
          }),
        );
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
