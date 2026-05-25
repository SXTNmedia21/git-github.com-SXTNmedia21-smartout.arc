---
title: "Journey: Manager skifter view-mode mellom Område / Rolle / Person"
status: verified
feature: dayplanner-dnd-and-views
created: 2026-05-25
updated: 2026-05-25
verified: 2026-05-25
module: day-session
tags: [journey, dayplanner, oppgaver, view-mode, swimlanes, manager]
---

# Journey: Manager skifter view-mode mellom Område / Rolle / Person

**Rolle:** Manager (admin/owner)
**Surface:** Web `/dashboard/oppgaver`
**Cascade fit:** D5 Concept (view-state)

## Precondition

- Innlogget admin/owner på workspace med dagens session-tasks
- Tasks finnes med både `area_id`, `role_id`, og `assignee_profile_id` populated (minst 2 distinct verdier per dimension)
- Oppgaver-siden åpen, default view-mode = "Område" (fra p11)

## Happy Path

1. Manager ser timeline gruppert per `department.area_id` lanes (Sal, Kjøkken, Bar) — default
2. Manager klikker view-mode-selector "Rolle" i TimelineToolbar → `oppgaver.view_mode_changed` emit med `from=area, to=role`
3. ManagerTimelineChart re-rendrer: lanes nå gruppert per `role_id` (Servitør, Kokk, Bartender, Hovmester)
4. Tasks omplasseres til riktige role-lanes basert på `task.role_id`
5. Tasks uten `role_id` havner i "Uten rolle"-lane nederst
6. Manager klikker "Person" → swimlanes blir én per `assignee_profile_id` (José, Mona, Liv, …)
7. Tasks uten assignee → "Uassignert"-lane
8. Tasks med samme person men forskjellige tider overlapper visuelt i Personens lane → `layoutOverlap()` splitter dem horisontalt

## Postcondition

- view-mode state i useState (`viewMode: "area" | "role" | "person"`)
- Persisteres IKKE — fresh page = default "Område"
- Telemetry: 1 emit per mode-change

## Error Paths

- **Workspace har 0 roles definert** → "Rolle"-knapp disabled med tooltip "Definér roller først (Innstillinger → Roller)"
- **0 assigned tasks** → "Person"-mode viser bare "Uassignert"-lane med info-banner "Ingen tasks tildelt ennå"
- **useRolesForPositions error** → "Rolle"-knapp disabled + toast "Klarte ikke laste roller"
- **Workspace bytte mid-view** → view-mode resetter til "Område" (ny workspace = nye dimensjoner)

## Test Hooks

- E2E: `apps/web/e2e/dayplanner/journey-3-view-modes.spec.ts` (3 mode-bytte i sekvens + verify lane-count + verify task-placement)
- Unit: `groupTasksByMode(tasks, mode)` pure-function test
- Component: view-mode-selector aria-pressed + emit på change
- a11y: segmented-control role=radiogroup, hver mode role=radio
