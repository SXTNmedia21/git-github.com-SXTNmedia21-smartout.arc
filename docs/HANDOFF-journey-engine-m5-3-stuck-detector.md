---
title: "Handoff — M5.3 Journey Stuck Detector (event-driven mode)"
status: done
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [handoff, m5-3, m5, stuck-detector, edge-function, telemetry, journey-engine]
---

# HANDOFF — M5.3 Journey Stuck Detector

> **Campaign:** journey-engine · **Milestone:** M5 Runtime Agent-Guided + Mobile · **Sub-sortie:** M5.3
> **Branch:** current worktree on `campaign/journey-engine` base
> **Scope:** `supabase/functions/journey-stuck-detector/**` + contract tests. No migration. No touch on `packages/telemetry` (read-only).

## Summary

M5.3 extends the existing `journey-stuck-detector` Edge Function — originally a 2026-04-06 Journey Harness POC that creates `guardian_signal` rows on hourly cron — with the ADR-0175 event-driven path. The function is now **dual-mode**: legacy cron-rescue (body-less POST) preserved unchanged for the Journey 03 POC, new event-driven path (POST with `{ run_id, step_key, workspace_id, scheduled_for?, actor_id? }`) emits the registered `journey.stuck` event to the four ADR-0175 destinations.

The capability layer (M5.1) is NOT implemented in this sub-sortie. This function is the **detection + emit endpoint only** — the scheduler (who schedules the delayed invocation when a step begins) is the `journey.run_dev` / `journey.run_guided` capability tool, which is out of scope here.

No new Edge Function created. No new table created. No migration. No `packages/telemetry` writes — `journey stuck` was already registered by S1.1 (commit `8e67e105`, ADR-0175 acceptance).

## Function contract

### Entry point

`POST /functions/v1/journey-stuck-detector`

### Request modes

| Mode | Body | Auth | Effect |
|---|---|---|---|
| **Event-driven (M5.3, ADR-0175)** | `{ run_id: string, step_key: string, workspace_id: string, scheduled_for?: string (ISO8601), actor_id?: string }` | `Bearer <SUPABASE_SERVICE_ROLE_KEY>` (server-to-server from capability tool) OR `Bearer <WATCHDOG_CRON_SECRET>` | If `engine_state_step.status` is non-terminal (`pending` or `active`), emit `journey.stuck` to 4 destinations. Else noop with reason. |
| **Legacy cron rescue (pre-ADR-0175)** | empty or `{}` | `Bearer <WATCHDOG_CRON_SECRET>` (hourly cron) | Scan `engine_state` for `journey_03_check_shifts` rows stuck on step 2 > 24h; insert `guardian_signal` rows with 24h dedup. Produces `guardian_signal`, NOT `journey.stuck`. |

### Response shapes

Event mode success:
```json
{ "mode": "event", "emitted": true, "run_id": "…", "step_key": "…", "timeout_ms": 30123, "activity_trail_ok": true, "engine_event_ok": true }
```

Event mode noop (non-error short-circuits):
```json
{ "mode": "event", "emitted": false, "reason": "step_already_terminal" | "run_already_terminal" | "run_not_found" | "step_not_found" | "workspace_mismatch" }
```

Error codes:
- `400 Malformed payload` — JSON parse failed or missing required fields.
- `401 Unauthorized` — bearer missing, wrong token, or anon key.
- `403 workspace_mismatch` — payload `workspace_id` ≠ `engine_state.workspace_id`.
- `404 run_not_found` / `step_not_found` — referenced row missing (conservative — we return 404, never phantom-emit; L-0094).
- `405 Method not allowed` — non-POST method.
- `500` — unexpected DB error or both destinations failed.

### Emit payload (ADR-0175, verified by contract tests)

`packages/telemetry/src/registry.ts` `JourneyStuck` interface:

```
event: "journey stuck"
properties: {
  run_id: string
  step_key: string
  timeout_ms: number
  actor_id: string
  workspace_id: string
  entity: { entity_type: "journey_run", entity_id: run_id, entity_label: string }
}
```

Destinations written by this function directly (bypassing RLS via service-role):

