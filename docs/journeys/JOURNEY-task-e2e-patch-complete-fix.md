---
title: "JOURNEY — task e2e: PATCH /complete happy + forgeable body (J4)"
status: in_progress
updated: 2026-05-26
created: 2026-05-26
module: task
journey-id: J4
sortie: task-e2e-spec-fixes
---

# JOURNEY J4 — PATCH /api/mobile/tasks/[id]/complete: happy + forgeable

## Symptom

Spec `sortie-1-mobile-task-complete.spec.ts:137` + `:187` — 2 tests feiler hver 3 retries:

- **L137 happy path**: `valid Bearer + owned task → 200 + status=completed + activity_trail`
- **L187 forgeable body field**: `→ 422, DB not mutated`

Web-log viser PATCH-respons 401 + 500 — antyder enten Bearer-misalignment ELLER seedTask failer (J1 priority-kolonne) før test rekker assertion.

## Diagnose path

1. Verifiser at J1 (priority-kolonne) lukket først — gjenta J4-kjøring
2. Hvis fortsatt feiler etter J1:
   - L137: trace responskode + body. 401 = Bearer-token feilet `resolveMobileActor`. 500 = ukjent throw.
   - L187: forgeable body — test sender ekstra felter, forventer 422 fra Zod `.strict()`. Sjekk om PATCH-route har strict-mode.
3. Sjekk `apps/web/src/app/api/mobile/tasks/[id]/complete/route.ts` PATCH handler vs POST — har PATCH `PatchRequestSchema = z.object({}).strict()`? (line 36)

## Acceptance

- L137 + L187 grønne (begge spec'er, ingen retries)
- L222 (missing Bearer → 401) fortsatt grønn (ikke regresjon)

## Sannsynlig kobling

J1 fiks (priority-kolonne) sannsynligvis løser begge — seedTask blokkerer i beforeAll, så all downstream feiler. Fikse J1 først, så re-evaluer J4.

## Estimat

10-20 min hvis koblet til J1, 30-60 min hvis egen bug.
