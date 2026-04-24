---
title: "Plan — nordic-split-phase-2"
feature: nordic-split-phase-2
spec: docs/superpowers/specs/2026-04-23-nordic-split-phase-2.md
status: done
updated: 2026-04-23
created: 2026-04-23
module: Dashboard
tags: [plan, design-system, nordic-split, refactor]
---

# Plan — nordic-split-phase-2

> Branch: `feat/helpdesk-nordic-split-phase-2` | Worktree: `/home/sxtnl/dev/smartout.ai-helpdesk-wt-2` | Base: `campaign/helpdesk` | Module: Dashboard | Started: 2026-04-23

**Parent:** sub-sortie of `campaign/helpdesk`
**Follows:** `feat/helpdesk-nordic-split-phase-1` (commits `44eb5188` + `8ff0eae4`)
**Spec:** [Nordic Split Phase 2 — Organization klynge](../superpowers/specs/2026-04-23-nordic-split-phase-2.md)

## Context

Phase 1 migrated arkitektur-kritiske filer (`DashboardShell.tsx` + `GlobalSearchPalette.tsx`, 99 refs). Council 2026-04-23 verdict: APPROVE WITH NOTES — zero channel/chat/mobile regresjoner, Option C hybrid strategy bestått.

Phase 2 tar `/dashboard/organization/` klyngen — 442 treff i 7 filer. Dette er den visuelt mest sammenhengende sonen (locations, teams, departments, overview) og trenger konsistent paletten på tvers.

## Scope

**7 filer, 442 treff:**

| # | Fil | Treff |
|---|---|---|
| 1 | `apps/web/src/app/dashboard/organization/_components/locations-tab.tsx` | 74 |
| 2 | `apps/web/src/app/dashboard/organization/teams/[id]/page.tsx` | 72 |
| 3 | `apps/web/src/app/dashboard/organization/_components/overview-tab.tsx` | 69 |
| 4 | `apps/web/src/app/dashboard/organization/locations/[id]/page.tsx` | 67 |
| 5 | `apps/web/src/app/dashboard/organization/departments/[id]/page.tsx` | 63 |
| 6 | `apps/web/src/app/dashboard/organization/_components/departments-tab.tsx` | 57 |
| 7 | `apps/web/src/app/dashboard/organization/_components/teams-tab.tsx` | 40 |

Phase 3 (schedule, reports, my-schedule, handbook, scrape, page.tsx) planlagt som egen sub-sortie etterpå.

## Journeys (the contract)

- [JOURNEY-nordic-split-phase-2-admin-ser-konsistent-organization](../journeys/JOURNEY-nordic-split-phase-2-admin-ser-konsistent-organization.md) — Admin navigerer gjennom locations/teams/departments/overview med Nordic Split-tokens i begge temaer uten visuelle regresjoner

## Strategy (inherited from Phase 1 council)

**Option C (Hybrid collapse).** Per frontend-designer verdict 2026-04-23:

- Samle `isDark ? X : Y` ternaries hvor begge grener mapper til samme semantiske token
- Bevar ternaries hvor shadow/gradient/oklch mangler token-ekvivalent
- Replace `data-[selected=true]:bg-zinc-*` med `data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground`
- Defer hardkodet `oklch()` til Phase 2.5 — **IKKE** touch i denne sub-sortie
- Preserved ternaries får `// Nordic Split: no shadow token exists — Phase 2.5 candidate.` kommentar

## Canonical mapping table (same as Phase 1)

| zinc-klasse | Erstatt med |
|---|---|
| `bg-zinc-{50,100}`, `bg-white` (page bg) | `bg-background` |
| `bg-zinc-{900,950,800}`, `bg-white` (card) | `bg-card` |
| `bg-zinc-{200,800}` (muted surface) | `bg-muted` |
| `text-zinc-{100,200,300,900}`, `text-white` | `text-foreground` |
| `text-zinc-{400,500,600,700}` | `text-muted-foreground` |
| `border-zinc-*` | `border-border` |
| `hover:bg-zinc-*` | `hover:bg-accent` |
| `hover:text-zinc-*`, `hover:text-white` | `hover:text-accent-foreground` |
| `placeholder:text-zinc-*` | `placeholder:text-muted-foreground` |
| `data-[selected=true]:bg-zinc-*` | `data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground` |
| `shadow-zinc-300/50` | `shadow-border/50` |
| `divide-zinc-*` | `divide-border` |
| `ring-zinc-*` | `ring-ring` |

## Tasks

- [x] **Recon** — skipped (Phase 1 proved strategy; mapping-tabell direkte)
- [x] **Implementation** — én implementer agent, 7 filer, 442 refs → 0
- [x] **Grep gate** — 0 zinc/gray/slate i alle 7 filer
- [x] **Code review** — inline (implementer rapport + grep verifisert)
- [x] **Design review** — arvet fra Phase 1 council (Option C)
- [x] **Typecheck** — `pnpm --filter web typecheck` 0 errors
- [x] **Lint** — 0 errors, 24 pre-existing warnings (5 isDark-unused fikset via _isDark)
- [x] **Commit** — 1 atomic commit (8eb50238) for alle 7 filer
- [x] **Journey flip** — `status: verified` (code-level; visual deferred)

## Acceptance Criteria

- [ ] Grep 0 zinc/gray/slate i alle 7 filer
- [ ] Typecheck 0 errors (`pnpm --filter web typecheck`)
- [ ] Lint 0 nye errors
- [ ] Code review: ingen P1s
- [ ] Journey verified for code-level
- [ ] Mobile boundary: 0 mobile-filer endret
- [ ] 0 ChatPanel/komm/channel-logic endret i diff

## Out of scope

- Phase 3 (schedule/reports/my-schedule/handbook/scrape/page.tsx — ~957 treff)
- Hardkodede `oklch()` verdier (Phase 2.5)
- Orange brand-signaler (Phase 2.5 — `bg-signal-live` semantisk token)
- `--card-elevated` token (fra Phase 1 council backlog)
- Mobile parity (allerede 0 treff)
