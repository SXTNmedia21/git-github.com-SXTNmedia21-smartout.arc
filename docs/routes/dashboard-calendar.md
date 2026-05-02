---
title: /dashboard/calendar
status: in_progress
route: /dashboard/calendar
updated: 2026-04-29
created: 2026-04-29
module: calendar
tags: [calendar, dashboard, ui, year-wheel, bookings, events]
---

# /dashboard/calendar — Calendar Hub

Sentral kalender-overflate. Samler **Kalender · Årshjul · Eventer · Bookinger** i én tabbed shell. Speiler `/dashboard/reports` sin layout (header + sub-tabs).

## Purpose

- Gi sjefen ett sted for tid: dagslinje, måned, sesong-årshjul, eventer, bookinger.
- Plug for fremtidige kilder: vakter (D6), sesjoner (D6), helligdager (K1a), Google-eventer.
- Lese-først. Ingen mutasjoner mot D-tabeller herfra ennå — eventer/bookinger ligger i `localStorage` til backend lander.

## Layout

```
┌─ Kalender · text under ───────── [I dag] [‹ ›] [date popover] [Dag/Uke/Måned] [⚙ settings]
│
├─ Tab-rad: Kalender · Årshjul · Eventer · Bookinger
│
└─ Tab-content (Animatert swap, motionTokens.exitMs / easingExpoArray)
```

Header-controls vises kun når Kalender-tab er aktiv. Settings-cog alltid synlig. **`Ny ▾`-dropdown** ligger globalt i `DashboardShell`-headeren (ikke per-side) — se «External Wiring».

## Tabs

| Tab | Komponent | Datakilde |
|-----|-----------|-----------|
| Kalender | `CalendarTab.tsx` | `useCalendarEvents` (localStorage) |
| Årshjul | `YearWheelPageClient` (dynamic-imported) | TanStack Query hooks i `year-wheel/_hooks` |
| Eventer | `EventsTab.tsx` | `useCalendarEvents` |
| Bookinger | `BookingsTab.tsx` | `useCalendarBookings` |

Årshjul-tab gjenbruker hele eksisterende `/dashboard/year-wheel`-klient. Ingen duplisering.

## Calendar tab — Day / Week / Month

`CalendarTab.tsx` rendrer tre subviews:

- **DayView** — 24h vertikal timeline, slot-klikk = ny event på det tidspunktet.
- **WeekView** — 7×24h grid, mandag først (`weekStartsOn: 1`, `nb` locale).
- **MonthView** — DayPicker-style månedsgrid, klikk på dag = ny event 09:00.

View-toggle bruker `layoutId="calendar-view-toggle-pill"` for spring-flyt mellom valg.

## State

Lever lokalt i `CalendarPageShell`:

| State | Type | Persisteres? |
|-------|------|--------------|
| `activeTab` | `"calendar" \| "year-wheel" \| "events" \| "bookings"` | nei (in-memory) |
| `view` | `"day" \| "week" \| "month"` | nei |
| `cursor` | `Date` | nei |
| `events` | `CalendarEvent[]` | localStorage `smartout.calendar.events.v1` |
| `bookings` | `Booking[]` | localStorage `smartout.calendar.bookings.v1` |
| `settings` | `CalendarSettings` | localStorage `smartout.calendar.settings.v1` |

Hooks: `useCalendarEvents`, `useCalendarBookings`, `useCalendarSettings` i `_lib/store.ts`. Svap-out for TanStack Query mot `workspace-api` når backend lander — komponentene rører ikke lagringen direkte.

## Sheets / Drawers

Alle bruker `SheetShell.tsx` (sticky header + footer, scroll body, `springSnappy` entrance).

- **`EventSheet`** — opprett/rediger/slett event. Felter: tittel, dato, start/slutt, farge, notater.
- **`BookingSheet`** — opprett/rediger/slett booking. Felter: gjest, dato, tid, antall, notater.
- **`CalendarSettingsSheet`** — Google Kalender connect (placeholder, se «Known Debt»), 6 visibility-togglers (events / bookings / shifts / sessions / holidays / google).

## External Wiring

### GlobalCreateMenu (header «Ny»-knapp)

