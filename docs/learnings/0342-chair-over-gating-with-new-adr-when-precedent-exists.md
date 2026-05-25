---
id: L-0342
title: Chair over-gating with new-ADR when precedent exists at file:line
status: canonical
layer: learning
created: 2026-05-24
updated: 2026-05-24
module: governance
council_refs: [council-2026-05-24-domain-skill-structure-governance-audit]
tags: [learnings, council-protocol, chair-reversal, l-0147, adr-gating, governance]
---

# L-0342 — Chair over-gating with new-ADR when precedent exists

## Context

Council 2026-05-24 (Domain-skill ↔ structure governance audit, Fix F).

Chair Phase 3 verdict: **DEFER Fix F** (adding inline-prose `docs/domains/` pointer to 4 agent definition files) and demand a **new ADR** before any agent-file edits, citing this as a "namespace/authority boundary change."

Two reviewers voted opposite with file:line code-trace evidence:
- **Supervisor:** `botsson-harness-builder.md:11-21` already lists numbered "First Read, Every Session" items — adding item 8 is mechanical, not architectural.
- **Agent-coord:** `supervisor.md:24-33` (Prime Directive §READ BEFORE YOU SPEAK) already has a numbered read-order list — prepending step 0 is following existing precedent, not creating new authority structure.

Phase 5 synthesis applied L-0147 protocol. Chair classified Phase 3 DEFER as **REVERSED** — Fix F ships without a new ADR, because the change is mechanical addition to existing lists, not a new boundary or authority declaration.

## Discovery

Chair's default-to-ADR behavior is correct when a change:
- Creates a new authority boundary (who owns what)
- Adds a new namespace (new capability, new capability tool, new data domain)
- Changes how two components interact for the first time
- Introduces a new pattern with no precedent in the codebase

Chair's default-to-ADR behavior is **WRONG** when a change:
- Adds one bullet/step to an existing numbered list following the same format
- Names an existing file/system already referenced elsewhere in the same file class
- Has a **file:line precedent** demonstrating the pattern is already established

The discriminating test before demanding an ADR: **"Is there a file:line precedent for this exact pattern in this codebase?"**

- If YES: the change is mechanical. ADR is overkill. No new authority boundary is created.
- If NO: the change is architectural. ADR is warranted.

In this case: `botsson-harness-builder.md:11-21` + `supervisor.md:24-33` both proved the pattern "numbered list of pre-work reads in agent definition file" was already established. Adding to an existing list is not an architectural decision.

## Impact

- Chair must run the "file:line precedent" check before blocking on ADR demand — 30-second grep is sufficient.
- Sibling of L-0147 (single-axis chair insufficient) — same structural cause: chair reasons at prose/abstract level and misses concrete code-level precedent.
- Sibling of L-0298 (mapping-fidelity only caught by code-trace) — same asymmetry, different domain.
- L-0147 counter: this council is the **7th precedent** by whole-verdict count (post-L-0294 standardization). Prior count in L-0341 was 10 (sub-axis events counted separately) — the "7th" here refers specifically to whole-verdict-on-Fix-F reversal vs prior precedent list.

## References

- Run-council SKILL.md Phase 5 §1.5 — L-0147 protocol enforcement block
- L-0147 — chair self-reversal origin
- L-0341 — 10th precedent (prior council, whole-verdict count)
- `botsson-harness-builder.md:11-21` — precedent evidence (numbered First Read list)
- `supervisor.md:24-33` — precedent evidence (numbered READ BEFORE YOU SPEAK list)
- Council session 2026-05-24 — `docs/council/COUNCIL-LOG.md`

---

> Registered in `docs/learnings/0000-learning-log.md`.
