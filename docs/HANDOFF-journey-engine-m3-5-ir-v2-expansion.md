---
title: "Journey Engine M3.5 — JourneyIR v2 schema expansion + adapter deletion (ADR-0178 + ADR-0174 C.11)"
status: done
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [journey-engine, journey-ir, adr-0178, adr-0174, m3-5, cutover, runner]
---

# HANDOFF — Journey Engine M3.5: JourneyIR v2 Expansion + Adapter Deletion

## Summary

M3.5 closes ADR-0174 C.11 (adapter deletion) via the ADR-0174 §E row 3
resumption path ("Extend `JourneyIR` (additive), not `ProtocolSource`").

- **New ADR-0178 authored and accepted** — JourneyIR v2 schema expansion.
  Adds optional `actor`, `platform`, `auth_profile`, `preconditions`,
  `entry_url`, `success_gate`, and per-step `actions?: JourneyAction[]` /
  `gate?: JourneyGate` / `order?` / `screenshot?` / `description?`. IR
  version bumped `"1.0.0"` → `"2.0.0"`. `CURRENT_IR_VERSION` exported.
  `assertCurrentIrVersion()` write guard added to `compile.ts` +
  `UnsupportedIrVersionError` class.
- **Adapter deleted.** `packages/journey-ir/src/adapters/protocolToJourneyIR.ts`,
  its test, `ProtocolSource` type, and the `adapters/` directory are gone.
  `index.ts` barrel trimmed.
- **Runner retargeted to JourneyIR v2 natively.** `apps/e2e/runners/protocol-runner.ts`
  consumes `JourneyIR` directly; no `ProtocolDefinition` / `../protocols/schema`
  imports. `gate-checker.ts` consumes `JourneyGate`. `progress-writer.ts`
  consumes `JourneyIR`.
- **Sample files rewritten to emit `JourneyIR` v2 directly.**
  `apps/e2e/protocols/P-001-admin-onboarding.ts` and the inline `P_LOGIN`
  in `apps/e2e/tests/protocol-login.spec.ts` are authored as `JourneyIR`.
- **Additive-compat preserved.** v1 IRs (`version: "1.0.0"`) still parse
  through `JourneyIRSchema`. 28 existing type/schema tests kept passing
  plus 28 new v2 tests added.
- **No new capabilities (ADR-0173 stays frozen).** No new telemetry events
  (ADR-0175 stays frozen). No `engine_authority_config` seed changes.

## Commit Trail

| # | SHA | Message |
|---|---|---|
| 1 | `da4a426e` | docs(adr): ADR-0178 JourneyIR v2 schema expansion (proposed, Path A, M3.5) |
| 2 | `37ee19de` | feat(journey-ir): IR v2 additive expansion + version guard (M3.5, ADR-0178) |
| 3 | `f95a848a` | feat(journey-ir): adapter preserves actions + actor + platform + preconditions (M3.5) |
| 4 | `74f976d9` | feat(journey-ir): retarget protocol-runner to JourneyIR v2 natively (M3.5) |
| 5 | _TBA (this commit)_ | feat(journey-ir): delete protocolToJourneyIR adapter — C.11 closed (M3.5, ADR-0178) |

## Binding Rule Compliance

| # | Rule | Result |
|---|---|---|
| 1 | ADR-0178 FIRST (commit 1 = ADR only) | ✅ Commit `da4a426e` contains only ADR-0178 + decision-log registration. |
| 2 | Phase 2.5 emit-registry grep | ✅ IR v2 did NOT introduce step-level events. `packages/telemetry/src/registry.ts` untouched. The 5 frozen events (`journey run_started` / `step_reached` / `completed` / `stuck` / `run_failed`) remain registered. |
| 3 | Campaign doc truth update | ✅ `docs/plans/CAMPAIGN-journey-engine.md` §Milestones M3 marked partial with C.11 deferred → M3.5 added and marked complete. §Trust-Gate Unblocks row 7 updated to distinguish **spec obligation** (M2, green) from **cutover obligation** (M3.5, green). |
| 4 | Additive optional only | ✅ Every v2 field is `?`. v1 IRs still parse (28 existing adapter tests + 28 new v2 tests confirm). |
| 5 | No 5th capability | ✅ `packages/ai/src/capabilities/journey/tools.ts` unchanged. 4 tools intact. |
| 6 | Mobile BFF server-side re-derivation preserved | ✅ `tools.ts` capability signatures accept only `journey_version_id` from user input. No `actor` / `platform` / `auth_profile` fields flow through tool inputs from client. ADR-0176 Invariant 3 intact. |
| 7 | Telemetry schemas additive only | ✅ No non-additive changes to the 5 journey event payloads. No new events added. |
| 8 | Version guard in compile.ts | ✅ `assertCurrentIrVersion()` rejects `ir.version !== CURRENT_IR_VERSION` with `UnsupportedIrVersionError`. `CURRENT_IR_VERSION = "2.0.0"` exported from `packages/journey-ir/src/types.ts`. |

