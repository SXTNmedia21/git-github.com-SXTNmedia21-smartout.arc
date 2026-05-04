---
title: "PLAN — journey-engine-honesty (Phase 0 remediation)"
status: in_progress
updated: 2026-04-23
created: 2026-04-23
module: journey-engine
tags: [plan, remediation, phase-0, phantom-capabilities, authority-loader, fjernkontroll]
---

# PLAN — Phase 0 Honesty Sub-Sortie

**Branch:** `feat/journey-engine-honesty` · **Worktree:** `~/dev/smartout.ai-journey-engine-wt-1` · **Base:** `campaign/journey-engine @ 74f7839c`

## Origin

This sub-sortie is **Phase 0** of the 2026-04-23 council remediation amendment (see `CAMPAIGN-journey-engine.md §REMEDIATION AMENDMENT`). The council (5/5 reviewers + 12/12 fact-check) classified the campaign status claim "M1–M3.5 complete, 7/7 unblocks closed" as **FALSE** and identified three defects not in any prior gap list. Phase 0 stops the bleeding before any new body-work begins.

## Mission

> **Make the shipped campaign state honest.** No shipped capability lies; per-capability authority is deterministic; Fjernkontroll state machine has exit edges.

Zero new features. Zero new capabilities. Pure remediation. All work must land in 1–2 days and is the blocking gate for Phase 1 (ADR acceptance).

## Scope — three independent tracks

### Track A — Neuter phantom capabilities (ADR-0196 Invariant 11 + L-0124)

**Problem:** `publishMissionTool` + `publishGuideTool` at `packages/ai/src/capabilities/journey/tools.ts:299-392` are skeletons. They emit `journey.run_started` and return `{ok:true, run_id, note:"S1.4 skeleton — ... lands in M4"}` without writing to `engine_missions` or producing MDX. Agent sees success; DB has nothing.

**Deliverables:**
1. Modify `execute()` of both tools to:
   - Keep the ADR-0134 `MISSING_CONTEXT` guard.
   - **Remove the `emit("journey run_started", ...)` call.**
   - Return `{ok:false, error:"not_implemented", message:"publish_mission body lands in Phase 3 per ADR-0194"}` (and equivalent for publish_guide).
2. Update `packages/ai/src/capabilities/journey/__tests__/journey.capability.test.ts:118-147`:
   - Change the `publish_mission` + `publish_guide` happy-path assertions from `parsed.ok === true` → `parsed.ok === false` + `parsed.error === "not_implemented"`.
   - Add test asserting no `journey.run_started` emit fires (verify via mock emit spy).
   - Keep the three `MISSING_CONTEXT` variant assertions unchanged.
3. Decision on `suggestTools` (`packages/ai/src/capabilities/journey/index.ts:45`):
   - Keep the tools in `suggestTools` (removing them would affect tool-selector shape unnecessarily during Phase 0). The `not_implemented` return is sufficient honesty; the LLM sees the error and can surface it to the user.

**Files:**
- `packages/ai/src/capabilities/journey/tools.ts`
- `packages/ai/src/capabilities/journey/__tests__/journey.capability.test.ts`

**Exit:**
- Grep confirms no `emit\(.*run_started` in `publishMissionTool` / `publishGuideTool` bodies.
- `pnpm --filter @smartout/ai test journey.capability` passes with updated assertions.
- Manual verification: invoking either tool returns `ok:false`.

### Track B — Authority loader full dotted-key preservation (ADR-0195 + L-0127)

**Problem:** `services/stage-engine/src/core/authority.ts:45-51` folds dotted capability keys (`journey.run_dev` etc.) to a base key (`journey`). The base-key level is "whichever row `.select()` returns first" — non-deterministic since the query lacks `ORDER BY`. `packages/ai/src/router/tool-selector.ts:67` reads `authorityConfig[capability.name]` = `authorityConfig["journey"]`, making per-tool visibility decisions from the non-deterministic base level. ADR-0176's deliberate 3× `suggest` + 1× `autonomous` seed is silently collapsed.

**Deliverables:**
1. `packages/ai/src/capabilities/types.ts`:
   - Extend `CapabilityName` union with dotted members: `| "journey.run_dev" | "journey.publish_mission" | "journey.publish_guide" | "journey.run_guided"`. Keep `"journey"` (legacy, mark `@deprecated` if convention allows).
2. `packages/ai/src/capabilities/journey/index.ts`:
   - For each tool entry in the `tools` array, ensure the `capability` field contains the dotted form (`"journey.run_dev"` etc.). Currently the tool's `capability` metadata is `"journey.run_dev"` etc. per tools.ts L.95/L.307/L.355/L.423 — verify this propagates to the registry.
3. `services/stage-engine/src/core/authority.ts:45-51`:
   - Preserve the full dotted key in `levels` map.
   - Delete the base-key fold ONLY for journey dotted keys (any key containing a `.`). Legacy single-word capabilities keep current behaviour.
4. `packages/ai/src/router/tool-selector.ts:67`:
   - Change lookup from `authorityConfig[capability.name]` → `authorityConfig[tool.capability]` (per-tool dotted). Confirm this compiles and downstream iteration still works.
