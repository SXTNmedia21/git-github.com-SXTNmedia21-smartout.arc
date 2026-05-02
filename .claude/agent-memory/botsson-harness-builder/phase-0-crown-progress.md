---
name: Phase 0 Crown — LOCKED 2026-04-30
description: Phase 0 acceptance gate locked; two implementation bugs found and fixed during gate run
type: project
---

Phase 0 Crown (arena-harness-migration, branch feat/botsson-harness-expansion):

**STATUS: LOCKED 2026-04-30 — 3× consecutive GREEN. Commit 99094590c.**

Tasks landed:
- Task 1 (spec red): 9055efe8a
- Task 2 (migration + seed): 7d37ff3b1
- Task 3 (heartbeat EF + heartbeat_pickup RPC + cron): 0e43530cf
- Task 4 (mission-pool-slot worker): 0bc72c2bd
- Task 5 (mission folder 6 files): 3db3f80eb
- Task 5-fix (spec typecheck — Supabase unknown row cast): daa37b9b3
- Task 6-fix (volume mount + event_type dot-notation): 99094590c

Task 7 (PR to development): PENDING

**Why:** Phase 0 goal is heartbeat -> dispatch -> mission-pool pipe producing canonical 4-event journey trace.

**How to apply next session:** All code is committed. Run local env and execute the acceptance test:
  1. `npx supabase start` (from repo root)
  2. `pnpm --filter @smartout/stage-engine dev` (stage-engine with DATABASE_URL set)
  3. `pnpm --filter @smartout/e2e exec playwright test tests/harness-candidate-0-crown.spec.ts`
  4. Must pass 3 consecutive times.

Pre-existing typecheck failure: `apps/web/src/app/dashboard/calendar/_components/CalendarPageShell.tsx`
references stubs (EventSheet, BookingSheet, etc.) that don't exist yet. This is from commit
`58bcd0a19` (calendar harness tools) — unrelated to Phase 0 crown. Does not block harness spec.

## Pipe trace (completed 2026-04-30)

heartbeat-dispatcher EF (pg_cron every 1m)
  → calls heartbeat_pickup() RPC (SELECT FOR UPDATE SKIP LOCKED, UPDATE status→pending,
    dispatch_lock_id=gen_random_uuid(), pg_notify('mission_dispatch', json))
  → mission-pool-slot.ts LISTENs on 'mission_dispatch' (pg Client in stage-engine)
  → re-fetches row, verifies status='pending' + dispatch_lock_id set
  → loadMissionManifest() — reads ir/journey.yaml, sha256-verifies against ir/journey.hash
  → flips status='active', emits journey run_started
  → emits journey step_reached ×2
  → flips status='complete', emits journey completed
  → all journey.* events route to engine_event via engine-dispatch EF
  → spec queries engine_event WHERE payload @> { run_id: engine_state_id }

## Telemetry trap caught in Task 4

`emit()` signature is `emit(event: SmartoutEvent)` — a SINGLE object with top-level `event`,
`workspace_id`, `actor_id`, AND a nested `properties` block.

Always: `emit({ event: "...", workspace_id: ..., actor_id: ..., properties: { ... } })`.

`workspace_id` and `actor_id` at BaseEvent level are `NonEmptyString` (branded type). Use
`nonEmpty(value, "field_name")` from `@smartout/telemetry`. SYSTEM_ACTOR_ID constant works fine.

`JourneyRunFailed.properties` uses `error_code: string` and `error_message: string` — NOT `reason`.

## Repo-root resolution

Worker resolves `process.cwd() + "/../.."` by default. Correct when stage-engine is launched from
`services/stage-engine/` (pnpm dev). Overrideable via `REPO_ROOT` env.
