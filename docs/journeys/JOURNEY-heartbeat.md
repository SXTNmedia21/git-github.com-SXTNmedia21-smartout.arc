---
title: Sixten Heartbeat — Operator Journeys
status: done
updated: 2026-04-30
created: 2026-04-30
module: heartbeat
tags: [heartbeat, sixten, orchestrator, phase-0d, engine-event, monitoring]
---

# Sixten Heartbeat — Operator Journeys

These journeys document the observable behaviour of the Sixten heartbeat pipeline (Phase 0d + 0d.1). The pipeline is system-pulse-driven — there is no admin UI. All journeys are written from the perspective of the **platform operator** (person responsible for infra/monitoring) and the **verification agent** (automated test runner or verify script).

Evidence in every journey means "the operator can look here and confirm the system did the right thing." Evidence is always observable via Supabase Studio → Table Editor → `engine_event`.

---

## Journey J1 — pg_cron operator schedules a pulse

**Role:** Platform operator

**Precondition:**
- `apps/web` is running at `http://localhost:3060` (or deployed)
- The endpoint `POST /api/heartbeat/sixten` is reachable
- Supabase local is running; `engine_event` table exists

**Steps:**

1. Operator (or pg_cron job) issues `POST /api/heartbeat/sixten` with body:
   ```json
   { "cron_run_id": "<job-run-uuid>", "scope": "platform", "trigger_source": "supabase_cron", "directives": ["health_check"] }
   ```
   → Webhook parses the body; generates a fresh `pulse_id` (UUID) and `pulse_at` timestamp.
   → Webhook writes one `engine_event` row: `event_type = "sixten.pulse_received"`, `workspace_id = null`, `idempotency_key = cron_run_id` (or `pulse_id` if `cron_run_id` omitted), `payload.pulse_id = <pulse_id>`.
   → Response: HTTP 200 `{ pulse_id, pulse_at, scope, directives, received: true }`.
   → Operator sees the 200 body and logs `pulse_id` for correlation.

2. Operator opens Supabase Studio → Table Editor → `engine_event`.
   → Filters `event_type = sixten.pulse_received`.
   → Finds the row inserted in step 1 with matching `idempotency_key`.

**Postcondition:**
- One `engine_event` row with `event_type = "sixten.pulse_received"` and `idempotency_key` matching the sent `cron_run_id` is visible in the DB.
- `payload.pulse_id` is a non-empty UUID.
- HTTP response is 200; body contains `received: true`.

**Error paths:**
- *Malformed body (invalid JSON):* Webhook swallows the parse error, treats body as empty `{}`, generates a new `pulse_id`. Returns 200 with `received: true`. The `engine_event` insert still proceeds.
- *Empty body:* Same as malformed — 200 returned, pulse logged with no `cron_run_id` (idempotency_key = `pulse_id`).
- *DB unavailable (engine_event insert fails):* Webhook catches the error, logs a warning, and still returns 200. The pulse is not durably recorded. Operator may see a warning in web server stdout: `[sixten.pulse] engine_event insert failed (non-blocking)`.
- *GET request to endpoint:* Returns HTTP 405 with schema documentation. No side-effects.

---

## Journey J2 — Stage-engine worker picks up pulse and runs checks

**Role:** Platform operator / on-call engineer

**Precondition:**
- J1 completed — at least one `sixten.pulse_received` row exists in `engine_event` from within the last 15 minutes.
- `services/stage-engine` is running with `ENABLE_SIXTEN_ORCHESTRATOR=true`.
- The orchestrator's `POLL_INTERVAL_MS = 60 000` ms; the first poll fires immediately on worker start.

**Steps:**

1. Within 60 seconds of the pulse landing, the orchestrator's `pollForPulses()` fires.
   → Queries `engine_event` for `event_type = "sixten.pulse_received"` rows with `fired_at >= now() - 15min`.
   → Filters out pulses already claimed (no matching `sixten.pulse_processing_claimed` sentinel row).
   → For each unclaimed pulse: calls `claimPulse(pulseId)`.

2. `claimPulse` inserts `event_type = "sixten.pulse_processing_claimed"` with `idempotency_key = "pulse_processed_<pulseId>"`.
   → If the insert succeeds (unique constraint passes), this worker owns the pulse.
   → If unique constraint rejects (error code `23505`): pulse already claimed by another instance; worker skips it silently.
   → Stage-engine stdout: `[sixten-orchestrator] processing pulse pulse_id=<uuid>`.

3. Worker calls `runAllChecks(supabaseAdmin, pulseId)` — 5 checks execute sequentially (each in a try/catch).
   → Each check returns a `CheckResult` with `check_name`, `status` (`ok | warn | breach`), `metric`, `threshold`, `payload`.

