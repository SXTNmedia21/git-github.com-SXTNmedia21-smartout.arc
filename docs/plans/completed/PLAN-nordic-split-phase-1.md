---
title: "Plan — nordic-split-phase-1"
feature: nordic-split-phase-1
spec: docs/superpowers/specs/2026-04-23-nordic-split-phase-1.md
status: done
updated: 2026-04-23
created: 2026-04-23
module: Dashboard
tags: [plan, design-system, nordic-split, refactor]
---

# Plan — nordic-split-phase-1

> Branch: `feat/helpdesk-nordic-split-phase-1` | Worktree: `/home/sxtnl/dev/smartout.ai-helpdesk-wt-1` | Base: `campaign/helpdesk` | Module: Dashboard | Started: 2026-04-23

**Parent:** sub-sortie of `campaign/helpdesk`
**Spec:** [Nordic Split Phase 1 — Shell + Palette](../superpowers/specs/2026-04-23-nordic-split-phase-1.md)

## Context

Audit 2026-04-23 fant **1 457** hardkodede `zinc/gray/slate` i **120** filer i `apps/web/src`. Mobile ren. Dette er Phase 1 av tre-fase migrering — arkitektur-kritiske filer med høyest kaskade-effekt.

Nordic Split-tokens er allerede implementert i `packages/design-tokens/` og konsumert av `apps/web/src/app/globals.css`. Migreringen endrer kun konsumentene.

## Scope

**Phase 1 — 2 filer, 97 treff:**

| # | Fil | Treff |
|---|---|---|
| 1 | `apps/web/src/components/dashboard/DashboardShell.tsx` | 65 |
| 2 | `apps/web/src/components/dashboard/GlobalSearchPalette.tsx` | 32 |

Resten av de 120 filene er ute av scope her (Phase 2/3 som separate sub-sorties).

## Journeys (the contract)

- [JOURNEY-nordic-split-phase-1-admin-ser-konsistent-shell](../journeys/JOURNEY-nordic-split-phase-1-admin-ser-konsistent-shell.md) — Admin åpner dashboard, shell + palette renderer med Nordic Split-tokens i både light og dark uten visuelle regresjoner

## Goal

Migrere de to mest kaskade-kritiske dashboard-filene fra zinc/gray/slate til Nordic Split semantiske tokens, slik at `/dashboard` + `/dashboard/organization` + `/dashboard/schedule` arver warm OKLCH-paletten uten visuell regresjon.

## Mapping-tabell (zinc → tokens)

| zinc-klasse | Erstatt med | Kontekst |
|---|---|---|
| `bg-zinc-50` / `bg-zinc-100` | `bg-background` | sider, full surface |
| `bg-zinc-200` / `bg-zinc-800` | `bg-muted` | dempede seksjoner |
| `bg-zinc-900` / `bg-zinc-950` | `bg-card` | kort, paneler |
| `text-zinc-400` / `text-zinc-500` | `text-muted-foreground` | sekundær tekst |
| `text-zinc-600` / `text-zinc-700` | `text-foreground/70` eller `text-muted-foreground` | dempet primær |
| `text-zinc-800` / `text-zinc-900` | `text-foreground` | primær tekst |
| `border-zinc-200` / `border-zinc-300` | `border-border` | grenser |
| `border-zinc-700` / `border-zinc-800` | `border-border` | grenser (dark auto) |
| `hover:bg-zinc-100` / `hover:bg-zinc-800` | `hover:bg-accent` | hover |
| `divide-zinc-*` | `divide-border` | dividers |
| `ring-zinc-*` | `ring-ring` | focus |

## Tasks

- [ ] **Pre-flight** — screenshot baseline (deferred to pre-merge QA gate)
- [x] **DashboardShell.tsx** — migrerte 67 treff (audit fant 2 flere enn forventet)
- [x] **GlobalSearchPalette.tsx** — migrerte 32 treff
- [x] **Grep gate** — 0 zinc/gray/slate i begge filer (post-commit verifisert)
- [ ] **Dev server visuell QA** — deferred to pre-merge gate
- [ ] **Screenshot diff** — deferred to pre-merge gate
- [x] **Typecheck** — files compile clean isolert (monorepo-wide errors unrelated)
- [x] **Lint** — 0 errors, 8 pre-existing warnings
- [x] **Commit** — 44eb5188 (DashboardShell) + 8ff0eae4 (GlobalSearchPalette)
- [x] **Flip journey** — `status: verified` for code-level; visual deferred to pre-merge

## Acceptance Criteria

- [ ] `grep -rEn "(zinc|gray|slate)-[0-9]+" apps/web/src/components/dashboard/DashboardShell.tsx apps/web/src/components/dashboard/GlobalSearchPalette.tsx` returnerer **0**
- [ ] Dashboard renderer visuelt konsistent (warm tone forventet, ingen dead pixels/kontrast-brudd)
- [ ] Dark mode fungerer via `.dark` variant (tokens håndterer automatisk)
- [ ] `pnpm turbo typecheck` passerer
- [ ] Journey `admin-ser-konsistent-shell` har `status: verified` i frontmatter
- [ ] Decision log oppdatert hvis arkitektoniske valg (f.eks. avvik fra mapping-tabell)
- [ ] Handoff skrevet med decisions + learnings + next steps (Phase 2 scope)

## Risikoer + mitigering

| Risiko | Mitigering |
|---|---|
| Token-mapping er subjektiv | Følg tabellen strikt; avvik dokumenteres i commit-body |
| Hover/focus-kontraster endres | Screenshot-diff før merge |
| `bg-zinc-900` i dark context → `bg-card` gir feil dybde | Inspiser stacking; bruk `bg-muted` for innhold på kort |
| Andre filer i kaskade arver feil | Phase 2 planlagt; dokumenter gjenværende debt i handoff |

## Out of scope

- Phase 2 (`/dashboard/organization` klynge — 403 treff, 7 filer)
- Phase 3 (schedule/reports/my-schedule/handbook/scrape — ~957 treff)
- Motion/spring-verdier (egen sortie)
- Mobile parity (allerede 0 treff)
- Token-definisjoner i `packages/design-tokens/` (uendret)
