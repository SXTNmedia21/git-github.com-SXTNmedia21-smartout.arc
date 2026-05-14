---
title: Journey — Greedy Scheduler V1 + ADR-0309 Single-Row Bundle
feature: scheduler-greedy
status: verified
updated: 2026-05-14
created: 2026-05-14
module: scheduler
tags: [journey, scheduler, solver, greedy, bundle, wfm]
---

# Journey — Greedy Scheduler V1 + ADR-0309 Single-Row Bundle

## Summary

Three capability tools (`propose_plan`, `accept_proposal`, `reject_proposal`) + a pure TypeScript greedy solver (`packages/ai/src/scheduler/solver/greedy.ts`) + a BFF layer (`/api/scheduler/*`) were shipped in Tasks 0–3. The solver consumes cascade context (profiles, contracts, framework_rules, absences, existing_shifts, day_factor × hour_factor demand) and produces a single `change_proposal` row (ADR-0309 single-row bundle pattern) carrying all proposed shifts as immutable JSONB. Web UI (`/dashboard/schedule/proposed-plan`), mobile bundle UI, and E2E tests (S10 + S11) are deferred to the follow-on sortie.

---

## Journey 1: Manager Proposes a Weekly Plan

**Role:** Manager (or admin/owner)
**Verb:** Compose (web-only per ADR-0133)
**Channel:** Chat only — voice rejected at capability level (ADR-0288 positive enumeration)

**Precondition:**
- Actor has `manager` (or higher) role in the workspace
- A `planning_cycle` row exists with a valid date range and `department_id`
- Cascade context is populated: profiles with contracts, `framework_rules` (Riksavtalen baseline seeded by Task 0 migration), `day_factor` + `hour_factor` rows for demand, no conflicting `schedule_shift` rows for the cycle period

**Steps:**

1. Manager opens chat (web) and asks "Lag utkast til vaktplan for uke 22" or similar → BFF routes intent to `scheduler` capability → `propose_plan` tool resolves `{planning_cycle_id}` via Zod
2. BFF loads cascade context: fetches `planning_cycle`, eligible profiles + contracts, applicable `framework_rules`, `schedule_absence` rows, existing `schedule_shift` rows, and demand buckets from `day_factor × hour_factor × baseline_headcount`
3. `solveGreedy(input)` executes — slices the cycle into hour-buckets per department, sorts buckets by headcount demand descending (tie-break: `start_at ASC, department_id ASC`), for each bucket filters eligible profiles via `eligibilityFor`, picks lowest `utilized_hours ASC, profile_id ASC`, emits `ProposedShift` or `Gap`; produces deterministic `SolverProposal` with `solver_version:'greedy_v1'` + `solver_run_id` (UUID) + `solver_inputs_hash` (SHA-256 of canonical inputs JSON)
4. `mutateWithGate` (single call, ADR-0287) performs ONE `INSERT` into `change_proposal`: `kind='scheduler_bundle'`, `trigger_type='manual_override'`, `status='pending'`, `changes` JSONB = `{proposed_shifts[], gaps[], objective_score, solver_run_id, solver_inputs_hash}`
5. `emit('scheduler.proposal.proposed')` fires ONCE (ADR-0134)
6. Chat responds with proposal summary (N shifts proposed, N gaps, objective score)

**Postcondition:**
- Exactly ONE `change_proposal` row with `status='pending'` and `kind='scheduler_bundle'`
- JSONB `changes` is immutable post-creation (ADR-0309)
- One `scheduler.proposal.proposed` telemetry event in `activity_trail`

**Error paths:**
- Voice channel request → capability guard rejects with `channel_not_allowed` (ADR-0288 positive enum: only `["chat"]` allowed for propose)
- Actor role < manager → `mutateWithGate` rejects with authority denial (ADR-0099)
- `planning_cycle_id` not found or not in actor's workspace → Zod/query rejects with 404-equivalent
- No eligible profiles for any bucket → solver still completes, all buckets emit `Gap`; proposal created with 0 proposed shifts and 100% gap rate

---

## Journey 2: Manager Accepts the Whole Bundle

**Role:** Manager (or admin/owner)
**Verb:** Approve (mobile-allowed per ADR-0133)
**Channel:** Chat or mobile UI (voice rejected per ADR-0288)

**Precondition:**
- `change_proposal` row exists with `status='pending'` and `kind='scheduler_bundle'`
- Actor is manager+ in the workspace that owns the proposal

**Steps:**

