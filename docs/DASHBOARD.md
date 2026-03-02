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

| #      | Path                              | Branch                            | Module    | Status      | Last Activity | tmux   | Changes |
| ------ | --------------------------------- | --------------------------------- | --------- | ----------- | ------------- | ------ | ------- |
| wt-1   | `~/dev/wt-1`                      | `feat/auth-screens-redesign`      | auth      | done        | merged        | —      | clean   |
| wt-2   | `~/dev/wt-2`                      | `feat/people-module-v2`           | org       | done        | just now      | —      | clean   |
| wt-3   | `~/dev/wt-3`                      | `feat/communications-v2`          | comms     | paused      | 6h ago        | —      | 2 files |
| wt-4   | `~/dev/wt-4`                      | `feat/schedule-control-panel`     | schedule  | done        | just now      | —      | clean   |
| wt-5   | `~/dev/wt-5`                      | `feat/dashboard-evolution`        | dashboard | in_progress | 3m ago        | —      | 6 files |
| wt-20  | `~/dev/wt-20`                     | `feat/operations-ui-redesign`     | ops       | done        | 25m ago       | —      | clean   |
| sma-16 | `~/.worktrees/smartout-ai/sma-16` | `feat/fix-schedule-supabase`      | web       | done        | 2h ago        | sma-16 | clean   |
| sma-17 | `~/.worktrees/smartout-ai/sma-17` | `feat/build-agent-config-ui`      | web       | in_progress | 15m ago       | sma-17 | clean   |
| sma-18 | `~/.worktrees/smartout-ai/sma-18` | `feat/services-health-dashboard`  | platform  | done        | 6h ago        | sma-18 | clean   |
| sma-19 | `~/.worktrees/smartout-ai/sma-19` | `feat/respawn-day-control-center` | schedule  | in_progress | 8m ago        | sma-19 | clean   |

## Free Slots

| #   | Available |
| --- | --------- |
| —   | none      |

## Pending Journeys

| Worktree | Feature                | Journey File                                      | Status  |
| -------- | ---------------------- | ------------------------------------------------- | ------- |
| wt-2     | people-module-v2       | `docs/journeys/JOURNEY-people-module-v2.md`       | done    |
| wt-4     | schedule-control-panel | `docs/journeys/JOURNEY-schedule-control-panel.md` | done    |
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
| 2026-03-03 | people-module-v2       | `feat/people-module-v2`                                            | development |
| 2026-03-03 | schedule-control-panel | `feat/schedule-control-panel`                                      | development |
| 2026-03-03 | auth-screens-redesign  | `feat/auth-screens-redesign`                                       | development |

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
| 2026-03-03 | people-module-v2       | closed            | Merged to development, wt-2 freed                                          |
| 2026-03-03 | email-template-editor  | session ended     | Tiptap rich editor, 4 new sections (card/hero/CTA/video), SSR fix, pushed  |
| 2026-03-03 | schedule-control-panel | closed            | Merged to development, wt-4 freed. 8/10 tasks, 10 commits                  |
| 2026-03-03 | auth-screens-redesign  | closed            | Split-screen auth, gradient mesh, 5 pages, reset-pw fix, merged wt-1       |
| 2026-03-03 | (dashboard)            | session ended     | Fixed useWorkspace crash in 5 hooks (edbf7e4), auth merged, session logged |
