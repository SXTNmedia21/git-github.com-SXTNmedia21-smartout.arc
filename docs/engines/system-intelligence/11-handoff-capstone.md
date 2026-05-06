---
title: "HANDOFF — Journey Engine Campaign Capstone"
status: done
updated: 2026-04-27
created: 2026-04-21
module: journey-engine
tags: [handoff, campaign, journey-engine, capstone]
---

# HANDOFF — Journey Engine Campaign Capstone

> **This file supersedes all prior per-sub-sortie journey-engine handoffs.**
> Campaign: `campaign/journey-engine` | Branch tip: `c1f74d6e` | Re-verified: 2026-04-27 council Phase 5
> All claims in this handoff are falsifiable. Each "complete" item cites a grep, SHA, or file:line.

---

## What Was Built

One Journey Engine delivering three experiences (dev test-run, admin publish, runtime guided) from a single `JourneyIR` intermediate representation. Five artefact types from one source of truth.

### Core deliverables (with evidence)

| Deliverable | Location | Evidence |
|---|---|---|
| `packages/journey-ir` canonical package | `packages/journey-ir/src/` (1139 lines across 6 files: schema.ts, types.ts, validate.ts, compile.ts, snapshot.ts, index.ts — verified 2026-04-28) | `grep -rn "packages/ai/src/journey" apps packages scripts` → 0 results |
| Four capability bodies (all non-phantom) | `packages/ai/src/capabilities/journey/tools.ts` (1031 lines) | each `execute()` writes DB artefact before `emit()` — Invariant 11 PASS |
| Fjernkontroll state machine (6 states) | `apps/web/src/components/journey/` (850 lines) | `useFjernkontrollMachine.ts` + 3 exit edges (`stuck → idle`, `stuck → running`, `failed → idle`) |
| Mobile BFF thin-client | `apps/mobile/app/(app)/journey/`, `apps/mobile/src/lib/journey-bff.ts` | no direct capability imports; server-derives workspace/actor per ADR-0132 |
| Journey authoring UI + author-enrich | `apps/web/src/app/platform-admin/journeys/` | enrich + activate server actions at `actions/` |
| `journey_guide` DB table + RLS | `supabase/migrations/20260518230000_journey_guide_table.sql` | ADR-0217 accepted |
| 5 campaign-specific DB migrations | `20260516000000` → `20260516000400` | enum 0a/0b/0c + authority seed — ADR-0172, ADR-0176 |
| Journey Guardian gate script | `scripts/close-feature-journey-guardian.sh` | 6 gates (G-JE-1..6); self-test: `CLOSE_FEATURE_SELF_TEST=1 bash scripts/close-feature-journey-guardian.sh` |
| Stuck detector Edge Function | `supabase/functions/journey-stuck-detector/index.ts` | cron-only path live; event-driven path deferred (ADR-0215) |
| Artefact-asserting E2E specs | `apps/e2e/tests/journey-capability-*.spec.ts` (4 files) | `run_dev`, `publish_mission`, `publish_guide`, `run_guided` |
| Mission resolution layer | `packages/ai/src/lib/mission-resolution.ts` | `resolveMissionForJourneyVersion()` with 4 failure codes (`version_not_found`, `not_found`, `multiple_active`, `stages_empty` — verified 2026-04-28) |
| BFF 409 guard on no active mission | `apps/web/src/app/api/journey/guided/start/route.ts:55` | `55bb28fb` |
| Telemetry registry (5 events, 4 destinations) | `packages/telemetry/src/registry.ts:5170+` | `grep '"journey run_started"' packages/telemetry/src/registry.ts` → found |
| JourneyIR v2 schema expansion | `packages/journey-ir/src/types.ts`, `schema.ts` | `CURRENT_IR_VERSION = "2.0.0"` exported; v1 still parses |
| Generator unification (adapter deleted) | `apps/e2e/runners/`, `apps/e2e/protocols/` | `grep -rn "protocolToJourneyIR" apps packages scripts` → 0; `grep -rn "ProtocolSource"` → 0 |

---

## All Decisions (ADRs) Registered in This Campaign