1. Manager finds proposal in chat ("Godta planen") or via `/api/scheduler/proposals` inbox → sends `{change_proposal_id}` to `accept_proposal` tool
2. `mutateWithGate` (single call, NOT a loop) executes a transactional callback:
   a. `SELECT change_proposal FOR UPDATE` — acquires row lock
   b. Asserts `status='pending'`; throws `state-precondition` error if not
   c. Parses `changes.proposed_shifts[]` from JSONB
   d. Multi-row `INSERT INTO schedule_shift` — all proposed shifts in a single statement within the transaction
   e. `UPDATE change_proposal SET status='applied', resolved_by=actor_profile_id, applied_at=NOW()`
   f. Transaction commits atomically
3. `emit('scheduler.proposal.accepted')` fires ONCE (ADR-0134 — NOT once per inserted shift)

**Postcondition:**
- `change_proposal.status='applied'`
- N `schedule_shift` rows inserted (one per proposed shift in JSONB)
- Exactly one `scheduler.proposal.accepted` event (regardless of N)
- `change_proposal` JSONB remains immutable

**Error paths:**
- Proposal `status ≠ 'pending'` (already applied or rejected) → state-precondition error returned, no writes
- Voice channel request → rejected (ADR-0288 — accept is `["chat", "mobile"]`, not voice)
- Concurrent accept by two actors → second `SELECT FOR UPDATE` waits; after first commits, second sees `status='applied'` and fails with state-precondition

---

## Journey 3: Manager Rejects the Bundle

**Role:** Manager (or admin/owner)
**Verb:** Approve (mobile-allowed per ADR-0133)
**Channel:** Chat or mobile UI (voice rejected per ADR-0288)

**Precondition:**
- `change_proposal` row exists with `status='pending'` and `kind='scheduler_bundle'`

**Steps:**

1. Manager sends rejection ("Avvis planen", optional reason) → `reject_proposal` tool resolves `{change_proposal_id, reason?}`
2. `mutateWithGate` (single call) executes: `UPDATE change_proposal SET status='rejected', resolved_by=actor_profile_id, rejection_reason=reason, resolved_at=NOW()`
3. `emit('scheduler.proposal.rejected')` fires ONCE

**Postcondition:**
- `change_proposal.status='rejected'`
- No `schedule_shift` rows inserted
- One `scheduler.proposal.rejected` event

**Error paths:**
- Proposal `status ≠ 'pending'` → state-precondition error, no write
- Voice channel → rejected (same guard as accept)

---

## Cross-Cutting: Solver Design + ADR-0309 Invariants

### Solver determinism

The greedy solver is a pure function — no external calls, no randomness. Determinism is enforced via:
- Bucket sort: `headcount DESC, start_at ASC, department_id ASC`
- Candidate sort: `utilized_hours ASC, profile_id ASC` (same precedent as `_shared.ts:93`)
- `solver_inputs_hash`: SHA-256 of canonical JSON of inputs — two runs on identical inputs produce identical hash

### Tests shipped

- 8 Vitest solver tests: determinism, gap-detection, fairness tie-break, AML constraint enforcement, absence exclusion, no-double-booking, demand coverage, hash stability
- 9 Vitest capability tests: 3 per tool (happy path + auth-fail + state-precondition)

### ADR-0309 invariants (V1)

| Invariant | Enforcement |
|---|---|
| ONE `change_proposal` row per solver run | Single `mutateWithGate` INSERT in `propose_plan` |
| JSONB `changes` is immutable post-creation | No UPDATE on `changes` column anywhere |
| Atomic accept V1 — all or nothing | Transaction in `mutateWithGate` exec callback |
| `scheduler.proposal.accepted` ONCE per accept | Single `emit()` after transaction, not inside loop |
| `kind='scheduler_bundle'` + `trigger_type='manual_override'` | Hard-coded in tool body |

### V2 paths (deferred — documented in ADR-0309)

- **V2a**: `proposal_group_id` column for partial-accept tracking (requires migration)
- **V2b**: `partial_applied` enum value for `change_proposal.status`
- V2 trigger: gap-rate >30% over 2 consecutive planning cycles (per ADR-0307)

### Demand input V1 note

Demand is derived from `day_factor × hour_factor × baseline_headcount` (manual coefficients). Real-time POS demand via `v_pos_sales_hour` is intentionally deferred to ADR-0320 (V2 trigger: Lightspeed integration + 30 days of real data). Solver does NOT read `v_pos_sales_hour` in V1 — this is the G3 amendment to ADR-0307 §47.
