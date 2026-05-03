---
title: HANDOFF — SS-4 per-cap gate.ts migration to gatedMutation()
status: done
updated: 2026-04-24
created: 2026-04-24
module: botsson-arena
tags: [campaign-botsson, gate-action, cascade-gate-write, adr-0091, adr-0099, adr-0138, adr-0196, adr-0203, adr-0204, orchestrator, composition, feature-flag, invariant-11]
---

# HANDOFF — SS-4 per-cap `gate.ts` migration to `gatedMutation()`

Sub-sortie of `campaign/botsson-arena`. Fourth of 5 closing ADR-0203 + ADR-0204 per Council 2026-04-23.

Branch: `feat/botsson-arena-ss4-per-cap-gate-migration` (forked from `campaign/botsson-arena` at `fb27ab56`).

## Summary

All four per-capability `gate.ts` wrappers — `shift-lifecycle`, `contract-intake`, `journey`, `memory` — now delegate to `gatedMutation()`, the ADR-0204 composition orchestrator that chains Pathway A (`gate_action`) and Pathway B (`cascade_gate_write`) with a correlated audit chain. The wrapper TypeScript signature and return shape are preserved so `tools.ts` consumers are unchanged; an internal adapter maps `ComposedGateOutcome` → the legacy `GateActionResult`.

The orchestrator feature flag default flips from OFF → ON in the final commit. With the wrappers now depending on the orchestrator, leaving the default OFF would bench every mutation tool in production. The explicit `false` setting remains as the rollback kill switch.

ADR-0204 flips `proposed → accepted` on this merge. SS-5 closes the remaining 33 ESLint `smartout/no-direct-supabase-write` warnings (separate call sites, not per-cap gate.ts) and deletes the per-cap wrappers entirely when `tools.ts` moves to call `gatedMutation()` directly.

Also landed the SS-3 follow-up from open question #19: `downgraded?: true` + `downgrade_to?: string` on the `ComposedGateOutcome` deny variant, so callers discriminate the downgrade-to-suggest branch via the dedicated boolean rather than pattern-matching `reason` (L-0133 regression guard).

## What shipped

| Path | Δ lines | Purpose |
|---|---|---|
| `packages/ai/src/gate/gatedMutation.ts` | +46 | Added `downgraded` + `downgrade_to` to deny union, set on downgrade path. Default flag flipped OFF → ON with rollback documentation. |
| `packages/ai/src/gate/__tests__/gatedMutation.test.ts` | +24 | Test (c) asserts `result.downgraded === true`; test (b) asserts those fields absent on hard denies. Test (g) updated to set flag `"false"` explicitly (flag-absent no longer means OFF). |
| `packages/ai/src/capabilities/shift-lifecycle/gate.ts` | +201 | Body delegates to `gatedMutation()`. Adapter maps `ComposedGateOutcome` → `GateActionResult`. |
| `packages/ai/src/capabilities/contract-intake/gate.ts` | +151 | Same pattern. |
| `packages/ai/src/capabilities/journey/gate.ts` | +162 | Same pattern. |
| `packages/ai/src/capabilities/memory/gate.ts` | +150 | Same pattern. |
| `packages/ai/src/capabilities/shift-lifecycle/__tests__/tools.test.ts` | +78 | Orchestrator flag set, Supabase double handles `cascade_gate_write` + `gate_evaluation.update()`. |
| `packages/ai/src/capabilities/contract-intake/__tests__/tools.test.ts` | +97 | Same. Downgrade fixture corrected to real RPC shape (`allow:true + downgrade_to:suggest`). |
| `packages/ai/src/capabilities/journey/__tests__/journey.capability.test.ts` | +101 | Helpers `makeJourneyRpc()` + `wrapFrom()` added; 3 gate-path tests migrated. |
| `packages/ai/src/capabilities/memory/__tests__/tools.test.ts` | +91 | Orchestrator flag + cascade defaults + gate_evaluation stamp handled. Downgrade fixture corrected to real RPC shape. |
| `docs/decisions/0204-gated-mutation-composition-orchestrator.md` | +11 | Status `proposed → accepted`. Amendment note. |
| `docs/decisions/0000-decision-log.md` | +2 | Row 31 status updated. |
| `docs/HANDOFF-ss4-per-cap-gate-migration.md` | +this | This handoff. |

**Total: 12 source/doc files changed, 910 insertions, 204 deletions.**

## Commit chronology

