---
title: "'Mobile parity with web' framing creates feature graveyards — ontology must come before features"
id: LEARNING_0044
status: canonical
layer: learning
created: 2026-04-17
updated: 2026-04-17
tags: [mobile, architecture, council, framing, cascade]
---

# Learning-0044: Mobile parity framing creates feature graveyards

## Context

2026-04-17 mobile strategy council. Pontus asked "what's missing/broken on mobile" with the implicit goal of "make mobile reach parity with web." Six prior councils (2026-03-26 through 2026-04-14) had all said "mobile = Phase 2" without explaining why. This council's two reviewers — system-steward (cascade ontology) and frontend-designer (UX verb-table) — independently arrived at the same boundary: web is an authoring/composition surface, mobile is an in-venue execution surface. They are different products that share a data model.

## Discovery

"Parity" framing assumes web and mobile are the same product on different screens. They are not. Web is desk-bound, two-handed, focused, 30+ minutes. Mobile in a bar mid-Friday-service is one-handed, wet-handed, 3-second attention, frequently interrupted. **Designing mobile as "smaller dashboard" produces UX that feels like a degraded port and goes unused.** Examples:

- Schedule drag-drop editor on mobile = unusable on a phone, easier on a 27" screen
- Onboarding wizard (10 sections) on mobile = abandoned at section 3
- Contract authoring on mobile = wrong tool, wrong moment
- Governance policy authoring on mobile = same

The right question is not "what does web have that mobile doesn't" — it is "what does mobile do that web cannot do as well." Camera evidence, GPS clock-in, push-driven D6 hooks, biometric C4 confirmation, voice-first onboarding — these are cascade extensions that *require* mobile, not "mobile features."

### The high-signal moment

Two reviewers from different lenses (cascade ontology + UX verb table) arrived at the same conclusion independently. Frontend's verb table:

| Verb | Web | Mobile |
|---|---|---|
| Author/Compose/Plan | YES | NO |
| Approve/Execute/Witness | limited | YES (primary) |

Maps almost perfectly onto cascade dimensions:
- Web = D1–D5 authoring
- Mobile = D6 production + C4 acceptance

When two reviewers from different domains converge on the same ontology from different angles, that is a strong signal — trust it.

## Application

When a feature is requested for mobile:
1. **Classify the verb.** Author/Compose/Plan → push back; this is web's domain. Approve/Execute/Witness → in scope.
2. **Map to cascade.** Which D-dimension or C-plane does this touch? If you can't name it, the feature isn't ready.
3. **Ask "why mobile?".** If the answer is "parity," reject. If the answer is "in-venue moment," approve.
4. **Watch for two-reviewer convergence.** When cascade-aware and design-aware reviewers agree on a boundary, treat it as an axiom.

ADR-0128 (Web Composes, Mobile Executes) codifies this learning. Future councils invoking "mobile parity" framing should be redirected to that ADR.

## Repeat-learning watch

If a future council surfaces the same "mobile parity" framing without referencing ADR-0128, that is a process gap — the ADR isn't reaching the right place. Promote into CLAUDE.md if it recurs.
