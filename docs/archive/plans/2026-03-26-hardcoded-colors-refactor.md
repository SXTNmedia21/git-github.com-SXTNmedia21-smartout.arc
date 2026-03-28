---
title: "Refactor: Replace 140 hardcoded colors with CSS variables"
status: backlog
updated: 2026-03-26
created: 2026-03-26
module: design-tokens
tags: [refactor, design-system, nordic-split]
---

# Refactor: Replace 140 Hardcoded Colors with CSS Variables

**Priority:** Low (not breaking, cosmetic debt)

## Background

Nordic Split design system audit (2026-03-25) found **140 files** in `apps/web/src` using hardcoded Tailwind classes (`bg-zinc-*`, `text-zinc-*`, `bg-gray-*`, `bg-slate-*`, `bg-[#...]`) instead of CSS variables (`bg-background`, `text-foreground`, `text-muted-foreground`).

## Scope

- 140 tsx files in `apps/web/src/`
- Heaviest areas: dashboard, platform-admin, organization, reports, schedule, season
- Not in scope: `#f97316` in chart data, email templates, `var(--brand, #f97316)` fallbacks

## Approach

1. Map hardcoded values → CSS variable equivalents
2. Module-by-module migration (dashboard first)
3. Verify dark mode after each batch