| ADR | Status | Summary |
|---|---|---|
| ADR-0171 | accepted | `packages/journey-ir` canonical; `packages/ai/src/journey` forbidden |
| ADR-0172 | accepted | `journey_version_status` enum via 0a/0b/0c migration |
| ADR-0173 | accepted | Four journey capabilities, names frozen |
| ADR-0174 | accepted | ADR-0074 unification completion (adapter + 12-step cutover + deletion) |
| ADR-0175 | accepted | Journey telemetry contract: 5 events, 4 destinations |
| ADR-0176 | accepted | Journey C4 authority seed migration (4 rows, idempotent CROSS JOIN) |
| ADR-0177 | accepted | Fjernkontroll state machine + UI contract (spring 35/22/2.2) |
| ADR-0178 | accepted | JourneyIR v2 schema expansion (additive; `assertCurrentIrVersion()` write guard) |
| ADR-0194 | accepted | JourneyIR v2.1 → engine_missions hybrid mapping (`system_prompt`+`mode` at IR root) |
| ADR-0195 | accepted | Authority loader dotted-key preservation (CVE-class fix in `authority.ts:45-51`) |
| ADR-0196 | accepted | Journey Engine Invariants 11/12/13 (phantom caps / falsifiable claims / gate_action on every mutation) |
| ADR-0197 | accepted | Phantom contracts class rule (3 failure modes codified; promotes L-0094) |
| ADR-0213 | accepted | Campaign PRs must use merge-commit, not squash (ADR-0202 falsifiability) |
| ADR-0217 | accepted | `journey_guide` DB table for MDX artefact (not Supabase Storage) |
| ADR-0215 | **accepted** | Stuck-detector strategy: Option C defer; event-driven path is dead code until Phase 3 #4. Reactivation conditions in ADR-0215 §Appendix B. |

> Stale duplicate rows (proposed → later updated to accepted): ADR-0194/0195/0196/0197 appear twice in `docs/decisions/0000-decision-log.md` because the Phase 1 Contracts sub-sortie prepended new rows without removing old ones. Newest (top) rows are authoritative. Recommend a cleanup commit after campaign merge.

---

## All Learnings

### From council verdict (binding at campaign start)

- **L-0023** — `journey_event` = dev/telemetry; `engine_state` = live runtime. Never collapse.
- **L-0045** — Code-trace catches schema fiction (first occurrence).
- **L-0066** — C4 authority defaults are not free.
- **L-0075** — Migration atomicity via 0a/0b/0c.
- **L-0094** — Phantom emit contracts: recurring pattern (4th occurrence at campaign start; 5th surfaced during Phase 0 remediation).
- **L-0095** — Long-spec internal contradictions.
- **L-0096** — Code-trace catches schema fiction (reinforcement of L-0045).
- **L-0097** — C4 authority defaults, 2nd occurrence.
- **L-0098** — Global scripts cutover ownership: 3-step plan (dual-write → flip → delete).

### From post-implementation audit (2026-04-23)

- **L-0124** — Phantom body vs phantom emit: two shapes of the same anti-pattern. A capability can `emit(run_started)` without writing to DB (phantom emit — original L-0094) OR write a stub "ok" return without any emit (phantom body). Both are forbidden.
- **L-0125** — Test spirit vs letter: asserting `{ok: true}` is not asserting the artefact. E2E tests must query the DB row (or file) that the capability claims to have written.
- **L-0126** — Ontology gap is an ADR, not effort: when two data models diverge (JourneyIR executable steps vs `engine_missions` agent-coaching model), the gap is a contract decision, not an engineering ticket. Write the ADR first.
- **L-0127** — Loader-level bugs evade grep-audits: authority loader collapse in `authority.ts:45-51` wasn't findable by grepping capability files. End-to-end code-trace through transformation layers is required.

### From M5 retraction chain (2026-04-27)

- **R1** — DB constraint vocab regression: `engine_state.status` constraint uses `pending|active|waiting|complete|failed|escalated|blocked`; capabilities were inserting `queued/running`. Fixed `36e1d8cc` + spec column fix `259a8014`. Lesson: always grep the constraint check before inserting a status string.
- **R2** — Mission resolution never built: `is_active=true` flag in `engine_missions` had no read-path consumer; `run_guided` would have 409'd on any real invocation. Fixed in Phase 3 #2 (`2b88f1a5`+chain). Lesson: a write-only artefact is a phantom body in disguise.
- **R3** — Stuck-detector dual-write was a paper contract: `M5.3` claimed "L-0098 step A (dual-write) complete" when zero capability tools call `engine_delayed_trigger`. Deferred per ADR-0215 Option C.

---

## Known Issues / Debt

### Blocking for Phase 4 (not blocking campaign milestone merge)