4. For each check result, `executePolicies` runs the policy matrix:
   - LOG (always): inserts `sixten.check_result` engine_event with `idempotency_key = "<pulseId>_<check_name>"`.
   - NUDGE (warn or breach non-D6): inserts `sixten.nudge` event.
   - AUTO_FIX (D6_orphan_deviations breach only): updates `deviation.subcategory = "sixten_orphan_escalated"` on open orphaned rows.
   - ESKALER (breach): emits `sixten escalation` telemetry via `emit()`.

5. After all checks: worker emits `sixten pulse_processed` telemetry with `{ checks_run: 5, breaches: N, duration_ms }`.
   → Stage-engine stdout: `[sixten-orchestrator] pulse processed checks_run=5 breaches=<N>`.

6. Operator verifies in `engine_event`:
   - One `sixten.pulse_processing_claimed` row for `pulse_processed_<pulseId>`.
   - Five `sixten.check_result` rows (one per check), all with `payload.pulse_id = <pulseId>`.

**Postcondition:**
- `sixten.pulse_processing_claimed` sentinel exists for the pulse.
- Five `sixten.check_result` rows exist in `engine_event`, one per check, with correct `check_name` and `status`.
- `sixten pulse_processed` telemetry event emitted (visible in PostHog / `activity_trail` depending on registry routing).

**Error paths:**
- *Stage-engine not running:* No sentinel row written; no check results. Pulse sits unclaimed until engine restarts and polls within the 15-minute lookback window.
- *DB error during check:* The failing check returns `status: warn` with `payload.error = <message>`. Remaining checks still run. Pulse is still processed.
- *Policy action fails (e.g. `sixten.check_result` insert error):* Error is caught and logged; other actions for the same check continue. Pulse processing is not aborted.

---

## Journey J3 — System with healthy state produces no breaches

**Role:** Verification agent / on-call engineer

**Precondition:**
- Local DB is freshly seeded (`npx supabase db reset`) — no stale engine_events (non-sixten), no old `notification_outbox` pending rows, no open deviations older than 12h, no overdue desk_query_ticket engine_states.
- Orchestrator is running and listening.

**Steps:**

1. Verification agent sends `POST /api/heartbeat/sixten` with `cron_run_id = "clean-state-test-<ts>"`.
   → Returns 200 with `pulse_id`.

2. Agent waits up to 30 seconds for the orchestrator to process the pulse.
   → Polls `engine_event` for `sixten.pulse_processing_claimed` with `idempotency_key = "pulse_processed_<pulseId>"`.
   → Once sentinel found: proceeds to assertions.

3. Agent reads all `sixten.check_result` rows for this `pulseId`.
   → Expects exactly 5 rows (one per check: `emit_pulse_received`, `engine_event_lag`, `notification_outbox_stale`, `ticket_SLA`, `D6_orphan_deviations`).
   → Each row: `payload.status = "ok"`.

4. Agent confirms no `sixten.nudge` or `sixten.check_breach` (via activity_trail) rows exist for this `pulseId`.

5. Agent reads telemetry (`activity_trail` or PostHog): finds `sixten pulse_processed` with `payload.breaches = 0` and `payload.checks_run = 5`.

**Postcondition:**
- All 5 `sixten.check_result` rows have `status = "ok"`.
- No `sixten.nudge` rows for this pulse.
- `sixten pulse_processed` telemetry: `breaches = 0`.

**Error paths:**
- *DB is not clean (residual test data):* One or more checks return `warn` or `breach`. The test should clean up fixtures before running (use `afterEach` + specific DB deletes). This journey intentionally tests the clean-DB case; J4 tests the breach case.
- *Orchestrator does not claim within 30s:* Engine may not be running or `ENABLE_SIXTEN_ORCHESTRATOR` is unset. Test should surface a clear timeout with a diagnostic message.

---

## Journey J4 — System with stale notification_outbox produces breach + escalation

**Role:** Verification agent / on-call engineer

**Precondition:**
- One or more `notification_outbox` rows exist in `status = "pending"` with `created_at` older than 600 seconds (10 minutes). These are injected by the test as fixtures, not via any UI action.
- Orchestrator is running.

**Steps:**

1. Verification agent inserts a fixture `notification_outbox` row directly via admin client:
   ```sql
   INSERT INTO notification_outbox (workspace_id, channel, recipient_profile_id, template_key, payload, status, created_at)
   VALUES (<workspace_id>, 'email', <profile_id>, 'test_stale', '{}', 'pending', NOW() - INTERVAL '700 seconds');
   ```
   → Row exists with `status = "pending"` and `created_at` more than 600s in the past.

