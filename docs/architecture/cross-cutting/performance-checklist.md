---
title: "Performance and Build Checklist"
id: XCUT_PERF_CHECKLIST
version: "1.0"
status: canonical
layer: cross-cutting
created: 2026-02-28
updated: 2026-02-28
author: claude
supersedes: []
superseded_by: null
depends_on:
  - XCUT_PERF_GOVERNANCE
tags:
  - performance
  - checklist
  - build
  - pr-review
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Performance and Build Checklist

Use this checklist for PRs that touch `web` or `landing` UI routes.

- Is this route server-first unless interactivity is truly required?
- Did you avoid adding new top-level `"use client"` boundaries in layouts?
- Are heavy components loaded with `next/dynamic` when possible?
- Are long lists/grids memoized or otherwise protected against unnecessary rerenders?
- Are expensive animations avoided above the fold, or gated by reduced-motion?
- Did you avoid adding hardcoded localhost/cross-origin navigation links?
- Did you verify route budgets still pass for modified routes?
- If budgets regressed, did you add owner, reason, and expiry for temporary exemption?

## Route Risk Triggers

If your PR includes any of the following, run extra validation:

- DnD systems (`@dnd-kit/*`)
- Charting libraries
- Continuous animations (`animate-pulse`, large blur layers, blend effects)
- Voice/RTC modules
- Large data tables

## Verification Commands

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm perf:audit:web`
- `pnpm perf:audit:landing`
