---
title: "Handoff — admin-daily-loop"
feature: admin-daily-loop
branch: feat/admin-daily-loop
closed: 2026-03-27
module: dashboard
---

# Handoff — admin-daily-loop

## Summary

Phase 1 of the Admin Daily Loop — the core operational rhythm for restaurant admins in Smartout. Adds budget visibility in the schedule, shift conflict detection, day lock with RLS enforcement, deviation logging from operations, department stress drill-down, and a DailyStatusBar on the admin dashboard. All wired with real data, telemetry, and proper RLS.

## What Was Done

- [x] `useScheduleBudget` hook — fetches `workspace_budget` for a given date, wired into BudgetTab (replaces mock data)
- [x] `useShiftConflicts` hook — pure client-side overlap detection, visual warnings (red ring + AlertTriangle) on shift cards
- [x] Reconciliation lock RLS migration — splits permissive FOR ALL into separate INSERT/UPDATE/DELETE, blocks edits after `locked_at` is set
- [x] `useUnreconciledDays` hook — counts days with `status = 'open'` for DailyStatusBar
- [x] Day lock button in DayApproval — mutation sets `locked_at`/`locked_by`/`status`, emits `reconciliation locked` telemetry, disables edit controls
- [x] `DeviationDialog` component — full form (title, domain, severity, department, description), inserts to `deviation` table with telemetry
- [x] `DepartmentBreakdown` component — per-department capacity % with color coding, spring animation toggle
- [x] `DailyStatusBar` component — 3-segment status bar (schedule, operations, reconciliation) with staggered spring entrance, live reconciliation data
- [x] Telemetry: `reconciliation locked` and `deviation reported` events registered in registry
- [x] Regenerated `database.types.ts` after RLS migration
- [x] User journey documentation: 6 journeys covering all Phase 1 flows

## Decisions Made

| Decision                                                   | Reason                                                                        | Impact                                                 |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| No i18n for Phase 1 dashboard components                   | Existing dashboard uses hardcoded Norwegian — consistency over premature i18n | Phase 2+ should i18n all dashboard components together |
| DepartmentBreakdown uses own query                         | Avoids breaking existing useOperationsData aggregated data contract           | Slightly more queries, but cleaner separation          |
| DailyStatusBar Phase 1 only shows reconciliation live data | Schedule publish status + stress level require Phase 3 wiring                 | Two segments show placeholder text until Phase 3       |

## Learnings

| Learning                                                                                        | Context                                                                                                   |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| RLS FOR ALL policies are dangerous — splitting into INSERT/UPDATE/DELETE gives granular control | The original `daily_reconciliation` policy allowed any UPDATE; splitting lets us block updates after lock |
| Client-side conflict detection is sufficient for shift overlaps                                 | No need for DB constraints — visual warnings let admins override intentionally (split shifts, training)   |
| Spring animations with stagger create professional feel with minimal code                       | DailyStatusBar uses 60ms stagger per segment — small detail, big UX improvement                           |

## Known Issues / Debt

- Mobile typecheck has 2 pre-existing errors (InviteEntry.tsx, shift-phase.test.ts) — not from this branch
- DailyStatusBar schedule and operations segments are Phase 1 placeholders (show muted "no data")
- Plan template (`PLAN-admin-daily-loop.md`) was not filled in — work was driven by council-reviewed spec instead
- Several docs from other features (mal-modus-schedule, nordic-split) were modified on this branch — may cause merge conflicts

## Next Steps

- **Phase 2**: Wire schedule publish status into DailyStatusBar (requires schedule publishing workflow)
- **Phase 3**: Wire live stress level into DailyStatusBar (requires operations real-time connection)
- **Phase 4**: Notification triggers — alert admin when unreconciled days exceed threshold
- E2E tests for reconciliation lock flow and deviation logging (recommended)
- i18n pass for all dashboard components (bundle with other dashboard i18n work)
