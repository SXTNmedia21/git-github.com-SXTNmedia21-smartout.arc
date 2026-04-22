---
title: "Tabs-in-hub vs split-IA — resolve by splitting at route, unifying at entry"
id: LEARNING_0100
status: done
layer: learning
created: 2026-04-22
updated: 2026-04-22
tags: [information-architecture, ux, navigation, tabs, routing, pattern]
---

# Learning-0100: Tabs-in-hub vs split-IA — resolve by splitting at route, unifying at entry

## Context

Council 2026-04-22 (contract-management-redesign) Q2 asked where template stewardship should live in the information architecture. Two reasonable answers collided:

- **Steward + supervisor (option D):** split at the route — daily contract ops under `/contracts`, template stewardship under `/settings/contracts`. Rationale: access-control visibility per tab, cognitive load reduction, clean role-scoping (workspace admins who don't steward templates never see the authoring surface).
- **Frontend-designer (tabs-in-hub):** keep everything in a single `/contracts` hub with tabs for ops and setup. Rationale: discoverability, visual cohesion, single mental model.

Both reviewers were right. The stewardship surface is simultaneously "daily" (check drift, approve proposed clause updates) and "rare" (restructure a template from scratch). Pure split-IA forces two destinations; pure tabs-in-hub dilutes access-control visibility and buries the rare-but-critical authoring surface inside everyday UI.

## Discovery

When ops vs setup lines blur, neither pure split nor pure tabs wins. The stable resolution:

> **Split at route, unify at entry point via tabs.**

Concretely for contracts:

- `/contracts` — operations hub (daily). Tabs for active contracts, drafts, signatures pending.
- `/settings/contracts` — stewardship hub (rare). Tabs for K1a library, K1b forks, drift review, clause editor.
- Both destinations link to each other from a persistent cross-link in each hub's header — "Template stewardship →" from `/contracts`, "Active contracts →" from `/settings/contracts`.

Why this works:

- Access-control stays visible per tab — a workspace admin without steward scope sees a clean `/contracts` and never stumbles into authoring.
- Cognitive cost of two destinations is absorbed by the cross-links; reviewers get a bounded set of "where am I?" moments (two hubs, two breadcrumbs) rather than N tabs in one place.
- Tabs preserve within-hub cohesion — daily ops are grouped with daily ops, stewardship with stewardship.
- URL as source of truth — route reflects role and intent; deep links don't land users on a tab with no action affordance.

Anti-pattern: resolving the tension with "tabs at both destinations pointing to each other's content" — this produces the worst of both worlds (N tabs + two URLs + duplicate surfaces).

## Impact

Apply this pattern to any IA decision where a surface is both daily and rare:

- **Channels:** `/channels` daily, `/settings/channels` for channel-type authoring + help-desk config + AI policy (ADR-0165).
- **Training:** `/training` daily for assigned modules, `/settings/training` for curriculum authoring.
- **Governance:** `/dashboard/operations` daily for today's signatures, `/settings/governance` for authority-config authoring per ADR-0133 surface boundary.
- **Year wheel:** `/dashboard/year-wheel` for plan execution, `/settings/year-wheel` for cycle authoring + template seeding.

Council chair adds an IA check to Phase 5 synthesis: when two reviewers diverge on tabs-vs-split, test the "split at route, unify at entry" pattern before casting a majority vote. In the contract-redesign council this resolved Q2 without a 2-1 minority being overridden.

Not a hard rule yet — three confirmed uses of this pattern are needed before promoting to run-council SKILL.md. This is occurrence 1.

## References

- ADR-0133 — mobile surface boundary (web composes, mobile executes) — the same split-at-role reasoning applies at the route level within web.
- ADR-0165 — Progressive Channel Discriminator (channels as a surface that is both daily and setup-heavy).
- ADR-0181 — K1a→K1b lineage (the stewardship concern that forced this IA decision in the contract redesign).
- L-0048 — two-reviewer cross-lens convergence as high-signal evidence (sibling pattern for synthesis).
- L-0091 — semantic conflict resolution must classify minority positions (parent rule for this pattern).

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