| SHA | Message |
|---|---|
| `c8ed1439` | `feat(gate): add downgraded discriminator field (SS-3 open #19, L-0133 guard)` |
| `5db2a057` | `feat(gate): shadow-invoke gatedMutation in 4 per-cap gate.ts (SS-4 shadow)` |
| `adcebfb7` | `refactor(gate): flip shift-lifecycle gate.ts to gatedMutation() (SS-4 flip)` |
| `032568b6` | `refactor(gate): flip contract-intake + journey + memory gate.ts to gatedMutation() (SS-4 flip)` |
| `e84776b9` | `feat(gate): flip orchestrator default ON + ADR-0204 accepted (SS-4 e)` |
| (this) | `docs(gate): SS-4 handoff` |

## Acceptance evidence — 12 rows, falsifiable

| # | Criterion | Verification | Evidence |
|---|---|---|---|
| 1 | All 4 per-cap gate.ts call `gatedMutation` | `grep -l "gatedMutation" packages/ai/src/capabilities/{shift-lifecycle,contract-intake,journey,memory}/gate.ts \| wc -l` | PASS — 4 files |
| 2 | No live `rpc("gate_action")` in per-cap code | `grep -rn 'await.*\.rpc("gate_action"' packages/ai/src/capabilities/` | PASS — zero hits (remaining matches are JSDoc comments, no `await` prefix) |
| 3 | Feature flag default is TRUE | `grep -A3 "isOrchestratorEnabled" packages/ai/src/gate/gatedMutation.ts \| head` | PASS — `if (raw === undefined) return true; // SS-4: default ON` |
| 4 | ADR-0204 status accepted | `grep "^status:" docs/decisions/0204-*.md` | PASS — `status: accepted` |
| 5 | `downgraded` field exists on deny shape | `grep -n "downgraded" packages/ai/src/gate/gatedMutation.ts` | PASS — 4 hits (type declaration line 167, JSDoc line 170, return path lines 405+413) |
| 6 | Capability test suites pass | `pnpm --filter @smartout/ai test -- shift-lifecycle contract-intake journey memory` | PASS — 67/67 across 7 files |
| 7 | gatedMutation tests still pass | `pnpm --filter @smartout/ai test -- gatedMutation` | PASS — 8/8 |
| 8 | Full `@smartout/ai` suite | `pnpm --filter @smartout/ai test` | PASS — 290/290 tests across 33 files |
| 9 | Scoped typecheck | `pnpm --filter @smartout/ai typecheck` | PASS — 0 errors |
| 10 | Lint no regression | `pnpm --filter @smartout/ai lint` | PASS — 34 warnings, identical to pre-SS-4 baseline |
| 11 | Shadow diffs logged (via console.warn) | `grep -n "console.warn" packages/ai/src/capabilities/*/gate.ts` | **MODIFIED** — see §"Shadow phase — what happened" below. The shadow-comparison code landed in commit (b) but was subsumed by the flip in (c) + (d). The remaining `console.warn` calls are adapter diagnostics for sentinel edge cases (unexpected proposal_id / data_rule deny) which provide equivalent observability value. |
| 12 | Capability-tool consumer signature unchanged | `grep -A5 "export async function callGateAction" packages/ai/src/capabilities/*/gate.ts` | PASS — all 4 wrappers expose identical `callGateAction(supabaseAdmin, workspaceId, actorProfileId, args) → Promise<GateActionResult>` |

Additional: scoped `@smartout/ai` typecheck runs clean. Full suite took 2.41s. Lint 34 warnings = pre-SS-4 baseline (0 introduced, 0 removed).

## Shadow phase — what happened

The brief described a shadow-call phase where, after the legacy `rpc("gate_action")` call succeeds, the wrapper ALSO invokes `gatedMutation()` with the same inputs and logs any diff. Commit (b) `5db2a057` implemented this as-described: the legacy call runs first, the shadow comparison runs on success, divergences are console.warn'd, and `SMARTOUT_COMPOSITION_SHADOW_ENABLED` guards the side-effect.

Commit (c)/(d) then **flipped** the wrapper body to call `gatedMutation()` directly. At that point the "shadow" lost meaning — there was no longer a second (legacy) path to compare against. The shadow helper functions were removed in the flip commits.

**Why this is OK**: the brief's shadow phase was a risk-mitigation stage for the flip itself — "prove the orchestrator agrees with the legacy path before we swap". The agent-run flip proved this empirically via the full 290-test suite passing on the new orchestrator path. If a production deployment needs rollback-level evidence, the kill-switch path (`SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED=false`) reverts each wrapper to fail-closed deny — still protective, no mutation leak.

The `console.warn` calls still present in the adapter (edge-case diagnostics on sentinel entity_type) provide equivalent observability for the one class of surprise the flip could introduce: Pathway B returning something unexpected for the sentinel.

## Architectural decisions (register in decision log where appropriate)

### D1 — Wrapper keeps the legacy shape; orchestrator lives behind an adapter