| Destination | Shape | Key form |
|---|---|---|
| `activity_trail` insert | `{ event: "journey stuck", action_verb: "stuck", category: "journey", entity_type: "journey_run", entity_id: run_id, entity_label, actor_id, workspace_id, data: {...}, source: "edge-function" }` | **space** form (matches registry EVENT_ROUTING) |
| `engine_event` insert | `{ event_type: "journey.stuck", workspace_id, payload: { run_id, step_key, timeout_ms, actor_id, workspace_id, entity: {…} } }` | **dot** form (matches `toDotNotation()` wire format) |
| Logger | structured `console.log({ level, action, category, event, run_id, step_key, step_order, timeout_ms, actor_id, workspace_id, activity_trail_ok, engine_event_ok, ... })` | — |
| PostHog | fan-out happens downstream via `engine_event → engine-dispatch → PostHog provider`. Edge Functions do not hold the PostHog client — same precedent as `create-invitation`, `session-hook-executor`. | — |

`timeout_ms` is computed: `now() - scheduled_for` if `scheduled_for` is a valid ISO timestamp; else `now() - engine_state.started_at`; else `0`. The caller (capability tool) is expected to pass `scheduled_for = now + step.timeoutMs` when scheduling the delayed invocation, so the resulting `timeout_ms` reflects how long the step has been non-terminal past its budget.

### step_key encoding

| Form | Lookup |
|---|---|
| UUID (e.g. `a3b4…`) | `engine_state_step.id = step_key AND state_id = run_id` |
| `step-<N>` or `<N>` | `engine_state_step.step_order = N AND state_id = run_id` |
| anything else | 404 `step_not_found` — conservative, no phantom emit |

## Auth

Bearer token required. Accepted tokens:

- `WATCHDOG_CRON_SECRET` — legacy cron path (matches `fire-delayed-triggers`, `session-lifecycle`, `watchdog-*` precedent).
- `SUPABASE_SERVICE_ROLE_KEY` — event-driven path (server-to-server from capability tool, or `supabase.functions.invoke()` from a Server Action with service-role client).

Rejected:
- Missing bearer → 401.
- `SUPABASE_ANON_KEY` → 401 (never listed as accepted; contract test asserts it is not referenced anywhere in the function).
- Local dev permissive fallback: if NEITHER secret is set in the Deno env, requests are accepted. This matches `fire-delayed-triggers` behaviour for `supabase functions serve` without env.

HMAC signing was considered but rejected — no inbound webhook semantics apply. All callers are inside our trust boundary (cron, capability tool). Matches the rest of the function fleet.

**No new secrets introduced.** Both `WATCHDOG_CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` already exist in every env file (1Password `smartout_ai` vault and `smartout_ai_prod` vault).

## Integration point with `fire-delayed-triggers`

**No change to `fire-delayed-triggers`** in this sub-sortie. The existing dispatcher polls `engine_delayed_trigger` and calls `engine-dispatch` with `{ event_type, payload, workspace_id }`. That chain is `engine_trigger.event_type` → `engine-dispatch` — not a function name switch.

Two integration options for M5.1 (capability layer) — decision is M5.1's to make:

1. **Direct invocation.** When a step starts, the `journey.run_dev` / `journey.run_guided` capability schedules a direct HTTP call via `setTimeout` (Server Action) or a second Edge Function cron. Simple, no new DB rows, but loses restart-durability.
2. **`engine_delayed_trigger` + `journey.step_timeout` event.** When a step starts, capability inserts an `engine_trigger` row with `event_type = 'journey.step_timeout'` and an `engine_delayed_trigger` row at `now + step.timeoutMs`. `fire-delayed-triggers` fires it into `engine-dispatch`. Register `journey.step_timeout` in engine-dispatch's handler and have it POST to this Edge Function. Durable across restarts; reuses existing time infra; L-0098-compliant.

Recommendation: option 2. It requires:
- One new `engine_trigger` seed row (migration) per process, OR a dynamic trigger insert per step start.
- A small case in `engine-dispatch` that recognises `journey.step_timeout` events and POSTs to `journey-stuck-detector`.

Neither is in scope for M5.3. This function is ready for either integration path — it takes the same payload regardless of dispatcher.

## L-0098 dual-write status

L-0098 mandates three steps for global-script changes: dual-write → flip → delete. This function currently stands at **Step A (dual-write)**:

| Path | Status | Consumer |
|---|---|---|
| Legacy cron rescue (`guardian_signal` insert for `journey_03_check_shifts`) | **Active** — hourly cron, still firing in prod. | Journey Harness POC (2026-04-06) — the rescue notification for employees who opened the shift list but never tapped a shift. |
| New event-driven emit (`journey.stuck` to 4 destinations) | **Active** — ready for M5.1 capability layer to invoke. | Fjernkontroll state machine card (M5.2), analytics funnels. |

**Step B (flip):** when the capability layer migrates Journey 03 onto the event-driven path (i.e. schedules `scheduled_for` per step, invokes event mode), flip Fjernkontroll subscribers from `guardian_signal.domain='journey_health'` to `engine_event.event_type='journey.stuck'` / `activity_trail.event='journey stuck'`.

