---
title: "G4-guardian acknowledge_signal Gate — HANDOFF"
status: done
updated: 2026-05-12
created: 2026-05-12
module: ai
tags: [adr-0099, gate, guardian, harness-followup]
---

# G4-guardian acknowledge_signal Gate — HANDOFF

## What was built

Closes G4-guardian gap documented in HANDOFF-harness-coverage-top3-batch7.md. `acknowledge_signal` now calls `gate_action` before mutating `guardian_signal`. ADR-0099 §2 compliance achieved.

| File | Change |
|------|--------|
| `packages/ai/src/capabilities/guardian/gate.ts` | NEW — mirrors personal + operations-intelligence wrappers |
| `packages/ai/src/capabilities/guardian/tools.ts` | Add gate check in `acknowledgeSignal.execute()` before update payload construction |
| `apps/e2e/tests/guardian-harness-e2e.spec.ts` | Update header comment + A5-A8 block comment. Add G4 active assertion |

After G3-ops + G4-guardian: all 3 mutating capabilities without `gate.ts` now have one. Audit clean per ADR-0099 §2.

## Decisions

### D1: actionType="acknowledge"
Semantic operation matches the tool name. Lets gate policies discriminate `guardian.acknowledge` from future guardian actions (resolve, dismiss).

### D2: entityId = signal_id
`acknowledge_signal` operates on a specific signal. Pass through to gate for entity-level authority resolution if policy demands.

### D3: Gate-blocked returns plain string, not structured JSON
Different from G3-ops (which returns JSON). Reason: existing acknowledge_signal returns plain strings on success ("Signal acknowledged.") and on existing error ("Failed to acknowledge..."). Maintaining string-return shape preserves consumer contract. Future refactor could unify all guardian returns to JSON.

### D4: New active test, no skip-to-active flip
Unlike G3-ops Z1, guardian spec had no permanent gap-doc skip — only a comment. So I added a new G4 test rather than flipping an existing one. Same enforcement contract.

## Cross-fix audit complete

| Cap | Mutates | Has gate.ts | Status |
|---|---|---|---|
| engine-world | ✓ (upsert) | ✗ but uses gatedMutation | ✓ ADR-0204 compliant |
| journey-authoring | ✓ (insert/update/delete) | ✗ but uses gatedMutation | ✓ ADR-0204 compliant (ADR-0240 delegation gap separate) |
| guardian | ✓ (update) | ✓ G4-fix | ✓ ADR-0099 §2 compliant |
| operations-intelligence | ✓ (emit→engine_event) | ✓ G3-fix | ✓ ADR-0099 §2 compliant |

All other caps without gate.ts are read-only. **Audit clean.**

## Known blocker

Same as G3-ops: stage-engine Docker rebuild blocked on `payroll-export` not in build chain. Local typecheck clean. Live E2E deferred.

## Learnings

### L-G4-1: Spec-comment ergonomics for permanent-skip vs active-test
G3-ops had a permanent-skip Z1 test documenting the gap. Easy to flip to active assertion. G4-guardian only had a comment in the spec header. Adding a new active test is harder to "discover" later. **Future pattern:** when documenting a gap in a harness spec, always include a `test.skip(true, "GAP DOC: ...")` so it's discoverable in test output AND easy to flip when the fix lands.

### L-G4-2: ADR-0204 gatedMutation is a parallel ADR-0099 §2 satisfier
engine-world + journey-authoring don't have `gate.ts` files but ARE ADR-0099 §2 compliant because they use `gatedMutation()` wrapper which calls `gate_action` internally. The audit pattern must check BOTH: presence of `gate.ts` import OR presence of `gatedMutation` import. Otherwise false-positive gaps.

## Next steps

1. Merge to development.
2. Stage-engine Dockerfile payroll-export fix (separate sortie — blocks live E2E for G3-ops + G4-guardian).
3. Live E2E run after Dockerfile fix to validate both fixes end-to-end.

## References

- ADR-0099 §2 (per-action gate requirement)
- ADR-0204 (gatedMutation wrapper — alternative satisfier)
- ADR-0151 (server-side ID derivation)
- L-0066 (fail-closed)
- L-0097 (channel guard layers)
- HANDOFF-harness-coverage-top3-batch7.md (G4 gap source)
- HANDOFF-g3-ops-triage-gate.md (G3 fix + audit kickoff)
- Reference: `packages/ai/src/capabilities/personal/gate.ts`, `packages/ai/src/capabilities/operations-intelligence/gate.ts`
