---
title: Polish Index — coverage, performance, harness tools
status: live
updated: 2026-05-20
module: meta
tags: [polish, coverage, performance, harness]
---

# Polish Index

> **Generated** by `pnpm --filter web polish:index` — DO NOT hand-edit.
> Truth sources: `.claude/page-polish/*.run.yml`, `apps/web/.botsson/site-map.json`,
> live source grep of Tier 0 primitives. Regenerate after touching any of them.
> Last generated: 2026-05-20T20:11:14.152Z

## Coverage Rollup

| Metric | Value |
|---|---|
| Routes tracked | 64 |
| Routes verified | 53 (83%) |
| Median warm LCP | 1086 ms |
| Median warm CLS | 0.001 |
| Total harness tools | 181 |
| Tier 0 elements clean | 6/8 |

## Routes

Tracked from `*.run.yml` (polish worksheets) + `site-map.json` (route catalog).
`Source` column: `both` = run.yml + site-map, `run.yml` = worksheet only (no site-map entry),
`site-map` = catalogued but never polished (coverage gap).

| Route | Tier | Status | ✓ | LCP ms | CLS | TTI ms | Tools | Source |
|---|---|---|---|---|---|---|---|---|
| `/dashboard` | 1 | done | ✓ | — | — | — | 0 | both |
| `/dashboard/calendar` | 1 | done | ✓ | — | — | — | 12 | both |
| `/dashboard/chat` | 1 | — | · | — | — | — | 1 | site-map |
| `/dashboard/komm` | 1 | done | ✓ | — | — | — | 0 | both |
| `/dashboard/my-day` | 1 | — | · | — | — | — | 0 | site-map |
| `/dashboard/people` | 1 | done | ✓ | 424 | 0.001 | 165 | 4 | both |
| `/dashboard/schedule` | 1 | done | ✓ | 1748 | 0.001 | 679 | 6 | both |
| `/dashboard/governance` | 2 | done | ✓ | — | — | — | 0 | both |
| `/dashboard/payroll/tariff` | 2 | — | · | — | — | — | 3 | site-map |
| `/dashboard/reconciliation` | 2 | done | ✓ | — | — | — | 0 | both |
| `/dashboard/season/[seasonId]` | 2 | done | ✓ | — | — | — | 6 | both |
| `/dashboard/year-wheel` | 2 | done | ✓ | — | — | — | 7 | both |
| `/dashboard/admin/pos-accounts` | 3 | done | ✓ | — | — | — | 0 | both |
| `/dashboard/ai` | 3 | done | ✓ | — | — | — | 0 | both |
| `/dashboard/billing` | 3 | done | ✓ | — | — | — | 5 | both |
| `/dashboard/billing/[invoice_id]` | 3 | done | ✓ | — | — | — | 5 | both |
| `/dashboard/billing/settings` | 3 | done | ✓ | — | — | — | 4 | both |
| `/dashboard/close` | 3 | done | ✓ | — | — | — | 0 | both |
| `/dashboard/cost` | 3 | done | ✓ | — | — | — | 4 | both |
| `/dashboard/handbook` | 3 | done | ✓ | — | — | — | 5 | both |
| `/dashboard/help` | 3 | done | ✓ | — | — | — | 6 | both |
| `/dashboard/hms` | 3 | done | ✓ | — | — | — | 0 | both |
| `/dashboard/hms/deviations` | 3 | done | ✓ | — | — | — | 5 | both |
| `/dashboard/hms/documents` | 3 | done | ✓ | — | — | — | 2 | both |
| `/dashboard/hms/drift` | 3 | done | ✓ | — | — | — | 0 | both |
| `/dashboard/hms/governance` | 3 | done | ✓ | — | — | — | 3 | both |
| `/dashboard/hms/training` | 3 | — | · | — | — | — | 0 | site-map |
| `/dashboard/komm/varsler` | 3 | — | · | — | — | — | 5 | site-map |
| `/dashboard/my-contract` | 3 | done | ✓ | — | — | — | 0 | both |
| `/dashboard/my-cv` | 3 | done | ✓ | — | — | — | 4 | both |
| `/dashboard/my-profile/complete` | 3 | done | ✓ | — | — | — | 3 | both |
| `/dashboard/my-salary` | 3 | done | ✓ | — | — | — | 5 | both |
| `/dashboard/my-schedule` | 3 | done | ✓ | — | — | — | 0 | both |
| `/dashboard/my-training` | 3 | done | ✓ | — | — | — | 6 | both |
| `/dashboard/onboarding-assistant` | 3 | done | ✓ | — | — | — | 0 | both |
| `/dashboard/operations` | 3 | done | ✓ | — | — | — | 5 | both |
| `/dashboard/organization` | 3 | done | ✓ | — | — | — | 7 | both |
| `/dashboard/organization/departments/[id]` | 3 | — | · | — | — | — | 5 | site-map |
| `/dashboard/organization/locations/[id]` | 3 | done | ✓ | — | — | — | 0 | both |
| `/dashboard/organization/teams` | 3 | done | ✓ | — | — | — | 0 | both |
| `/dashboard/people/contracts` | 3 | — | · | — | — | — | 7 | site-map |
| `/dashboard/people/contracts/[id]` | 3 | — | · | — | — | — | 5 | site-map |
| `/dashboard/people/contracts/[id]/revise` | 3 | — | · | — | — | — | 2 | site-map |
| `/dashboard/people/contracts/awaiting-my-signature` | 3 | — | · | — | — | — | 3 | site-map |
| `/dashboard/people/contracts/new` | 3 | — | · | — | — | — | 0 | site-map |
| `/dashboard/policies` | 3 | done | ✓ | — | — | — | 5 | both |
| `/dashboard/proposals` | 3 | done | ✓ | — | — | — | 0 | both |
| `/dashboard/reports` | 3 | done | ✓ | — | — | — | 0 | both |
| `/dashboard/settings` | 3 | done | ✓ | — | — | — | 0 | both |
| `/dashboard/settings/operations` | 3 | done | ✓ | — | — | — | 4 | both |
| `/dashboard/setup` | 3 | done | ✓ | — | — | — | 0 | both |
| `/dashboard/shift-clock` | 3 | done | ✓ | — | — | — | 9 | both |
| `/dashboard/website` | 3 | done | ✓ | — | — | — | 0 | both |
| `/dashboard/website/pages/[pageId]` | 3 | done | ✓ | — | — | — | 3 | both |
| `/dashboard/website/setup` | 3 | done | ✓ | — | — | — | 2 | both |
| `/dashboard/contracts` | — | done | ✓ | — | — | — | 7 | run.yml |
| `/dashboard/contracts/[id]` | — | done | ✓ | — | — | — | 5 | run.yml |
| `/dashboard/contracts/[id]/revise` | — | done | ✓ | — | — | — | 2 | run.yml |
| `/dashboard/contracts/awaiting-my-signature` | — | done | ✓ | — | — | — | 3 | run.yml |
| `/dashboard/contracts/new` | — | done | ✓ | — | — | — | 0 | run.yml |
| `/dashboard/my-profile` | — | done | ✓ | — | — | — | 0 | run.yml |
| `/dashboard/notifications` | — | done | ✓ | — | — | — | 0 | run.yml |
| `/dashboard/organization/departments/:id` | — | done | ✓ | — | — | — | 0 | run.yml |
| `/dashboard/payroll` | — | in_progress | ✓ | — | — | — | 6 | run.yml |