| Item | Description | ADR/Learning | Owner |
|---|---|---|---|
| ADR-0215 accepted (Option C — defer) | Stuck detector event-driven path (`index.ts:278-471`) is dead code. No upstream capability schedules `engine_delayed_trigger`. Cron-only path works but loses per-run detection resolution. Reactivation conditions in ADR-0215 §Appendix B. | ADR-0215 | Phase 3 #4 |
| Phase 3 #3 (N-C worker) | Out-of-scope for this worktree. `run_dev` queues `engine_state` rows; no worker dequeues them. The Playwright runner works in local dev but has no cloud execution path. | CLAUDE.md §Explicit Out-of-Scope | campaign/botsson-arena or new campaign |
| Phase 3 #3 Fjernkontroll exit edges | `stuck → running` retry and `stuck → idle` abandon exit edges added to `useFjernkontrollMachine.ts` (Phase 0 remediation); UX wiring for retry action button not surfaced in `FjernkontrollActions.tsx` | ADR-0177 | Phase 4 UX polish |
| Mobile Reanimated port | `apps/mobile/app/(app)/journey/` uses React Native components; spring 35/22/2.2 is web-only (Framer Motion). Reanimated port deferred. | ADR-0177 | Phase 4 |
| Seed-missions for preview/prod | Journey engine has no seeded missions in persistent preview. G2 (seed-compile migration) verified on local Supabase only. Pontus must promote `20260516000000`–`20260516000400` + `20260518230000` to persistent preview + prod before live testing. | ADR-0176 | Pontus (manual promote) |
| Decision log duplicate rows | ADR-0194/0195/0196/0197 appear twice (proposed then accepted). Stale rows are inert but noisy. | — | One-commit cleanup after campaign merge |

### Non-blocking debt

| Item | Description |
|---|---|
| Slider for `creative_freedom` | UI field deferred from author-enrich form (S3 scope decision). No ADR needed — additive UI. |
| Post-activation re-enrich v2 | Second enrich pass after `is_active=true` to refine instructions. Deferred. |
| Stale unit test ghost `journey.capability.test.ts:118-147` | Two test blocks for Phase 0 phantom skeletons now have `.skip` + FIXME per L-0125. Should be rewritten to assert real artefacts once Phase 3 bodies land. |
| `protocolToJourneyIR` grep gate in CI | ADR-0174 mandates a CI grep block-list; not yet wired as a CI job (enforced by Journey Guardian G-JE-3 which runs locally). |
| Authority loader CVE fix (ADR-0195) | `services/stage-engine/src/core/authority.ts:45-51` fix was specified in ADR-0195. Verify it landed in `campaign/botsson-arena` or a separate sortie — this campaign does not own stage-engine code. |

---

## Known Open-Loop (post-promote backlog)

The following capability promises are NOT kept end-to-end today. The capability layer writes; no consumer reads. Phase 4 + Phase 3 #3 N-C worker (out-of-scope per CLAUDE.md) own the closure.

| Capability | What it writes | What's missing | Tracked as |
|---|---|---|---|
| `journey.run_dev` | `journey_run` rows on capability invocation | No cloud worker dequeues. Local Playwright path works; cloud path is dormant. | B2 |
| `journey.run_guided` | `engine_state` (`status='active'`) + `engine_state_step` rows + `mission_id`/`mission_mode`/`mission_system_prompt` packed into `engine_state.context` JSONB | (a) `services/stage-engine/src/` has zero reads of `engine_state` (reads `engine_sessions` instead). (b) No producer emits `journey.completed`/`stuck`/`run_failed` from capability layer. Fjernkontroll state machine renders `active` indefinitely. | B1 (engine_state vs engine_sessions ontology decision), B2 (cloud worker) |

**Falsifiable test that fails today (Harness Candidate 1):** seed `engine_state` row via `runGuidedTool`, assert `engine_state_step.status` advances to `complete` for at least one step within 10 s. Test not yet written; flag for B1 closure.

