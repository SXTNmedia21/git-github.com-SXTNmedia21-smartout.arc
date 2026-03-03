---
title: Development Dashboard
status: in_progress
updated: 2026-03-06

created: 2026-03-02
module: meta
tags: [dashboard, worktrees, tracking]
---

# Development Dashboard

> Single source of truth for all active work. Updated by `/start-feature`, `/end-session`, `/close-feature`, `/status`.

## Active Worktrees

| #    | Path         | Branch                       | Module     | Status      | Last Activity | tmux | Changes |
| ---- | ------------ | ---------------------------- | ---------- | ----------- | ------------- | ---- | ------- |
| wt-2 | `~/dev/wt-2` | `feat/communications-finish` | comms      | in_progress | 11 hours ago  | none | 4 files |
| wt-3 | `~/dev/wt-3` | `feat/daily-standup`         | operations | in_progress | 1 hour ago    | none | 4 files |

## Free Slots

| #     | Available |
| ----- | --------- |
| wt-1  | yes       |
| wt-4  | yes       |
| wt-5  | yes       |
| wt-20 | yes       |

## Pending Journeys

| Worktree | Feature               | Journey File                                     | Status  |
| -------- | --------------------- | ------------------------------------------------ | ------- |
| wt-2     | communications-finish | `docs/journeys/JOURNEY-communications-finish.md` | missing |
| wt-3     | daily-standup         | `docs/journeys/JOURNEY-daily-standup.md`         | missing |

## Recent Closures

| Date       | Feature                   | Branch                                                             | Merged To   |
| ---------- | ------------------------- | ------------------------------------------------------------------ | ----------- |
| 2026-03-02 | unified-keys-admin        | `feat/unified-keys-admin`                                          | development |
| 2026-03-02 | fix-onboarding-flow       | `feat/fix-onboarding-flow`                                         | development |
| 2026-03-02 | fix-admin-bugs            | `feat/fix-admin-bugs`                                              | development |
| 2026-03-02 | landing-sessions-leads    | `feat/landing-sessions-leads`                                      | development |
| 2026-03-02 | dashboard-redesign        | `feat/dashboard-redesign`                                          | development |
| 2026-03-02 | team-member-management    | `feat/team-member-management`                                      | development |
| 2026-03-02 | landing-analytics         | `feat/landing-analytics`                                           | development |
| 2026-03-02 | stage-engine-local        | `feat/get-the-stage-engine-and-voice-ultravox-running-locally-the` | development |
| 2026-03-03 | operations-ui-redesign    | `feat/operations-ui-redesign`                                      | development |
| 2026-03-03 | fix-schedule-mutations    | `feat/fix-the-5-supabase-mutation-errors-on-the-schedule-page-the` | development |
| 2026-03-03 | people-module-v2          | `feat/people-module-v2`                                            | development |
| 2026-03-03 | schedule-control-panel    | `feat/schedule-control-panel`                                      | development |
| 2026-03-03 | auth-screens-redesign     | `feat/auth-screens-redesign`                                       | development |
| 2026-03-03 | services-health-dashboard | `feat/build-a-services-health-dashboard`                           | development |
| 2026-03-03 | day-control-center-polish | `feat/respawn-of-sma-10-s-lost-work-polish-the-day-control-center` | development |
| 2026-03-03 | dashboard-evolution       | `feat/dashboard-evolution`                                         | development |
| 2026-03-03 | agent-config-ui           | `feat/build-the-agent-config-training-session-ui-page`             | development |
| 2026-03-05 | entity-detail-pages       | `feat/entity-detail-pages`                                         | development |

## Session History

