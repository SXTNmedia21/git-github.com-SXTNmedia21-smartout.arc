---
title: "Journey: Manager filtrerer Oppgaver-timeline etter område"
status: verified
feature: dayplanner-dnd-and-views
created: 2026-05-25
updated: 2026-05-25
verified: 2026-05-25
module: day-session
tags: [journey, dayplanner, oppgaver, filter, manager]
---

# Journey: Manager filtrerer Oppgaver-timeline etter område

**Rolle:** Manager (admin/owner)
**Surface:** Web `/dashboard/oppgaver`
**Cascade fit:** D5 Concept (view-state) + D6 Production (read)

## Precondition

- Innlogget med admin/owner-rolle på workspace med 2+ områder (eks. "Sal", "Kjøkken", "Bar")
- Oppgaver-siden åpen, viser tasks for dagens dato i area-mode
- Tasks finnes i minst 2 områder

## Happy Path

1. Manager scanner timeline → ser tasks spredt over Sal, Kjøkken, Bar lanes
2. Manager klikker chip "Kjøkken" i TimelineToolbar → `oppgaver.filter_toggled` emitter med `filter_type=area, filter_value=kjokken, active=true`
3. ManagerTimelineChart dimmer Sal + Bar lanes til 30% opacity, skjuler tasks utenfor Kjøkken
4. Chip "Kjøkken" får `aria-pressed=true` + Nordic-Split orange-accent styling
5. Manager klikker chip "Alle" → filteret resettes, alle lanes opacity 100%, alle tasks synlige igjen
6. `oppgaver.filter_toggled` emitter med `active=false`

## Postcondition

- Filter-state lever i komponent useState (ikke URL — bottom-of-page surface, ephemeral)
- Telemetry events fanget i PostHog
- Ingen mutasjoner på server-side data

## Error Paths

- **Workspace har bare ett område** → chip-bar viser bare "Alle" + det ene området; chip-toggle no-op (aria-pressed disabled)
- **Workspace-id null** → emit guards short-circuiter med L-0177 fail-fast; UI viser fortsatt filteret, men telemetry stille (warn logged)
- **Tasks loader/error** → filter-state bevart, chart viser skeleton/error; chip-knapper aktive (forberedte for når data lander)

## Test Hooks

- E2E: `apps/web/e2e/dayplanner/journey-1-area-filter.spec.ts`
- Unit: chip-toggle callback + aria-pressed in `TimelineToolbar.test.tsx`
- axe: zero violations på chip-bar role=group + role=button[aria-pressed]
