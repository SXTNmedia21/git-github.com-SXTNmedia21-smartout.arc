---
title: "UX Compose vs Author Verb Collision Pattern"
id: LEARNING_0174
status: canonical
layer: learning
created: 2026-04-29
updated: 2026-04-29
tags: [ux, cascade, verb-pattern, contract-module]
---

# Learning-0174: UX Compose vs Author Verb Collision

## Context

Council 2026-04-29 Frontend Designer review of Contract Module Phase 0a found Journey 1 (admin authors 15 §14-6 fields inline on `/dashboard/people/[id]`) collides with Journey 2 (admin opens 5-step CompositionDrawer to compose+send contract). Two different UX models for the same data. Council 2026-04-22 had previously approved 5-step drawer; Council 2026-04-29 proposed 2-step regression.

Resolution: people-page = author the data; drawer = compose & dispatch the document. Consistent with cascade pattern (D1–D5 author, D6 produces).

## Discovery

Cascade pattern verbs are distinct ontological actions:
- **Author** (D1–D5) = create or edit canonical data shape (employment terms, schedule template, framework rules)
- **Compose** (intermediate) = combine canonical data with template into produced artefact (PDF, schedule instance, calculated value)
- **Dispatch** (D6) = send produced artefact to consumer (employee for signing, employee for shift, payroll system for processing)

Collisions happen when one UI surface tries to do two verbs at once. Symptoms:
- Wall-of-form on a "compose" drawer (because authoring is also happening there)
- Stale ghost values in compose UI (because authoring happens elsewhere but isn't reflected)
- Write conflicts (two surfaces editing same data)
- Council approves N-step drawer; next council proposes M-step regression

Pattern signature:
- Same data appears in multiple UI surfaces with edit affordance
- Drawer/modal/wizard step count keeps changing across council reviews
- Spec talks about "authoring" and "sending" interchangeably

## Impact

**Frontend review checklist:** for any new UI surface, identify which cascade verb it implements. If multiple verbs, split into separate surfaces.

**Migration map requirement:** when consolidating from N-step to M-step UX, list every element being relocated/dropped, with destination. Council 2026-04-29 Frontend Council provided concrete map for 5→2-step drawer (compliance badge → people-page section header; cascade ghost-values → inline input fields; AcknowledgementRing → drawer Step 2; etc.).

**ADR-0001-contract-service amendment / ADR-0236 enforces:** people-page authors employment data via inline-save sections; drawer composes+dispatches contract document. No edit affordance on drawer's compose step.

**Reusable cascade pattern application:** schedule (week-template authoring vs day-instance dispatch), framework (rule authoring vs binding to workspace), tariff (rate authoring vs application to contracts). Same verb-collision risk in each.

## References

- ADR-0133 (web composes, mobile executes — cascade surface boundary)
- ADR-0236 (amendment flow + AcknowledgementRing — addresses verb separation in contract UX)
- Council 2026-04-22 Contract Hub Redesign (prior UX approval)
- Council 2026-04-29 Contract Module Phase 0a (this learning)
- Cascade Core Foundation spec — verb taxonomy

---

> Registered in `docs/learnings/0000-learning-log.md` 2026-04-29.
