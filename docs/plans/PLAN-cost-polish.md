---
title: "Plan — cost-polish"
status: draft
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [plan, ui-shell, cost, polish, campaign-ui-shell]
---

# Plan — cost-polish

> Branch: `feat/ui-shell-cost-polish` | Worktree: /home/sxtnl/dev/smartout.ai-ui-shell-wt-1 | Base: `campaign/ui-shell` | Module: MODULE_01 | Started: 2026-05-17

## Goal

Close S12 step 6 (`/dashboard/cost`). Surface is already well-built (Nordic Split clean, loading.tsx present, 4 read-only tools clean per ADR-0151/0238, no D4/D5 coupling). Three narrow gaps only.

## Scope

**In scope (3 gaps from T0 recon):**
- Add `apps/web/src/app/dashboard/cost/error.tsx`
- Add page-view telemetry `emit("cost.overview.viewed")` on mount
- Add PageHeader + Norwegian page instructions to CostOverview

**Out of scope:**
- Cascade D4/D5 work (workspace_budget, day_factor) — analytics-only surface, no coupling exists
- New capabilities or tools (4 read-only tools already polished + compliant)
- Component refactors beyond header standardization
- DepartmentCostTable empty-state copy refinement (defer to followup if Pontus prioritizes)

## Recon (done — see T0 haiku report)

- `/dashboard/cost` = single route, server-component shell wrapping `<CostOverview>` client island
- Data source: `shift_cost_snapshot` via `useCostOverview()` hook
- 4 tools: getCostOverview, getLaborCostByPeriod, getMarginAnalysis, getCostBreakdownByDepartment — all read-only, ADR-0151 compliant
- Existing loading.tsx skeleton matches CostOverview shape (3 cards + table)
- 0 hardcoded palette classes, full Nordic Split

## Tasks

- [ ] **T1** — Create `error.tsx` (mirror contracts-polish pattern: client component, Norwegian copy, retry button, Nordic Split tokens)
- [ ] **T2** — Add page-view telemetry emit on CostOverview mount with `openedRef` guard + `nonEmpty(workspaceId/profileId)` per ADR-0134
- [ ] **T3** — Register telemetry event in `packages/telemetry/src/registry.ts` (mirror contracts-polish pattern: interface, union member, EVENT_ROUTING entry, `category: "cost"`, destinations `["posthog", "logger", "activity_trail"]`)
- [ ] **T4** — Standardize CostOverview header: `font-heading` h1 + page instructions paragraph (Norwegian, explains week-navigation + variance reading)
- [ ] **T5** — G4 sonnet code-reviewer pass
- [ ] **T6** — HANDOFF + close-feature

## Acceptance Criteria

- [ ] `pnpm turbo typecheck` 0 errors
- [ ] `pnpm --filter web site-map:validate` exit 0
- [ ] `error.tsx` exists at `apps/web/src/app/dashboard/cost/`
- [ ] `cost.overview.viewed` registered in telemetry registry + emitted from CostOverview
- [ ] Primary journey verified (feature: cost-polish, status: verified)
- [ ] HANDOFF written
- [ ] G4 verdict APPROVE (or APPROVE WITH MINOR ISSUES + blocker fixed)

## Risks

- Surface so clean that polish is mostly cosmetic — confirm header + telemetry edits don't introduce client/server boundary issues
- `emit()` inside client island needs DashboardContext — mirror pattern from contracts-polish `/revise` page (useContext + useEffect + openedRef)

## Next

T1+T2+T3+T4 dispatch to single sonnet build agent — small enough scope, no parallel value.
