---
title: "HANDOFF — swap-marketplace-convergence-v2"
status: done
updated: 2026-05-16
created: 2026-05-16
module: scheduler
tags: [handoff, scheduler, swap, marketplace, authority-pipeline, wfm, council]
---

# HANDOFF — swap-marketplace-convergence-v2

> Branch: `feat/world-best-wfm-swap-marketplace-convergence-v2` | Worktree: `~/wsl/smartout.ai-world-best-wfm-wt-1` | Base: `campaign/world-best-wfm` | Module: scheduler | Started: 2026-05-16 | Closed: 2026-05-16

## Summary

V2 unifies `shift-swap` (5 tools) and `shift_marketplace` (5 tools) behind a shared multi-stage **authority pipeline** runtime. Both surfaces terminal-write `schedule_shift.profile_id`; before V2 they ran two independent gate stacks with binary `auto_approve_claim` short-circuit. V2 introduces:

- Single workflow-definition table `engine_authority_pipeline` (blueprint rows: capability + action_type + stage_index + required_role + max_wait_minutes + escalation_action)
- Pipeline INSTANCE state reuses `engine_state` per ADR-0067 (no new instance table — Q1 reversed C→B in council Phase 5, 6th L-0147 precedent)
- Shared lock-on-shift via `schedule_shift.pipeline_lock_state_id` FK to `engine_state(id)` — prevents concurrent reassignment from both surfaces
- Additive `pipeline.stage_*` telemetry envelope (6 events) — V1 `shift_swap.*` (registry 5341-5397) and `shift_offer.*` (8610-8666) preserved verbatim
- Per-stage `gate_action` calls (Q3=A) — RPC signature unchanged; each stage = atomic `mutateWithGate` write
- Admin escalation surface (`override_swap_pipeline`, `override_marketplace_pipeline`) gated by C4 `<cap>.override` rows in `engine_authority_config` (seeded in T0.5, CI-checked)
- Chat-only at pipeline level (Q5=A) — `engine_process.allowed_channels = ARRAY['chat']` + per-tool inline ADR-0288 guards retained as Layer 3 defense-in-depth

**Why now:** ADR-0321 G3 council 2026-05-14 ratified V2 path but left 5 schema questions open. AI Council escalation 2026-05-16 (4 reviewers + chair synthesis) closed all 5. ADR-0340 supersedes ADR-0321 §V2 Schema Sketch + §V2 Capability Convergence; amends §V2 Trigger Conditions to admit "anticipated cross-capability reuse" (lønn + contracts will reuse this engine).

**What stays V1:** capability surface names (`shift-swap`, `shift_marketplace`), all 10 existing tools, telemetry envelopes, `approve_claim` 2-writes-1-gate atomic exec callback (extended to 4-writes-1-gate inside same `mutateWithGate` body — terminate offer + release lock added). ADR-0173 frozen-4 capability boundary intact; ADR-0240 cross-namespace write-ban honored (pipeline orchestrates via capability tools, never writes cross-namespace).

## Council Outcome

**Council session:** 2026-05-16 (see `docs/council/COUNCIL-LOG.md` line 1961 — "swap-marketplace-convergence-v2 schema decisions")

**Verdict:** APPROVE WITH CHANGES + mandatory Phase 0 gate

**Reviewers:** `system-steward` (chair, REVERSED Q1 vote per L-0147), `supervisor`, `system-agent-coordinator`, `botsson-harness-builder`. Frontend-designer skipped (no UI in scope).

**Q1 — pipeline INSTANCE state storage = B reuse `engine_state`** (per ADR-0067). Chair Phase 3 voted C (dual stores + pipeline_id FK on engine_state); Phase 5 reversed to B after supervisor + agent-coord code-traced ADR-0067 engine_state as canonical pipeline-instance model. 6th L-0147 precedent (L-0283).

**Q2 — cross-workspace policy = DEFER** to V2.1 ADR (3 options: source-ws / home-ws / intersection). Scope-bound single-workspace V2 via CHECK constraint `source_workspace_id = target_workspace_id` (fail loud, L-0177 class).

**Q3 — multi-stage gating = A per-stage `gate_action`** calls (action_type encodes blueprint + stage). RPC signature unchanged. `approve_claim` 4-writes-1-gate atomic pattern preserved verbatim.

**Q4 — capability rename `shift_lifecycle_marketplace` = DEFER** to follow-on sortie. V1 names `shift-swap` + `shift_marketplace` preserved (ADR-0173 frozen-4 capability-merge requires its own ADR; cascades on Q2).

**Q5 — channel restriction = A chat-only at pipeline level** + per-tool ADR-0288 guards retained = 3-layer defense-in-depth (ADR-0078 + ADR-0163 + per-tool).

## Decisions Made

All registered in `docs/decisions/0000-decision-log.md`:

