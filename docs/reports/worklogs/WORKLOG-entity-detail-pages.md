---
title: "Worklog — entity-detail-pages"
status: in_progress
updated: 2026-03-05
created: 2026-03-03
module: org-structure
tags: [entity-detail, tabs, navigation, org-structure, people]
---

# Worklog — entity-detail-pages

> Branch: `feat/entity-detail-pages` | Worktree: wt-1 | Started: 2026-03-03

## Status: 🟢 Ready for Closure

## Done

- [x] Create EntityDetailLayout shared component (breadcrumbs, header, badges, tabs)
- [x] Create Department Detail page (5 tabs: Overview, Positions, Teams, Policies, Settings)
- [x] Create Location Detail page (4 tabs: Overview, Zones, Assets, Settings)
- [x] Create Team Detail page (4 tabs: Overview, Members, Policies, Settings)
- [x] Create Profile Detail page (4 tabs: Overview, Competence, HR & Logs, Settings)
- [x] Wire up list views to navigate to detail pages (departments, locations, teams, people)
- [x] Typecheck passes clean

## Remaining

- [x] Commit all changes
- [x] Write user journeys (JOURNEY-entity-detail-pages.md)
- [x] Verify decision/learning logs
- [ ] Run `/close-feature`

## Files Created

| File                                              | Description                |
| ------------------------------------------------- | -------------------------- |
| `organization/_components/EntityDetailLayout.tsx` | Shared layout component    |
| `organization/departments/[id]/page.tsx`          | Department detail (5 tabs) |
| `organization/locations/[id]/page.tsx`            | Location detail (4 tabs)   |
| `organization/teams/[id]/page.tsx`                | Team detail (4 tabs)       |
| `people/[id]/page.tsx`                            | Profile detail (4 tabs)    |

## Files Modified

| File                    | Change                                                      |
| ----------------------- | ----------------------------------------------------------- |
| `departments-tab.tsx`   | Card click navigates to detail page                         |
| `locations-tab.tsx`     | Card click navigates to detail page                         |
| `teams-tab.tsx`         | Card click navigates to detail page (replaces sheet)        |
| `people-data-table.tsx` | Row click navigates to detail page (invited keep slide-out) |

## Decisions

| Date       | Decision                                                    | Reason                                                        |
| ---------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| 2026-03-05 | Profile detail reuses EntityDetailLayout from organization/ | Consistency across all entity pages, single shared component  |
| 2026-03-05 | Invited users keep slide-out card (no profile detail)       | Invited users don't have profile_id, can't navigate to detail |
| 2026-03-05 | Team card click navigates instead of opening sheet          | Detail page replaces sheet for full member management         |

## Log

| Date       | Time  | Event                                                         |
| ---------- | ----- | ------------------------------------------------------------- |
| 2026-03-03 | 07:40 | Feature started                                               |
| 2026-03-05 | —     | Executed plan: Batch 1 (EntityDetailLayout + Dept + Location) |
| 2026-03-05 | —     | Fixed typecheck: LOCATION_TYPE_CONFIG lacks 'border' property |
| 2026-03-05 | —     | Executed plan: Batch 2 (Team + Profile + navigation wiring)   |
| 2026-03-05 | —     | All 6 tasks complete, typecheck passes. Session ended.        |
