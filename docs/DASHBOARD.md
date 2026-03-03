---
title: Development Dashboard
status: in_progress
updated: 2026-03-10
created: 2026-03-02
module: meta
tags: [dashboard, worktrees, tracking]
---

# Development Dashboard

> Single source of truth for all active work. Updated by `/start-feature`, `/end-session`, `/close-feature`, `/status`.

## Active Worktrees

| #   | Branch                                  | Module     | Status      | Progress     | Blocker | State |
| --- | --------------------------------------- | ---------- | ----------- | ------------ | ------- | ----- |
| 1   | `feat/agent-profile-system`             | ai         | in_progress | just started | —       | clean |
| 2   | `feat/onboarding-redesign`              | onboarding | in_progress | just started | —       | clean |
| 3   | `feat/onboarding-intelligence-pipeline` | onboarding | in_progress | just started | —       | clean |

## Free Slots

| #     | Available                             |
| ----- | ------------------------------------- |
| wt-1  | no (agent-profile-system)             |
| wt-3  | no (onboarding-intelligence-pipeline) |
| wt-4  | yes                                   |
| wt-5  | yes                                   |
| wt-20 | yes                                   |

## Pending Journeys

| Worktree | Feature                          | Journey File                                                | Status  |
| -------- | -------------------------------- | ----------------------------------------------------------- | ------- |
| wt-1     | agent-profile-system             | `docs/journeys/JOURNEY-agent-profile-system.md`             | missing |
| wt-2     | onboarding-redesign              | `docs/journeys/JOURNEY-onboarding-redesign.md`              | missing |
| wt-3     | onboarding-intelligence-pipeline | `docs/journeys/JOURNEY-onboarding-intelligence-pipeline.md` | missing |

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
| 2026-03-06 | communications-finish     | `feat/communications-finish`                                       | development |
| 2026-03-08 | operation (season)        | `feat/operation`                                                   | development |
| 2026-03-08 | daily-standup             | `feat/daily-standup`                                               | development |

## Session History

