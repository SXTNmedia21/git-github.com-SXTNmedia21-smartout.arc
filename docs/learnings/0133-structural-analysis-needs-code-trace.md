---
id: L-0133
title: Structural analysis must cite code-trace before shared-policy claims
status: active
date: 2026-04-23
updated: 2026-04-23
layer: learning
module: council-process
tags: [learning, council, code-trace, structural-analysis, phase-2.5, council-2026-04-23]
---

# L-0133: Structural Analysis Must Cite Code-Trace Before Shared-Policy Claims

## Context

Council 2026-04-23 reviewed B1 dual-gate reconciliation: should
`gate_action` and `cascade_gate_write` be unified into one RPC, share a SQL
core, or stay separate? The plan's Option 3 ("shared SQL core") was pitched
on a structural argument — Cascade Invariant 2 (single source of truth) and
Invariant 4 (no parallel write paths) — and Phase 3 System Steward voted it
the winner.

Phase 3 → Phase 5 inverted after Agent-Coord (code-tracer) walked both
RPCs end-to-end.

## What actually happened

Agent-Coord code-traced `four_eyes_required` end-to-end through both RPCs
and the shared-policy premise fell apart:

- **`gate_action`** reads `engine_authority_config` (capability + channel +
  workspace), computes four-eyes history from `engine_approval_action`,
  checks `channel_type`, returns `{ok, reason, four_eyes_required,
  approvers_needed, approvers_present, gate_evaluation_id}`.
- **`cascade_gate_write`** reads `workspace_framework_binding`, evaluates
  `framework_rule` against the proposed row, creates a
  `change_proposal` row if rejected, returns `{ok, reason,
  change_proposal_id}`.

**Zero shared rules.** No common lookup table. No common predicate. Not
even a shared `reason` taxonomy. The plan's premise "share most logic" was
empirically false.

Supervisor reinforced this with migration header
`supabase/migrations/20260512100000_cascade_gate_write.sql:7-9`:

> gate_action = capability/authority (who can do X?);
> cascade_gate_write = data/rule (should this row change?)

Steward Phase 5 reversed to Option 2 (keep separate, add parity tests).

## The pattern

Structural ontology arguments (Invariant X says Y) can co-reinforce a
grep-count or plan-statement briefing when neither touches the actual call
graph. Four agents voted Option 3 on structural grounds. None had traced
the two functions rule-by-rule. When traced, the shared-policy claim
collapsed at first contact with the source.

This is the **6th occurrence** of the grep/structural-claim-without-code-trace
pattern (L-0117 promoted it to hard rule at 5; this reinforces at 6 in a
new shape — structural *inference* without trace, not just grep counts).

## Rule

Any synthesis claim of the form "X and Y share most/core logic" must cite
a **code-trace** — end-to-end walk with `file:line` evidence — NOT just
structural reasoning or grep counts. Phase 2.5 fact-check should enforce:
if plan says "share most logic", Phase 2.5 produces a rule-by-rule parity
table (lookup inputs, predicate logic, return fields) **before** Phase 3
dispatches.

## Enforcement

- `run-council` SKILL.md Phase 2.5: extend fact-check to require a
  rule-by-rule parity table for any "shared logic / shared core / shared
  policy" claim. Table columns: rule name, source-of-truth (table or
  function), predicate, return field. Empty cells on either side = no
  shared core.
- Steward Phase 5 synthesis: if a reviewer votes a shared-X option,
  synthesis MUST cite the parity table or reject the vote as
  unsubstantiated.
- If plan and code-trace disagree, code wins (project rule), and the plan
  section is rewritten in the same PR.

## References

- ADR-0203 (B1 dual-gate reconciliation verdict)
- ADR-0204 (CI grep gate for inline gate RPC calls)
- L-0117 (grep-based structural claims must be code-traced — hard rule)
- L-0127 (loader-level bugs evade grep-audits — transformation layer trap)
- Council session 2026-04-23 Phase 3 → Phase 5 inversion
- `supabase/migrations/20260512100000_cascade_gate_write.sql:7-9`
