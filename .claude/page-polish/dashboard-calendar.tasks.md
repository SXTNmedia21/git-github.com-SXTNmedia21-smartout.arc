# Page Polish Tasks — dashboard/calendar

| # | Step | Status | Output |
|---|------|--------|--------|
| 1 | Locate | ✅ | 11 components, 4 tabs, 4 sheets |
| 2 | Architecture | ✅ | Server shell + Suspense + 4-tab AnimatePresence |
| 3 | Skills loaded | ✅ | page-polish, cascade, db |
| 4 | Datapoint inventory | ✅ | 4 (3 localStorage + companyHours) |
| 5 | Server Action inventory | ✅ | 0 — backend not yet wired |
| 6 | Create-entry inventory | ✅ | 4 |
| 7 | Page Knowledge | ✅ | Norwegian copy populated |
| 8 | Harness tools — implementation | ✅ | 12 tools (6 read + 2 propose-write + 4 nav) live |
| 9 | Design pass | ✅ | 0/0/0 (zinc/motion/emoji) |
| 10 | Speed test cold/warm | ⏳ | DEFERRED — Lighthouse |
| 11 | Verification | 🔄 | 5/8 checklist items pass |

Status legend: ⏳ pending · 🔄 in progress · ✅ done · ❌ failed

## Findings

**Pass:**
- 0 hardcoded colors / motion tokens / emojis
- Already production-grade skeleton pattern (Suspense + AnimatePresence)
- Page header has descriptive subtitle ("Datoer, sesonger, eventer og bookinger på ett sted")
- Tab system uses Radix Tabs (semantic + accessible)
- DayControlSheet integration re-uses schedule day-control (no UI duplication)

**Implemented this sortie:**
- 12 Botsson harness tools mounted on /dashboard/calendar:
  - 6 read: getCalendarState, getEventsForRange, getBookingsForRange,
    getEventsForDay, getBookingsForDay, getNextEvents
  - 2 propose-write: proposeNewEvent, proposeNewBooking (both open sheets,
    never upsert directly — user confirms via sheet save)
  - 4 navigation: navigateCalendar, switchCalendarView, switchCalendarTab,
    openDayInDayControl

**Open follow-ups:**
- Lighthouse baseline + re-test (Phase 1+10)
- Backend wiring: events + bookings currently localStorage. When workspace-api
  endpoints land, swap useCalendarEvents/Bookings to TanStack queries +
  Server Action upserts. Harness tools won't need changes — implementations
  read from store-hook output, write tools open sheets (sheet itself swaps
  upsert callback to action). Surface stays stable.
- Add emit() per mutation once backend wired (currently no telemetry — 0
  mutations make it through to engine_event)

## Pattern Notes (for next page polish)

Calendar tools follow same pattern as oversikt + schedule:
1. `_tools/use-<page>-tools.ts` — useMemo'd ClientToolKit, dataRef refresh
   pattern, JSON.stringify returns, camelCase modelToolName.
2. `_tools/<page>-tools-bridge.tsx` — thin wrapper, useRegisterTools(...).
3. Mount bridge inside the page shell (here CalendarPageShell — top of return).
4. Write tools = "propose" — open the sheet pre-filled. User confirms.
   Never mutate directly. Mirrors schedule's ghost-card pattern.

This pattern is now consistent across schedule + oversikt + calendar. Future
pages should reuse it without inventing new structures.
