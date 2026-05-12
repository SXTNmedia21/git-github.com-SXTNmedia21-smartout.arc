---
title: "ADR-0292: Payroll Override-Applier Uses Supersession-Chain Plus derivation_version+1"
id: ADR-0292
status: accepted
layer: decision
created: 2026-05-07
updated: 2026-05-07
module: payroll
tags: [payroll, override, audit, change-proposal, immutability, supersession, adr]
---

# ADR-0292: Payroll Override-Applier Uses Supersession-Chain Plus derivation_version+1

**Status:** Accepted
**Date:** 2026-05-07

## Context and Problem Statement

Payroll Phase 2 introduces `override_calculation_line` — a manager-proposed,
admin-approved flow for replacing a derived payroll calculation line. When an
admin approves a `change_proposal` of `kind='wage_line_override'`, the system
must apply the manager's proposed new amount to the period total.

The question: **how should the applier write the override into the database
while preserving both audit immutability (Bokføringsloven §13) and
idempotent reproducibility (payroll-engine-developer skill, Principle 2)?**

The applier function (T2.2, next batch) will be triggered by the DB trigger
`payroll_proposal_applied_trg` (installed in 20260507110100) via an
`engine_event` row with `event_kind='payroll.line_override_applied'`.

## Decision Drivers

- **Bokføringsloven §13 — 5-year immutability.** Accounting records cannot be
  deleted or overwritten. This makes direct UPDATE of `payroll_calculation` rows
  illegal under Norwegian accounting law.

- **Payroll-engine-developer Principle 3 (audit non-negotiable, ADR-0251).**
  `shift_pay_calculation_event` is append-only with RLS blocking UPDATE/DELETE for
  all except service_role. The supersession chain (`superseded_by_event_id`) is the
  canonical mechanism for expressing "this calculation event replaced that one."

- **Payroll-engine-developer Principle 2 (idempotens via derivation_version+1).**
  Re-running `aggregate-period.ts` must produce the same result. The canonical way
  to express "the current value of a line" without ambiguity is `derivation_version
  = MAX(derivation_version)` per `(period_id, profile_id, shift_id, source)`.

- **Journey contract.** `JOURNEY-payroll-phase-2-admin-approves-line-override.md`
  explicitly requires: *"Old `payroll_calculation` row UENDRET (audit immutability)"*
  and *"New `payroll_calculation` row eksisterer m/ override-amount,
  derivation_version+1, source='override'"* and *"shift_pay_calculation_event
  audit-row m/ supersession."*

## Considered Options

### Option A — Direct UPDATE of payroll_calculation row

Set `total_pay = proposed_amount` and `source = 'override'` on the existing row.

**Rejected because:**

- Violates Bokføringsloven §13 (immutability of accounting records). Once a period
  is open and calculations exist, those rows are de facto accounting records for
  the audit chain.
- Breaks Principle 2 (idempotens): re-running `aggregate-period.ts` on different
  versions of the same `payroll_calculation` row can produce different results
  depending on which version of the row the engine sees.
- `shift_pay_calculation_event` RLS blocks UPDATE for non-service_role sessions,
  meaning the trigger function would need elevated privileges to update the old
  event — which is fragile and obscures the audit chain.

### Option B — Supersession-only via shift_pay_calculation_event, no new payroll_calculation

Insert a new `shift_pay_calculation_event` row that supersedes the old one
(via `superseded_by_event_id`). Leave `payroll_calculation` untouched. Let
`aggregate-period.ts` recompute from events only.

**Rejected because:**

- `aggregate-period.ts` (Layer 5) currently aggregates from `payroll_calculation`
  rows, not from `shift_pay_calculation_event` rows directly. Changing the
  aggregation layer to chase supersession chains would require a non-trivial
  rewrite of the pipeline (Phase 3+ territory).
- The period totals (visible in LinesTable) would not update until the next full
  recalc pass, which consumes `payroll_calculation` rows. The supersession event
  alone does not update the rows the UI reads.
- Principle 2 (idempotens) requires `derivation_version` to be the version
  discriminator. Without a new `payroll_calculation` row with
  `derivation_version+1`, the engine cannot determine "latest version" by
  standard MAX() query.

### Option C (chosen) — Both: supersession-chain AND new payroll_calculation row

**Write BOTH:**

1. `INSERT` a new `shift_pay_calculation_event` row with:
   - `superseded_by_event_id` pointing forward to the new override event
   - `derivation_version = old_event.derivation_version + 1`
   - `amount_nok` = proposed_amount_cents / 100
   - `rule_type = 'override'`
   - `provenance JSONB` containing `change_proposal_id` reference

