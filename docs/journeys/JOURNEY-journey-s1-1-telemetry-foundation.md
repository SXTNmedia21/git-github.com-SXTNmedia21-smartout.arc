---
title: "Journey S1.1 — Telemetry Foundation (operator verification)"
status: done
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [journey, telemetry, s1-1, m1, journey-engine, operator]
---

# JOURNEY — S1.1 Telemetry Foundation

> **Context.** S1.1 registers 5 journey events in the telemetry registry with 4-destination routing, widens `activity_trail` to accept flat payloads (ADR-0175), and documents `AuthorityLevel` semantics. No `emit()` call sites exist yet — they land in S1.4. This journey therefore describes the **operator verification** path: a dev triggers a synthetic emit (or scripted capability, once S1.4 arrives) and checks that all four destinations receive it.
>
> User surfaces hit: **Dev console / Supabase dashboard / PostHog / logs**. No runtime UI or mobile BFF in S1.1.

---

## Journey: Dev verifies a journey event reaches all 4 destinations (happy path)

**Precondition:**
- Supabase Local is running (`npx supabase start`).
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, PostHog env vars are set in the shell (from `.env.template` via `op run`).
- Dev has a valid `workspace_id` and a `profile_id` where `profile.workspace_id` matches.
- `engine-dispatch` Edge Function is deployed to local supabase (or a stub that accepts calls).
- The dev has imported `emit` + a `JourneyRunStarted` shape from `@smartout/telemetry`.

**Steps:**

1. Dev constructs a synthetic event payload.
   ```ts
   import { emit } from "@smartout/telemetry";
   await emit({
     event: "journey run_started",
     workspace_id: "00000000-0000-0000-0000-000000000001",
     actor_id: "<resolved_profile_id>",
     correlation_id: crypto.randomUUID(),
     properties: {
       journey_version_id: "jv-test",
       run_id: "run-000",
       actor_id: "<resolved_profile_id>",
       workspace_id: "00000000-0000-0000-0000-000000000001",
       capability: "journey.run_dev",
       surface: "dev",
       entity: {
         entity_type: "journey_run",
         entity_id: "run-000",
         entity_label: "Dev verification run",
       },
     },
   });
   ```
   → System routes according to `EVENT_ROUTING["journey run_started"]` → `["posthog", "logger", "activity_trail", "engine_event"]`.
   → Dev sees: `emit()` resolves with no error.

2. Dev opens the **server log** (Next.js dev server, worker log, wherever logger is consumed).
   → System: Logger provider writes one structured line containing `event: "journey run_started"`.
   → Dev sees: the log line matching the event name + correlation_id.

3. Dev opens **PostHog dashboard** → Events → filter `event = "journey.run_started"` (dot form, post-`toDotNotation()`).
   → System: PostHog provider captured the event with the same correlation_id.
   → Dev sees: a matching event row with properties expanded.

4. Dev opens **Supabase Studio** → Table editor → `activity_trail` → filter `event = "journey run_started"` (space form).
   → System: `writeActivityTrail()` called `resolveEntityRef()` on the FLAT payload, resolved `entity_type = "journey_run"` + `entity_id = "run-000"`, resolved `actor_profile_id` from the `profile` table, and inserted a row.
   → Dev sees: one row with `entity_type = "journey_run"`, `entity_id = "run-000"`, `category = "journey"`, correlation_id matching.

5. Dev opens **Supabase Studio** → Table editor → `engine_event` → filter `event_type = "journey.run_started"` (dot form).
   → System: `sendToEngine()` built the payload via `buildPayload()`, dispatched via `engine-dispatch` Edge Function which inserted one `engine_event` row.
   → Dev sees: one row with `event_type = "journey.run_started"`, `workspace_id` populated, `payload` containing the flat fields + nested entity block.

**Postcondition:**
- Exactly one record in each of: logger output, PostHog events, `activity_trail`, `engine_event`.
- All four records share the same `correlation_id`.
- The widened `activity_trail` resolver accepted the FLAT payload without a `console.warn`.

---

## Journey: Dev accidentally emits an unregistered event (error path)

**Precondition:** same as happy path.

**Steps:**

1. Dev typos the event name in an emit call (e.g., `"journey runstarted"` instead of `"journey run_started"`).
   → TypeScript compile: fails because `"journey runstarted"` is not assignable to `SmartoutEvent["event"]`.
   → Dev sees: red squiggle + TS error in IDE.
2. Dev ignores TS and force-casts (`as SmartoutEvent`).
   → `emit()` at runtime: looks up `EVENT_ROUTING["journey runstarted"]` → `undefined` → logs a `console.error` and returns without routing anywhere.
   → Dev sees: `[telemetry] No routing defined for event "journey runstarted"` (or equivalent guard message in `packages/telemetry/src/emit.ts`).
3. Dev checks `activity_trail` → no row. PostHog → no event. `engine_event` → no row.
   → Dev fixes the typo, re-runs step 1 of happy path.

**Postcondition:** no destination received the phantom event. The registry is the forcing function — unregistered events cannot be emitted by mistake.

---

## Journey: CI fails when a new journey event ships without a test entry (forcing function)

**Precondition:** a developer adds a sixth journey event (e.g., `JourneyPaused`) to `registry.ts` and `EVENT_ROUTING` but forgets to update `packages/telemetry/src/__tests__/registry.journey.test.ts`.

**Steps:**

1. Developer pushes commit with 6 journey events and 5 test entries.
2. CI runs `pnpm turbo test --filter=@smartout/telemetry`.
   → System: `registry.journey.test.ts` iterates over the `JOURNEY_EVENTS` constant (5 items). Does not validate the 6th event.
3. Developer opens PR.
4. Reviewer grep-checks `grep -c "journey " packages/telemetry/src/__tests__/registry.journey.test.ts` vs `grep -c "\"journey " packages/telemetry/src/registry.ts`.
   → System: grep counts mismatch; reviewer requests the 6th event be added to the test constant (or declined via ADR amendment).
   → Developer sees: review comment requiring `JourneyPaused` in `JOURNEY_EVENTS` + destination assertion.

**Postcondition:** the test constant is updated; CI + review catch the drift. Phantom contracts are blocked at test authorship.

---

## Error paths (general)

| Failure | Cause | Recovery |
|---|---|---|
| `activity_trail` row missing | `resolveEntityRef()` returned null — neither nested nor flat entity fields populated | Check payload: at minimum `entity_type` + `entity_id` at properties root OR inside `properties.entity`. |
| `activity_trail` row missing (actor-resolution) | `profile_id` not found for `workspace_id` | Confirm `profile.workspace_id = event.workspace_id`. Provider logs `Could not resolve actor profile`. |
| `engine_event` row missing | `engine-dispatch` Edge Function not running or env var missing | Check `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. Provider logs `Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`. |
| PostHog event missing | PostHog client not initialised (env var) | Check `NEXT_PUBLIC_POSTHOG_KEY` or equivalent server var. |
| TypeScript error on `event: "journey.run_started"` | Dev used dot form in registry key instead of space form | Change to `"journey run_started"`. Dot form is the wire format, not the registry key. |

---

## Out of scope for S1.1 (deferred to later sub-sorties)

- Live capability emit sites: `journey.run_dev`, `journey.publish_mission`, `journey.publish_guide`, `journey.run_guided` — S1.4.
- `journey_version` table + `journey_version_status` enum — S1.2.
- `engine_authority_config` seed rows — S1.3.
- Zod-in-dev runtime payload validation — S1.4 (defer per brief §B.4).
- Mobile BFF path for `journey.run_guided` — M5.
- Fjernkontroll state-machine UI verification — M5.