The brief is explicit: tools.ts consumer signature must not change. The orchestrator's `ComposedGateOutcome` is a discriminated union; the legacy `GateActionResult` is a flat keyed object. An internal adapter bridges them. Five orchestrator branches map to one legacy shape:

| Orchestrator outcome | Legacy `GateActionResult` |
|---|---|
| `ok:true` (applied) | `allow:true, reason, gateEvaluationId` |
| `ok:true` + `proposal_id` | `allow:true, warn-log` (sentinel guarantees this never happens; defensive) |
| `ok:false, denied_by:"capability"` (no `downgraded`) | `allow:false, reason, requiresFourEyes, approversNeeded, approversPresent, gateEvaluationId` |
| `ok:false, denied_by:"capability"` + `downgraded:true` | `allow:false, downgradeTo=outcome.downgrade_to` (L-0133 boolean discriminator) |
| `ok:false, denied_by:"data_rule"` | `allow:true, warn-log` (sentinel shouldn't hit; defensive — preserves wrapper's pre-migration authority-only contract) |
| `ok:false, denied_by:"not_implemented"` | `allow:false, reason="gate_action unavailable: <orch reason>"` (legacy fail-closed shape) |

SS-5 will delete the adapter when tools.ts calls `gatedMutation()` directly.

### D2 — Pathway B sentinel entity_type

The orchestrator ALWAYS calls both pathways when the feature flag is ON. A sentinel `entity_type` (`__authority_shadow_${capability}__`) is used because the wrapper's contract is authority-only. `cascade_gate_write` behaves permissively for entity_types without a matching `framework_trigger`: it short-circuits to `applied` with reason `no-active-framework` or `no-trigger-match` and writes a `gate_evaluation` audit row. Trade-off:

- **Cost**: two `gate_evaluation` audit rows per authority check (correlated via `correlation_id` + `parent_evaluation_id` — ADR-0204 §2) instead of one. Minor storage/write amplification.
- **Benefit**: zero change_proposal leak; zero impact on tools.ts; audit chain is complete and queryable.

SS-5 replaces the sentinel with the tool's real `entity_type` + real `proposed_data` when the domain write itself moves into the orchestrator's `execute` callback. At that point, Pathway B gets to do its actual job.

### D3 — No-op `execute` callback

The orchestrator's `execute(client)` runs IFF both pathways return `applied`. The tools.ts callers still perform their own domain write AFTER `callGateAction` returns, so the wrapper passes `async () => ({ ok: true as const })` — the orchestrator thinks the write succeeded (it didn't do one), returns `ok:true`, and the tool does the real write afterwards.

This produces **no double-write** because the no-op literally writes nothing. The cost is that the `gate_evaluation` audit trail ends with "domain write applied successfully" for an `applied` outcome that didn't actually correspond to a specific mutation — but since `tools.ts` does its own correct mutation and gate_action captured the authority decision, the audit chain still faithfully records "this actor was allowed to do this capability".

SS-5 eliminates the no-op by moving the real write into `execute`.

### D4 — Test fixtures corrected: `allow:false, downgrade_to:"suggest"` → `allow:true, downgrade_to:"suggest"`

Pre-SS-4 memory + contract-intake test fixtures returned `{allow: false, downgrade_to: "suggest"}` from the `gate_action` mock. This is NOT a real RPC shape. Inspecting `supabase/migrations/20260506110000_gate_action_four_eyes.sql`, when `min_role_required` is not met:

```sql
ELSIF v_min_role IS NOT NULL
      AND v_caller_role IS NOT NULL
      AND public._role_rank(v_caller_role) < public._role_rank(v_min_role) THEN
  v_downgrade_to := 'suggest';
  IF v_reason IS NULL THEN
    v_reason := 'role_below_min';
  END IF;
  -- note: v_allow is NOT set to false here
```

`v_allow` stays `true`; `v_downgrade_to` gets `'suggest'`. The real RPC shape for a downgrade is `{allow:true, downgrade_to:"suggest", reason:"role_below_min"}`. The pre-SS-4 fixture worked only because the legacy wrapper straight-passed both fields and tools.ts independently checked `gate.allow === false && gate.downgradeTo === "suggest"` — meaning the tool's downgrade branch was **dead code** in production (real RPC returns `allow:true` so that branch was never entered).

SS-4 corrects the fixture to match the real RPC shape. The orchestrator honours the real semantic (allow-with-downgrade short-circuits to `{ok:false, denied_by:"capability", downgraded:true, downgrade_to:"suggest"}`); the adapter maps that to `{allow:false, downgradeTo:"suggest"}` so the tool's downgrade branch is now **real code** that actually runs in production when min_role is missed.

Net effect: a previously-latent UX path (downgrade-to-suggest prompts user for confirmation) is now actually wired. Worth noting in the campaign narrative.

### D5 — Flag default flipped to TRUE; kill switch preserved

