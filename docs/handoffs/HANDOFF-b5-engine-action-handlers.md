---
title: B5 — 3 missing EngineActionType handlers (HACCP Phase 2c unblock)
status: done
updated: 2026-04-24
created: 2026-04-24
module: botsson-arena / engine-dispatch
tags: [engine-dispatch, haccp, invariant-11, adr-0099, adr-0196, l-0124, l-0134]
---

# HANDOFF — B5 Engine Action Handlers

## Summary

Resolved the three phantom / stubbed `EngineActionType` handlers that were blocking HACCP Phase 2c in `supabase/functions/engine-dispatch/index.ts`:

- `create_deviation` — pre-existing shape inserted into `deviation` but had **no error handling**, **no telemetry emit**, and **no context-aware linkage** to the triggering session / shift / reconciliation. Silent no-op on insert failure. Now blocks `engine_state` on insert error, emits `ops.deviation_created` with the `gate_evaluation_id`, and attaches `session_id` / `linked_shift_id` / `reconciliation_id` when resolvable.
- `validate_settlement` — pre-existing shape **swallowed** edge-function errors (`try { await invoke } catch { console.error }`) and advanced as if success. Classic Invariant 11 phantom. Now blocks `engine_state` on any edge-function failure and emits `ops.settlement_validated` with the outcome + `gate_evaluation_id`.
- `lock_checkout` — pre-existing shape was a **pure stub** (`await advanceToNextStep`); gate passed but no mutation occurred. Now updates `daily_reconciliation.status = 'locked'` + `locked_at` + `locked_by`, with idempotency on already-locked rows and a workspace cross-check guard. Emits `ops.checkout_locked` with `gate_evaluation_id`.

A supporting refactor hoists `gateEvaluation` from the gate-check block into `executeStep` function scope so the three handlers can stamp `gate_evaluation_id`, `four_eyes_required`, and `downgrade_to` into their engine_event payloads (L-0134 compliance).

## Per-handler details

### `create_deviation`

| Aspect | Value |
|---|---|
| Real table / service | `public.deviation` (INSERT) + `public.engine_event` (emit) |
| Capability (via dispatcher) | `state.process_id` — gated upstream by `engine_authority_config` row for the specific process |
| Action type | `create_deviation` (member of `GATED_MUTATION_TYPES`) |
| Gate-outcome shape | `gate_evaluation_id` + `four_eyes_required` + `downgrade_to` stamped into `engine_event.payload` |
| Domain artefact | `deviation_id` returned by `.select("deviation_id").single()` and echoed in the emit payload |
| Failure mode | `status='blocked'` + `last_error='create_deviation insert failed: …'` + early return (no advance) |
| Condition path | When `action_payload.condition` key is false in `state.context`, emits `ops.deviation_conditioned_skip` and advances (explicit skip, not silent) |
| Enum safety | `domain` + `severity` validated against `deviation_domain` / `deviation_severity` enum values, fall back to `system` / `medium` on unknown input |

### `validate_settlement`

| Aspect | Value |
|---|---|
| Real table / service | `supabase.functions.invoke("validate-settlement")` + `public.engine_event` (emit) |
| Capability (via dispatcher) | `state.process_id` |
| Action type | `validate_settlement` (member of `GATED_MUTATION_TYPES`) |
| Gate-outcome shape | Same three fields stamped into emit payload |
| Domain artefact | `validation_id` + `deviation_id` (when mismatch exceeds threshold) returned by the edge function, echoed in the emit payload |
| Reconciliation resolution | `action_payload.reconciliation_id` → `context.reconciliation_id` → `state.entity_id` (when `entity_type='daily_reconciliation'`) |
| Failure mode | Missing `reconciliation_id` blocks. Edge-function throw OR non-null `error` from `supabase.functions.invoke` blocks. No silent advance. |

### `lock_checkout`

| Aspect | Value |
|---|---|
| Real table / service | `public.daily_reconciliation` (UPDATE) + `public.engine_event` (emit) |
| Capability (via dispatcher) | `state.process_id` |
| Action type | `lock_checkout` (member of `GATED_MUTATION_TYPES`) |
| Gate-outcome shape | Same three fields stamped into emit payload |
| Domain artefact | `daily_reconciliation.reconciliation_id` row flipped to `status='locked'` + `locked_at=now()` + `locked_by=state.assignee_id` |
| Reconciliation resolution | Same precedence as `validate_settlement` |
| Idempotency | `was_already_locked` computed from prior row; UPDATE skipped when already locked; emit still fires (with the flag) so every lock attempt leaves a trail row |
| Workspace safety | Rejects `priorRow.workspace_id !== state.workspace_id` before mutating — belt-and-braces guard against cross-tenant writes via service role |
| Failure modes | Missing ID → block. Fetch error → block. Row not found → block. Workspace mismatch → block. Update error → block. All with distinct `last_error` strings for observability. |

## Tests

New file: `supabase/functions/engine-dispatch/haccp_phase2c_test.ts`

- **Pattern:** source-parsing (same approach as the existing `entity_pk_test.ts`). Parses `index.ts` as text and asserts structural / semantic properties on each case body.
- **Why not end-to-end:** `index.ts` registers a top-level `Deno.serve` on import, so importing it into a test starts an HTTP server. End-to-end coverage belongs in the deno-test / pgTAP suites, not in this hermetic guard.
- **15 tests, 18 total in the dispatcher suite (incl. 3 pre-existing entity_pk guards). All pass.**

```
deno test --allow-read supabase/functions/engine-dispatch/
ok | 18 passed | 0 failed
```

Coverage map:

