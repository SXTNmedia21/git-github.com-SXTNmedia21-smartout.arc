---
title: "daily_close as Department-Aggregate Consumer of Settled Shifts"
id: ADR-0100
status: accepted
layer: decision
created: 2026-04-15
updated: 2026-04-15
module: reconciliation
tags: [adr, reconciliation, daily-close, event-engine, c1-calibration]
---

# ADR-0100: daily_close as Department-Aggregate Consumer of Settled Shifts

**Status:** Accepted
**Date:** 2026-04-15

## Context and Problem Statement

The existing `daily_close` engine_process (migration `20260304300000_seed_daily_close_process.sql`) starts when `department_session.status` reaches `pending_signoff`. The proposed `shift_lifecycle_v1` engine_process (council 2026-04-15) covers per-shift lifecycle through settlement (publish → punch → interpretation → cost-snapshot → approval). Without an explicit relation, both processes risk racing against the same shift rows and mutating overlapping state.

## Decision Drivers

- Two engine_processes operating on overlapping data without a defined handoff = race and double-mutation.
- Five-Layer architecture (ADR-0095) places per-shift settlement in Decision layer (`shift_approval`) and department-day close in C1 (`daily_reconciliation`) — different aggregates.
- Event Engine pattern is event-driven; the natural seam is an event boundary, not a process call.

## Decision Outcome

**`daily_close` consumes events emitted by `shift_lifecycle_v1`. Neither subsumes the other.**

1. **`shift_lifecycle_v1`** terminates per-shift at *settlement complete* — it emits `shift.settled` once Interpretation, Derivation, and Decision layers have authoritative rows for the shift.
2. **`daily_close`** listens for `shift.settled` events (via `wait_for_event` action) for shifts within its (`workspace_id`, `department_id`, `session_date`) scope. When all expected shifts for the session have settled, `daily_close` advances to `validate_settlement` and remaining steps.
3. **Cutoff handling:** if `daily_close` reaches its cutoff (e.g., end-of-day timeout) with one or more unsettled shifts, it raises a `deviation` (domain=system, severity=high, blocks_day_approval=true) listing the offending shift_ids. The deviation surfaces the gap rather than silently waiting forever.
4. **No process call.** `daily_close` does not invoke `shift_lifecycle_v1.start_process`. They are coordinated via events, not orchestration.
5. **Aggregate scope:** `shift_lifecycle_v1` writes/reads at the shift level (D6 + D6-derived + C3 + C1.shift_approval). `daily_close` writes/reads at the department-day level (C1.daily_reconciliation, settlement_image, settlement_validation). Each respects the other's domain.

## Rules & Consequences

- **Good, because** clear event boundary; no race; either process can be retried independently; deviation surfaces when shifts are stuck.
- **Bad, because** requires `shift.settled` event to be reliably emitted at the end of `shift_lifecycle_v1` — a missed emit blocks `daily_close`. Mitigation: emit on the final step's success handler with idempotency key.
- **Agent Impact:** when modeling a new lifecycle process, identify its aggregate scope first. Cross-aggregate coordination uses events, never process calls.

## Related ADRs

- ADR-0095 — Five-Layer Architecture.
- ADR-0096 — `schedule_shift` ↔ `department_session` (1:N).
- ADR-0098 — `engine_state` as coordination spor.
