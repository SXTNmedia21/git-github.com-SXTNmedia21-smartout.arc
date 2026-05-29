---
title: "JOURNEY — task e2e: engine_event emit for canonical 'task created' (J2)"
status: in_progress
updated: 2026-05-26
created: 2026-05-26
module: task
journey-id: J2
sortie: task-e2e-spec-fixes
---

# JOURNEY J2 — engine_event emit for canonical 'task created'

## Symptom

Spec `sortie-p0-fix-sweep-task-created-canonical.spec.ts:238` T3:

```
Error: T3: engine_event row with event='task created' not found within 20s.
       Pre-fix branch emits 'session_task.created' instead.
```

T1 + T2 PASS (POST /api/mobile/tasks → 200; activity_trail har canonical event). Bare engine_event-destinasjonen mangler.

## Diagnose path

1. Sjekk `packages/telemetry/src/registry.ts` for `"task created"` event — registrert?
   - Destinasjoner: posthog, logger, activity_trail, engine_event?
   - Hvis engine_event mangler i destinations-array → wire den

2. Hvis registrert med engine_event: verifiser dispatch i `supabase/functions/engine-dispatch/index.ts` — fyrer den på `task created`?

3. Eventuell race: 20s timeout kan være for kort om dispatch er asynkron. Sjekk om test poller eller venter på fixed delay.

## Acceptance

- `packages/telemetry/src/registry.ts` viser `"task created"` med `engine_event` i destinations
- Etter POST → engine_event-tabellen får row med event='task created' innen <20s
- T3 grønn i `e2e-task.yml`

## Risk

- ADR-0298 boundary respect: task capability eier emit, ikke route. Hvis route emit'er duplikat → ADR-0196 brudd.

## Estimat

20-45 min. Single-line registry-edit hvis bare destination mangler.
