---
id: L-0135
title: Migration headers are primary evidence in council synthesis
status: active
date: 2026-04-23
updated: 2026-04-23
layer: learning
module: council-process
tags: [learning, council, migration-headers, evidence, phase-2, phase-5, council-2026-04-23]
---

# L-0135: Migration Headers Are Primary Evidence in Council Synthesis

## Context

Council 2026-04-23 B1 dual-gate reconciliation. Four-agent structural
argument favored Option 3 (shared SQL core for `gate_action` +
`cascade_gate_write`). Supervisor countered with one citation:

> `supabase/migrations/20260512100000_cascade_gate_write.sql:7-9`:
> gate_action = capability/authority (who can do X?);
> cascade_gate_write = data/rule (should this row change?)

A 3-line canonical artefact, authored at the moment the two RPCs were
designed, outweighed a 4-agent structural consensus. Steward Phase 5
reversed to Option 2 (keep separate).

## Why it matters

Migration headers are authored at the moment of decision, frequently by
the same engineer who wrote both sides of an interface. They encode
**intent that later structural analyses lose**. When a council is
debating "should these two things be unified?", migration headers of
both artefacts are the fastest, highest-quality evidence about whether
the proposed unification is regression or progress.

A migration header survives:

- Rebases and squashes (header is inside the committed file).
- Doc drift (the migration is the source; docs are downstream
  projections).
- Agent hand-offs across sessions (the SQL file doesn't get paraphrased
  by claude-mem; the header survives verbatim).
- Structural reasoning fashions (Invariant N arguments come and go; the
  migration header stays).

In this council, the header's 3 lines carried more evidentiary weight
than 4 structured reviews combined. That asymmetry is the signal: when
migration headers disagree with structural synthesis, the headers
usually win on intent.

## Rule

Council briefings MUST include migration header text — first 20 lines
of each cited migration — pre-loaded as evidence, for any topic
touching SQL RPC unification, schema refactor, or table semantic
change. Not an appendix; Phase 2 briefing body.

Steward Phase 5 synthesis MUST explicitly check migration-header claims
against proposed changes **before** weighing structural arguments. If
synthesis contradicts a migration header, it must cite why the header
is wrong or stale (with file:line and reason), not silently override.

## Enforcement

- `run-council` SKILL.md Phase 2 briefing checklist gains:
  > Migration headers preloaded: yes/no. List every migration file cited
  > and paste the first 20 lines of each.
- Phase 5 synthesis template gains a "migration-header check" section:
  for each cited migration, state whether the synthesis agrees, disagrees
  (with reason), or supersedes (with ADR).
- Briefing author rule: any RPC/schema/unification topic without
  migration headers in Phase 2 body is a rejected briefing — chair
  sends back for revision before Phase 3 dispatch.

## References

- ADR-0203 (B1 dual-gate reconciliation verdict)
- Council session 2026-04-23 Supervisor review
- `supabase/migrations/20260512100000_cascade_gate_write.sql:1-20` (the
  header that decided it)
- L-0133 (structural analysis needs code-trace — sibling learning,
  migration headers are a special high-signal class of trace evidence)
- L-0117 (grep-based structural claims must be code-traced — header
  check is a lightweight trace for the common case)