`apps/web/src/components/dashboard/GlobalCreateMenu.tsx` — global dropdown helt til høyre i `DashboardShell`-headeren. Items som lander her:

| Item | Action |
|------|--------|
| Event | `router.push("/dashboard/calendar?new=event")` |
| Booking | `router.push("/dashboard/calendar?new=booking")` |

`CalendarPageShell` lytter på `?new=` og åpner riktig sheet på mount, deretter `router.replace` for å rense URL-en.

### Sidebar

Nav-item «Kalender» (Calendar-ikon) i `DashboardShell.tsx`, plassert øverst i Operasjoner-seksjonen. Pinned channel: `mr-botsson` (per `PINNED_CHANNEL_BY_PATH`).

## Related Files

```
apps/web/src/app/dashboard/calendar/
├── page.tsx                       Server entrypoint, withPagePerf + Suspense
├── loading.tsx                    Skeleton fallback
├── _components/
│   ├── CalendarPageShell.tsx      Tabbed shell, state lift, query-param wiring
│   ├── CalendarTab.tsx            Day/Week/Month views, slot+event click handlers
│   ├── EventsTab.tsx              Sortert liste, klikk → EventSheet
│   ├── BookingsTab.tsx            Sortert liste, klikk → BookingSheet
│   ├── EventSheet.tsx             CRUD-sheet for events
│   ├── BookingSheet.tsx           CRUD-sheet for bookings
│   ├── CalendarSettingsSheet.tsx  Google connect + visibility toggles
│   └── SheetShell.tsx             Felles drawer-wrapper (sticky header/footer)
└── _lib/
    ├── types.ts                   CalendarEvent, Booking, CalendarSettings
    └── store.ts                   useCalendar* hooks (localStorage)
```

Tilstøtende:

- `apps/web/src/app/dashboard/year-wheel/year-wheel-page-client.tsx` — Årshjul-tabens implementasjon.
- `apps/web/src/components/dashboard/GlobalCreateMenu.tsx` — Ny-knapp med routes inn hit.
- `apps/web/src/components/dashboard/cockpit/sheets/AnnounceSheet.tsx` — Nyhet-flyt (Ny ▾ → Nyhet).

## Known Debt

- **Google OAuth** — `CalendarSettingsSheet.handleConnect` er en `setTimeout`-stub. Krever ADR + Edge Function (scope `calendar.readonly`, token i 1Password, refresh server-side). Én vei: Google → Smartout. Ikke skriv tilbake.
- **localStorage-persistens** — `_lib/store.ts` er midlertidig. Plan: bytt til TanStack Query-hooks mot et nytt `calendar_event` / `calendar_booking`-table eller kobling mot `planning_event` (D4) hvis koblingen til sesong gir mening.
- **Drag-to-move / resize** — Ikke implementert. Kandidat: `@dnd-kit` i egen sortie.
- **Ekstrne kilder ikke wiret** — visibility-togglene for `shifts`, `sessions`, `holidays` finnes som UI-state, men `CalendarTab` filtrerer kun events i dag. `schedule_shift` (D6), `department_session` (D6) og `public_holiday` (K1a) må feedes inn som typed event-rows før togglene gjør noe.
- **Telemetri** — Ingen `emit()` ennå. Når mutations flyttes til backend, registrer events i `packages/telemetry/src/registry.ts`.

## Cascade Notes

Per `smartout-cascade-developer`-skill:

- Eventer og bookinger er ikke kjernedimensjon. Eventer kan koble seg til **D4 planning_event** når sesong-bindingen kreves. Booking er candidate for nytt domain-table eller kan lande i `engine_state` som mission-instans.
- Vakter (`schedule_shift`) hentes via D6-views — kan ikke skrives herfra (Schedule eier write-path).
- Sesjoner (`department_session`) er D6 og leses fra HMS-hooks; igjen lese-først her.
- Helligdager (`public_holiday`) er K1a (platform-level, NULL workspace_id).

## Changelog

| Date | Change |
|------|--------|
| 2026-04-29 | Initial page setup: tabbed shell, Day/Week/Month views, sheets for events/bookings/settings, GlobalCreateMenu wiring, Google connect stub. |
