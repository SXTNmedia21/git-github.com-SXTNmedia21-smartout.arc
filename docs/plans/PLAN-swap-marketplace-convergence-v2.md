---
title: "Plan — swap-marketplace-convergence-v2"
status: ready_for_pr
updated: 2026-05-16
created: 2026-05-16
module: scheduler
tags: [plan, scheduler, swap, marketplace, authority-pipeline]
---

# Plan — swap-marketplace-convergence-v2

> Branch: `feat/world-best-wfm-swap-marketplace-convergence-v2` | Worktree: /home/sxtnl/dev/smartout.ai-world-best-wfm-wt-1 | Base: `campaign/world-best-wfm` | Module: scheduler | Started: 2026-05-16

## Goal

Unify `shift-swap` (5 tools) + `shift_marketplace` (5 tools) under shared multi-stage `engine_authority_pipeline`. Both surfaces terminal-write `schedule_shift.profile_id` — V2 introduces shared lock-on-shift + shared telemetry envelope + multi-stage gate (employee consent → manager approve → optional admin escalation). Reduces UX duplication, makes authority pipeline reusable for lønn/contracts.

## ADR refs

- ADR-0321 (accepted, baseline design) — swap↔marketplace convergence
- ADR-0287 — mutateWithGate (single-write rule)
- ADR-0133 — Compose = web only
- ADR-0288 — chat-channel-only for mutation tools
- ADR-0151 — server-side identity resolution
- ADR-0099 — role gates
- ADR-0309 — single-row bundle pattern (proposal envelope)

## Council Verdict (2026-05-16) — Phase 5 Synthesis

**APPROVE WITH CHANGES + mandatory Phase 0 gate.** ADR-0340 supersedes ADR-0321. See `docs/council/COUNCIL-LOG.md` 2026-05-16 entry.

**Q1 vote reversal:** chair Phase 3 voted C (dual stores + pipeline_id FK); Phase 5 REVERSED to B (reuse engine_state per ADR-0067). 6th L-0147 precedent (L-0283).

**Decisions ratified:**
- Q1 = B reuse `engine_state` (no new pipeline-instance table)
- Q2 = DEFER cross-workspace policy + CHECK source_ws=target_ws constraint
- Q3 = A per-stage `gate_action` (action_type encodes stage)
- Q4 = B preserve V1 capability names (rename = future sortie)
- Q5 = A chat-only at pipeline level + Layer 3 per-tool ADR-0288 inline guards retained

**Preservation clauses (non-negotiable):**
- `shift_swap.*` telemetry events (registry 5341-5397) — keep verbatim
- `shift_offer.*` telemetry events (registry 8610-8666) — keep verbatim
- `approve_claim` 2-writes-1-gate atomic pattern at `shift_marketplace/tools.ts:494-518` — preserve verbatim
- ADR-0173 frozen-4 capability names — no collapse
- ADR-0240 cross-namespace write-ban — pipeline orchestrates via existing capability tools, never writes cross-namespace

## Tasks

### Phase 0 — Gating ADR + Schema Decisions (MANDATORY before T0; 2-3 days)

- [x] **P0.1** — ADR-0340 drafted (Shift Lifecycle Pipeline Implementation, supersedes ADR-0321) ✅ shipped 2026-05-16 (`b1cae1506`)
- [x] **P0.2** — B1 dual-gate (G13) close-or-document-independence ✅ `982c1236a`
- [x] **P0.3** — authority.ts dual-gate divergence resolution ✅ `982c1236a` (folded into T2)
- [x] **P0.4** — engine_state vs engine_sessions ontology confirmation ✅ `982c1236a`
- [x] **P0.5** — ADR-0288 accept-or-remove decision ✅ `72e2fc537` (accepted)
- [x] **P0.6** — schedule_shift lock column design (NOT migration) ✅ `982c1236a` (design ratified; migration T0)

**Phase 0 exit gate:** ✅ All 6 P0 items closed. Pontus signed off. T0 proceeded.

### Phase 1 — Schema + Engine