| Guard | Tests |
|---|---|
| L-0134 gate-field propagation | 1 (`gateEvaluation hoisted`) + per-handler gate linkage assertions |
| ADR-0099 gate membership | 1 (`all three HACCP action types remain in GATED_MUTATION_TYPES`) |
| Invariant 11 / ADR-0196 / L-0124 | 1 aggregate (`all three HACCP handlers emit a domain-specific engine_event`) + per-handler artefact checks |
| L-0085 silent-noop guards | 3 (one per handler, asserts `blocked` + `return` on error paths) |
| Idempotency | 1 (`lock_checkout — is idempotent when target already locked`) |
| Enum safety | 1 (`create_deviation — enum inputs fall back to safe defaults`) |
| Phantom regression guard | 1 (`validate_settlement — propagates edge function errors`) — negative regex rejects the old `catch { console.error } ... advanceToNextStep` shape |

## Decisions

No new ADRs. Implementation aligns with existing:

- **ADR-0099** — unified authority gate (gate_action before every mutation). All three action types remain in `GATED_MUTATION_TYPES`.
- **ADR-0196 / Invariant 11** — no phantom capabilities. Each handler now produces a verifiable domain artefact or blocks explicitly.
- **L-0085** — silent-noop guards. Each handler blocks `engine_state` on any sub-operation failure before reaching `advanceToNextStep`.
- **L-0124** — phantom-capability mode 3 (gate-call, no artefact). Specifically retired by the `lock_checkout` fix.
- **L-0134** — handler must honour gate return fields. Implemented via function-scope `gateEvaluation` hoist and per-handler stamping.

## Learnings

1. **The system map said "dispatcher has no case" but the code had 3 case branches already.** The real issue was not missing cases — it was three cases in three different phantom patterns: (a) insert-without-error-check, (b) edge-call-with-swallowed-error, (c) pure-stub-advance. Invariant 11 names all three as "phantom". Future dispatcher audits should inspect handler *bodies*, not just presence of `case` labels.
2. **`engine-dispatch/index.ts` is a single 2700+ line Deno file with a top-level `Deno.serve`.** Test coverage is therefore source-parsing only, not end-to-end. This is consistent with the existing `entity_pk_test.ts`. A longer-term improvement would be to extract `executeStep` into a sibling module that can be imported without side-effects — but that's an architectural change beyond B5 scope.
3. **The gate_action RPC has returned `four_eyes_required` and `downgrade_to` since migration `20260506110000`, but the dispatcher silently discarded them.** L-0134 names this pattern. The minimum-scope fix hoists the gate result to function scope so handlers can read it — no change to the gate-check shape itself.
4. **`ENTITY_PK` maps `daily_reconciliation: "id"` but the actual PK is `reconciliation_id`.** I did not fix this — out of scope, and `lock_checkout` does not go through `update_entity` so the bug doesn't affect my handlers. Flagging for a follow-up: `update_entity` targeting `daily_reconciliation` is currently broken because of this mismatch.

## Known issues / debt

- **`ENTITY_PK.daily_reconciliation` is wrong** (see Learning #4). `update_entity` dispatches for `daily_reconciliation` would fail silently today because the allowlist entry maps to column `id`, which doesn't exist. Separate fix — out of B5 scope. Recommend an L-0085 follow-up sortie.
- **No pgTAP test yet verifies end-to-end that an `engine_state` run with `action_type='lock_checkout'` actually locks the target row.** The source-parsing tests verify shape, not behaviour. A pgTAP test seeding an `engine_process` with a `lock_checkout` step, invoking engine-dispatch, and asserting `daily_reconciliation.status='locked'` would close the loop. Parked for a future sortie.
- **`validate_settlement` depends on `settlement_image.ocr_parsed` being populated by the OCR pipeline** (see `supabase/functions/validate-settlement/index.ts:46`). If OCR hasn't run, the edge function returns 400 "No OCR results available for validation" and the handler now correctly blocks. This is expected behaviour; the HACCP process needs to gate its own flow on OCR completion upstream.

## Next steps

1. Update `docs/architecture/BOTSSON-SYSTEM-MAP.md` — flip the three 🔴 rows at lines 304-306 to 🟢 with a note pointing to this handoff.
2. Consider the follow-up: pgTAP tests for dispatch-level behaviour on these three cases. Can be bundled with the `ENTITY_PK.daily_reconciliation` fix.
3. When Phase A5 (Stage Engine intent-classifier context fix) lands, verify that processes triggering these handlers carry the correct `originating_channel` so the gate_action RPC sees the right actor context.

## Verification commands

```bash
# Test suite — 18 tests, 3 pre-existing + 15 new
deno test --allow-read supabase/functions/engine-dispatch/

# Lint — pre-existing errors only (jsr import prefix + unrelated async function)
deno lint supabase/functions/engine-dispatch/index.ts

# Acceptance-criterion greps
grep -c "case \"create_deviation\|case \"validate_settlement\|case \"lock_checkout" \
  supabase/functions/engine-dispatch/index.ts   # → 3
grep -c "gate_evaluation_id:\s*gateEvaluation" \
  supabase/functions/engine-dispatch/index.ts   # → 4 (one per handler + conditioned_skip)
```

## Surprises

- Handler bodies already existed; the task framing ("dispatcher has no handler") was map-drift. Re-framed work as making three phantom handlers real.
- `deno test` silently created a `deno.lock` at repo root on first run. Removed it before commit — no other test in the repo commits one, and it regenerates cleanly when not present.
- `pnpm turbo typecheck` cannot run in the worktree because `node_modules` wasn't hydrated. The Deno edge function is checked by the Deno toolchain instead, which is the correct gate for this surface.
