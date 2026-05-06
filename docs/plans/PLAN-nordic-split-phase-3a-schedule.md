---
title: "Plan — nordic-split-phase-3a-schedule"
feature: nordic-split-phase-3a-schedule
spec: docs/superpowers/specs/2026-04-23-nordic-split-phase-3a-schedule.md
status: draft
updated: 2026-04-23
created: 2026-04-23
module: Dashboard
tags: [plan, design-system, nordic-split, refactor, schedule]
---

# Plan — nordic-split-phase-3a-schedule

> Branch: `feat/helpdesk-nordic-split-phase-3a-schedule` | Worktree: `/home/sxtnl/dev/smartout.ai-helpdesk-wt-1` | Base: `campaign/helpdesk` | Module: Dashboard | Started: 2026-04-23

**Parent:** sub-sortie of `campaign/helpdesk`
**Follows:** Phase 1 (closed `3323bccc`) + Phase 2 (closed `a45b2e36`)
**Spec:** [Nordic Split Phase 3a — Schedule cluster](../superpowers/specs/2026-04-23-nordic-split-phase-3a-schedule.md)

## Scope

**3 files, 162 zinc refs:**

| # | Fil | Treff |
|---|---|---|
| 1 | `apps/web/src/app/dashboard/schedule/_components/daily-briefing.tsx` | 85 |
| 2 | `apps/web/src/app/dashboard/schedule/page.tsx` | 50 |
| 3 | `apps/web/src/app/dashboard/my-schedule/_components/MyWeekView.tsx` | 27 |

Tightest visual cluster — schedule surfaces that users see together. Remaining Phase 3 (reports + landing + employee dashboard + long tail ~635 refs) as separate sub-sorties.

## Strategy

**Option C (Hybrid Collapse)** — inherited from Phase 1 council 2026-04-23 verdict, validated 1:1 through Phase 2 (442 refs, 0 regressions). Same mapping table applied literally.

## Mapping table

| zinc | Nordic Split token |
|---|---|
| `bg-zinc-{50,100}`, `bg-white` (page bg) | `bg-background` |
| `bg-zinc-{900,950,800}`, `bg-white` (card) | `bg-card` |
| `bg-zinc-{200,800}` (muted tray) | `bg-muted` |
| `text-zinc-{100,200,300,900}`, `text-white`, `text-black` | `text-foreground` |
| `text-zinc-{400,500,600,700}` | `text-muted-foreground` |
| `border-zinc-*` | `border-border` |
| `ring-zinc-*` | `ring-ring` |
| `hover:bg-zinc-*` | `hover:bg-accent` |
| `hover:text-zinc-*`, `hover:text-white` | `hover:text-accent-foreground` |
| `placeholder:text-zinc-*` | `placeholder:text-muted-foreground` |
| `data-[selected=true]:bg-zinc-*` | `data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground` |
| `shadow-zinc-*/N0` | `shadow-border/N0` |
| `divide-zinc-*` | `divide-border` |
| `bg-zinc-400` (knob) | `bg-muted-foreground` |
| `bg-zinc-700` (disabled) | `bg-muted` |

## Tasks

- [ ] Implementer: 3 files, 162 refs → 0
- [ ] Grep gate
- [ ] Typecheck
- [ ] Lint (fix any new isDark-unused with `_` prefix)
- [ ] Commit
- [ ] Handoff + journey verified

## Acceptance Criteria

- [ ] 0 zinc/gray/slate in all 3 files
- [ ] Typecheck 0 errors
- [ ] Lint 0 new errors
- [ ] Journey verified for code-level
- [ ] 0 mobile files touched
- [ ] 0 channel/chat logic changed

## Out of scope

- Reports cluster (Phase 3b — 121 refs, 5 files)
- Landing page + EmployeeDashboard + scrape + long tail (Phase 3c — ~635 refs)
- Phase 2.5 (card-elevated token, oklch cleanup, brand-signal semantic tokens — council required)
- Hardcoded oklch() values — preserve as Phase 2.5 candidates