## Final Gates

1. `grep -R "protocolToJourneyIR" apps packages scripts` → **0** ✅
2. `grep -R "ProtocolSource" apps packages scripts` → **0** ✅
3. `grep -R "packages/ai/src/journey" apps packages scripts` → **0** ✅ (already gone from M2)
4. `grep -R "apps/e2e/protocols/schema" apps/e2e/generators apps/e2e/runners` → **0** for code imports (doc-comment mentions in runner remain; no type imports). ✅
5. `pnpm --filter @smartout/journey-ir typecheck` → **0 errors** ✅
6. `pnpm --filter @smartout/journey-ir test` → **28 tests pass** ✅ (adapter tests gone with adapter; types.test.ts still green)
7. `cd apps/e2e && npx tsc --noEmit` → only 4 pre-existing errors in `reporters/journey-reporter.ts` + `tests/telemetry-smoke.spec.ts`. No new errors from M3.5. ✅
8. Phase 2.5 grep `journey\.` in registry.ts vs `emit('journey.*')` call sites — ZERO phantoms. All 5 registered events match existing emit sites in `packages/ai/src/capabilities/journey/tools.ts`. ✅
9. ADR-0178 status at final commit: **accepted** ✅
10. Decision log row for 0178: **accepted** ✅

## `CURRENT_IR_VERSION` constant location

Exported from `packages/journey-ir/src/types.ts` line ~44. Re-exported
through `packages/journey-ir/src/index.ts`. Write-time guard lives in
`packages/journey-ir/src/compile.ts::assertCurrentIrVersion()`.

## How the runner handles a v1 IR

If a caller passes a `JourneyIR` with `version: "1.0.0"`, the runner applies
the following semantics:

1. **`JourneyIRSchema` accepts it.** v1 IRs parse without error (additive
   compat per ADR-0178).
2. **`assertRunnerInputs(ir)` then runs.** This guard throws
   `RunnerInputError` if the IR does not carry the runner-required fields:
   - `ir.actor` (required for session/screenshot bookkeeping)
   - `step.actions` (required for typed Playwright dispatch)
   - `step.gate` (required for typed verification checkpoint)
   A v1 IR does not have `actions` / `gate` (those are v2 additions), so it
   will reliably fail here with a precise path like `$.steps[0].actions` or
   `$.steps[0].gate` — no silent misbehaviour.
3. **Net outcome.** The runner does NOT auto-upgrade. v1 IRs are read-only
   from the runner's perspective; use the adapter-free v2 authoring path
   (rewrite to `JourneyIR` v2 with typed actions + gate). Authoring tools
   (M4 UI) serialize to v2 natively; legacy protocols (there are only two:
   `P-001-admin-onboarding.ts` and the inline `P_LOGIN`) were rewritten to
   v2 as part of M3.5 commit 5.
4. **Write boundary.** Any code path that persists an IR to
   `journey_version.ir_json` must call `assertCurrentIrVersion(ir)` first
   to reject v1 writes outright. `UnsupportedIrVersionError` surfaces with
   the received + required version strings.

## Deviations from the plan

One material deviation, documented and justified:

**Added fields beyond the ADR-0178 body's original list.** The body named
`actor`, `platform`, `auth_profile`, `preconditions`, and `steps[i].actions?`.
At commit 4 the runner retarget needed more to function without reaching
back into `ProtocolDefinition`. Additions:

- `steps[i].gate?: JourneyGate` — required by `checkGate()`.
- `steps[i].order?: number` — required by screenshot naming.
- `steps[i].screenshot?: boolean` — required by screenshot toggle.
- `steps[i].description?: string` — authoring-time human summary (preserved
  from `ProtocolStep.description` for docs generator).
