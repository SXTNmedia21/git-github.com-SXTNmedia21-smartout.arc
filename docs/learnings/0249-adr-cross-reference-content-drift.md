---
title: "ADR cross-reference content-drift — cite ADR title + number, never number alone"
id: L-0249
status: accepted
created: 2026-05-14
updated: 2026-05-14
module: governance
related_adrs:
  - ADR-0161
  - ADR-0162
  - ADR-0163
  - ADR-0268
tags: [adr, cross-reference, governance, council, drift]
---

# L-0249: ADR cross-reference content-drift

## Context

Discovered during Council 2026-05-14 reviewing ADR-0268 status flip (`proposed` → `accepted`). ADR-0268 cited "ADR-0163 helpdesk hub work" / "ADR-0163 (kanaler-som-helpdesk)" in three places (lines 37, 66, 126) as the absorption decision for the `(komm)` tab. All three citations were wrong:

- **ADR-0163** is titled "ADR-0078 amendment — `allowedChannels` mandatory for PII-handling capabilities" — a PII channel-restriction amendment, orthogonal to UX layout.
- The actual helpdesk decisions from the 2026-04-19 Kanaler-som-Helpdesk Council were **ADR-0161** (helpdesk ontology = `engine_state` Alt D) + **ADR-0162** (helpdesk capability placement).
- The author of ADR-0268 conflated "the Kanaler Council" with "the highest-numbered ADR from that council" — but the Council produced 4 ADRs (0160–0163), and the helpdesk decisions were the lower numbers.

The implementation was correct (Chat tab has `Skranke` segment, `(komm)` route retained as detail surface, ticket detail reads `engine_state` per ADR-0161). Only the ADR-0268 narrative text was wrong. A future reader chasing the cross-reference would land on ADR-0163 (PII rules) and find nothing about absorption — a 30+ minute investigation loop.

## Class of trap

**Cross-reference content-drift.** Distinct from:
- *Renumber-side drift* (`reference_adr_renumber_pattern.md` — same number means different ADR after a renumber).
- *Content-side drift* (this one — the number is correct but the author cited the wrong ADR from the same council/cluster).

Both fail silently. Both cost cleanup minutes. Both compound when the cited ADR is widely linked (this was line 37, 66, 126 in ADR-0268 alone).

## Rule

**When ADR-A cites ADR-B, always cite ADR-B by both title and number.**

Bad:
```markdown
- (komm) absorbed by ADR-0163 helpdesk hub
- See ADR-0163 (kanaler-som-helpdesk)
```

Good:
```markdown
- (komm) list logic absorbed into Chat tab Skranke segment per ADR-0161 (helpdesk ontology = engine_state) + ADR-0162 (capability placement)
- ADR-0163 (PII allowedChannels mandatory) — orthogonal, applies to capability registration, not UX layout
```

The title surfaces the trap at write-time. The number alone hides it.

## Why this matters

Cross-references are load-bearing for ADR comprehension. They tell future readers which decisions interlock. A wrong number that LOOKS right (because it's adjacent in the council that produced it) is worse than a wrong number that LOOKS wrong — the reader doesn't even know to question it.

The 2026-05-14 Council caught this because the briefing pre-flagged "ADR-0163 title is PII allowedChannels, NOT kanaler-som-helpdesk." Without that pre-flag, all 4 reviewers might have chased the wrong reference.

## Application

When writing ADRs:
1. Cite cross-referenced ADRs by `**ADR-N** — <title fragment>` minimum.
2. When citing a Council that produced multiple ADRs, enumerate each one and what it decided. Avoid shorthand like "the X Council ADRs" or "ADR-N work".
3. When amending an existing ADR's cross-references, grep the cited ADR's frontmatter title before linking — confirm the citation matches what the cited ADR actually decided.

When reviewing ADRs:
1. Spot-check every cross-reference — read the cited ADR's title, confirm topic alignment.
2. Treat single-number citations (no title fragment) as a smell.

## Pattern frequency

5th observed instance of ADR cross-reference drift overall (4 prior were renumber-side per `reference_adr_renumber_pattern.md`; this is the 1st content-side instance — first of a new sub-class). Promote to skill enforcement on 3rd content-side occurrence per Council self-improvement protocol.

## Related
- `reference_adr_renumber_pattern.md` — renumber-side drift (sibling sub-class)
- Council 2026-05-14 — verdict that caught this
- ADR-0268, ADR-0161, ADR-0162, ADR-0163 — the involved ADRs
