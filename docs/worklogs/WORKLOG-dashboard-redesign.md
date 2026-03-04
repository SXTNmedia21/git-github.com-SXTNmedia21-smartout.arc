---
title: "Worklog — dashboard-redesign"
status: in_progress
updated: 2026-03-02
created: 2026-03-02
module: dashboard
tags: [dashboard, redesign, tanstack-query, supabase]
---

# Worklog — dashboard-redesign

## Status: 🟡 In Progress

## Done

- [x] Create query key factory (dashboard-keys.ts) and shared types (dashboard-types.ts)
- [x] Extract TacticalView to own file from AdminDashboard.tsx
- [x] Extract StrategicView to own file from AdminDashboard.tsx
- [x] Slim AdminDashboard.tsx to 30-line view router
- [x] Create useActionItems hook (5 parallel count queries)
- [x] Create useStaffingCoverage hook (7-day fill percentages)
- [x] Create useWorkforcePipeline hook (active staff, hires, departures)
- [x] Create useTrainingReadiness hook (protocol assignment completion)
- [x] Create useDepartmentShifts hook (shifts grouped by department)
- [x] Create useMyShifts + useMyReadiness hooks (employee dashboard)
- [x] Create hooks barrel export
- [x] Create SignalCard reusable component
- [x] Create ActionStrip component with count chips
- [x] Integrate ActionStrip into DashboardShell
- [x] Pass profileId from layout -> DashboardContext
- [x] Refactor TacticalView with real staffing + training data
- [x] Refactor StrategicView with real pipeline + training data
- [x] Refactor ReconciliationView with real department shifts (full rewrite)
- [x] Refactor ActivityView with real stats + training progress
- [x] Refactor EmployeeDashboard with real shifts + readiness + open shifts
- [x] Final typecheck passes (0 errors)

## Remaining

- [ ] Write user journeys (JOURNEY-dashboard-redesign.md)
- [ ] Update decision log and learning log
- [ ] Feature closure deliverables

## Decisions

| Date       | Decision                                                     | Reason                                                            |
| ---------- | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| 2026-03-02 | Use TanStack Query for all dashboard data                    | Consistent with schedule hooks pattern, enables caching + refetch |
| 2026-03-02 | Join protocol_assignment through profile for workspace scope | protocol_assignment lacks workspace_id column                     |
| 2026-03-02 | Replace ReconciliationView table with department cards       | Design spec: cards are more scannable for daily review            |
| 2026-03-02 | Keep heatmap data as generated mock                          | Needs activity scoring algorithm (TODO)                           |
| 2026-03-02 | Placeholder cards for Cost of Sales and Absence              | Require POS/revenue integration not yet available                 |

## Log

| Date       | Time | Event                                                        |
| ---------- | ---- | ------------------------------------------------------------ |
| 2026-03-02 | --   | Session started in wt-3 on feat/dashboard-redesign           |
| 2026-03-02 | --   | Phase 0: Scaffolding complete (keys, types, view extraction) |
| 2026-03-02 | --   | Phase 1-2: 7 data hooks + SignalCard + ActionStrip created   |
| 2026-03-02 | --   | Phase 3: ActionStrip + profileId integrated into layout      |
| 2026-03-02 | --   | Phase 4: All 5 views refactored with real Supabase data      |
| 2026-03-02 | --   | Phase 5: Cleanup complete, typecheck passes                  |