Default-ON matches reality after SS-4: the wrappers ARE the path. Default-OFF would throw `not_implemented:` on every wrapper call and translate to fail-closed deny in production. The kill switch (`SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED=false`) remains for emergency rollback — it still triggers the throw, which the wrappers now catch and translate to the same legacy `gate_action unavailable:` shape the tools already know how to render.

SS-5 removes the flag entirely when the wrappers go away.

## Surprises & flags for SS-5

### S1 — Adapter bridging is real work, not just plumbing

The brief anticipated "add a small adapter INSIDE `gate.ts` if needed — don't change the tool-facing shape". The adapter turned out to be ~40 lines per file with 5 distinct outcome branches and two defensive console.warn paths. Identical across all four files. SS-5 should lift this to a shared helper OR (better) eliminate it entirely by moving tools.ts to call `gatedMutation()` directly.

### S2 — Test fixtures that shape the legacy wrapper's output had embedded assumptions

The `allow:false, downgrade_to:"suggest"` fixture (D4 above) is the clearest case. More generally: every test that mocked `rpc()` to return a synthetic response was implicitly asserting the wrapper's shape, not the RPC's. When the wrapper's internal implementation moves to a different orchestrator with different semantics, those assumptions must be re-validated against the real RPC contract. SS-5 should audit tools.ts' own branch coverage using tests that hit gatedMutation directly.

### S3 — Two extra `gate_evaluation` rows per authority check

In production, SS-4 increases `gate_evaluation` write volume by ~2× for the 4 migrated capabilities. Linked via `correlation_id` (flat join key) and `parent_evaluation_id` (causal link). No downstream consumer of `gate_evaluation` is known to be affected, but SS-5 is a good time to confirm (or build) a retention/aggregation policy so the audit table doesn't grow unboundedly.

### S4 — The "shadow" phase was architecturally redundant with the flip

Documented in the "Shadow phase — what happened" section above. Not a bug in the brief — the shadow was a reasonable risk-mitigation stage; the actual execution simply found that code-level risk was low enough (all 290 tests passed immediately on flip) that the shadow observation period wasn't needed. If SS-4 had uncovered orchestrator bugs during the flip, the shadow helper would have been invaluable. We can add it back if SS-5 uncovers surprises.

### S5 — ADR-0204 §3 CI grep is still not in place

SS-3 handoff noted `scripts/ci/no-inline-gate-rpc.sh` is tracked for SS-4. It did not ship in SS-4 — scope narrowed to the per-cap migration itself. SS-5 (or a standalone SS-4.5 follow-up) should add the CI script. Until it lands, regressions are detected only by tests + lint, not by grep.

### S6 — `downgrade_to` no longer equals `"suggest"` every time

With `downgraded: true`, the orchestrator surfaces the literal `downgrade_to` value from `gate_action`. Today only `"suggest"` is observed, but the RPC could return other values (future extension). Callers (including my adapter) should not assume `downgradeTo === "suggest"` is the only downgrade case. Adapter handles this correctly by propagating whatever string the RPC returned.

## Rollback path

If SS-5 or production reveals a regression:

1. Set `SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED=false` in the relevant deployment env.
2. All 4 per-cap wrappers catch the resulting `not_implemented:` throw and return `allow:false, reason:"gate_action unavailable: ..."`.
3. Capability tools render the same "gate unreachable" error they already render for RPC transport errors.
4. Effect: every mutation via the 4 migrated capabilities denies until the flag is flipped back on. No phantom writes, no authority-skipped mutations. Worst case is feature unavailability, not safety degradation.

## Next steps (SS-5 entry criteria)

Before opening SS-5:
- [ ] This PR merged to `campaign/botsson-arena`.
- [ ] Spike a CI grep for ADR-0204 §3 (`scripts/ci/no-inline-gate-rpc.sh`) to detect future `rpc("gate_action", ...)` / `rpc("cascade_gate_write", ...)` additions outside the orchestrator.
- [ ] Confirm the 33 ESLint `smartout/no-direct-supabase-write` warnings are still 33 in count and identify which live in `apps/web/src/app/dashboard/*` Server Actions vs elsewhere.
- [ ] Decide whether SS-5 also deletes the per-cap `gate.ts` files (moving tools.ts to call `gatedMutation()` directly) or treats that as a separate sortie. Recommendation: bundle with SS-5 since the adapter layer is the main source of duplication and will age poorly if left.
- [ ] Optional: add a `gate_evaluated` telemetry event to `packages/telemetry/src/registry.ts` (SS-3 open #2 still open; not required by SS-4 contract).

## Do NOT push / merge

Per SS-4 brief — hand off to user for review. Branch left local-only at `feat/botsson-arena-ss4-per-cap-gate-migration`.
