---
title: "'Mostly mechanical' claim in migration brief is a red flag for under-scoped phase"
id: L_0183
status: accepted
layer: learning
created: 2026-04-30
updated: 2026-04-30
references:
  - ADR-0246
---

# L-0183: "Mostly mechanical" is a red flag for under-scoped migration phase

## Why

ADR-0246 brief said Phase A1 was "mostly mechanical" — Agent-coord code-trace found 60% under-scope:
- 12 columns on engine_sessions + 7 on engine_state with no clean analog (brief acknowledged 0)
- 4 nullability conflicts (workspace_id, process_id, mode, channel — brief acknowledged 0)
- Status-enum collision with no translation rule (brief said "status-vocabulary normalization")
- Hot-path `appendConversationTurn` double-emit risk (brief said nothing)
- 8 cascade domains using engine_state (brief said "frozen-4 + journey-engine")

Brief's softening language ("mostly mechanical") signaled a phase that had not been honestly scoped.

## How to apply

When a brief uses softening language without enumerated deliverables, treat as under-scoped and require enumeration as an explicit pre-phase deliverable.

Trigger phrases:
- "mostly mechanical"
- "straightforward migration"
- "minor refactor"
- "should be quick"
- "just a search-and-replace"
- "additive only" (without listing the additions)

For each, council preflight grep + demand: "Enumerate the additions / mechanical operations / files touched. If <unable to enumerate within 1 hour, the phase is under-scoped and needs a Phase X.0 (enumeration) deliverable before being sized."

ADR-0246 added Phase A0 (schema reconciliation, 1 week) explicitly to enumerate before A1 schema-add ships. Cost rose from 4 weeks to 5–6 weeks. Honest cost > false low-bound.

## Pattern signature

- Brief estimates time without per-file or per-column enumeration
- Brief uses softening adjective in cost section
- Estimate is presented as lower bound but not bracketed (no "4–6 weeks")
- Reviewers in Phase 3 produce file:line evidence that contradicts softening adjective

When 3 of 4 are true: brief is under-scoped, demand enumeration phase.

## Why this matters

Under-scoped phases produce:
- Mid-phase scope creep (recurring symptom)
- Council re-review at Phase 5 with new constraints (waste of agent rounds)
- "We didn't know" excuse when migration breaks production
- Decision-log entries that turn `accepted` to `partially-implemented`

Enumeration phase is cheap (1 week). Mid-phase scope creep is expensive (often 2–3 weeks lost + production risk).
