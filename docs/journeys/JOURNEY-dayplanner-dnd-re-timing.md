---
title: "Journey: Manager drar task til ny tid og ansatt"
status: verified
feature: dayplanner-dnd-and-views
created: 2026-05-25
updated: 2026-05-25
verified: 2026-05-25
module: day-session
tags: [journey, dayplanner, oppgaver, dnd, manager, mutation, adr-0298]
---

# Journey: Manager drar task til ny tid og ansatt

**Rolle:** Manager (admin/owner)
**Surface:** Web `/dashboard/oppgaver`
**Cascade fit:** D6 Production (mutate session_task)

## Precondition

- Innlogget admin/owner på workspace med aktive session_tasks
- Oppgaver-siden åpen, person-mode aktiv → 2+ swimlanes (ansatte) synlige
- Minst én task "Prep pasta" scheduled 12:00 i lane "José"

## Happy Path

1. Manager hover over task-blokk "Prep pasta 12:00" → cursor blir grab; task får drag-affordance border-highlight
2. Manager presses mousedown + drar task vertikalt nedover til lane "Mona" og horisontalt til 14:00
3. Under drag: ghost-block følger cursor; target-lane + target-time slot får drop-zone highlight
4. Manager slipper musen ved 14:00 i Mona-lane → `useDragRetiming` beregner `to_iso=14:00`, `to_assignee=mona_profile_id`
5. Server action `updateTaskScheduledAtAction({ task_id, scheduled_at: "14:00:00", assignee_profile_id: "mona…" })` kalles
6. Backend: task-capability `task.update_scheduled_at` validerer (workspace-bound, profile-bound, C4 authority) + skriver `session_task.scheduled_at` + `assignee_profile_id`
7. Telemetry: `oppgaver.task_re_timed` emitter med from/to-tider og from/to-assignees
8. Toast vises "Flyttet 'Prep pasta' til 14:00 (Mona)" (3 sek auto-dismiss)
9. TanStack Query invalidate → tasks re-fetched → task vises i Mona-lane @ 14:00

## Postcondition

- DB: `session_task.scheduled_at = '14:00'`, `assignee_profile_id = mona_profile_id`, `updated_at` bumped
- Telemetry event lagret i PostHog + activity_trail
- engine_event registrert (ADR-0298 D6 mutation)
- Optimistic UI: blokk vises i ny posisjon umiddelbart (rollback ved server-error)

## Error Paths

- **Drop på samme posisjon** (ikke faktisk endret) → no-op, ingen emit, ingen server-call
- **Server-error** (RLS deny, network) → optimistic update rulles tilbake; toast viser feilmelding; emit ikke fired
- **Drop utenfor gyldig drop-zone** (eks. drag til disabled past time) → no-op + visuell shake-animasjon på source
- **Workspace-id eller profile-id missing** (L-0177) → server-action returnerer `{ok:false}`, ingen DB-write, toast "Klarte ikke flytte"
- **C4 authority deny** (manager mangler permission) → server-action returnerer `{ok:false, reason:"unauthorized"}`, toast "Ikke tillatt"
- **Concurrent edit** (annen manager mutede samtidig) → server detekterer via `updated_at` stale; toast "Andre har endret denne, last på nytt"

## Test Hooks

- E2E: `apps/web/e2e/dayplanner/journey-2-dnd-re-timing.spec.ts` (happy path + drop-utenfor-zone)
- Unit: `useDragRetiming` drop-calc med edge-cases (snap-to-grid, time-bounds clamp)
- Component: TaskBlock draggable=true, onDragStart sets dataTransfer
- a11y: Keyboard fallback (Enter on focused task → opens "Endre tid"-modal som ikke-mus brukere)
