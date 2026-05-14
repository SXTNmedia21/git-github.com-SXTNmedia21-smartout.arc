---
title: "Plan — scheduler-greedy (C3)"
status: draft
updated: 2026-05-14
created: 2026-05-14
module: scheduler
tags: [plan, scheduler, solver, greedy, bundle, mobile, adr-0307, adr-0309]
---

# Plan — scheduler-greedy (C3)

> Branch: `feat/world-best-wfm-scheduler-greedy` | Worktree: /home/sxtnl/dev/smartout.ai-world-best-wfm-wt-3 | Base: `campaign/world-best-wfm` | Module: scheduler | Started: 2026-05-14

## Goal

Ship greedy constraint-solver scheduler per ADR-0307 (amended) + ADR-0309 single-row bundle pattern. 3 capability tools + greedy solver + bundle review UI (atomic accept V1). Builds on PHASE 1 foundation: `eligibilityFor` helper + `change_proposal.kind='scheduler_bundle'` taxonomy + 3 scheduler telemetry events + scheduler authority seed.

## Hard Constraints

- Migration timestamp floor: `> 20260615200100`. Probably ONE migration (Task 0 framework_rule seed).
- ADR-0287 SINGLE-CALL mutateWithGate on all 3 tools — NEVER loop helper.
- ADR-0309: ONE change_proposal row per solver run. JSONB IMMUTABLE post-creation. Atomic accept = single UPDATE status='applied' + transactional applier inserts ALL proposed_shifts.
- ADR-0309: `kind='scheduler_bundle'` + `trigger_type='manual_override'` (provenance in JSONB per L-0248, NOT new enum value).
- ADR-0134 one emit per logical event — `scheduler.proposal.accepted` ONCE per accept, NOT per inserted shift.
- ADR-0099 one gate per write. ADR-0288 chat-only on all 3 tools.
- ADR-0133: accept/reject mobile-allowed; propose web-only.
- ADR-0309 V1 mobile = 3 components ONLY (BundleCard + BundleActionBar + ReadOnlyShiftList). NO per-row toggle.
- Determinism: `ORDER BY utilized_hours ASC, profile_id ASC` per `_shared.ts:93`.
- Pure TypeScript solver — NO Python microservice V1.

## Tasks

### Task 0 — D3 framework_rule seed (Riksavtalen baseline)

- [ ] Closes PHASE 0 A1 golden-case warning.
- [ ] Migration `<timestamp>_riksavtalen_framework_rule_seed.sql` (timestamp > 20260615200100).
- [ ] Seed minimal `regulatory_framework`: `{name:'Riksavtalen NHO', country:'NO', industry:'hospitality'}`.
- [ ] Seed 5 framework_rule baseline rows: aml_daily_hour_cap=9.0, aml_weekly_hour_cap=40.0, aml_rest_period_min=11.0, riksavtalen_kveldstillegg_threshold=18:00, riksavtalen_helgetillegg_threshold=lørdag-06:00.

### Task 1 — Greedy solver

- [ ] `packages/ai/src/scheduler/solver/greedy.ts` greenfield.
- [ ] Export types `SolverInput { planning_cycle, demand_buckets, profiles, framework_rules, absences, existing_shifts, workspace_id }` + `SolverProposal { proposed_shifts, gaps, objective_score, solver_version:'greedy_v1', solver_run_id, solver_inputs_hash }`.
- [ ] Export `solveGreedy(input): SolverProposal` — PURE, deterministic.
- [ ] Algorithm: slice cycle into hour-buckets per dept → headcount from `demand_buckets[bucket].score * baseline_productivity` → sort buckets `headcount DESC` (tie-break `start_at ASC, department_id ASC`) → per assignment filter via `eligibilityFor` → sort eligible `utilized_hours ASC, profile_id ASC` → pick lowest → emit ProposedShift OR Gap.
- [ ] Hash via sha256 of canonical inputs JSON.
- [ ] Vitest 8 tests (determinism, gap-detection, fairness tie-break, Aml, absence, no-double-book, demand-coverage, hash-stability).

### Task 2 — `scheduler` capability with 3 tools

