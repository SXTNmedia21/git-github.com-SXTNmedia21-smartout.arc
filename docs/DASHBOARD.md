---
title: Development Dashboard
status: in_progress
updated: 2026-03-03
created: 2026-03-02
module: meta
tags: [dashboard, worktrees, tracking]
---

# Development Dashboard

> Single source of truth for all active work. Updated by `/start-feature`, `/end-session`, `/close-feature`, `/status`.

## Active Worktrees

| #     | Path                             | Branch                        | Module        | Status      | Last Activity | tmux  | Changes |
| ----- | -------------------------------- | ----------------------------- | ------------- | ----------- | ------------- | ----- | ------- |
| wt-1  | `~/dev/wt-1`                     | `feat/auth-screens-redesign`  | web           | paused      | —             | —     | unknown |
| wt-2  | `~/dev/wt-2`                     | `feat/people-module-v2`       | org-structure | in_progress | just started  | —     | clean   |
| wt-3  | `~/dev/wt-3`                     | `feat/communications-v2`      | comms         | paused      | —             | —     | unknown |
| wt-4  | `~/dev/wt-4`                     | `feat/schedule-control-panel` | schedule      | in_progress | just started  | —     | clean   |
| sma-1 | `~/.worktrees/smartout-ai/sma-1` | `feat/test-spawn`             | infra         | idle        | 2h ago        | sma-1 | clean   |
| sma-2 | `~/.worktrees/smartout-ai/sma-2` | `feat/fix-services-docker`    | infra         | idle        | 1h ago        | sma-2 | clean   |
| sma-4 | `~/.worktrees/smartout-ai/sma-4` | `feat/fix-daily-session`      | landing       | idle        | 1h ago        | sma-4 | clean   |
| sma-5 | `~/.worktrees/smartout-ai/sma-5` | `feat/fix-schedule-supabase`  | web           | idle        | 1h ago        | sma-5 | clean   |
| wt-5  | `~/dev/wt-5`                     | `feat/dashboard-evolution`    | dashboard     | in_progress | just started  | —     | clean   |

## Free Slots

| #     | Available |
| ----- | --------- |
| wt-20 | free      |

## Pending Journeys

| Worktree | Feature                | Journey File                                      | Status  |
| -------- | ---------------------- | ------------------------------------------------- | ------- |
| wt-2     | people-module-v2       | `docs/journeys/JOURNEY-people-module-v2.md`       | missing |
| wt-4     | schedule-control-panel | `docs/journeys/JOURNEY-schedule-control-panel.md` | missing |
| wt-5     | dashboard-evolution    | `docs/journeys/JOURNEY-dashboard-evolution.md`    | missing |

## Recent Closures

| Date       | Feature                | Branch                                                             | Merged To   |
| ---------- | ---------------------- | ------------------------------------------------------------------ | ----------- |
| 2026-03-02 | unified-keys-admin     | `feat/unified-keys-admin`                                          | development |
| 2026-03-02 | fix-onboarding-flow    | `feat/fix-onboarding-flow`                                         | development |
| 2026-03-02 | fix-admin-bugs         | `feat/fix-admin-bugs`                                              | development |
| 2026-03-02 | landing-sessions-leads | `feat/landing-sessions-leads`                                      | development |
| 2026-03-02 | dashboard-redesign     | `feat/dashboard-redesign`                                          | development |
| 2026-03-02 | team-member-management | `feat/team-member-management`                                      | development |
| 2026-03-02 | landing-analytics      | `feat/landing-analytics`                                           | development |
| 2026-03-02 | stage-engine-local     | `feat/get-the-stage-engine-and-voice-ultravox-running-locally-the` | development |
| 2026-03-03 | operations-ui-redesign | `feat/operations-ui-redesign`                                      | development |
| 2026-03-03 | fix-schedule-mutations | `feat/fix-the-5-supabase-mutation-errors-on-the-schedule-page-the` | development |

## Session History

| Date       | Feature                | Action            | Notes                                                                      |
| ---------- | ---------------------- | ----------------- | -------------------------------------------------------------------------- |
| 2026-03-02 | (meta)                 | Dashboard created | Boot sequence, plugin cleanup, slash commands                              |
| 2026-03-02 | (meta)                 | session ended     | All infra done: SESSION.md, DASHBOARD.md, 4 slash commands, plugin cleanup |
| 2026-03-02 | dashboard-redesign     | closed            | Merged to development, wt-3 freed                                          |
| 2026-03-02 | team-member-management | closed            | Merged to development, wt-1 freed                                          |
| 2026-03-02 | landing-analytics      | closed            | Merged to development, branch deleted                                      |
| 2026-03-02 | agent-architecture     | synced            | Merged to development, wt-4 stays open                                     |
| 2026-03-02 | (orchestrator)         | session ended     | 4 PRs merged, CI fixed, landing variants, keys/vault, middleware perf      |
| 2026-03-03 | schedule-control-panel | started           | wt-4, module: schedule — UI redesign for schedule module                   |
| 2026-03-03 | people-module-v2       | started           | wt-2, module: org-structure — People module UI redesign                    |
| 2026-03-02 | stage-engine-local     | closed            | Merged to development, sma-14 freed                                        |
| 2026-03-02 | dashboard-evolution    | started           | wt-5, module: dashboard — 9-track dashboard evolution plan                 |
| 2026-03-03 | operations-ui-redesign | closed            | Merged to development, wt-20 freed                                         |
| 2026-03-03 | fix-schedule-mutations | closed            | PR #26 closed (already on development), sma-16 freed                       |