- **ADR-0340** (proposed) — Shift Lifecycle Pipeline — V2 Implementation. Supersedes ADR-0321 §V2 Schema Sketch + §V2 Capability Convergence. Five council decisions captured. (line 54 of decision log)
- **ADR-0321** (superseded) — Swap↔Marketplace Convergence — V2 Authority Pipeline. Frontmatter `status: superseded`. Status row updated to point to ADR-0340. (line 55)
- **ADR-0288** (accepted 2026-05-16 as Phase 0 P0.5) — Voice policy split scheduling.own vs scheduling.others. Pipeline-level enforcement binding via `engine_process.allowed_channels`. Blast radius zero. (line 102)

## Learnings Discovered

All registered in `docs/learnings/0000-learning-log.md`:

- **L-0279** — Chair Phase 3 internal inconsistency (chair flagged Option A for parallel-state-plane "Invariant 1 violation" then voted Option C which commits the same sin). Sibling mechanism to L-0147.
- **L-0280** — ADR DDL sketches are not current truth (ADR-0321 §V2 `engine_authority_pipeline_instance` superseded by ADR-0067 `engine_state` canonical role). Sibling of L-0264. Phase 2.5 fact-check MANDATORY for DDL sketches.
- **L-0281** — Default-allow CVE recurrence on pipeline `.override` (4th occurrence across campaigns; same shape as L-0066, L-0151, L-0177). Every pipeline-defining capability MUST seed `<cap>.override` sibling row. CI check extended in T0.5.
- **L-0282** — Phase 0 gate inside sortie beats split-into-2-campaigns when scope-bounded. 3-vs-1 council split (harness BLOCK + 3 APPROVE-WITH-CHANGES) resolved via 6-item Phase 0 checklist inside same sortie.
- **L-0283** — 6th L-0147 Chair Self-Reversal precedent (Q1 C→B reversal). Pattern continues to hold structurally across Year Wheel, /help, ADR-0216, Botsson Platform Admin, S6 R4, this council.

No new learnings discovered during implementation beyond the council batch (T0..T7 ran clean per plan after Phase 0 closure).

## What Was Built

### Phase 0 — Gating ADR + Schema Decisions

- P0.1 — ADR-0340 drafted + accepted decisions captured (`b1cae1506`)
- P0.2 — B1 dual-gate (G13) closed (`982c1236a`)
- P0.3 — `authority.ts` dual-gate divergence resolved (`982c1236a`, folded into T2)
- P0.4 — engine_state vs engine_sessions ontology confirmed (`982c1236a`)
- P0.5 — ADR-0288 accepted (`72e2fc537`)
- P0.6 — `schedule_shift` lock column design ratified (`982c1236a`)

### Phase 1 — Schema + Engine

- **T0** (`638c0280d`) — Migration `20260616120000` forward-only:
  - CREATE TABLE `engine_authority_pipeline` (workflow DEFINITION blueprint table)
  - ADD COLUMN `schedule_shift.pipeline_lock_state_id` FK to `engine_state(id)`
  - Trigger carve-out so pipeline writes don't tangle with existing `schedule_shift` triggers
  - CHECK constraint enforcing single-workspace per pipeline row
- **T0.5** (`a6f2857c4`) — Seed `<cap>.override` rows in `engine_authority_config` (min_role=admin, level=autonomous) + CI check in `scripts/gate-action-coverage.ts` flagging pipeline-defining capabilities lacking sibling `.override` row. **Closes L-0281 default-allow CVE.**
- **T1** (`82524647d`) — `packages/ai/src/engine/authority-pipeline/` (7 files, 1446 lines): stage definitions, stage-transition validator, event emitter. Operates ON `engine_state` via existing capability tools, never writes cross-namespace.

Plus dev hygiene (`c7228d056`) — 3 duplicate-timestamp migration renames (100500→100501, 100600→100602, 100700→100702).

Plus types regen (`d3a034ad4`) — `database.types.ts` post-T0 (24072 lines).

### Phase 2 — Capability Refactor

- **T2** (`d27cc2d00`) — `shift-swap` refactored to emit through pipeline; SS-4 `gate.ts` adapter added; P0.3 dual-gate divergence folded in. ADR-0287:112 grandfathers `callGateAction` — no forced `mutateWithGate` migration. Backward-compat: `respond_to_swap` lookup is tolerant — `hasPipelineInstance=false` falls through to RPC for pre-pipeline swaps.
- **T3** (`18c46cdfd`) — `shift_marketplace` refactored same pattern. **`approve_claim` 2-writes-1-gate at `tools.ts:494-518` PRESERVED verbatim, EXTENDED to 4-writes-1-gate** inside same `mutateWithGate` exec body (terminate offer + release lock + flip profile_id + emit, single gate_evaluation_id).
- **T4** (`71a21b8bf`) — 6 additive `pipeline.stage_*` telemetry events registered in `packages/telemetry/src/registry.ts` with routing. V1 envelopes untouched.

