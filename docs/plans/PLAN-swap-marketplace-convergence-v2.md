---
title: "Plan — swap-marketplace-convergence-v2"
status: draft
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

- [x] **P0.1** — ADR-0340 drafted (Shift Lifecycle Pipeline Implementation, supersedes ADR-0321) ✅ shipped 2026-05-16
- [ ] **P0.2** — B1 dual-gate (G13) close-or-document-independence
- [ ] **P0.3** — authority.ts dual-gate divergence resolution
- [ ] **P0.4** — engine_state vs engine_sessions ontology confirmation
- [ ] **P0.5** — ADR-0288 accept-or-remove decision
- [ ] **P0.6** — schedule_shift lock column design (NOT migration)

**Phase 0 exit gate:** All 6 P0 items closed. Pontus signs off. Then T0 proceeds.

### Phase 1 — Schema + Engine

- [ ] **T0** — Migration: seed `engine_process` blueprints (`shift_swap_lifecycle`, `marketplace_lifecycle`); CREATE TABLE `engine_authority_pipeline` (workflow DEFINITION table per ADR-0321 schema sketch, NOT instance table); ADD COLUMN `pipeline_locked_by uuid` on `schedule_shift` per P0.6 design. Forward-only.
- [ ] **T0.5** — Seed `<cap>.override` rows in `engine_authority_config` (min_role=admin, level=autonomous). Extend `scripts/gate-action-coverage.ts` to flag pipeline-defining capabilities lacking sibling .override row. **BLOCKS override_pipeline tool ship per L-0281.**
- [ ] **T1** — Pipeline engine (`packages/ai/src/engine/authority-pipeline/`): stage definitions, stage-transition validator, event emitter. Operates ON engine_state via existing capability tools, never writes cross-namespace.

### Phase 2 — Capability Refactor (parallel T2/T3/T4)

- [ ] **T2** — Refactor `shift-swap` capability to emit through pipeline (preserves V1 tool names; internal write delegates). ADR-0287:112 grandfathers `callGateAction` — no forced mutateWithGate migration.
- [ ] **T3** — Refactor `shift_marketplace` capability same pattern. **Preserve `approve_claim` 2-writes-1-gate atomic exec callback at tools.ts:494-518 verbatim.**
- [ ] **T4** — `pipeline.stage_*` telemetry events ADDITIVE only; register in `packages/telemetry/src/registry.ts`. Do NOT remove or rename `shift_swap.*` / `shift_offer.*`.

### Phase 3 — Override + Tests + E2E

- [ ] **T5** — `override_pipeline` admin escalation tool. **BLOCKED by T0.5 seed.**
- [ ] **T6** — Capability tests: 3 journey paths × happy+error variants.
- [ ] **T7** — E2E spec `p-swap-marketplace-pipeline.ts` (S12).

### Phase 4 — Closure

- [ ] **T8** — Type regen + full typecheck (52/52 green).
- [ ] **T9** — HANDOFF + decision log entry for closure.

## Acceptance Criteria

- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] All 10 existing swap+marketplace tools still pass V1 contract tests (no breaking changes)
- [ ] New pipeline emits 3 stage events per flow (proposed → consented → approved)
- [ ] Lock-on-shift prevents concurrent swap + marketplace claim on same `schedule_shift.id`
- [ ] Admin escalation path covered by capability test + E2E spec
- [ ] Decision log updated (ADR-0321 implementation confirmed, any new sub-ADRs registered)
- [ ] All 3 user journeys written (see `docs/journeys/JOURNEY-world-best-wfm-swap-marketplace-convergence-v2.md`)
- [ ] HANDOFF written at closure

## Out of Scope

- Push-fanout notifications (deferred to marketplace mobile V2 sortie)
- Real-time WebSocket pipeline updates (V3, requires LiveKit data-channel infra)
- Cross-workspace swap (governance ADR needed first)
