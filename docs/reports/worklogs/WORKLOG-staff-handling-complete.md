---
title: "Worklog — staff-handling-complete"
status: done
updated: 2026-03-22
created: 2026-03-22
module: core
tags: [people, invitation, profile, mobile, design-tokens]
---

# Worklog — staff-handling-complete

> Branch: `feat/staff-handling-complete` | Worktree: wt-7 | Started: 2026-03-22

## Status: Done

## Done

- [x] Shared types + status transitions in @smartout/utils
- [x] Shared data fetching (fetchWorkspacePeople) with readiness RPC
- [x] Fix readiness score (was always 0%, now computed from protocol_assignment)
- [x] Fix hasContract (was always false, now from employment_contract.status = 'signed')
- [x] Fix expired invite count (exclude from "Pending Invites" card)
- [x] Fix profileId usage (was using invitation_id for profile mutations)
- [x] Add reactivation path for offboarding employees
- [x] Remove fake hours (142h) and activity data from invited drawer
- [x] Add real activity_trail query to profile detail page
- [x] Server actions: sendProtocolReminder, addToTeam, removeFromTeam, updateProfileStatus
- [x] Update updateProfileDepartment to preserve multi-dept array
- [x] Profile detail: schedule tab, activity tab, team management, status enforcement
- [x] Invite dialog: SMS and link invite type support
- [x] Bulk deactivate, CSV export, advanced filter popover
- [x] Wire expire_stale_invitations() to watchdog-integrity
- [x] Design token cleanup: 296 hardcoded zinc refs → 0 across 5 files
- [x] Mobile: team list and member detail screens with nativeTheme

## Remaining

- None

## Decisions

| Date       | Decision                                   | Reason                                                            |
| ---------- | ------------------------------------------ | ----------------------------------------------------------------- |
| 2026-03-22 | Single mega-branch for all 19 fixes        | Items share the same files, splitting would cause merge conflicts |
| 2026-03-22 | Readiness RPC joins through profile        | protocol_assignment is not workspace-scoped directly              |
| 2026-03-22 | hasContract uses status = 'signed'         | "Active Contract" label should mean signed, not just existing     |
| 2026-03-22 | Status transitions enforced via shared map | Prevents invalid transitions like active → trainee                |
| 2026-03-22 | offboarding → active allowed (admin only)  | Reactivation needed for employees returning                       |

## Log

| Date       | Time  | Event                                                       |
| ---------- | ----- | ----------------------------------------------------------- |
| 2026-03-22 | 18:10 | Feature started                                             |
| 2026-03-22 | 18:20 | Task 1: Shared types + status transitions committed         |
| 2026-03-22 | 18:25 | Task 2: Data fetching + readiness/contracts committed       |
| 2026-03-22 | 18:30 | Task 3: profileId fix + reactivation committed              |
| 2026-03-22 | 18:35 | Tasks 4, 7, 9: Agents completed (drawer, invite, watchdog)  |
| 2026-03-22 | 18:40 | Task 5: Server actions committed                            |
| 2026-03-22 | 18:50 | Tasks 6, 8, 11: Agents completed (detail, table, mobile)    |
| 2026-03-22 | 19:00 | Task 10: Design token cleanup committed (296 → 0 zinc refs) |
| 2026-03-22 | 19:05 | All gates green, feature ready for closure                  |
