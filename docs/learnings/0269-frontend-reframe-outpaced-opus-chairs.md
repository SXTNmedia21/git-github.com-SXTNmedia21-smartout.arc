---
title: "Frontend Designer reframe outpaced opus chairs on structural problem"
id: L-0269
status: canonical
created: 2026-05-14
updated: 2026-05-14
module: governance
tags: [council, council-protocol, design-role, reframe, adr-0325, l-0147]
---

# L-0269: Frontend reframe outpaced opus chairs

## Context

2026-05-14 ADR-0325 council (tool-name discipline follow-up). The briefing framed the problem as "collision as conflict" — two tools with the same name are in conflict and must be disambiguated (either by renaming or by a central allowlist). Three opus reviewers (Steward, Supervisor, Agent-Coord) all accepted this framing and debated between Options A, B, and C.

Frontend Designer (sonnet) reframed the problem: "collision as duplicate-OR-conflict." Most collisions represent the SAME operation viewed from different mount points. `listOpenDeviations` in `hms/` and `listOpenDeviations` in `governance/` may be identical semantics — the collision is a DUPLICATE, not a CONFLICT. Duplicates should collapse to one shared definition (Alternative D semantic dedupe), not be renamed to distinguish non-existent differences.

This reframe changed the decision space entirely: Phase 2 dedupe likely collapses 6-8 of 11 collisions to shared mounts, leaving only 3-5 genuine conflicts for targeted rename. Total rename scope: 3-5 names instead of 241.

## Learning

**Design role's surface-level pattern recognition occasionally catches structural smell that code-tracers miss because they verify the question instead of questioning it.** Opus reviewers traced whether Option A would break the LLM (answering the question the briefing asked). Frontend Designer asked whether the question was right (questioning the briefing's framing).

**Counter-detection pattern:** When 3+ reviewers all converge on accepting a briefing framing without challenge — especially when all reviewers are in the same role category (all code-tracers, all architects) — that is a smell. The council chair should explicitly ask: "Is the problem actually X, or is the framing of X masking Y?"

**Formal addition to council Phase 3 protocol:** Before Phase 3 dispatch, chair should include at least one reviewer from a role orthogonal to the majority. For "naming convention" decisions (code-structural), include frontend or UX role explicitly — they are trained to recognize structural patterns from the user/author side, which complements code-tracer tracing from the implementation side.

**This is the first occurrence of "design role reframe outpaced code-tracer consensus."** Promote to SKILL.md Phase 3 dispatch guidance on 3rd occurrence.

## Cross-references

- ADR-0325 (tool-name discipline — council where this surfaced)
- L-0147 (Chair self-reversal on falsified briefing claims — sibling; this is "reviewer accepts wrong framing" variant)
- L-0239 (Retrospective briefings are claims — sibling, briefing-trust class)
- ADR-0326 (sharedMount flag — the mechanism Alternative D enabled)
- COUNCIL-LOG.md 2026-05-14 late evening (Frontend Designer role attribution)