5. Integration test:
   - New spec `apps/e2e/tests/journey-authority-per-tool.spec.ts` OR `packages/ai/src/__tests__/authority-loader.test.ts`.
   - Seed `engine_authority_config` with 4 rows in deliberately OUT-OF-ORDER sort (e.g. run_guided first, run_dev last).
   - Assert tool-selector returns `run_guided` at `autonomous` + the three others at `suggest`.
   - Without the fix, this test fails ~50% of the time (non-deterministic). With the fix, always green.

**Files:**
- `packages/ai/src/capabilities/types.ts`
- `packages/ai/src/capabilities/journey/index.ts`
- `services/stage-engine/src/core/authority.ts`
- `packages/ai/src/router/tool-selector.ts`
- New test file

**Exit:**
- `pnpm turbo typecheck` green after type union change.
- Integration test passes deterministically across 10 consecutive runs.
- Grep confirms no consumer reads `authorityConfig["journey"]` (base form) for journey capabilities.

### Track C — Fjernkontroll state-machine exit edges (ADR-0177 amendment)

**Problem:** `apps/web/src/components/journey/useFjernkontrollMachine.ts` implements all 6 ADR-0177 states (`idle | running | paused | stuck | completed | failed`) but `stuck` and `failed` have no outbound transitions. A user whose run times out or fails is UI-locked. No retry, no skip, no reset.

**Deliverables:**
1. `apps/web/src/components/journey/useFjernkontrollMachine.ts`:
   - Add transitions:
     - `{ state: 'stuck', event: 'RETRY' } → 'running'` (re-enter step)
     - `{ state: 'stuck', event: 'ABANDON' } → 'idle'` (terminal abandon)
     - `{ state: 'failed', event: 'RESET' } → 'idle'` (fresh start)
   - Emit telemetry on each exit (registry keys already exist per ADR-0175; reuse `journey.step_reached` with a `recovery` property OR add minimal new event — prefer reuse to avoid ADR-0175 scope expansion).
   - Preserve ARIA live announcement on state change.
2. `apps/web/src/components/journey/FjernkontrollActions.tsx`:
   - When state is `stuck`: render "Prøv igjen" (Retry, calls RETRY) + "Avslutt" (Abandon, calls ABANDON) buttons.
   - When state is `failed`: render "Start på nytt" (Reset, calls RESET) button.
   - Buttons use Nordic Split tokens only. Lucide icons (RotateCw for retry, X for abandon, Refresh for reset). ≥44pt touch targets. No hardcoded colors.
   - `useReducedMotion()` respected on any button-state animation.
3. Test `apps/web/src/components/journey/__tests__/useFjernkontrollMachine.test.ts` (create if missing):
   - Assert `stuck + RETRY → running`, `stuck + ABANDON → idle`, `failed + RESET → idle`.
   - Assert ARIA live text changes on each transition.

**Files:**
- `apps/web/src/components/journey/useFjernkontrollMachine.ts`
- `apps/web/src/components/journey/FjernkontrollActions.tsx`
- `apps/web/src/components/journey/__tests__/useFjernkontrollMachine.test.ts` (create)

**Exit:**
- `pnpm --filter @smartout/web typecheck` green.
- Unit test suite passes.
- Manual click-through on admin run page (`/platform-admin/journeys/versions/[journeyVersionId]/run`) confirms recovery buttons render + trigger transitions.

## Dependencies

- **Track A ⊥ Track C** — fully independent, dispatch parallel.
- **Track A → Track B** — both touch `packages/ai/src/capabilities/journey/index.ts`. Sequential. Track A first (smaller diff), Track B second (merge conflict-free).
- **Track B ⊥ Track C** — fully independent.

**Dispatch order:**
- Round 1 (parallel): Track A + Track C.
- Round 2: Track B (after Round 1 agent returns).

## Quality gates (Orchestrator-owned)

Before commit to `feat/journey-engine-honesty`:

1. **Typecheck:** `pnpm turbo typecheck` — zero errors.
2. **Tests:** journey capability tests + fjernkontroll tests + authority integration test — all green.
3. **Campaign invariants 11/12/13:** manual spot-check.
4. **Close-feature Journey Guardian dry-run:** `bash scripts/close-feature.sh --self-test` on the branch.
5. **Supervisor review** (AI council): verify diff matches ADR-0194/0195 (where applicable to Phase 0) and L-0125 test requirements.
6. **Gate approval:** if any reviewer flags, iterate — do not merge with warnings.

## Out of scope (do NOT do in this sub-sortie)

- Writing real `publish_mission` body (Phase 3).
- IR v2.1 schema extension (ADR-0194 acceptance in Phase 1).
- Mobile RN Fjernkontroll UI (Phase 4).
- Stuck detector step B-flip / step C-delete (Phase 3).
- N-C worker (not this worktree — separate campaign per CLAUDE.md §In-Scope).
- Seed-compile migration (Phase 2).

## References

- `docs/plans/CAMPAIGN-journey-engine.md §REMEDIATION AMENDMENT`
- ADR-0194 / 0195 / 0196 / 0197 (proposed, 2026-04-23)
- L-0124 / 0120 / 0121 / 0122 (2026-04-23)
- `docs/council/COUNCIL-LOG.md` 2026-04-23

---

## Sub-sortie journey documentation

Per CLAUDE.md §Feature closure gates, a journey file is required. See `docs/journeys/JOURNEY-journey-engine-honesty.md` (created alongside this plan).

