"use client";

/**
 * use-calendar-tools.ts — Botsson tools for the calendar hub.
 *
 * Eight tools — six read, two write proposals + four navigation:
 *
 *   getCalendarState        — current view, cursor, active tab, settings flags
 *   getEventsForRange       — events in [from, to] window
 *   getBookingsForRange     — bookings in [from, to] window
 *   getEventsForDay         — events for a specific date
 *   getBookingsForDay       — bookings for a specific date
 *   getNextEvents           — N upcoming events from now
 *   proposeNewEvent         — opens EventSheet pre-filled (user confirms + saves)
 *   proposeNewBooking       — opens BookingSheet pre-filled (user confirms + saves)
 *   navigateCalendar        — prev / next / today / specific date
 *   switchCalendarView      — day / week / month
 *   switchCalendarTab       — calendar / year-wheel / events / bookings
 *   openDayInDayControl     — opens DayControlSheet for a date
 *
 * Pattern follows use-schedule-voice-tools.ts (memoise tools once, refresh
 * dataRef every render) and oversikt-tools-bridge (page-level read tools).
 *
 * Why proposals for writes: calendar entries are user-facing — Botsson opens
 * the sheet pre-filled and the user confirms + saves. This mirrors the
 * proposal-pattern Schedule uses for shift mutations (ghost cards + addProposal).
 */

import { useEffect, useMemo, useRef } from "react";
import { addDays, formatISO, parseISO, startOfDay, isBefore, isAfter } from "date-fns";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type { Booking, CalendarEvent, CalendarSettings } from "../_lib/types";
import type { ViewMode } from "../_components/CalendarTab";

export type CalendarTab = "calendar" | "year-wheel" | "events" | "bookings";

export type CalendarToolInput = {
  /** Current cursor date (the date the calendar is centered on). */
  cursor: Date;
  /** Active view mode. */
  view: ViewMode;
  /** Active tab. */
  activeTab: string;
  /** All events (after source-filter applied — what user sees). */
  visibleEvents: CalendarEvent[];
  /** All events (raw, regardless of show flags). */
  allEvents: CalendarEvent[];
  /** All bookings. */
  bookings: Booking[];
  /** User-facing show/hide settings. */
  settings: CalendarSettings;
  /** UI actions — Botsson opens sheets and triggers nav, never mutates. */
  uiActions: {
    openNewEvent: (date?: Date, hour?: number) => void;
    openNewBooking: () => void;
    setCursor: (d: Date) => void;
    setView: (v: ViewMode) => void;
    setActiveTab: (t: string) => void;
    openDayInDayControl: (date: Date) => void;
  };
};

