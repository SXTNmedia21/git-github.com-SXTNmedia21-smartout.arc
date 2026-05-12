---
title: "Journey — g3-ops-triage-gate"
feature: g3-ops-triage-gate
branch: feat/g3-ops-triage-gate
created: 2026-05-12
updated: 2026-05-12
module: ai
status: verified
tags: [adr-0099, gate, operations-intelligence, harness-followup]
---

# Journey — g3-ops-triage-gate

## Why

G3-ops gap surfaced in HANDOFF-harness-coverage-final-batch9.md. `triage_event` emits to `engine_event` (mutation) but had no `gate_action` call. ADR-0099 §2 violated. Router-level gate covers the turn but not the per-action mutation.

## Journey 1 — Add tool-level gate to triage_event

**Precondition:** `packages/ai/src/capabilities/operations-intelligence/` has no `gate.ts`. `tools.ts:triage_event.execute()` jumps straight to classification + emit.

1. Create `packages/ai/src/capabilities/operations-intelligence/gate.ts` mirroring `packages/ai/src/capabilities/personal/gate.ts` (thin RPC wrapper around `gate_action`)
2. Import `callGateAction` + `SessionChannel` in `tools.ts`
3. Add `CAPABILITY` const + `normaliseChannel` helper (matches personal pattern)
4. Insert `callGateAction` call in `triage_event.execute()` BEFORE classification logic
5. On `gate.allow=false`: return structured JSON `{ ok: false, error: "gate_denied", reason }` — does not throw, does not panic LLM
6. On `gate.allow=true`: classification + emit proceed unchanged
7. Verify typecheck clean

**Postcondition:** every `triage_event` invocation writes a `gate_evaluation` row with `capability='operations_intelligence'` AND `action_type='triage'`.

## Journey 2 — Flip Z1 from skip to assertion

**Precondition:** `apps/e2e/tests/operations-intelligence-harness-e2e.spec.ts:Z1` is permanent `test.skip` documenting the gap.

1. Replace Z1 body with active assertion: query `gate_evaluation` filtered by `capability='operations_intelligence'` AND `action_type='triage'`, expect ≥ 1 row
2. Verify `allow=true` + `actor_profile_id=SEED_PROFILE_ID`
3. Update G1 comment: expected delta changed from 1 (router-only) → ≥2 (router + tool)
4. Update G1 console.info messages accordingly

**Postcondition:** Z1 test name changed from "[gap-doc]: triage_event has no internal gate_action call" to "calls internal gate_action — G3-ops gap CLOSED". E2E spec now enforces the fix.

## Error paths

- `gate_action` RPC unavailable → `gate.allow=false`, structured error returned, no DB write. Equivalent to "fail closed" per L-0066.
- Channel guard mismatch → `gate.channelAllowed=false` surfaces through `gate.allow=false`.
- Authority config drift (e.g. `operations_intelligence` capability not seeded with sufficient role) → row count > 0 but `allow=false`, Z1 asserts allow=true and fails.

## Known blocker (live verification deferred)

Stage-engine Docker rebuild blocked on pre-existing build issue: `packages/payroll-export` (added via dev merge 5dc099d02) is a transitive runtime dep of `@smartout/ai` but NOT listed as a stage-engine build dep in `services/stage-engine/Dockerfile`. Adding it requires @types/node devDep resolution which pnpm filter doesn't bring in. Separate sortie to fix Dockerfile build chain.

**Local typecheck clean. E2E run deferred until docker build fix.**