- [ ] `packages/ai/src/capabilities/scheduler/` + register + CapabilityName.
- [ ] Tool `propose_plan` (manager+, chat-only voice, web Compose): Zod `{planning_cycle_id}`. BFF loads cascade context → calls `solveGreedy` → SINGLE mutateWithGate INSERT one change_proposal row with `kind='scheduler_bundle'`, `trigger_type='manual_override'`, `status='pending'`, `changes` JSONB per ADR-0309 §V1 Persistence Shape. Emit `scheduler.proposal.proposed` once.
- [ ] Tool `accept_proposal` (manager+, chat-only voice, mobile Approve): Zod `{change_proposal_id}`. Transactional single mutateWithGate exec — SELECT proposal FOR UPDATE → parse JSONB → multi-row INSERT all proposed_shifts → UPDATE change_proposal.status='applied' + resolved_by + applied_at. Emit `scheduler.proposal.accepted` ONCE per ADR-0134.
- [ ] Tool `reject_proposal` (manager+, chat-only voice, mobile Approve): UPDATE status='rejected' + reason. Emit `scheduler.proposal.rejected`.
- [ ] Vitest 9 tests (3 per tool: happy + auth-fail + state-precondition).

### Task 3 — BFF `/api/scheduler/*` routes

- [ ] `/api/scheduler/propose-plan` POST.
- [ ] `/api/scheduler/accept-bundle` POST body `{change_proposal_id}` — scoped (NOT generalized per supervisor council verdict).
- [ ] `/api/scheduler/reject-bundle` POST.
- [ ] `/api/scheduler/proposals` GET (inbox filtered `kind='scheduler_bundle'`).

### Task 4 — Web `/dashboard/schedule/proposed-plan`

- [ ] Read Nordic Split skill.
- [ ] Glass header card (date range + N proposed + N gaps + objective_score).
- [ ] Read-only proposed shifts list (NO checkboxes V1).
- [ ] Gaps section with blocker codes.
- [ ] Two big buttons: "Godta hele planen" (success) + "Avvis" (destructive).
- [ ] Motion: single-sweep gradient animation on accept (per Frontend Phase 3 — NOT 50 simultaneous springs).

### Task 5 — Mobile bundle UI (3 components)

- [ ] Read Nordic Split skill.
- [ ] Route `apps/mobile/app/(app)/(shifts)/proposed-plan.tsx` + Stack.Screen registered.
- [ ] `<BundleCard>` — summary (date range + N proposed + N gaps + confidence).
- [ ] `<BundleActionBar>` — bottom sheet handle with Accept ALL / Reject ALL (`bg-background border-t border-border py-safe-bottom`).
- [ ] `<ReadOnlyShiftList>` — flat list (employee + role + time), NO toggle V1.
- [ ] No per-row interaction.
- [ ] TanStack mutations calling `accept_proposal` / `reject_proposal` via BFF.

### Task 6 — E2E protocols P-scheduler-propose-accept + P-scheduler-mobile-bundle

- [ ] `apps/e2e/protocols/p-scheduler-propose-accept.ts`: seed golden case → propose_plan via chat → assert change_proposal row + N proposed in JSONB → web Godta → assert N schedule_shift inserted + single `scheduler.proposal.accepted` event.
- [ ] `apps/e2e/protocols/p-scheduler-mobile-bundle.ts`: mobile BundleCard renders → Accept ALL → confirmation → assert same DB state.
- [ ] Closes S10 + S11.

### Task 7 — Type regen + verification

- [ ] `npx supabase gen types typescript --local 2>/dev/null > packages/supabase/src/database.types.ts`.
- [ ] `pnpm turbo typecheck` 52/52.
- [ ] `pnpm --filter @smartout/ai test` covering solver + capability.
- [ ] Run E2E.
- [ ] HANDOFF documents: V1 atomic accept only, V2a (proposal_group_id column) + V2b (partial_applied enum) migration paths, day_factor fallback for demand.
- [ ] Decision log updated.

## Acceptance Criteria

- [ ] Tasks 0-7 atomic commits
- [ ] Typecheck 52/52
- [ ] Solver + capability tests green (8 + 9 vitest)
- [ ] S10 + S11 E2E passes
- [ ] Solver gap-rate <30% on golden case (V1 target per ADR-0307; V2 trigger if exceeded)
- [ ] HANDOFF + decision log

## Out of Scope (deferred V2)

- Partial-accept per-shift selection (V2a / V2b paths in ADR-0309)
- OR-Tools CP-SAT solver (V2 trigger: gap-rate >20% over 2 cycles per ADR-0307)
- Multi-department transfers in single proposal
- Employee preferences (day-off requests)
- Sequential-shift fatigue penalty
- Cost minimization objective
- Real-time POS demand (uses day_factor V1; POS view exists from C1 but golden case may be empty)
