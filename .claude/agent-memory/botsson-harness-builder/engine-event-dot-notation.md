---
name: engine_event dot-notation
description: engine_event table stores event_type in dot-notation not space-notation; e2e specs must use dot form
type: reference
---

## Rule

`engine_event.event_type` stores dot-notation strings: `"journey.run_started"`, `"journey.step_reached"`, `"journey.completed"`.

The telemetry registry uses space-notation keys: `"journey run_started"` etc. These are converted via `toDotNotation()` in `packages/telemetry/src/providers/engine-event.ts` before writing to the table.

## Why

`toDotNotation(eventName: string): string` does `eventName.replace(/ /g, ".")`.

So `"journey run_started"` → `"journey.run_started"` → stored in `engine_event.event_type`.

## In E2E specs

Always assert the dot form:

```typescript
// CORRECT:
expect(types.filter((t) => t === "journey.run_started")).toHaveLength(1);

// WRONG — this will always return empty array:
expect(types.filter((t) => t === "journey run_started")).toHaveLength(1);
```

Logger output (`action` field in pino JSON) uses the space form. Only the DB column uses dot form.

## Other journey specs (reference)

All specs in `apps/e2e/tests/` except the initial harness-candidate-0-crown.spec.ts
correctly use `.eq("event_type", "journey.run_started")` when querying the DB.

The harness-candidate-0-crown.spec.ts had the space form — fixed in commit `99094590c`.
