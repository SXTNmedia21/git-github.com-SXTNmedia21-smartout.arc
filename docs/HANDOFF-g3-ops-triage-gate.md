---
title: "G3-ops Triage Gate — HANDOFF"
status: done
updated: 2026-05-12
created: 2026-05-12
module: ai
tags: [adr-0099, gate, operations-intelligence, harness-followup]
---

# G3-ops Triage Gate — HANDOFF

## What was built

Closes G3-ops gap documented in HANDOFF-harness-coverage-final-batch9.md. `triage_event` now calls `gate_action` before `emit()`. ADR-0099 §2 compliance achieved.

| File | Change |
|------|--------|
| `packages/ai/src/capabilities/operations-intelligence/gate.ts` | NEW — thin wrapper around `gate_action` RPC, mirrors personal/gate.ts |
| `packages/ai/src/capabilities/operations-intelligence/tools.ts` | Add `callGateAction` import, `CAPABILITY` const, `normaliseChannel` helper, gate check in `triage_event.execute()` before classification |
| `apps/e2e/tests/operations-intelligence-harness-e2e.spec.ts` | Flip Z1 from permanent-skip to active assertion. Update G1 expected delta from 1 → ≥2 |

## Decisions

### D1: Mirror personal/gate.ts pattern, not payroll/gate.ts
Both work, personal is the more recent reference and aligns with availability/contract-intake/guardian patterns from batches 7-8. Identical RPC contract.

### D2: actionType="triage" (not "write")
`triage` is the semantic operation. `write` is too generic. Matches the emit event name (`ops.triage classified`) and lets `gate_action` policies discriminate by action.

### D3: entityId = department_id when present
`triage_event` is department-scoped when caller provides it. Pass through to gate for finer authority resolution.

### D4: Gate-blocked returns structured JSON, not throw
Pattern from personal/availability — gate-block returns `{ ok: false, error: "gate_denied", reason }` so the LLM consumer handles cleanly. Throwing would cascade through stage-engine error path.

### D5: Z1 test inverted — was permanent-skip, now active
Test name reflects state: "G3-ops gap CLOSED". If the fix regresses, Z1 fails immediately. G1 comment block updated to expect delta ≥ 2.

## Known blocker

**Stage-engine Docker rebuild blocked.** Pre-existing issue: `@smartout/payroll-export` (added via dev merge 5dc099d02) is now a runtime dep of `@smartout/ai` but `services/stage-engine/Dockerfile` doesn't COPY or build it. Attempted fix in this sortie added `payroll-export` to COPY + build chain but ran into @types/node resolution: pnpm filter `--filter @smartout/stage-engine...` does not include payroll-export's devDeps (@types/node), so its build fails inside container.

Local typecheck + spec compilation clean. Live E2E verification deferred.

**Recommended fix (separate sortie):** Add `--filter @smartout/payroll-export` to the pnpm install line in `services/stage-engine/Dockerfile`, OR move `@types/node` to a non-devDep, OR drop `types: ["node"]` from `packages/payroll-export/tsconfig.json` (risky).

## Learnings

### L-G3-1: Capabilities without gate.ts inherit only router-level gate
Before this fix, `operations-intelligence/` had no gate.ts file. Stage-engine router calls `gate_action` once per turn at capability level. But ADR-0099 §2 also requires per-action gate for mutations. Tools that mutate via emit() without gate.ts are silent ADR-0099 violators. **Action item:** audit other capabilities without gate.ts for similar gaps.

### L-G3-2: Z1 inversion pattern
The pattern of "permanent skip documenting a gap" + flipping to "active assertion when fixed" is clean. Better than deleting the test — preserves audit trail of what the gap was.

## Next steps

1. Merge to development.
2. Audit other capabilities without `gate.ts` files:
   - `guardian/` (no gate.ts, `acknowledge_signal` mutation flagged in batch 7)
   - `engine-world/` (check)
   - others — grep `find packages/ai/src/capabilities -type d | xargs -I{} test -f {}/gate.ts || echo {}`
3. Fix stage-engine Dockerfile payroll-export build chain (separate sortie).
4. Run live E2E verification after Dockerfile fix.

## References

- ADR-0099 §2 (per-action gate requirement)
- ADR-0151 (server-side ID derivation, gate_action consumer)
- L-0066 (fail-closed on gate RPC error)
- L-0097 (channel guard layers)
- HANDOFF-harness-coverage-final-batch9.md (Z1 gap-doc source)
- Reference pattern: `packages/ai/src/capabilities/personal/gate.ts`
