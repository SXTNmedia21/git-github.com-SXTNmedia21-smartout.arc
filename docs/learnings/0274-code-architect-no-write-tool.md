---
id: L-0274
title: "feature-dev:code-architect skill lacks Write tool — use general-purpose for spec authoring"
status: accepted
date: 2026-05-15
discovered_in: feat/dagslinjen-quickadd (Track B)
related_adrs: []
tags: [agent-dispatch, skills, tooling-mismatch]
---

# code-architect cannot write spec files directly

## Discovery

Track B was specified as `(opus, code-architect)` to fill in the
architecture spec at `docs/superpowers/specs/2026-05-15-dagslinjen-quickadd-design.md`
(component tree, file-touch list, authority matrix).

The `feature-dev:code-architect` skill plus its associated agent profile
does not include the `Write` tool. The architect produced an excellent
spec **as a text report in chat** but could not persist it.

The orchestrator had to either:

a) Manually copy the architect's text into a `Write` call (lossy if the
report is long, drift risk on copy-paste),
b) Re-dispatch a `general-purpose` agent with the architect's text as
input and `Write` tool to materialize it,
c) Write the spec from the architect's text itself.

In this sortie option (c) was chosen — the orchestrator wrote the spec.

## Lesson

For tasks where the deliverable is a **file** (spec, plan, journey,
ADR), the dispatched agent MUST have the `Write` tool. Default-pick
`general-purpose` (sonnet) or write directly from the architect's text
output yourself.

`feature-dev:code-architect` is correctly scoped to **thinking**
about architecture — its absence of `Write` is a feature, not a bug.
The mismatch was in the dispatch decision, not the agent.

## Application

Updated dispatch decision tree (informal addition to CLAUDE.md
"Orchestrator Dispatch Protocol"):

| Task | Right pick |
|------|-----------|
| Reason about architecture, return analysis | `code-architect` (opus) |
| Reason about architecture AND write the spec | `general-purpose` (sonnet) with the spec template inlined |
| Materialize a spec from architect's text | orchestrator writes it, or `general-purpose` (sonnet) |

## Promote to ADR?

No — fits into existing dispatch protocol as a tooling caveat. If we
hit this pattern 3+ times across different agents, promote to a
"Tool-Capability Verification Before Dispatch" ADR.
