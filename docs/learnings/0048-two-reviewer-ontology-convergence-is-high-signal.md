---
title: "Two reviewers from different domains converging on the same ontology is a high-signal moment"
id: LEARNING_0048
status: canonical
layer: learning
created: 2026-04-17
updated: 2026-04-17
tags: [council, process, ontology, signal-detection, meta]
---

# Learning-0048: Two-reviewer ontology convergence is high signal

## Context

2026-04-17 mobile strategy council. Two reviewers approached the topic from very different lenses:

- **system-steward** via cascade ontology: rejected "mobile = replica of web" framing; proposed "mobile = D6 production + C4 acceptance surface"
- **frontend-designer** via UX verb table: rejected "feature parity" framing; proposed "web composes, mobile executes"

They were dispatched in parallel with different briefings tailored to their domains. They had not seen each other's responses when writing. **They independently arrived at the same boundary** — Frontend's verb table maps almost perfectly onto cascade dimensions:

| Frontend's verb | Cascade mapping |
|---|---|
| Author / Compose / Plan (web) | D1–D5 authoring |
| Approve / Execute / Witness (mobile) | D6 production + C4 acceptance |

Steward's Phase 5 synthesis explicitly noted this: "Two independent reviewers (one cascade-aware, one design-aware) converged on the same ontology from different directions. **High confidence signal.**"

## Discovery

When parallel reviewers from different lenses arrive at the same conceptual boundary without seeing each other's work, that boundary is more likely to be a real structural truth than a coincidence. Conversely, when reviewers disagree, the disagreement is information — usually pointing at a missing distinction or unresolved tradeoff.

Council process should treat:

- **Two-reviewer convergence on ontology** = high signal, lift to ADR
- **Two-reviewer divergence** = surface for explicit synthesis (Phase 5 conflict resolution table)
- **Single reviewer insight not echoed** = treat with normal weight; ask if the absence of echo is signal

### The invariant

**Convergence across different lenses is rarer than agreement within the same lens. When it happens, it means the underlying structure is real enough that multiple framings see it.** This is the council's strongest output type.

## Application

- Phase 5 conflict resolution should explicitly call out cross-lens convergence (not just classify same/different/partial)
- Council log entries should note when convergence happened, so future councils can pattern-match
- ADRs born from cross-lens convergence are more likely to age well (e.g. ADR-0128)
- If reviewers from different lenses *disagree*, that's also high signal — it usually means a hidden distinction needs surfacing

## Repeat-learning watch

If 3+ future councils show cross-lens convergence patterns that produced sound ADRs, promote this to a SKILL.md rule: "Phase 5 must explicitly score convergence-across-lenses."