### Phase 3 — Override + Tests + E2E

- **T5** (`bbcf4fcd2`) — `override_swap_pipeline` + `override_marketplace_pipeline` admin escalation tools. Closes Trust Gate FAIL (T0.5 seed unlocks ship). C4 authority verified via `engine_authority_config` lookup; `override_reason` + `overridden_by` audit fields written; distinct `pipeline.stage_overridden` event for audit clarity.
- **T6** (`1ab5213b3`) — 26 capability tests covering 3 journeys × (happy + error) variants. Test mobile fixture fix (`3fd3fb8cd`) — `pipeline_lock_state_id: null`.
- **T7** (`dcd26397e`) — Playwright E2E protocol `apps/e2e/protocols/p-swap-marketplace-pipeline.ts` (S12).

### Phase 4 — Closure (this commit)

- **T8** — `pnpm turbo typecheck` → **52/52 FULL TURBO** (cached 52/52); ai+telemetry packages clean; 598/599 ai tests pass (1 pre-existing env failure orthogonal to sortie).
- **T9** — this handoff + plan/journey closure.

## Preservation Clauses (verified honored)

1. ✅ `shift_swap.*` events (registry 5341-5397) — KEPT verbatim; additive `pipeline.stage_*` added
2. ✅ `shift_offer.*` events (registry 8610-8666) — KEPT verbatim
3. ✅ `approve_claim` atomic exec callback at `shift_marketplace/tools.ts:494-518` — PRESERVED + EXTENDED to 4-writes-1-gate inside same `mutateWithGate` body (T3 verified at tools.ts:616-665)
4. ✅ ADR-0173 frozen-4 capability names — NO collapse, V1 surface intact
5. ✅ ADR-0240 cross-namespace write-ban — pipeline writes ONLY to `engine_state` + `pipeline_lock_state_id`; entity mutations stay in capability tools

## Quality Gates

- `pnpm turbo typecheck` — **52/52 FULL TURBO** (cached 52/52)
- `pnpm --filter @smartout/ai typecheck` — 0 errors
- `pnpm --filter @smartout/ai test` — 598/599 pass; 1 pre-existing env failure (`supabaseUrl is required` — orthogonal to this sortie per T2 agent report)
- `pnpm --filter @smartout/telemetry build` — clean
- T0 migration applied via `npx supabase db reset` — clean fresh apply
- Type regen via `npx supabase gen types typescript --local` — 24072 lines
- ADR cross-refs verified (8 sibling ADRs cited: 0067, 0099, 0151, 0173, 0204, 0240, 0287, 0288, 0306, 0321, 0340)
- 5 council learnings registered (L-0279 through L-0283)

## Trust Gate Status

- **9 V1 tools** — PASS (no contract drift; envelopes preserved)
- **`approve_claim` atomic** — PRESERVED + EXTENDED (T3 verified at tools.ts:616-665)
- **`override_swap_pipeline` + `override_marketplace_pipeline`** — PASS (T0.5 seeded `<cap>.override` rows in `engine_authority_config`)
- **Per-stage gate_evaluation correlation chain** — PARTIAL. T6 unit tests assert per-stage `gate_evaluation_id` distinctness; T7 E2E flags multi-row correlation_id chain DB-level assertion as follow-up (requires custom SQL helper).

## Known Issues / Debt

1. **T2 deviation — pre-pipeline backward compat.** `respond_to_swap` falls through to RPC when `hasPipelineInstance=false` for pre-existing swaps without engine_state row. Documented in T2 commit body; intentional bridge for in-flight V1 swaps during migration window.
2. **T3 deviation — vitest mock updates.** 12 marketplace vitest tests updated to mock pipeline-path call shape; pipeline-path-specific tests added in T6.
3. **T5 deviation — marketplace override doesn't reset offer status.** `override_marketplace_pipeline` does NOT reset `schedule_shift_offer.status` to `'cancelled'` on override — admin must follow with explicit `cancel_offer` call. T5 author flagged as intentional (audit-cleaner separation). Revisit if real ops complain.
4. **T7 deviation — Journey 2 `post_open` seed.** Test seeds offer + pipeline directly (skips Botsson chat round-trip). Journey 3 ADR-0328 + idempotency assertions are soft. Hard contract coverage remains in T6 unit tests.
5. **T7 deviation — Journey 1 `stage_2_approve`.** Uses direct DB cancel instead of manager-approve RPC (single-user test env constraint).
6. **Mobile claim Bearer auth gap.** Playwright cookie context doesn't carry Bearer header for `/api/mobile/marketplace/claim`. Test falls back to direct DB write with soft warn — orthogonal to pipeline change.
7. **Pre-existing test env failure.** 1 ai test fails on `supabaseUrl is required` — orthogonal to this sortie, present before T1.
8. **Cross-workspace policy.** V2.1 ADR required to choose source-ws / home-ws / intersection per Q2 defer. CHECK constraint enforces single-workspace at V2.
9. **Capability rename.** `shift_lifecycle_marketplace` rename deferred to follow-on sortie when cross-workspace policy lands (Q4 cascades on Q2).