## Tier 0 Elements (shared primitives)

Shared primitives have no route, so polish status is computed live from inline
spring physics (`stiffness:`/`damping:` outside `motionTokens.*`) and hardcoded
palette tokens (`zinc-`/`gray-`/`slate-`). `clean` = both 0.

| Element | Path | Motion debt | Palette debt | Status |
|---|---|---|---|---|
| DashboardShell | `apps/web/src/components/dashboard/DashboardShell.tsx` | 0 | 0 | ✓ clean |
| entity-drawer | `apps/web/src/components/dashboard/entity-drawer` | 0 | 0 | ✓ clean |
| PaymentStatusBadge | `apps/web/src/components/ui/PaymentStatusBadge.tsx` | 0 | 0 | ✓ clean |
| DispatchStatusBadge | `apps/web/src/components/ui/DispatchStatusBadge.tsx` | 0 | 0 | ✓ clean |
| NotificationBell | `apps/web/src/components/dashboard/NotificationBell.tsx` | 1 | 0 | · debt |
| GlobalCallAlert | `apps/web/src/components/dashboard/GlobalCallAlert.tsx` | 1 | 0 | · debt |
| AnimatedWizardShell | `apps/web/src/components/wizard/AnimatedWizardShell.tsx` | 0 | 0 | ✓ clean |
| Sonner toast theme (globals.css) | `apps/web/src/app/globals.css` | 0 | 0 | ✓ clean |
