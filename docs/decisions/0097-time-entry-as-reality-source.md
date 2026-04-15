---
title: "time_entry as D6 Reality Source (Immutable)"
id: ADR_0097
status: accepted
layer: decision
created: 2026-04-15
updated: 2026-04-15
module: timesheet
tags: [adr, timesheet, d6, reality-layer, immutability, provenance]
---

# ADR-0097: time_entry as D6 Reality Source (Immutable)

**Status:** Accepted
**Date:** 2026-04-15

## Context and Problem Statement

`timesheet.time_entry` records punch_in / punch_out / breaks for an employee on a shift. Today, code paths sometimes UPDATE `time_entry` rows directly to "fix" an employee's hours after the fact. This conflates two distinct facts: (a) what was observed at the moment of punching, (b) what the manager later decides the hours should be. The ADR-0095 Five-Layer architecture requires the Reality layer to be append-only — otherwise reproducibility (re-deriving Interpretation and Derivation from history) is impossible.

## Decision Drivers

- Reproducibility (cascade invariant): Interpretation and Cost must be re-derivable from Reality + rules at any time. Mutating Reality silently invalidates all historical derivations.
- Audit: a manager edit to "approved hours" is a Decision-layer action and must leave both the original observation and the override visible.
- Already-present `time_entry.status` enum has value `edited` — but actually mutating the row blows away the original timestamps.

## Decision Outcome

`time_entry` is **append-only after Interpretation has consumed it**. Concretely:

- INSERT and UPDATE allowed during the active punch session (`status='clocked_in'`) while the employee is still on shift.
- After `status='completed'` and the row has been consumed by the Interpretation layer (a `shift_hour_interpretation` row exists referencing it), no further UPDATE is permitted by RLS.
- Manager corrections do not edit `time_entry`. They produce override artifacts at the Decision layer (`shift_approval.edit_justification` + adjusted hours in `shift_approval.approved_hours`), which the Derivation layer reads alongside Interpretation.
- The existing `time_entry_status` enum value `edited` is deprecated; use Decision-layer override artifacts instead. Migration to remove the value happens after callers are migrated.

## Rules & Consequences

- **Good, because** derivation is reproducible; audit is complete; "Reality vs Decision" stays distinguishable.
- **Bad, because** tooling that previously rewrote `time_entry` directly must be migrated to write override artifacts. The migration is mostly mechanical because admin-edit paths are few.
- **Agent Impact:** when a user asks the agent to "fix the hours" on a past shift, the agent writes a Decision-layer override (with `edit_justification`), never an UPDATE to `time_entry`.

## Related ADRs

- ADR-0095 — Five-Layer Architecture.
- ADR-0099 — authority-gate must permit Decision-layer overrides only with proper `min_role`.
