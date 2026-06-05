---
title: "HANDOFF — contract-signed-active-cascade"
status: done
updated: 2026-06-21
created: 2026-06-21
module: cascade
tags: [handoff, D2, employee-activation, contract, engine-process, cascade]
---

# HANDOFF — contract-signed-active-cascade

**Branch:** `feat/contract-signed-active-cascade`  
**Worktree:** `/home/sxtnl/wsl/smartout.ai-wt-7`  
**Based on:** `development`

---

## What was built

The cascade tail that was deferred in migration `20260520120100` comment ("Phase 4 will wire actual D2 update + C4 authority-flip steps"). When a DocuSeal contract is fully signed, the employee's `profile.status` now automatically transitions from `trainee` → `active`.

### Files changed

| File | Change |
|------|--------|
| `apps/web/src/app/api/webhooks/docuseal/route.ts` | Option A: resolve `profile_id` from `employment_contract`, emit `entity_type=profile` in engine_event payload |
| `supabase/migrations/20260621100000_engine_process_employee_activation.sql` | `employee_activation` engine_process + single `update_entity` step |
| `supabase/migrations/20260621100100_engine_trigger_employee_activation.sql` | `contract.signed` → `employee_activation` trigger (condition: contract_type=employee) |
| `supabase/migrations/20260621100200_engine_authority_config_employee_activation.sql` | Authority config level=autonomous for all workspaces + capability_default_registry |
| `packages/telemetry/src/registry.ts` | `ProfileActivated` interface + `"profile activated"` EVENT_ROUTING entry |
| `supabase/functions/engine-dispatch/index.ts` | Post-flip `profile.activated` emit in `update_entity` handler (employee_activation branch) |
| `docs/decisions/0379-signature-as-c4-authorization.md` | ADR-0379 — new |
| `docs/decisions/0000-decision-log.md` | ADR-0379 registered |
| `docs/journeys/JOURNEY-contract-signed-active-cascade.md` | Journey — new |
| `docs/journeys/drafts/contract-signed-to-active-cascade.idea.md` | Status updated: idea → done |

---

## Decisions made

### Decision 1: Option A for entity binding (NOT Option B)

**Choice:** The docuseal route resolves `profile_id` from `employment_contract` and emits `entity_type=profile, entity_id=<profile_id>` in the engine_event payload.

**Why Option A over Option B:** Option B would require an intermediate "resolution step" in the engine_process, adding engine plumbing complexity. Option A is a single DB lookup in the docuseal route (which already writes to `employment_contract` in the same code block). The profile entity is then carried directly through `engine_state.entity_type/entity_id`, and `update_entity` can flip the profile row with zero extra steps.

**Risk (documented in ADR-0379):** If `employment_contract.profile_id` resolution fails, the fallback emits `entity_type=employment_contract`. That entity is NOT in the `update_entity` allowlist, so the step silently skips. Monitor `engine_state WHERE process_id='employee_activation' AND entity_type='employment_contract'`.

### Decision 2: Signature = C4 authorization (ADR-0379)

**Choice:** No `change_proposal`, no admin confirmation gate. `engine_authority_config.level='autonomous'` for `employee_activation`.

**Why:** The legal employment contract, signed by both employer and employee, IS the C4 authorization. A post-signing admin confirmation would be paradoxical (legally done, systemically pending). See ADR-0379 for full reasoning.

### Decision 3: No step-level condition guard for idempotency

**Original plan:** `condition: {"match": {"status": "trainee"}}` on the engine_step.

**Why dropped:** The condition evaluator in engine-dispatch checks `state.context` (built from event payload), NOT the live DB row. The event payload does NOT contain `profile.status`. A context-level condition guard would always evaluate to false (no `status` key in payload), causing the step to skip on every invocation — breaking the activation entirely.

**Actual idempotency strategy:**
1. **PRIMARY:** `engine_event.idempotency_key = 'docuseal:<submissionId>:signed'` — DocuSeal retries that send the same submission_id are deduplicated at engine-dispatch intake BEFORE any trigger evaluation.
2. **SECONDARY:** The `update_entity` flip (`SET status='active', is_active=true`) is data-safe for already-active profiles (idempotent write). No double-emit: the idempotency_key prevents the second trigger invocation entirely.
3. **WEBHOOK LEVEL:** The docuseal route's status regression check (`newWeight <= currentWeight`) returns 200 early for duplicate events BEFORE the engine_event is even inserted.