- [x] **T0** — Migration `20260616120000` forward-only: CREATE TABLE `engine_authority_pipeline` (workflow DEFINITION table — NOT instance table; instance state reuses `engine_state` per Q1=B); ADD COLUMN `schedule_shift.pipeline_lock_state_id` FK to `engine_state(id)`; trigger carve-out; single-workspace CHECK constraint. ✅ `638c0280d`
- [x] **T0.5** — Seed `<cap>.override` rows in `engine_authority_config` (min_role=admin, level=autonomous). Extended `scripts/gate-action-coverage.ts` to flag pipeline-defining capabilities lacking sibling `.override` row. **Closes L-0281 default-allow CVE.** ✅ `a6f2857c4`
- [x] **T1** — Pipeline engine (`packages/ai/src/engine/authority-pipeline/`, 7 files, 1446 LOC): stage definitions, stage-transition validator, event emitter. Operates ON `engine_state` via existing capability tools, never writes cross-namespace. ✅ `82524647d`

### Phase 2 — Capability Refactor (parallel T2/T3/T4)

- [x] **T2** — Refactored `shift-swap` capability to emit through pipeline; SS-4 `gate.ts` adapter added; P0.3 dual-gate divergence folded in. ADR-0287:112 grandfathers `callGateAction`. Backward-compat: `respond_to_swap` tolerant lookup falls through to RPC for pre-pipeline swaps. ✅ `d27cc2d00`
- [x] **T3** — Refactored `shift_marketplace` capability same pattern. **`approve_claim` 2-writes-1-gate at `tools.ts:494-518` PRESERVED + EXTENDED to 4-writes-1-gate** inside same `mutateWithGate` body (terminate offer + release lock added, single gate_evaluation_id). ✅ `18c46cdfd`
- [x] **T4** — 6 additive `pipeline.stage_*` telemetry events registered in `packages/telemetry/src/registry.ts`. V1 envelopes `shift_swap.*` (5341-5397) + `shift_offer.*` (8610-8666) untouched. ✅ `71a21b8bf`

### Phase 3 — Override + Tests + E2E

- [x] **T5** — `override_swap_pipeline` + `override_marketplace_pipeline` admin escalation tools shipped. T0.5 seed unlocked ship (Trust Gate FAIL → PASS). C4 authority verified via `engine_authority_config`; `pipeline.stage_overridden` distinct event. ✅ `bbcf4fcd2`
- [x] **T6** — 26 capability tests: 3 journey paths × happy+error variants. Mobile fixture fix (`pipeline_lock_state_id: null`). ✅ `1ab5213b3` + `3fd3fb8cd`
- [x] **T7** — E2E protocol `apps/e2e/protocols/p-swap-marketplace-pipeline.ts` (S12) shipped. ✅ `dcd26397e`

### Phase 4 — Closure

- [x] **T8** — Type regen + full typecheck. ✅ 52/52 FULL TURBO (cached 52/52); ai+telemetry clean; 598/599 ai tests pass (1 pre-existing env failure orthogonal).
- [x] **T9** — HANDOFF + decision log entry for closure. ✅ `docs/HANDOFF-swap-marketplace-convergence-v2.md` written.

## Acceptance Criteria

- [x] Typecheck passes: `pnpm turbo typecheck` → 52/52 FULL TURBO
- [x] All 10 existing swap+marketplace tools still pass V1 contract tests (no breaking changes; T2+T3 vitest updates green)
- [x] New pipeline emits stage events per flow (`pipeline.stage_proposed` / `_consented` / `_approved` / `_rejected` / `_cancelled` / `_overridden` — 6 events additive)
- [x] Lock-on-shift prevents concurrent swap + marketplace claim on same `schedule_shift.id` (`pipeline_lock_state_id` FK)
- [x] Admin escalation path covered by capability test (T6) + E2E spec (T7 S12)
- [x] Decision log updated — ADR-0340 row registered (line 54), ADR-0321 marked superseded (line 55), ADR-0288 marked accepted (line 102)
- [x] All 3 user journeys written (`docs/journeys/JOURNEY-world-best-wfm-swap-marketplace-convergence-v2.md`)
- [x] HANDOFF written at closure (`docs/HANDOFF-swap-marketplace-convergence-v2.md`)

## Out of Scope

- Push-fanout notifications (deferred to marketplace mobile V2 sortie)
- Real-time WebSocket pipeline updates (V3, requires LiveKit data-channel infra)
- Cross-workspace swap (governance ADR needed first)