| Date       | Feature                          | Action            | Notes                                                                                                                                                                                          |
| ---------- | -------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-02 | (meta)                           | Dashboard created | Boot sequence, plugin cleanup, slash commands                                                                                                                                                  |
| 2026-03-02 | (meta)                           | session ended     | All infra done: SESSION.md, DASHBOARD.md, 4 slash commands, plugin cleanup                                                                                                                     |
| 2026-03-02 | dashboard-redesign               | closed            | Merged to development, wt-3 freed                                                                                                                                                              |
| 2026-03-02 | team-member-management           | closed            | Merged to development, wt-1 freed                                                                                                                                                              |
| 2026-03-02 | landing-analytics                | closed            | Merged to development, branch deleted                                                                                                                                                          |
| 2026-03-02 | agent-architecture               | synced            | Merged to development, wt-4 stays open                                                                                                                                                         |
| 2026-03-02 | (orchestrator)                   | session ended     | 4 PRs merged, CI fixed, landing variants, keys/vault, middleware perf                                                                                                                          |
| 2026-03-03 | schedule-control-panel           | started           | wt-4, module: schedule — UI redesign for schedule module                                                                                                                                       |
| 2026-03-03 | people-module-v2                 | started           | wt-2, module: org-structure — People module UI redesign                                                                                                                                        |
| 2026-03-02 | stage-engine-local               | closed            | Merged to development, sma-14 freed                                                                                                                                                            |
| 2026-03-02 | dashboard-evolution              | started           | wt-5, module: dashboard — 9-track dashboard evolution plan                                                                                                                                     |
| 2026-03-03 | operations-ui-redesign           | closed            | Merged to development, wt-20 freed                                                                                                                                                             |
| 2026-03-03 | fix-schedule-mutations           | closed            | PR #26 closed (already on development), sma-16 freed                                                                                                                                           |
| 2026-03-03 | people-module-v2                 | closed            | Merged to development, wt-2 freed                                                                                                                                                              |
| 2026-03-03 | email-template-editor            | session ended     | Tiptap rich editor, 4 new sections (card/hero/CTA/video), SSR fix, pushed                                                                                                                      |
| 2026-03-03 | schedule-control-panel           | closed            | 10/10 tasks, 13 commits, all gates pass. wt-4 freed                                                                                                                                            |
| 2026-03-03 | auth-screens-redesign            | closed            | Split-screen auth, gradient mesh, 5 pages, reset-pw fix, merged wt-1                                                                                                                           |
| 2026-03-03 | (dashboard)                      | session ended     | Fixed useWorkspace crash in 5 hooks (edbf7e4), auth merged, session logged                                                                                                                     |
| 2026-03-03 | services-health-dashboard        | closed            | PR #27 merged, sma-18 freed. Health dashboard at /platform-admin/services                                                                                                                      |
| 2026-03-03 | day-control-center-polish        | closed            | PR #28 merged, sma-19 freed. Day control split into modular directory                                                                                                                          |
| 2026-03-03 | dashboard-evolution              | closed            | 11 commits merged (tracks 1-8), wt-5 freed                                                                                                                                                     |
| 2026-03-03 | agent-config-ui                  | closed            | PR #29 merged. Agent authority config UI at /dashboard/ai/config                                                                                                                               |
| 2026-03-05 | entity-detail-pages              | closed            | 2 commits merged, wt-1 freed                                                                                                                                                                   |
| 2026-03-03 | complete-remaining-features      | started           | wt-1, module: multi — 4 features: landing, portal, comms, entity-detail                                                                                                                        |
| 2026-03-04 | admin-wizard-completion          | session ended     | Verified all 17 plan tasks already implemented, typecheck passes clean                                                                                                                         |
| 2026-03-04 | dashboard-polish                 | closed            | 8 commits on development: heatmap overhaul, strategic fix, day-control tabs, wt-1 freed                                                                                                        |
| 2026-03-04 | communications-finish            | started           | wt-2, module: comms — template persistence, engagement reports, webhook fix                                                                                                                    |
| 2026-03-04 | entity-detail-pages              | started           | wt-1, module: org-structure — 4 entity detail pages with shared tabs layout                                                                                                                    |
| 2026-03-05 | entity-detail-pages              | session ended     | All 6 tasks complete: EntityDetailLayout + 4 detail pages + navigation wiring. Uncommitted, needs commit + closure gates                                                                       |
| 2026-03-05 | daily-standup                    | started           | wt-3, module: operations — DailyCloseEngine: state machine + reconciliation + OCR                                                                                                              |
| 2026-03-05 | schedule-ui-polish               | session ended     | 16 files: 13 dialog redesigns, monthly view rewrite, working filters, compact headers. Uncommitted on development                                                                              |
| 2026-03-06 | (status review)                  | session ended     | Ran /status + typecheck (18/18 pass). Cleaned ghost worktrees sma-16/sma-17. Found 12 orphan feat branches. 2 active worktrees (wt-2 comms, wt-3 standup). 2 uncommitted files on development. |
| 2026-03-06 | operation                        | started           | wt-1, module: operations                                                                                                                                                                       |
| 2026-03-06 | communications-finish            | closed            | 5 commits, all 8 plan tasks done. wt-2 freed                                                                                                                                                   |
| 2026-03-06 | (main session)                   | session ended     | Status review, typecheck (18/18), comms closure prep (all gates pass, cf 2 ready). 5 uncommitted files on development (3 new module docs, 2 modified docs).                                    |
| 2026-03-07 | communications-finish            | closing           | All gates verified, 5 commits ready for merge. cf 2 to execute.                                                                                                                                |
| 2026-03-07 | operation                        | abandoned         | Empty branch (0 commits). Worktree + branch removed.                                                                                                                                           |
| 2026-03-07 | daily-standup                    | abandoned         | Empty branch (0 commits). Worktree + branch removed.                                                                                                                                           |
| 2026-03-07 | (comms closure)                  | session ended     | Verified comms-finish plan (8/8 tasks), closed feature, cf 2 merged. Clean development.                                                                                                        |
| 2026-03-03 | DO droplet deployment            | session ended     | Fixed all 5 DO services: env vars, swapped keys, DNS A-records (GoDaddy), TLS certs, contract-service Vault fallback. All services verified working.                                           |
| 2026-03-08 | (hydration fix)                  | session ended     | Fixed React hydration mismatch: lazy-loaded ReactQueryDevtools in query-provider.tsx. 1 file changed on development.                                                                           |
| 2026-03-07 | onboarding-redesign              | started           | wt-2, module: onboarding — 5-step dashboard-style onboarding replacing 15-step wizard                                                                                                          |
| 2026-03-09 | season-planning-mvp              | ready_for_closure | wt-1: Season Planning MVP (Module 15) — 3 DB tables, calculation engine, 5 hooks, 5 components, tab page. All closure gates pass. Run `cf 1`.                                                  |
| 2026-03-09 | daily-close-engine               | ready_for_closure | wt-3: DailyCloseEngine — 6 engine tables, 3 Edge Functions (OCR/validation/dispatch), employee close-out UI, admin reconciliation dashboard. All closure gates pass. Run `cf 3`.               |
| 2026-03-09 | (session)                        | session ended     | Completed Season Planning MVP + DailyCloseEngine. Both features ready for closure (cf 1, cf 3). 16 schedule UI files committed earlier.                                                        |
| 2026-03-08 | operation (season)               | merged+closed     | 10 commits merged to development, wt-1 removed. Season planning UI + calc engine + DB migration.                                                                                               |
| 2026-03-08 | daily-standup                    | merged+closed     | 2 commits merged to development, wt-3 removed. Daily close engine, reconciliation UI, 4 DB migrations, 3 edge functions.                                                                       |
| 2026-03-10 | agent-profile-system             | started           | wt-1, module: ai — Voice DNA, personality, posture, relationship index, context awareness                                                                                                      |
| 2026-03-10 | onboarding-intelligence-pipeline | started           | wt-3, module: onboarding — Full pipeline: scrape → Brreg name search → details → web search                                                                                                    |
