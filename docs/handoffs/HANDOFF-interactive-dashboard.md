---
title: "Handoff — interactive-dashboard"
feature: interactive-dashboard
branch: feat/interactive-dashboard
closed: 2026-03-29
module: dashboard
---

# Handoff — interactive-dashboard

## Summary

Replaced the passive tactical+strategic dashboard with an action-oriented bento grid that auto-switches between Operative (live ops) and Preparatory (planning) modes. 11 new components, 6 new hooks, 3 telemetry events, 144 i18n keys. Feature-flagged behind `NEXT_PUBLIC_INTERACTIVE_DASHBOARD`.

## What Was Done

- [x] Dual mode system (Operative/Preparatory) with auto-detection + manual override
- [x] DashboardMetricStrip — compact 56px bar with mode toggle + severity pills
- [x] TaskSwiper — horizontal swipeable action cards with inline mutations (assign, complete, approve)
- [x] OnDutyStrip — compact avatar row with expand panel
- [x] ActivityFeed — realtime scrollable timeline with filter pills
- [x] QuickBroadcast — inline message composer with 3 recipient groups (on duty / incoming / yesterday)
- [x] PrepActionCards — preparatory mode action stack with inline task creation
- [x] InlineTaskCreator — mini-form with department session resolution
- [x] KpiPillGrid — 2x2 compact KPI cards with expand detail
- [x] StaffingCoverageBar — 7-day fill rate bar chart with day popover
- [x] AssignPopover — shared profile selector
- [x] Feature flag integration in AdminDashboard.tsx
- [x] 72 Norwegian + 72 English i18n keys
- [x] 3 telemetry events (session_task.created, session_task.assigned, communication.broadcast_sent)
- [x] Responsive breakpoints (desktop/tablet/mobile)
- [x] prefers-reduced-motion handling on all animated components
- [x] Empty/error/loading states for all bento cells

## Decisions Made

| Decision                                         | Reason                                                         | Impact                                                                      |
| ------------------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Bento CSS Grid with named areas                  | Flexible mode-switching layout, responsive                     | New pattern — register in design docs                                       |
| `news` channel type for broadcasts               | Existing enum, no migration needed                             | Communication capability should be updated to understand broadcast channels |
| session_task for inline tasks (not new table)    | Avoids schema changes, session_task already has full lifecycle | InlineTaskCreator disabled when no active/upcoming session                  |
| Feature flag `NEXT_PUBLIC_INTERACTIVE_DASHBOARD` | Safe rollback to old dashboard                                 | Remove flag when stable                                                     |
| Mutations inline on cards, NOT in entity drawers | ADR-0068 compliance (drawers are read-only)                    | Assign popover overlays dashboard, not drawer                               |
| Council-approved spec (4 agents, 2026-03-29)     | Cross-domain verification                                      | Telemetry, broadcast channel, session_task resolution all specified         |

## Learnings

| Learning                                                                               | Context                                                                 |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `timesheet.time_entry` uses `punch_in`/`punch_out`, not `clock_in`/`clock_out`         | Broadcast recipients hook needed schema-qualified queries               |
| `emit()` entity field lives inside `properties.entity`, not top-level                  | Mutation hooks adapted to match actual telemetry pattern                |
| Spring constants in specs tend to be too high                                          | Council frontend designer caught 3-10x overshoot vs design system tiers |
| `useTaskCompletion` hook doesn't exist as standalone                                   | Operations data provides task completion via `useOperationsData`        |
| Three preparatory metric counters (contracts, training, budget) need wiring from hooks | Currently hardcoded to 0 in MetricStrip — follow-up needed              |

## Known Issues / Debt

- Preparatory metric pills (unsigned contracts, expiring training, budget variance) show 0 — need wiring from `useActionItems` counts
- Pending approval "Godkjenn" and late arrival "Send påminnelse" are placeholder toasts
- `profileId` in assign task emit uses assignee ID, not current user (needs DashboardContext profileId passthrough)
- Bento grid pattern not yet registered in `docs/design/patterns.md`
- 9 pre-existing typecheck errors unrelated to this feature

## Next Steps

- Wire preparatory metric counters to real data
- Implement actual session approval mutation (replace toast placeholder)
- Implement push notification for "Send påminnelse" action
- Register bento grid as design pattern in docs/design/patterns.md
- Remove feature flag when stable in production
- Build mobile equivalent using shared data hooks
