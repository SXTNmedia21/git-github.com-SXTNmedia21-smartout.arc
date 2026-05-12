---
title: "Journey — g4-guardian-ack-gate"
feature: g4-guardian-ack-gate
branch: feat/g4-guardian-ack-gate
created: 2026-05-12
updated: 2026-05-12
module: ai
status: verified
tags: [adr-0099, gate, guardian, harness-followup]
---

# Journey — g4-guardian-ack-gate

## Why

G4-guardian gap surfaced in HANDOFF-harness-coverage-top3-batch7.md and confirmed in HANDOFF-g3-ops-triage-gate.md audit. `acknowledge_signal` mutates `guardian_signal.status='acknowledged'` without `gate_action` call. ADR-0099 §2 violation. Same class as G3-ops.

## Journey 1 — Add tool-level gate to acknowledge_signal

**Precondition:** `packages/ai/src/capabilities/guardian/` has no `gate.ts`. `tools.ts:acknowledgeSignal.execute()` builds update payload + writes directly.

1. Create `packages/ai/src/capabilities/guardian/gate.ts` mirroring `personal/gate.ts` and `operations-intelligence/gate.ts` (same RPC wrapper contract)
2. Import `callGateAction` + `SessionChannel` in `tools.ts`
3. Add `CAPABILITY="guardian"` const + `normaliseChannel` helper
4. Insert `callGateAction` call in `acknowledgeSignal.execute()` BEFORE `updatePayload` construction
5. actionType="acknowledge", entityId=`signal_id`
6. On `gate.allow=false`: return error message "Signal not acknowledged: {reason}"
7. On `gate.allow=true`: proceed with existing update logic

**Postcondition:** every `acknowledge_signal` invocation writes `gate_evaluation` row with `capability='guardian'` AND `action_type='acknowledge'`.

## Journey 2 — Add G4 assertion to guardian harness spec

**Precondition:** spec docs `G3/G4 pattern` gap. No active assertion for tool-level gate.

1. Update header comment block: replace "Gate gap — G3/G4 note" with "Gate fix — G4-guardian CLOSED"
2. Update A5-A8 block comment: replace "no gate_action call" with "now calls callGateAction"
3. Add new test `G4` after A8: query `gate_evaluation` filtered by `capability='guardian' AND action_type='acknowledge'`, expect ≥ 1 row
4. Assert `allow=true` + `actor_profile_id=SEED_PROFILE_ID`
5. Conditional skip if `acknowledgeSignalSessionId` is null (cascade from A5)

**Postcondition:** G4 test in spec actively asserts the fix. If acknowledge_signal regresses, G4 fails immediately.

## Error paths

- `gate_action` RPC unavailable → `gate.allow=false`, error returned to user. No DB mutation.
- Channel guard mismatch → `gate.channelAllowed=false` surfaces as `allow=false`.
- Authority config drift (guardian not seeded with sufficient role) → row count > 0 but `allow=false`. G4 asserts `allow=true` and fails.

## Known blocker (live verification deferred)

Same stage-engine Docker rebuild blocker as G3-ops: `packages/payroll-export` not in stage-engine Dockerfile build chain. Local typecheck clean. Live E2E run deferred until separate Dockerfile sortie.
