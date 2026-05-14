---
title: "Constraint-Solver Scheduler — Greedy V1, Change-Proposal Output"
id: ADR_0307
status: proposed
layer: decision
created: 2026-05-13
updated: 2026-05-14
---

> **AMENDED 2026-05-14 (G1 council, chair self-reversal per Skill §1.5).** Persistence shape changed from "one `change_proposal` row per delta + manager subset-accept" to "single `change_proposal` row per solver run + atomic all-or-nothing accept V1." See ADR-0309 (Scheduler Bundle Proposal Pattern) for canonical persistence + accept semantics. The §"Persistence" + §"Capability" + §"Telemetry" + §"Agent Impact" lines below are SUPERSEDED by ADR-0309 where they conflict; algorithm + constraints + V2 trigger sections still hold.

# ADR-0307: Constraint-Solver Scheduler — Greedy V1, Change-Proposal Output

## Context and Problem Statement

Smartout cascade has every input a scheduler needs (D2 employees + contracts +
absences, D3 framework rules + tariff, D4 demand + day/hour factors, D6 existing
shifts). Today the manager builds the vaktplan manually (drag-drop) with Botsson
suggesting assignments one at a time. World-best WFM auto-generates an entire
weekly plan from inputs and presents it for one-shot approval. Cost of greenfield
constraint-solver lib (OR-Tools / OptaPlanner) is high; cost of shipping nothing
is higher (Smartout looks like a CRUD scheduler with AI sugar, not a planner).

## Decision Drivers

- Cascade data shape is solver-ready; not building scheduler is leaving moat unexploited.
- C4 authority + `change_proposal` table already exists for "agent proposes, human approves" — solver output fits naturally.
- "Sjapp implementering" requirement: ship value in weeks, not months.
- Solver-quality gap visible only at scale; greedy-first acceptable if upgrade path clear.
- Norway tariff (Riksavtalen) constraints are hard; soft-constraint optimization (employee preferences) is bonus.

## Considered Options

1. **Greedy heuristic in TypeScript, ship V1 immediately** — fast, transparent, debuggable, suboptimal output quality.
2. **OR-Tools CP-SAT via Python microservice** — global-optimal, slow to build, requires Python service + ops surface (similar to `services/scrapling`), V1 in 4-8 weeks.
3. **OptaPlanner JVM service** — strongest at workforce-scheduling specifically, heaviest ops + deploy cost, 6-12 weeks.

## Decision Outcome

Chosen option: **Option 1 — greedy heuristic V1 in TypeScript, OR-Tools V2 if quality insufficient**.

**MVP scope (sjapp / lightweight first iteration):**

- Location: `packages/ai/src/scheduler/solver/` (pure TS, no service).
- Inputs (read-only from cascade):
  - Planning cycle (D1 envelope) — start/end dates + department list.
  - Demand profile (D4) — solver derives demand from `day_factor × hour_factor × baseline_headcount` directly from D4 cascade tables. `public.v_pos_sales_hour` view exists but is reserved for V2 calibration loop (see ADR-0320). V1 source: manual coefficients set by manager.
  - Roster (D2) — active profiles with `employment_contract` + `employee_payroll_profile` + competence flags.
  - Rules (D3) — Aml + tariff hour-floor / hour-ceiling per profile + framework triggers.
  - Existing shifts (D6) — `schedule_shift` already published for cycle (solver respects published; only fills gaps).
  - Absences (D2) — `schedule_absence` overlapping cycle (hard exclusion).
- Algorithm V1 (greedy, deterministic):
  1. Slice cycle into hour-buckets per department.
  2. Per bucket, compute headcount-needed from demand × productivity.
  3. Sort buckets by demand descending; assign highest-demand first.
  4. Per assignment: filter eligible profiles (competence + Aml hour-floor + no absence + no overlap + tariff-rest gap respected); pick lowest-utilized (fairness proxy).
  5. Skip on no-eligible; flag as `gap` in output.
- Output: NOT direct shift inserts. Returns `SolverProposal` shape:
  - `proposed_shifts[]` — new shifts to insert.
  - `proposed_swaps[]` — assignee changes on existing shifts.
  - `gaps[]` — buckets where no eligible profile found.
  - `objective_score` — total demand-coverage % + fairness variance.