| Date       | Feature                     | Action            | Notes                                                                                                                    |
| ---------- | --------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 2026-03-02 | (meta)                      | Dashboard created | Boot sequence, plugin cleanup, slash commands                                                                            |
| 2026-03-02 | (meta)                      | session ended     | All infra done: SESSION.md, DASHBOARD.md, 4 slash commands, plugin cleanup                                               |
| 2026-03-02 | dashboard-redesign          | closed            | Merged to development, wt-3 freed                                                                                        |
| 2026-03-02 | team-member-management      | closed            | Merged to development, wt-1 freed                                                                                        |
| 2026-03-02 | landing-analytics           | closed            | Merged to development, branch deleted                                                                                    |
| 2026-03-02 | agent-architecture          | synced            | Merged to development, wt-4 stays open                                                                                   |
| 2026-03-02 | (orchestrator)              | session ended     | 4 PRs merged, CI fixed, landing variants, keys/vault, middleware perf                                                    |
| 2026-03-03 | schedule-control-panel      | started           | wt-4, module: schedule — UI redesign for schedule module                                                                 |
| 2026-03-03 | people-module-v2            | started           | wt-2, module: org-structure — People module UI redesign                                                                  |
| 2026-03-02 | stage-engine-local          | closed            | Merged to development, sma-14 freed                                                                                      |
| 2026-03-02 | dashboard-evolution         | started           | wt-5, module: dashboard — 9-track dashboard evolution plan                                                               |
| 2026-03-03 | operations-ui-redesign      | closed            | Merged to development, wt-20 freed                                                                                       |
| 2026-03-03 | fix-schedule-mutations      | closed            | PR #26 closed (already on development), sma-16 freed                                                                     |
| 2026-03-03 | people-module-v2            | closed            | Merged to development, wt-2 freed                                                                                        |
| 2026-03-03 | email-template-editor       | session ended     | Tiptap rich editor, 4 new sections (card/hero/CTA/video), SSR fix, pushed                                                |
| 2026-03-03 | schedule-control-panel      | closed            | 10/10 tasks, 13 commits, all gates pass. wt-4 freed                                                                      |
| 2026-03-03 | auth-screens-redesign       | closed            | Split-screen auth, gradient mesh, 5 pages, reset-pw fix, merged wt-1                                                     |
| 2026-03-03 | (dashboard)                 | session ended     | Fixed useWorkspace crash in 5 hooks (edbf7e4), auth merged, session logged                                               |
| 2026-03-03 | services-health-dashboard   | closed            | PR #27 merged, sma-18 freed. Health dashboard at /platform-admin/services                                                |
| 2026-03-03 | day-control-center-polish   | closed            | PR #28 merged, sma-19 freed. Day control split into modular directory                                                    |
| 2026-03-03 | dashboard-evolution         | closed            | 11 commits merged (tracks 1-8), wt-5 freed                                                                               |
| 2026-03-03 | agent-config-ui             | closed            | PR #29 merged. Agent authority config UI at /dashboard/ai/config                                                         |
| 2026-03-05 | entity-detail-pages         | closed            | 2 commits merged, wt-1 freed                                                                                             |
| 2026-03-03 | complete-remaining-features | started           | wt-1, module: multi — 4 features: landing, portal, comms, entity-detail                                                  |
| 2026-03-04 | admin-wizard-completion     | session ended     | Verified all 17 plan tasks already implemented, typecheck passes clean                                                   |
| 2026-03-04 | dashboard-polish            | closed            | 8 commits on development: heatmap overhaul, strategic fix, day-control tabs, wt-1 freed                                  |
| 2026-03-04 | communications-finish       | started           | wt-2, module: comms — template persistence, engagement reports, webhook fix                                              |
| 2026-03-04 | entity-detail-pages         | started           | wt-1, module: org-structure — 4 entity detail pages with shared tabs layout                                              |
| 2026-03-05 | entity-detail-pages         | session ended     | All 6 tasks complete: EntityDetailLayout + 4 detail pages + navigation wiring. Uncommitted, needs commit + closure gates |
| 2026-03-05 | daily-standup               | started           | wt-3, module: operations — DailyCloseEngine: state machine + reconciliation + OCR                                        |
| 2026-03-05 | schedule-ui-polish          | session ended     | 16 files: 13 dialog redesigns, monthly view rewrite, working filters, compact headers. Uncommitted on development        |