2. `INSERT` a new `payroll_calculation` row with:
   - `derivation_version = old_row.derivation_version + 1` (or MAX + 1 for the profile×period)
   - `source = 'override'`
   - `change_proposal_id` = the approved proposal ID
   - All other fields copied from the most-recent existing row for that line

3. **Original `payroll_calculation` row UNCHANGED** — immutability preserved.

**Why this works:**

- `aggregate-period.ts` filters to `derivation_version = MAX()` per
  `(period_id, profile_id, shift_id, source)` — the new row wins automatically.
- `shift_pay_calculation_event` supersession chain gives auditors a traversable
  lineage: old event → new override event → `change_proposal`.
- The UI reads from `payroll_calculation` rows (which LinesTable aggregates),
  so the new row triggers an immediate visual update after recalc.
- Bokføringsloven §13 is satisfied: no row is deleted or updated.

## Decision Outcome

Chosen option: **Option C — Both supersession-chain AND new payroll_calculation row.**

The applier function (T2.2) MUST:

1. Verify the `change_proposal` row in the workspace (ADR-0151 forgery defense,
   L-0177 fail-fast on row-not-found).
2. Verify `payroll.period.status = 'open'` (period may have been locked after
   the proposal was submitted — applier must 409 if locked).
3. Read the current `payroll_calculation` row identified by `calculation_id`
   in the proposal payload.
4. Read the most-recent `shift_pay_calculation_event` row for that calculation.
5. INSERT new `shift_pay_calculation_event` with supersession link.
6. INSERT new `payroll_calculation` row with `derivation_version + 1`, `source = 'override'`.
7. Emit `payroll.line_overridden` (telemetry, ADR-0292).
8. Leave original rows UNCHANGED.
9. The existing recalc flow (`aggregate-period.ts`) re-runs on the updated
   `payroll_calculation` rows and updates period totals.

The trigger `payroll_proposal_applied_trg` (20260507110100) emits
`engine_event(payroll.line_override_applied)` and the engine_dispatch poller
calls the applier. This is not a synchronous inline call — the apply is
eventually consistent (typically <2s per acceptance criteria T7.2).

## Consequences

**Good:**

- Audit chain is complete and traversable: `activity_trail` → `change_proposal`
  → `shift_pay_calculation_event` (supersession) → `payroll_calculation`
  (new row with source='override').
- `aggregate-period.ts` requires zero changes — MAX(derivation_version) filter
  already selects the latest version per line.
- Bokføringsloven §13 satisfied in full.
- Principles 2 and 3 of the payroll-engine-developer skill satisfied.

**Constraints imposed on downstream code:**

- `aggregate-period.ts` MUST filter `payroll_calculation` to
  `derivation_version = MAX(derivation_version)` per `(period_id, profile_id,
  shift_id, source)`. This is the existing behavior as of Phase 1.
- The applier function MUST NOT `UPDATE` any existing `payroll_calculation` row.
  Code reviewers should assert: zero `UPDATE` calls in the applier body.
- The applier MUST use `gatedMutation` per ADR-0204.
- The applier MUST emit `payroll.line_overridden` per ADR-0134 telemetry contract.

**Agent enforcement note (L-0176 / phantom contract prevention):**

Do NOT write docstrings claiming "ADR-0292 compliant" before the applier body
satisfies all 9 steps above. Verify each step is in the function body before
writing the compliance claim in a comment. (L-0176 lesson: docstrings drift from
bodies.)

## Rules & Consequences enforced for Agents

- **Good, because** every override is traceable from UI drilldown → calculation row
  → audit event → change_proposal. Accountants can reproduce the period total
  exactly by running MAX(derivation_version) queries.

- **Bad, because** two INSERTs per approved override (one event + one calculation)
  means slightly higher DB write volume. Acceptable given the low frequency of
  manual overrides in a payroll period.

- **Agent Impact:** Any capability tool or applier function that touches
  `wage_line_override` processing MUST follow the 9-step procedure above.
  Direct UPDATE of `payroll_calculation` or `shift_pay_calculation_event` is a
  Critical violation of this ADR and of Bokføringsloven §13.

## References

- `payroll-engine-developer` skill, Principles 2 and 3
- ADR-0251: shift_pay_calculation_event audit module
- ADR-0204: gatedMutation requirement for capability tools
- ADR-0151: server-side workspace_id derivation (forgery defense)
- ADR-0134: telemetry contract (emit on every mutation)
- Bokføringsloven §13: Norwegian Bookkeeping Act, 5-year record immutability
- PLAN-payroll-phase-2.md: Q1 resolution (pre-resolved, this ADR formalizes it)
- JOURNEY-payroll-phase-2-admin-approves-line-override.md: journey contract
