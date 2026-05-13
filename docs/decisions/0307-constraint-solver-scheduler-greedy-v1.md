---
title: "Constraint-Solver Scheduler — Greedy V1, Change-Proposal Output"
id: ADR_0307
status: proposed
layer: decision
created: 2026-05-13
updated: 2026-05-13
---

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
  - Demand profile (D4) — `cascade.v_pos_sales_hour` post-ADR-0305 + manual `day_factor` / `hour_factor` fallback.
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
- Persistence: solver result writes one `change_proposal` row per delta with `proposal_kind='scheduler_solver_v1'`. Manager reviews bundle in `/dashboard/schedule/proposed-plan` and approves all-or-subset. Approval triggers existing C4 gate → applies via existing `schedule_shift` mutations.
- Capability: `scheduler` with tools: `propose_plan` (manager+ run solver), `accept_proposal` (manager+ apply subset), `reject_proposal` (manager+ discard).
- Telemetry: `scheduler.proposal_generated`, `scheduler.proposal_accepted`, `scheduler.proposal_rejected`, `scheduler.gap_flagged`.

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
  - Capability `scheduler` MUST use `mutateWithGate` per ADR-0287; all writes via `change_proposal` (no direct `schedule_shift` INSERT from solver).
  - Voice channel: `propose_plan` chat-only (long-running, displays bundle); `accept_proposal` chat-only (irreversible C4 act, ADR-0288).
  - Solver MUST be deterministic for given input snapshot — same input twice = same output. Required for replay + debug.
  - Competence-eligibility helper SHARED with `shift_marketplace.claim` (ADR-0306). Single source of truth.
  - V2 trigger: when any workspace logs >20% gap-rate over 2 consecutive cycles, escalate to OR-Tools ADR.

---

> Register in `docs/decisions/0000-decision-log.md`. First sortie: `feat/scheduler-solver-greedy-v1` — solver lib + capability + change_proposal write + manager bundle UI. Estimated 5-8 days. Depends on ADR-0305 (POS) for real demand inputs; can ship with `day_factor` fallback first.