2. Agent sends `POST /api/heartbeat/sixten` → gets `pulse_id`.

3. Agent polls for `sixten.pulse_processing_claimed` (max 30s).

4. Agent reads `sixten.check_result` for check_name `notification_outbox_stale`.
   → Expects `payload.status = "breach"`.
   → `payload.stale_count >= 1`.
   → `payload.threshold_seconds = 600`.

5. Agent reads `engine_event` for `event_type = "sixten.nudge"` with `payload.check_name = "notification_outbox_stale"`.
   → Expects at least one nudge row for this `pulseId`.

6. Agent checks `activity_trail` (or engine_event breach row) for `sixten check_breach` event with `payload.check_name = "notification_outbox_stale"`.
   → `payload.pulse_id = <pulseId>`.
   → `payload.metric >= 1` (count of stale rows).

7. Agent checks `activity_trail` for `sixten escalation` event.
   → `payload.check_name = "notification_outbox_stale"`.
   → `payload.escalation_reason` contains `"breach"`.

8. After all assertions: agent deletes the fixture row from `notification_outbox`.

**Postcondition:**
- `sixten.check_result` for `notification_outbox_stale` has `status = "breach"`.
- `sixten.nudge` event exists for this pulse + check.
- `sixten check_breach` telemetry event emitted.
- `sixten escalation` telemetry event emitted.
- Fixture row cleaned up.

**Error paths:**
- *Fixture row was already processed by a previous pulse:* The check counts all `pending` rows older than 600s — even rows from previous test runs. `afterEach` must delete the fixture row unconditionally to avoid state bleed.
- *Orchestrator processes pulse before fixture is inserted:* Race condition. Ensure fixture is inserted BEFORE the pulse POST, not after.
- *activity_trail not a destination for sixten events:* The `sixten check_breach` and `sixten escalation` events route via `emit()`. Check `packages/telemetry/src/registry.ts` for which destinations are active; PostHog may be the only sink on local dev.

---

## Journey J5 — Duplicate pulse with same cron_run_id is idempotent

**Role:** Verification agent / platform operator

**Precondition:**
- Orchestrator is running.
- No prior pulse with the test `cron_run_id` exists in `engine_event`.

**Steps:**

1. Agent sends `POST /api/heartbeat/sixten` with `{ "cron_run_id": "dedup-test-<fixedkey>" }`.
   → Returns 200; receives `pulse_id_1`.
   → One `sixten.pulse_received` row inserted with `idempotency_key = "dedup-test-<fixedkey>"`.

2. Agent immediately sends a second `POST /api/heartbeat/sixten` with the same `cron_run_id = "dedup-test-<fixedkey>"`.
   → Supabase's unique constraint on `idempotency_key` rejects the second insert.
   → Webhook catches the insert error (non-blocking); returns 200 with a new `pulse_id_2`.
   → No second `engine_event` row is written for `dedup-test-<fixedkey>`.

3. Agent waits 30 seconds for orchestrator.
   → Polls for `sixten.pulse_processing_claimed` rows with `idempotency_key IN ["pulse_processed_<pulse_id_1>", "pulse_processed_<pulse_id_2>"]`.
   → Expects exactly ONE claimed sentinel row (for `pulse_id_1`).
   → The second `pulse_id_2` has no `sixten.pulse_received` row → orchestrator never sees it → no processing.

4. Agent counts `sixten.check_result` rows where `payload.pulse_id = pulse_id_1` → expects exactly 5.

5. Agent counts `sixten.check_result` rows where `payload.pulse_id = pulse_id_2` → expects 0.

6. Agent counts `sixten pulse_processed` telemetry events correlated to `pulse_id_1` → expects exactly 1.

**Postcondition:**
- Exactly one `sixten.pulse_received` row for the given `cron_run_id`.
- Exactly one `sixten.pulse_processing_claimed` row (for `pulse_id_1`).
- `pulse_id_2` produced no `engine_event` rows and no processing activity.
- The second HTTP response was still 200 (fail-open for scheduler compatibility).

**Error paths:**
- *Supabase does not have a unique index on `engine_event.idempotency_key`:* Second insert would succeed; two `sixten.pulse_received` rows exist; orchestrator processes both. This indicates a missing DB constraint — report to the schema owner.
- *Orchestrator polls between pulse 1 and pulse 2:* Orchestrator claims pulse 1 before pulse 2 arrives — safe, expected. Pulse 2 still has no `engine_event` row and is never processed.
- *Test leaves residual `dedup-test-<fixedkey>` row:* `afterAll` must delete the `sixten.pulse_received` row and both sentinel rows by `idempotency_key` pattern to keep the DB clean for reruns.
