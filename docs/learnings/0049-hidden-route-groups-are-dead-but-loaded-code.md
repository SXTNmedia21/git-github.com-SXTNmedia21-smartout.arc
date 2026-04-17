---
title: "Hidden route groups (href: null) are dead-but-loaded code — Expo Router compiles all of app/"
id: LEARNING_0049
status: canonical
layer: learning
created: 2026-04-17
updated: 2026-04-17
tags: [mobile, expo-router, ia, code-debt, council, bundle-size]
---

# Learning-0049: Hidden route groups ship in the bundle

## Context

2026-04-17 mobile strategy council. Steward and Supervisor independently flagged the same finding:

`apps/mobile/app/(app)/(payroll)/` contains 7 fully-coded screens (`index.tsx`, `payslip.tsx`, `payslip-detail.tsx`, `payroll-supplements.tsx`, `absence-balance.tsx`, `absence-request.tsx`, `timebank.tsx`).

`apps/mobile/app/(app)/_layout.tsx:73` registers the group with `href: null`, hiding it from the tab bar. There is no other entry point. The screens are unreachable from any navigation flow.

But Expo Router compiles every file under `app/` into the JS bundle. The 7 screens ship to every user, get evaluated at startup, and increase bundle size. They also confuse new contributors who find the files and assume they're live.

Additionally: `(payroll)/payroll-supplements.tsx` duplicates `(me)/payroll-supplements.tsx` — same screen at two routes, with different IA implications for deep links and analytics.

## Discovery

Expo Router's file-system-routing convention treats `app/**` as the route table. Hiding a group from the tab bar does NOT exclude it from the bundle. There is no "draft" or "scratch" location inside `app/`.

Patterns that cause hidden-but-loaded code:

- IA in flux: dev builds a new group while old group still exists, plans to delete old later (and forgets)
- A/B prototyping: dev codes both options, ships both, picks one in code review (never deletes the loser)
- Deferred features: dev codes the flow, hides it pending product decision, decision never comes
- Refactor-in-progress: moving screens between groups, hidden state during transition

All four patterns are common; none of them result in `git rm` discipline.

### The invariant

**If a screen is in `app/**` it ships. If you don't want it to ship, move it to `app/_dev/`, `apps/mobile/scratch/`, or delete it. `href: null` hides from UI; it does not exclude from bundle.**

For the duplicate-route case: two paths to the same screen breaks deep linking (which one wins?), notification routing, and analytics fingerprints. Pick one and delete the other.

## Application

- Mobile remediation week 1-2 deletes the `(payroll)/` group (per ADR-0128 + frontend-designer recommendation: Lønn becomes a Hjem card)
- Code review checklist: any new route group with `href: null` requires a comment explaining the in-flight reason and a follow-up issue link
- Bundle size monitoring: when bundle grows unexpectedly, audit `app/` for orphans first
- Naming convention: experimental routes go under `app/_experiments/` (Expo Router convention treats `_` prefix as ignored)

## Repeat-learning watch

If future council finds another `href: null` orphan group, escalate to a CLAUDE.md hard rule banning unreachable route groups in `app/`.