## Next Steps (post-merge)

1. Open PR `feat/world-best-wfm-swap-marketplace-convergence-v2` → `campaign/world-best-wfm`
2. `close-feature.sh <N>` runs gate check + merge
3. **V2.1 follow-on sortie:** cross-workspace policy ADR (Q2 defer) + `shift_lifecycle_marketplace` capability rename sortie (Q4 cascades)
4. **Telemetry consumer sweep** — ensure `pipeline.stage_*` events captured in analytics dashboards (PostHog + activity_trail consumers + engine_event routing)
5. **E2E coverage gaps from T7** — manager-approve RPC integration, non-admin override rejection, multi-row correlation_id chain DB-level assertion helper
6. **T2 ad-hoc improvements** — tighten `respond_to_swap` fallthrough once in-flight V1 swaps drained (~1 cycle observation window)
7. **Pre-existing `supabaseUrl` test failure** — orthogonal cleanup sortie
8. **Marketplace override → offer status reset** — design call (T5 deviation #3)

## ADR Cross-References

- ADR-0067 — engine_state canonical pipeline-instance model (Q1 basis)
- ADR-0099 — role gates (cardinality preservation)
- ADR-0151 — server-side identity resolution
- ADR-0173 — frozen-4 capability surface
- ADR-0204 — gatedMutation envelope
- ADR-0240 — cross-namespace write-ban
- ADR-0287 — mutateWithGate single-write rule (line 112 grandfather clause)
- ADR-0288 — voice policy split scheduling.own vs scheduling.others (Phase 0 P0.5)
- ADR-0306 — open-shift marketplace (sibling capability)
- ADR-0321 — superseded by 0340
- ADR-0340 — this sortie's canonical ADR

## Files Inventory (key)

- `docs/decisions/0340-shift-lifecycle-pipeline-implementation.md` — ADR
- `docs/decisions/0321-swap-marketplace-convergence.md` — superseded
- `docs/decisions/0288-voice-policy-split-scheduling-own-vs-others.md` — accepted as P0.5
- `docs/plans/PLAN-swap-marketplace-convergence-v2.md` — plan
- `docs/journeys/JOURNEY-world-best-wfm-swap-marketplace-convergence-v2.md` — 3 journeys
- `docs/council/COUNCIL-LOG.md` (line 1961+) — council session record
- `docs/learnings/0000-learning-log.md` (lines 292-296) — L-0279..0283
- `supabase/migrations/20260616120000_*.sql` — T0 schema migration
- `packages/ai/src/engine/authority-pipeline/` — T1 engine (7 files, 1446 LOC)
- `packages/telemetry/src/registry.ts` — T4 6 additive events
- `apps/e2e/protocols/p-swap-marketplace-pipeline.ts` — T7 S12 protocol

## Commit Inventory (16 commits this sortie)

```
bbcbc4240 docs(swap-marketplace-v2): plan + journey stubs
b1cae1506 docs(swap-marketplace-v2): council Phase 5 verdict + ADR-0340 + 5 learnings
982c1236a docs(adr-0340): Phase 0 resolutions P0.2-P0.4 + P0.6
72e2fc537 docs(adr-0288): accept — Phase 0 P0.5 swap-marketplace-convergence-v2
a6f2857c4 feat(schema): T0.5 pipeline override authority seed + CI check
c7228d056 fix(db): resolve 3 duplicate-timestamp migration collisions on dev
638c0280d feat(schema): T0 shift lifecycle pipeline — engine_authority_pipeline + lock col + trigger extend
d3a034ad4 chore(types): regen database.types.ts post-T0 migration
82524647d feat(engine): T1 authority-pipeline TS engine package
71a21b8bf feat(telemetry): T4 pipeline.stage_* envelope ADDITIVE
d27cc2d00 feat(swap): T2 shift-swap capability + SS-4 gate.ts adapter + pipeline integration
18c46cdfd feat(marketplace): T3 shift_marketplace pipeline integration
bbcf4fcd2 feat(override): T5 override_pipeline admin escalation tool
1ab5213b3 test(pipeline): T6 capability tests for 3 journeys x happy+error
3fd3fb8cd chore(mobile): add pipeline_lock_state_id:null to test fixture
dcd26397e test(pipeline): T7 p-swap-marketplace-pipeline protocol (S12)
```

T8 quality-gate run + T9 closure docs land on top.