**Step C (delete):** remove `handleCronMode`, the `PROCESS_ID` constant, and the `STALE_THRESHOLD_HOURS` constant from this function. Remove the hourly cron schedule (migration). Remove the `guardian_signal` insert path.

**Flip date:** blocked on M5.1 (capability layer). Estimated M5 week 9.

**Delete date:** blocked on at least 2 production cron cycles passing with the new path canonical (empirical "no regressions" window). Estimated M6 week 10.

## How to test locally

Prerequisites: `npx supabase start` running. `.env.local` has `SUPABASE_URL=http://localhost:54321` and `SUPABASE_SERVICE_ROLE_KEY=<from-start-output>`.

```bash
# 1. Start the function (hot-reload)
npx supabase functions serve journey-stuck-detector --no-verify-jwt --env-file supabase/functions/.env.local &

# 2. Seed a journey run + step (replace workspace_id with one that exists)
docker exec -i "$(docker ps -q -f name=supabase_db)" psql -U postgres <<'SQL'
INSERT INTO engine_state (id, process_id, workspace_id, current_step, status, entity_type, entity_id, started_at)
VALUES ('11111111-1111-1111-1111-111111111111', 'journey_04_demo', '<workspace_uuid>', 1, 'active', 'profile', '<profile_uuid>', now() - interval '30 seconds');
INSERT INTO engine_state_step (state_id, step_order, status, action_type)
VALUES ('11111111-1111-1111-1111-111111111111', 1, 'active', 'wait_for_event');
SQL

# 3. Invoke event mode
curl -s -X POST http://localhost:54321/functions/v1/journey-stuck-detector \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "run_id": "11111111-1111-1111-1111-111111111111",
    "step_key": "step-1",
    "workspace_id": "<workspace_uuid>",
    "scheduled_for": "'"$(date -u -d '10 seconds ago' +%Y-%m-%dT%H:%M:%SZ)"'"
  }' | jq .
# Expect: { "mode": "event", "emitted": true, ... }

# 4. Verify the four destinations
docker exec -i "$(docker ps -q -f name=supabase_db)" psql -U postgres <<'SQL'
SELECT event, entity_type, entity_id, data->>'run_id' AS run_id, data->>'step_key' AS step_key, data->>'timeout_ms' AS timeout_ms
  FROM activity_trail WHERE event = 'journey stuck' ORDER BY created_at DESC LIMIT 1;
SELECT event_type, payload->>'run_id' AS run_id, payload->>'step_key' AS step_key, payload->>'timeout_ms' AS timeout_ms
  FROM engine_event WHERE event_type = 'journey.stuck' ORDER BY created_at DESC LIMIT 1;
SQL

# 5. Idempotency: complete the step and re-invoke
docker exec -i "$(docker ps -q -f name=supabase_db)" psql -U postgres \
  -c "UPDATE engine_state_step SET status='completed' WHERE state_id='11111111-1111-1111-1111-111111111111' AND step_order=1;"
curl -s -X POST http://localhost:54321/functions/v1/journey-stuck-detector \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"run_id":"11111111-1111-1111-1111-111111111111","step_key":"step-1","workspace_id":"<workspace_uuid>"}' | jq .
# Expect: { "mode": "event", "emitted": false, "reason": "step_already_terminal", "step_status": "completed" }

# 6. Cron mode (body-less)
curl -s -X POST http://localhost:54321/functions/v1/journey-stuck-detector \
  -H "Authorization: Bearer $WATCHDOG_CRON_SECRET" | jq .
# Expect: { "mode": "cron", "checked": N, "signals_created": M }
```

Contract tests (hermetic, no network, CI-safe):

```bash
deno test --allow-read supabase/functions/journey-stuck-detector/emit_contract_test.ts
# Expect: 15 passed | 0 failed
```

## Decisions made in this sub-sortie

