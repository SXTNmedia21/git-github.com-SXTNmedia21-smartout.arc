---
title: "App Router directory renames are safer than they appear"
id: LEARNING_0032
status: canonical
layer: learning
created: 2026-04-10
updated: 2026-04-10
tags: [next.js, app-router, refactoring, risk-assessment]
---

# Learning-0032: App Router directory renames are safer than they appear

## Context

During the Year Wheel UX Pivot council, the Supervisor recommended using a Next.js
rewrite (`/dashboard/year-wheel` -> `/dashboard/season` on filesystem) instead of
physically renaming a 22-file directory. The argument: "22 files, hundreds of import
paths at risk."

## Discovery

The System Steward verified the actual blast radius. In Next.js App Router:

- Internal relative imports (`./SeasonOverviewTab`, `../_hooks/use-seasons`) survive
  a directory rename unchanged because they reference siblings, not the route path.
- The only changes needed were 25 hardcoded `/dashboard/season` **strings** across
  14 files — all mechanically replaceable with grep.
- Zero cross-directory import changes were needed.

The "safe" option (rewrite) would have created permanent tech debt: a URL saying
`year-wheel` while the filesystem says `season`, confusing every future developer
who opens the folder.

## Impact

Before choosing a risk-mitigation strategy for route restructuring:

1. **Count actual broken references** — don't estimate from file count.
2. **Distinguish string references from import paths** — in App Router, the directory
   name IS the route, but internal imports are relative and survive renames.
3. **Prefer clean renames + redirects** over rewrites that create permanent
   URL/filesystem discrepancy.

The "safe-looking" option can create tech debt that outlives the risk it mitigates.

## References

- Council session: 2026-04-10 Year Wheel UX Pivot
- ADR-0085: Year Wheel Governance Policy
