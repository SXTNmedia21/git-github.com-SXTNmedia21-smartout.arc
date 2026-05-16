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

## Tasks

- [ ] **Task 0** — Schema: `engine_authority_pipeline` table + `pipeline_stage_event` audit + lock column on `schedule_shift` (`pipeline_locked_by uuid` FK). Forward-only migration.
- [ ] **Task 1** — Pipeline engine (`packages/ai/src/engine/authority-pipeline/`): stage definitions, stage-transition validator, event emitter.
- [ ] **Task 2** — Refactor `shift-swap` capability to emit through pipeline (preserves V1 tool names; internal write delegates).
- [ ] **Task 3** — Refactor `shift_marketplace` capability same pattern.
- [ ] **Task 4** — Shared telemetry envelope `pipeline.stage_*` events; register in `packages/telemetry/src/registry.ts`.
- [ ] **Task 5** — Admin escalation override (manager declined → admin can force via C4 authority).
- [ ] **Task 6** — Capability tests: 3 journey paths (swap, marketplace, escalation) × happy + error variants.
- [ ] **Task 7** — E2E spec `p-swap-marketplace-pipeline.ts` (S12).
- [ ] **Task 8** — Type regen + full typecheck.
- [ ] **Task 9** — Decision log + HANDOFF.

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
