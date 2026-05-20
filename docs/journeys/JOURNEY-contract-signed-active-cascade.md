---
title: "Journey — Contract Signed → Employee Active (Cascade Activation)"
status: done
updated: 2026-06-21
created: 2026-06-21
module: cascade
tags: [journey, D2, employee-activation, contract, engine-process]
---

# Journey: Contract Signed → Employee Active (Cascade Activation)

## Journey: System — Employee Activation on Contract Signing

**Actor:** System (cascade engine — employee_activation engine_process)  
**Precondition:**
- Employee has been invited and their profile exists with `status='trainee'`
- An `employment_contract` row exists with `profile_id` pointing to the employee
- The contract has been sent via DocuSeal (`signing_contract_id` populated)
- Both employer AND employee have signed the contract (DocuSeal final signature)

---

### Happy path

1. DocuSeal fires `submission.completed` or `form.completed` (final signature) webhook to `/api/webhooks/docuseal`
   → System maps event to `newStatus = 'signed'`
   → System updates `contract.status = 'signed'` and `employment_contract.status = 'active'`

2. System resolves `profile_id` from `employment_contract WHERE signing_contract_id = contract.contract_id`
   → Returns employee's `profile_id`

3. System inserts `engine_event` row:
   - `event_type = 'contract.signed'`
   - `workspace_id = contract.workspace_id`
   - `idempotency_key = 'docuseal:<submissionId>:signed'`
   - `payload.entity_type = 'profile'`, `payload.entity_id = <profile_id>`
   - `payload.contract_type = 'employee'`
   → User sees: no immediate UI change (system background process)

4. `engine-dispatch` Edge Function receives `contract.signed` event
   → Checks `idempotency_key` — not seen before, proceeds
   → Matches `engine_trigger` with `event_type='contract.signed'` AND `process_id='employee_activation'`
   → Evaluates trigger condition: `payload.contract_type === 'employee'` → TRUE
   → Creates `engine_state` with `entity_type='profile'`, `entity_id=<profile_id>`, `process_id='employee_activation'`

5. `engine-dispatch` calls `gate_action(workspace_id, 'employee_activation', 'system', NULL, 'update_entity', 'employee_activation', state_id)`
   → Looks up `engine_authority_config` for `(workspace_id, 'employee_activation')` → level='autonomous'
   → `gate_action` returns `allow=true`, records `gate_evaluation` row
   → User sees: no change

6. `engine-dispatch` executes `update_entity` step:
   → `UPDATE profile SET status='active', is_active=true, updated_at=now() WHERE profile_id = <profile_id>`
   → Profile is now active

7. `engine-dispatch` emits `profile.activated` telemetry event:
   - `actor_id = 'system'`
   - `workspace_id = <workspace_id>`
   - `entity_type = 'profile'`, `entity_id = <profile_id>`
   - `data.contract_id`, `data.submission_id`
   → Routes to PostHog + Logger + activity_trail
   → User sees: (no UI yet — notification in follow-up sortie)

8. `engine_state.status` set to `complete`
   → User sees: employee profile status is now 'active', eligible for shift scheduling

**Postcondition:**
- `profile.status = 'active'`, `profile.is_active = true`
- `engine_state.status = 'complete'` for the activation run
- `gate_evaluation` row records the autonomous allow
- `profile.activated` telemetry event in activity_trail + PostHog
- Employee can now be scheduled for shifts, assigned protocols, etc.

---

## Journey: System — DocuSeal Retry (Idempotency)

**Actor:** System (DocuSeal webhook retry)  
**Precondition:** `contract.signed` has already been processed once; profile is already `active`

1. DocuSeal retries the webhook → `/api/webhooks/docuseal` runs again
2. `contract.status` check: `newWeight (signed=3) <= currentWeight (signed=3)` → early return `status_not_advanced`
   → User sees: 200 `{ received: true, skipped: "status_not_advanced" }`
   → Engine event is NEVER emitted on retry — idempotency fully covered at the webhook level

**Postcondition:** No engine_event created. Profile unchanged. No double-emit. No double-flip.

---

## Journey: System — Profile Not Trainee (Late Activation Request)

**Actor:** System  
**Precondition:** `contract.signed` fires but profile is already `active` (rare: manual admin reactivation ran first), or profile is `inactive/offboarding`

1. If profile was manually reactivated BEFORE signing: the `update_entity` step runs anyway
   → `UPDATE profile SET status='active', is_active=true` — idempotent, same values written
   → `profile.activated` emitted with system actor
   → Result: no harm, profile stays active

2. If profile is `inactive` or `offboarding`: same `update_entity` writes `active + is_active=true`
   → NOTE: This is an edge case. In practice, `inactive/offboarding` profiles should not have a pending signing workflow, since they are not in trainee onboarding flow.
   → Result: profile transitions to active. If this is undesired for `inactive/offboarding` profiles, a future migration can add a `condition` guard to the engine_step once the condition evaluator is enhanced to read live DB state.

**Postcondition:** Profile is active. No errors. Documented known limitation for inactive/offboarding edge case.

---

## Error paths

**E-1: profile_id cannot be resolved (employment_contract not found)**
- `employment_contract.select("profile_id").eq("signing_contract_id", contract_id)` returns null
- Webhook logs error: `[docuseal] could not resolve profile_id for employee activation`
- Engine event emits with `entity_type='employment_contract'` fallback
- `employee_activation` trigger fires, creates engine_state with `entity_type='employment_contract'`
- `update_entity` handler: `employment_contract` NOT in allowed list → update skipped silently
- `engine_state.status = complete` (advanceToNextStep still runs)
- Operator must monitor: query `engine_state WHERE process_id='employee_activation' AND entity_type='employment_contract'` to detect failures

**E-2: gate_action RPC error**
- `engine_state.status = blocked`, `last_error = 'gate_action RPC failed: ...'`
- Operator resolves by fixing the RPC + manually resuming the engine_state

**E-3: update_entity DB error**
- `engine_state.status = blocked`, `last_error = <postgres error>`
- Operator resolves by fixing the profile row + resuming

**E-4: telemetry emit fails (non-fatal)**
- `profile.activated` emit fails → logged to console
- Profile activation already complete — emit failure does NOT reverse the flip
- Operator observes via PostHog absence + console log