1. **Dual-mode over replacement.** Legacy POC remains live alongside new event path. Rationale: the POC has prod cron consumers (Journey 03 rescue push), and L-0098 forbids ripping out a global script without flip + delete steps. A separate Edge Function was considered and rejected — orchestrator ADR "only add `journey-stuck-detector`".
2. **No migration.** `engine_delayed_trigger`, `engine_state`, `engine_state_step`, `activity_trail`, `engine_event` all exist with sufficient shape. `engine_delayed_trigger` already supports cancellation, firing, workspace-scoping. Adding a column or trigger_type enum was tempting but wasteful — the M5.1 capability layer can insert any `engine_trigger.event_type` string it wants, no DB change needed.
3. **Direct DB writes over a telemetry helper.** Deno cannot import `packages/telemetry` (Node-only). Mirrors `create-invitation` and `session-hook-executor` precedent — two parallel `.insert()` calls in a `Promise.all`.
4. **Conservative on phantom stucks.** Missing step → 404 (no emit). L-0094: phantom emits are worse than missed emits. Better to log and alert an operator than to emit fake stuck events into the Fjernkontroll card.
5. **Workspace-mismatch = 403.** Even a service-role caller can be buggy. Reject cross-tenant emits.
6. **step_key dual-encoding.** Accept both UUID (`engine_state_step.id`) and numeric (`step_order`) to keep the caller's JourneyIR-side flexibility. Plain strings → 404. Documented.
7. **No HMAC.** No inbound webhook semantics; every caller is in-trust-boundary (cron, capability tool on same supabase instance). Bearer-token auth with existing secrets is sufficient.

## Known debt

- **L-0098 Step B + C pending on M5.1.** Legacy cron path + guardian_signal insert still live. Flip requires capability-layer migration of Journey 03. Tracked in campaign dashboard.
- **PostHog routing unverified in this sub-sortie.** The fan-out from `engine_event.event_type = "journey.stuck"` to PostHog happens via `engine-dispatch` downstream. We have NOT exercised that path end-to-end in this sub-sortie — a M5.1 integration test should verify PostHog receives the event when M5.1 lands.
- **No capability-layer scheduler yet.** Until M5.1 schedules delayed invocations, the event-driven mode is dead code in production. Local dev works via the curl invocation above.
- **Terminal-run short-circuit uses string literals.** `runStatus === "complete" || runStatus === "failed"` — should be typed enum if we generate types for this function. Low priority; `engine_state.status` is TEXT, not enum.
- **Contract tests parse source.** Same precedent as `engine-dispatch/entity_pk_test.ts`, L-0085. Long-term fix: generate the emit shape from registry.ts. Low priority.

## Next steps (for M5.1 / M5.2)

1. **M5.1 capability layer** — implement `journey.run_dev` and `journey.run_guided` step tracking: on step start, write `engine_state_step` row with `status='active'` and schedule the delayed stuck-detector invocation (recommended path: insert `engine_trigger` + `engine_delayed_trigger` with `event_type='journey.step_timeout'`; add a case in `engine-dispatch` that POSTs to `journey-stuck-detector`).
2. **M5.2 Fjernkontroll UI** — subscribe to `engine_event.event_type='journey.stuck'` via Supabase Realtime. Render the `stuck` state machine transition per ADR-0177 (spring physics stiffness=35 damping=22 mass=2.2).
3. **L-0098 flip** — once M5.1 lands and Journey 03 migrates, bump the capability docs to point at the event-driven path. Rewrite the hourly-cron consumer to consume `engine_event` instead of `guardian_signal`.
4. **L-0098 delete** — after 2 clean cron cycles, remove `handleCronMode` + constants from this function. Drop the cron schedule migration. Commit atomically.

## Commits

| SHA | Message |
|---|---|
| `541ee2e7` | feat(edge): journey-stuck-detector event-driven mode (M5.3) |
| `956622b8` | test(edge): contract tests for journey-stuck-detector emit shape (M5.3) |

## Final gate check

| Gate | Result |
|---|---|
| Function scaffold + config | ✅ existing `supabase/config.toml` `[functions.journey-stuck-detector]` with `verify_jwt = false` (S1.1 scaffold) |
| `grep -R "journey stuck\|journey\.stuck" supabase/functions/journey-stuck-detector` | ✅ non-zero |
| Payload schema matches ADR-0175 exactly | ✅ contract test #3 + #4 enforce 5 required fields + entity block |
| `SUPABASE_SERVICE_ROLE_KEY` use justified | ✅ comment at entrypoint: "telemetry writes bypass RLS by design" |
| L-0098 dual-write documented | ✅ §L-0098 dual-write status above |
| `supabase/config.toml` entry | ✅ line 572 |
| No anon key for DB writes | ✅ contract test asserts `SUPABASE_ANON_KEY` never appears |
| No new table | ✅ zero migrations touched in this sub-sortie |
| No NEW `packages/ai/src/journey` reference | ✅ grep empty |
| No `ALTER TYPE journey_status ADD VALUE` | ✅ n/a (no migrations) |
| Deno contract tests pass | ✅ 15 passed / 0 failed (26ms) |