/* ━━━ Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const VIEW_LABELS: Record<ViewMode, string> = {
  day: "Dag",
  week: "Uke",
  month: "Måned",
};

function eventsInRange(events: CalendarEvent[], fromISO: string, toISO: string) {
  const from = parseISO(fromISO);
  const to = parseISO(toISO);
  return events.filter((e) => {
    const d = parseISO(e.date);
    return !isBefore(d, from) && !isAfter(d, to);
  });
}

function bookingsInRange(bookings: Booking[], fromISO: string, toISO: string) {
  const from = parseISO(fromISO);
  const to = parseISO(toISO);
  return bookings.filter((b) => {
    const d = parseISO(b.date);
    return !isBefore(d, from) && !isAfter(d, to);
  });
}

function summarizeEvent(e: CalendarEvent) {
  return {
    id: e.id,
    title: e.title,
    date: e.date,
    start: `${String(e.startHour).padStart(2, "0")}:00`,
    end: `${String(e.endHour).padStart(2, "0")}:00`,
    color: e.color,
    source: e.source,
    notes: e.notes ?? null,
  };
}

function summarizeBooking(b: Booking) {
  return {
    id: b.id,
    guest: b.guest,
    date: b.date,
    time: b.time,
    seats: b.seats,
    notes: b.notes ?? null,
  };
}

function isValidISODate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidViewMode(v: unknown): v is ViewMode {
  return v === "day" || v === "week" || v === "month";
}

function isValidTab(v: unknown): v is CalendarTab {
  return v === "calendar" || v === "year-wheel" || v === "events" || v === "bookings";
}

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

export function useCalendarTools(input: CalendarToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "getCalendarState",
          description:
            "Get the calendar's current state — visible cursor date, view (day/uke/måned), active tab, total event + booking counts, and which layers are toggled on. Call first when manager asks any open-ended calendar question.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getEventsForRange",
          description:
            "Get events between two dates (inclusive). Use when manager asks 'hva skjer denne uka?', 'hvilke arrangementer i mars?', or wants a date-range listing.",
          dynamicParameters: [
            {
              name: "from",
              location: "PARAMETER_LOCATION_BODY",
              schema: { type: "string", description: "Start date YYYY-MM-DD." },
              required: true,
            },
            {
              name: "to",
              location: "PARAMETER_LOCATION_BODY",
              schema: { type: "string", description: "End date YYYY-MM-DD (inclusive)." },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getBookingsForRange",
          description:
            "Get bookings between two dates (inclusive). Use when manager asks 'hvilke bord er reservert i helga?' or wants seat counts across days.",
          dynamicParameters: [
            {
              name: "from",
              location: "PARAMETER_LOCATION_BODY",
              schema: { type: "string", description: "Start date YYYY-MM-DD." },
              required: true,
            },
            {
              name: "to",
              location: "PARAMETER_LOCATION_BODY",
              schema: { type: "string", description: "End date YYYY-MM-DD (inclusive)." },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getEventsForDay",
          description:
            "Get events on a specific date. Use when manager asks 'hva skjer i dag?' or 'hva er booket på fredag?'.",
          dynamicParameters: [
            {
              name: "date",
              location: "PARAMETER_LOCATION_BODY",
              schema: {
                type: "string",
                description:
                  "Date YYYY-MM-DD. Resolve relative dates ('i dag', 'i morgen', 'fredag') to ISO before calling.",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getBookingsForDay",
          description:
            "Get bookings on a specific date — guests, time, seats. Use when manager asks 'hvor mange bord i kveld?'.",
          dynamicParameters: [
            {
              name: "date",
              location: "PARAMETER_LOCATION_BODY",
              schema: { type: "string", description: "Date YYYY-MM-DD." },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getNextEvents",
          description:
            "Get the next N upcoming events from today. Use when manager asks 'hva er neste på agendaen?'. Default count: 5, max 20.",
          dynamicParameters: [
            {
              name: "count",
              location: "PARAMETER_LOCATION_BODY",
              schema: { type: "number", description: "How many to return (1–20). Default 5." },
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "proposeNewEvent",
          description:
            "Open the new-event drawer pre-filled with date + time. User reviews, edits, and confirms. Use when manager says 'legg inn et møte', 'opprett event', etc. NEVER saves directly — drawer requires manual save.",
          dynamicParameters: [
            {
              name: "date",
              location: "PARAMETER_LOCATION_BODY",
              schema: {
                type: "string",
                description: "Date YYYY-MM-DD. Optional — defaults to today.",
              },
            },
            {
              name: "hour",
              location: "PARAMETER_LOCATION_BODY",
              schema: { type: "number", description: "Start hour 0–23. Optional — defaults to 9." },
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "proposeNewBooking",
          description:
            "Open the new-booking drawer. User fills guest + time + seats and confirms. Use when manager says 'ta inn en booking'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "navigateCalendar",
          description:
            "Move the calendar cursor — 'today' jumps to today, 'prev'/'next' steps by view unit, 'date' jumps to a specific YYYY-MM-DD.",
          dynamicParameters: [
            {
              name: "target",
              location: "PARAMETER_LOCATION_BODY",
              schema: {
                type: "string",
                description: "'today' | 'prev' | 'next' | 'date'",
              },
              required: true,
            },
            {
              name: "date",
              location: "PARAMETER_LOCATION_BODY",
              schema: { type: "string", description: "Required when target='date'. YYYY-MM-DD." },
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "switchCalendarView",
          description:
            "Switch the calendar view between day, week, and month. Norwegian aliases accepted: 'dag', 'uke', 'måned'.",
          dynamicParameters: [
            {
              name: "view",
              location: "PARAMETER_LOCATION_BODY",
              schema: { type: "string", description: "'day' | 'week' | 'month'" },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "switchCalendarTab",
          description:
            "Switch the active tab — 'calendar' | 'year-wheel' | 'events' | 'bookings'. Use when user wants to see year wheel or list view.",
          dynamicParameters: [
            {
              name: "tab",
              location: "PARAMETER_LOCATION_BODY",
              schema: {
                type: "string",
                description: "'calendar' | 'year-wheel' | 'events' | 'bookings'",
              },
              required: true,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "openDayInDayControl",
          description:
            "Open the day-control sheet for a specific date — drills into bemanning, oppgaver, avvik for that day. Use when manager asks 'åpne torsdag i dag-styringen'.",
          dynamicParameters: [
            {
              name: "date",
              location: "PARAMETER_LOCATION_BODY",
              schema: { type: "string", description: "Date YYYY-MM-DD." },
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
      getCalendarState: () => {
        const d = dataRef.current;
        return JSON.stringify({
          cursor: formatISO(d.cursor, { representation: "date" }),
          view: d.view,
          viewLabel: VIEW_LABELS[d.view],
          activeTab: d.activeTab,
          counts: {
            visibleEvents: d.visibleEvents.length,
            allEvents: d.allEvents.length,
            bookings: d.bookings.length,
          },
          show: d.settings.show,
          googleConnected: d.settings.google.connected,
        });
      },

      getEventsForRange: (params) => {
        const d = dataRef.current;
        const from = params.from;
        const to = params.to;
        if (!isValidISODate(from) || !isValidISODate(to)) {
          return JSON.stringify({ error: "from + to må være YYYY-MM-DD." });
        }
        const rows = eventsInRange(d.visibleEvents, from, to);
        return JSON.stringify({
          from,
          to,
          count: rows.length,
          events: rows.map(summarizeEvent),
        });
      },

      getBookingsForRange: (params) => {
        const d = dataRef.current;
        const from = params.from;
        const to = params.to;
        if (!isValidISODate(from) || !isValidISODate(to)) {
          return JSON.stringify({ error: "from + to må være YYYY-MM-DD." });
        }
        const rows = bookingsInRange(d.bookings, from, to);
        return JSON.stringify({
          from,
          to,
          count: rows.length,
          bookings: rows.map(summarizeBooking),
        });
      },

      getEventsForDay: (params) => {
        const d = dataRef.current;
        const date = params.date;
        if (!isValidISODate(date)) {
          return JSON.stringify({ error: "date må være YYYY-MM-DD." });
        }
        const rows = d.visibleEvents.filter((e) => e.date === date);
        return JSON.stringify({
          date,
          count: rows.length,
          events: rows.map(summarizeEvent),
        });
      },

      getBookingsForDay: (params) => {
        const d = dataRef.current;
        const date = params.date;
        if (!isValidISODate(date)) {
          return JSON.stringify({ error: "date må være YYYY-MM-DD." });
        }
        const rows = d.bookings.filter((b) => b.date === date);
        const totalSeats = rows.reduce((sum, b) => sum + (b.seats || 0), 0);
        return JSON.stringify({
          date,
          count: rows.length,
          totalSeats,
          bookings: rows.map(summarizeBooking),
        });
      },

      getNextEvents: (params) => {
        const d = dataRef.current;
        const requested = typeof params.count === "number" ? params.count : 5;
        const count = Math.max(1, Math.min(20, Math.floor(requested)));
        const today = startOfDay(new Date());
        const upcoming = d.visibleEvents
          .filter((e) => !isBefore(parseISO(e.date), today))
          .sort((a, b) =>
            a.date === b.date ? a.startHour - b.startHour : a.date.localeCompare(b.date),
          )
          .slice(0, count);
        return JSON.stringify({
          today: formatISO(today, { representation: "date" }),
          count: upcoming.length,
          events: upcoming.map(summarizeEvent),
        });
      },

      proposeNewEvent: (params) => {
        const d = dataRef.current;
        const date = isValidISODate(params.date) ? parseISO(params.date) : new Date();
        const hour =
          typeof params.hour === "number" && params.hour >= 0 && params.hour < 24
            ? Math.floor(params.hour)
            : 9;
        d.uiActions.openNewEvent(date, hour);
        return JSON.stringify({
          ok: true,
          message: `Åpnet ny event for ${formatISO(date, { representation: "date" })} kl ${hour}:00. Bruker må fylle inn detaljer og lagre.`,
        });
      },

      proposeNewBooking: () => {
        const d = dataRef.current;
        d.uiActions.openNewBooking();
        return JSON.stringify({
          ok: true,
          message: "Åpnet ny booking. Bruker må fylle inn gjest, tid og antall.",
        });
      },

      navigateCalendar: (params) => {
        const d = dataRef.current;
        const target = params.target;
        if (target === "today") {
          d.uiActions.setCursor(new Date());
          return JSON.stringify({
            ok: true,
            cursor: formatISO(new Date(), { representation: "date" }),
          });
        }
        if (target === "prev") {
          const step = d.view === "month" ? -30 : d.view === "week" ? -7 : -1;
          const next = addDays(d.cursor, step);
          d.uiActions.setCursor(next);
          return JSON.stringify({ ok: true, cursor: formatISO(next, { representation: "date" }) });
        }
        if (target === "next") {
          const step = d.view === "month" ? 30 : d.view === "week" ? 7 : 1;
          const next = addDays(d.cursor, step);
          d.uiActions.setCursor(next);
          return JSON.stringify({ ok: true, cursor: formatISO(next, { representation: "date" }) });
        }
        if (target === "date") {
          if (!isValidISODate(params.date)) {
            return JSON.stringify({ error: "date må være YYYY-MM-DD når target='date'." });
          }
          const next = parseISO(params.date);
          d.uiActions.setCursor(next);
          return JSON.stringify({ ok: true, cursor: params.date });
        }
        return JSON.stringify({ error: "target må være today | prev | next | date." });
      },

      switchCalendarView: (params) => {
        const d = dataRef.current;
        const raw = typeof params.view === "string" ? params.view.toLowerCase() : "";
        const aliases: Record<string, ViewMode> = {
          day: "day",
          dag: "day",
          week: "week",
          uke: "week",
          month: "month",
          måned: "month",
          maaned: "month",
        };
        const view = aliases[raw];
        if (!isValidViewMode(view)) {
          return JSON.stringify({ error: "view må være day | week | month." });
        }
        d.uiActions.setView(view);
        return JSON.stringify({ ok: true, view });
      },

      switchCalendarTab: (params) => {
        const d = dataRef.current;
        const tab = params.tab;
        if (!isValidTab(tab)) {
          return JSON.stringify({
            error: "tab må være calendar | year-wheel | events | bookings.",
          });
        }
        d.uiActions.setActiveTab(tab);
        return JSON.stringify({ ok: true, tab });
      },

      openDayInDayControl: (params) => {
        const d = dataRef.current;
        if (!isValidISODate(params.date)) {
          return JSON.stringify({ error: "date må være YYYY-MM-DD." });
        }
        d.uiActions.openDayInDayControl(parseISO(params.date));
        return JSON.stringify({ ok: true, date: params.date });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