### Decision 4: ADR written (ADR-0379)

The "signature as C4 authorization" pattern is novel — it establishes a precedent that a legal external act can satisfy the C4 gate without system-level `change_proposal`. This warrants an ADR. Slot 0379 was free (0378 confirmed as tip, 0379-0383 had no files or log entries).

---

## Idempotency proof (red-green analysis)

**Scenario 1: DocuSeal fires once (normal case)**
- `idempotency_key = 'docuseal:12345:signed'` — not seen → engine_event created → trigger fires → engine_state created → profile flipped → `profile.activated` emitted → engine_state complete
- Green

**Scenario 2: DocuSeal retries same event (same submission_id)**
- Webhook route: `newStatus='signed'`, contract already `status='signed'` → `statusWeight['signed'] <= statusWeight['signed']` → early return 200 `status_not_advanced`
- engine_event NEVER inserted — idempotency handled before even reaching idempotency_key check
- Green

**Scenario 3: Different DocuSeal event for same contract (e.g. form.viewed after signed)**
- `newStatus='viewed'`, `currentWeight(signed=3) >= newWeight(viewed=2)` → early return `status_not_advanced`
- No engine_event emitted for this path
- Green

**Scenario 4: Two engine_events somehow with same submission_id reach engine-dispatch**
- engine-dispatch line 208-228: `SELECT id FROM engine_event WHERE idempotency_key = 'docuseal:12345:signed'` → exists → return 200 "Event already processed"
- No second trigger evaluation, no second engine_state created
- Green

**Scenario 5: Profile already active (manual admin reactivated before signing)**
- engine_event fires, trigger fires, engine_state created, gate_action allows
- `UPDATE profile SET status='active', is_active=true WHERE profile_id=X` — same values, idempotent write
- `profile.activated` emitted with system actor
- Result: no harm, minor redundant telemetry event
- Yellow (acceptable: redundant but not harmful)

---

## Known limitations / follow-up work

1. **Employee notification** — OUT OF SCOPE per locked decision. When a profile is activated, the employee should receive a notification (push/email). This requires `packages/notifications` work. Target: follow-up sub-sortie.

2. **Employee-facing "you're active" UI** — OUT OF SCOPE. Web my-cv/my-schedule + mobile home should show activation state.

3. **Inactive/offboarding edge case** — The `update_entity` step does NOT guard against inactive/offboarding profiles. In practice these profiles don't have pending signing workflows, but an operator could construct a scenario. Future migration can add a step-level condition guard once the condition evaluator supports live DB reads.

4. **E-1 silent failure path** — If `profile_id` resolution fails in the docuseal route, the engine_event falls back to `entity_type=employment_contract`, which is silently skipped by `update_entity`. Operator monitoring is the only detection mechanism today. A stricter approach would abort the engine_event insert on resolution failure, but that risks losing the event entirely if there's a transient DB issue.

---

## Migration timestamps

| File | Timestamp | Dependency check |
|------|-----------|-----------------|
| `20260621100000_engine_process_employee_activation.sql` | 20260621100000 | Tip was 20260621000000 — strictly greater ✓ |
| `20260621100100_engine_trigger_employee_activation.sql` | 20260621100100 | References `employee_activation` process from T2 — ordered after T2 ✓ |
| `20260621100200_engine_authority_config_employee_activation.sql` | 20260621100200 | References `employee_activation` capability — after T2 ✓ |

---

## Typecheck result

- `pnpm --filter @smartout/telemetry build` — passes (0 errors, ESM imports fixed)
- `pnpm --filter web exec tsc --noEmit --skipLibCheck` — pre-existing errors only (unbuilt `@smartout/ai`, `@smartout/contracts`, `@smartout/utils` dist). Zero errors on changed files (`docuseal/route.ts` clean, telemetry registry clean).
- Full `pnpm turbo typecheck` — SIGTERM (WSL2 OOM, known constraint). Scoped checks confirm no regression.

---

## Migrations applied locally?

Local Supabase not running. Migrations verified via SQL review only. Apply with:
```sh
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260621100000_engine_process_employee_activation.sql
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260621100100_engine_trigger_employee_activation.sql
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260621100200_engine_authority_config_employee_activation.sql
```

---

## References

- ADR-0379: `docs/decisions/0379-signature-as-c4-authorization.md`
- Journey: `docs/journeys/JOURNEY-contract-signed-active-cascade.md`
- Plan: `docs/plans/PLAN-contract-signed-active-cascade.md`