- Persistence: **AMENDED — see ADR-0309.** Solver result writes ONE `change_proposal` row per solver run with `kind='scheduler_bundle'` + `trigger_type='manual_override'` + `changes` JSONB carrying `proposed_shifts[]` array. Manager reviews bundle in `/dashboard/schedule/proposed-plan`. Atomic all-or-nothing accept V1 — partial-accept deferred V2 with documented migration paths in ADR-0309.
- Capability: `scheduler` with tools: `propose_plan` (manager+, web-only Compose verb), `accept_proposal` (manager+, mobile-allowed Approve verb), `reject_proposal` (manager+, mobile-allowed Approve verb). All chat-only per ADR-0288.
- Telemetry: `scheduler.proposal.proposed`, `scheduler.proposal.accepted`, `scheduler.proposal.rejected` (one emit per logical event per ADR-0134; one event per bundle, NOT per shift).

**Hard constraints (V1):**
- Aml §10 daily/weekly hour caps.
- Tariff Riksavtalen rest-period gaps.
- No absence overlap.
- Profile competence vs role-on-shift.
- No double-booking (profile in two shifts same time).

**Soft constraints (V1, scored):**
- Fairness: minimize hour-variance across profiles.
- Demand-coverage: maximize bucket-fill %.

**NOT in V1:** employee preferences (day-off requests), sequential-shift fatigue penalty, multi-department transfer, cost minimization, OR-Tools optimal search. All deferred to V2.

## Rules & Consequences

- **Good, because** ships in 1-2 weeks; transparent greedy = explainable to manager (every assignment traceable to "lowest-utilized eligible profile").
- **Good, because** writes to `change_proposal` (existing table, existing C4 gate) — zero new approval-flow code.
- **Good, because** clean upgrade path: V2 swaps the algorithm body; inputs + outputs + capability stay.
- **Bad, because** greedy is suboptimal at scale (>50 employees, multi-department); will leave 5-15% more gaps than CP-SAT in same constraints.
- **Bad, because** fairness is approximated (lowest-utilized first), not optimized. Edge case: one profile eternally underused if always lowest-eligible.
- **Bad, because** soft-constraint scoring is heuristic, not provably optimal. V2 needed before claiming "AI-optimized scheduling" externally.
- **Agent Impact:**
  - Capability `scheduler` MUST use `mutateWithGate` per ADR-0287 with **single-call shape** (one row INSERT for propose, one row UPDATE for accept/reject). NEVER loop `mutateWithGate` over N rows — violates ADR-0099 + ADR-0134.
  - All writes via `change_proposal` (no direct `schedule_shift` INSERT from solver).
  - Voice channel: all 3 tools chat-only per ADR-0288 (irreversible C4 acts).
  - Mobile boundary per ADR-0133: `propose_plan` web-only (Compose); `accept_proposal` + `reject_proposal` mobile-allowed at bundle granularity (3 components: BundleCard + BundleActionBar + ReadOnlyShiftList). Per-row toggle = V2 affordance.
  - Solver MUST be deterministic for given input snapshot — same input twice = same output. Tie-break = `ORDER BY utilized_hours ASC, profile_id ASC` per `apps/web/src/app/api/payroll/_shared.ts:93` precedent. Required for replay + debug.
  - Provenance lives in `changes` JSONB (`solver_version`, `solver_run_id`, `solver_inputs_hash`), NOT in `framework_trigger_type` enum. Reuse `manual_override` value (per L-0248).
  - Competence-eligibility helper SHARED with `shift_marketplace.claim` (ADR-0306). Single source of truth at `packages/ai/src/scheduler/eligibility.ts`.
  - V2 trigger (algorithm): when any workspace logs >20% gap-rate over 2 consecutive cycles, escalate to OR-Tools ADR.
  - V2 trigger (partial-accept): when any workspace logs >2 partial-accept user-requests per cycle, escalate to ADR-0309 V2a or V2b migration path.

---

> Register in `docs/decisions/0000-decision-log.md`. First sortie: `feat/scheduler-solver-greedy-v1` — solver lib + capability + change_proposal write + manager bundle UI. Estimated 5-8 days. Depends on ADR-0305 (POS) for real demand inputs; can ship with `day_factor` fallback first.