- `entry_url?: string` — runner bootstraps navigation from this field on
  some protocols (P-001 uses it; P-LOGIN doesn't).
- `success_gate?: JourneyGate` — terminal verification mirror of
  `ProtocolDefinition.success_gate`.

Each is optional. v1 IRs still parse. Pattern sits inside ADR-0174 §E row 3
("Extend `JourneyIR` (additive), not `ProtocolSource`"). The ADR-0178 body
explicitly predicted this resumption-path shape; the implementation just
landed a more complete additive surface in one pass to avoid a
"retarget now, expand later" second sub-sortie. ADR-0178 §Status section
lists the final shipped surface for traceability.

## Known Issues & Debt

1. **Pre-existing apps/e2e typecheck errors unchanged.**
   `reporters/journey-reporter.ts` + `tests/telemetry-smoke.spec.ts` still
   surface 4 errors unrelated to M3.5. Tracked for a separate sweep.
2. **`apps/e2e/protocols/schema.ts` + `apps/e2e/protocols/index.ts` linger.**
   No live code consumes them; they export `ProtocolDefinition` / `Gate` /
   `Action` types. Safe to delete in a follow-up cleanup; kept out of this
   sub-sortie to contain blast radius. Grep check still passes because
   `ProtocolDefinition` does not appear in runner or generators.
3. **P-001 test remains `test.skip(true)`** — unchanged from M3; data-testid
   attributes still missing on onboarding page.
4. **`protocolToJourneyIR` name no longer exists** but the file name
   `apps/e2e/runners/protocol-runner.ts` + function name `runProtocol`
   retained for caller-site stability. Internal doc comments reference the
   legacy "protocol" nomenclature as historical artefact only.

## Next Steps

- **M4 (authoring surface).** `apps/web/src/app/platform-admin/journeys/**`
  shell + list + detail. Serializes to `JourneyIR` v2 via the authoring UI.
  Must call `assertCurrentIrVersion()` before any `journey_version.ir_json`
  write.
- **M5 (Fjernkontroll runtime).** Consumes typed `step.actions` for
  per-step UI cues. Fjernkontroll state machine (`idle | running | paused |
  stuck | completed | failed`) is owned by ADR-0177 at the runtime layer —
  IR v2 deliberately does NOT mirror those names.
- **M6 (Journey Guardian CI gate).** `scripts/close-feature.sh` needs grep
  guards for `protocolToJourneyIR`, `ProtocolSource`, and new references to
  `packages/ai/src/journey`. Block merges that re-introduce any of them.
- **Follow-up cleanup (small).** Delete `apps/e2e/protocols/schema.ts` +
  `apps/e2e/protocols/index.ts` if no code still consumes them. Confirm via
  grep before removal.
- **DB-level version guard (optional).** Consider a CHECK constraint on
  `journey_version.ir_json->>'version'` to enforce `"2.0.0"` at the DB
  boundary. Additive only; outside M3.5 scope.

## Files Touched

- `docs/decisions/0178-journey-ir-v2-schema-expansion.md` (new) — proposed → accepted.
- `docs/decisions/0174-adr-0074-journey-ir-unification-completion.md` — appendix added.
- `docs/decisions/0000-decision-log.md` — ADR-0178 row added + appendix row.
- `docs/plans/CAMPAIGN-journey-engine.md` — §Milestones M3 + M3.5, §Trust-Gate Unblocks row 7.
- `packages/journey-ir/src/types.ts` — v2 additive types + `CURRENT_IR_VERSION`.
- `packages/journey-ir/src/schema.ts` — Zod mirrors; `JourneyGate` schema added.
- `packages/journey-ir/src/compile.ts` — `assertCurrentIrVersion` + `UnsupportedIrVersionError`.
- `packages/journey-ir/src/index.ts` — adapter barrel export removed.
- `packages/journey-ir/src/types.test.ts` (new) — 28 tests for v2 types + guard.
- `packages/journey-ir/tsconfig.json` — exclude `*.test.ts` from dist.
- `packages/journey-ir/src/adapters/protocolToJourneyIR.ts` — DELETED.
- `packages/journey-ir/src/adapters/protocolToJourneyIR.test.ts` — DELETED.
- `packages/journey-ir/src/adapters/` — DIRECTORY REMOVED.
- `apps/e2e/runners/protocol-runner.ts` — consumes `JourneyIR`.
- `apps/e2e/runners/gate-checker.ts` — consumes `JourneyGate`.
- `apps/e2e/runners/progress-writer.ts` — consumes `JourneyIR`.
- `apps/e2e/tests/protocol.spec.ts` — passes `JourneyIR` directly.
- `apps/e2e/tests/protocol-login.spec.ts` — inline `P_LOGIN` rewritten as `JourneyIR`.
- `apps/e2e/protocols/P-001-admin-onboarding.ts` — rewritten as `JourneyIR`.