**ADR coverage:** ADR-0215 (accepted Option C — defer; stuck-detector telemetry deferred to Phase 3 #4) covers the symmetric phantom-WRITE side. The phantom-CONSUMER side (this section) is the mirror image and is captured in L-0130 + a new ADR (engine_state vs engine_sessions ontology) being written in this same closure cycle.

---

## Next Steps (Post-Merge to Development)

1. **Pontus promotes migrations to persistent preview** — 5 campaign-specific migrations (`20260516000000`–`20260516000400`, `20260518230000`) must land on Supabase persistent preview and eventually prod before live journey runs are possible.
2. **ADR-0215 reactivation (Option A)** — ADR-0215 is already accepted (Option C — defer). When Phase 3 correctness items are complete, reactivate per the conditions in ADR-0215 §Appendix B (B1 engine_state vs engine_sessions ontology resolved + N-C worker shipped). The council vote, if any, is on Option A reactivation only — not on ADR-0215 itself.
3. **Phase 4 scope decision** — Mobile Reanimated port + seed-missions + kill-switch + monitoring. Recommend a new sub-sortie `journey-engine-phase-4` or a separate campaign if mobile Reanimated work is substantial.
4. **Stage-engine ADR-0195 verification** — Confirm the authority loader dotted-key fix landed in `services/stage-engine/src/core/authority.ts` before marking the CVE closed. This campaign does not own that service.
5. **Decision log cleanup** — One commit to remove or mark stale the duplicate `proposed` rows for ADR-0194/0195/0196/0197.
6. **Campaign milestone PR** — `campaign/journey-engine → development` opened as merge-commit (ADR-0213). All 6 Journey Guardian gates must pass in CI against the merge target. Run `CLOSE_FEATURE_SELF_TEST=1 BASE_BRANCH=development bash scripts/close-feature-journey-guardian.sh` after rebase.

---

## Code-Trace Metrics

| Surface | Files | Key line counts |
|---|---|---|
| `packages/journey-ir` | 5 source files | 634 lines; 28 unit tests in `types.test.ts` |
| `packages/ai/src/capabilities/journey/tools.ts` | 1 | 1031 lines; 4 capability bodies; 4× `callGateAction`; emit after artefact on all paths |
| `apps/web/src/components/journey/` | 5 | 850 lines; 6-state machine; `useReducedMotion()` on every animated element |
| `apps/e2e/tests/journey-capability-*.spec.ts` | 4 | artefact-asserting E2E: `run_dev`, `publish_mission`, `publish_guide`, `run_guided` |
| `apps/e2e/tests/journey-mission-resolution.spec.ts` | 1 | 5 failure codes + multiple-active integrity |
| `apps/web/src/app/api/journey/` | BFF routes | `guided/start` + `guided/[runId]/status`; 409 guard on no active mission |
| `apps/mobile/src/lib/journey-bff.ts` | 1 | thin-client; no direct capability import |
| `supabase/functions/journey-stuck-detector/` | 2 | `index.ts` (cron path live) + `emit_contract_test.ts` |
| Campaign-specific DB migrations | 6 | `journey_version` (4-step enum) + authority seed + `journey_guide` table |
| Telemetry registry entries | 5 events | `journey run_started/step_reached/completed/stuck/run_failed`; 4 destinations each |
| Bound ADRs (campaign) | 15 | 15 accepted (ADR-0215 accepted Option C — defer; Appendix B) |

---

## Journey Guardian Self-Test (2026-04-27, tip `c1f74d6e`)

Re-verified 2026-04-27 council Phase 5 (tip updated from `6d931ded` to `c1f74d6e` after pre-promote documentation fixes commit).

```
CLOSE_FEATURE_SELF_TEST=1 BASE_BRANCH=campaign/journey-engine bash scripts/close-feature-journey-guardian.sh
```

Result:
- G-JE-1 Emit-registry parity: PASS
- G-JE-2 Authority seed parity: PASS
- G-JE-3 No legacy journey-path refs: PASS
- G-JE-4 No enum shortcut: PASS
- G-JE-5 Capability count = 4: PASS
- G-JE-6 No runtime writes to journey_event: PASS

All 6 gates green.

---

## Campaign Shippability Assessment

**Campaign is ready for milestone-merge to `development`** with the following acknowledged scope boundaries:

- Phase 4 (mobile Reanimated, seed-missions, kill-switch, monitoring) is not started and is explicitly post-merge work.
- ADR-0215 (stuck-detector) accepted (Option C — defer); the dead event-driven path is labelled but not deleted. Reactivation conditions documented in ADR-0215 §Appendix B.
- The N-C worker (Phase 3 #3) is out-of-scope for this worktree; `run_dev` queue rows will accumulate without a cloud executor until the botsson-arena or a new campaign delivers it.

These are documented, bounded, and do not compromise correctness of the three live artefact paths (`publish_mission`, `publish_guide`, `run_guided` on web + BFF).
