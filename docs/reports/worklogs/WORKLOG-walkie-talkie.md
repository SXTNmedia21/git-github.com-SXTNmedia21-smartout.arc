---
title: "Worklog — walkie-talkie"
status: done
updated: 2026-03-22
created: 2026-03-22
module: communications
tags: [channels, messaging, realtime, phase-1]
---

# Worklog — walkie-talkie

> Branch: `feat/walkie-talkie` | Worktree: wt-2 | Started: 2026-03-22

## Status: ✅ Done — Phase 1 Complete (Web)

## Done

- [x] Spec: channel communications design (3 subsystems, 16 tables)
- [x] Plan: Phase 1 implementation plan (16 tasks)
- [x] DB: 16 enums, 11 tables, 42 RLS policies
- [x] DB: create_channel() SECURITY DEFINER + read-model RPCs
- [x] DB: Botsson system profile seed (profile_role 'system')
- [x] DB: Auto-create triggers (dept/team channels + profile sync)
- [x] DB: Realtime enabled on channel_message + channel_message_reaction
- [x] Types: database.types.ts regenerated
- [x] Telemetry: 12 channel events in registry
- [x] Hooks: 10 TanStack Query hooks (channels, messages, send, react, read, create, members, unread, realtime)
- [x] UI: 12 components (Shell, List, Item, Header, Timeline, Bubble, SystemMessage, Input, Reply, Members, Create, Loading)
- [x] Sidebar: "Kanaler" nav item with Radio icon
- [x] Dev server verified running

## Remaining

- [ ] Mobile UI: React Native channel screens (packages/ hooks ready)
- [ ] Phase 2: LiveKit voice/video
- [ ] Phase 3: AI participation (Botsson @mention, summaries)
- [ ] Phase 4: Integrations + old chat sunset
- [ ] E2E tests (Playwright)
- [ ] User journeys documentation
- [ ] Feature closure deliverables

## Decisions

| Date       | Decision                                   | Reason                                                            |
| ---------- | ------------------------------------------ | ----------------------------------------------------------------- |
| 2026-03-22 | Parallel schema (not modify existing chat) | Approach C from spec — clean separation, sunset later             |
| 2026-03-22 | profile_role 'system' for Botsson          | Cleaner than boolean flag, semantically correct                   |
| 2026-03-22 | Dotted event names (channel.created)       | Distinguish from old chat events (space-separated)                |
| 2026-03-22 | Membership-scoped RLS for child tables     | More secure than workspace-scoped — only channel members see data |
| 2026-03-22 | RPCs for read models (not ad-hoc selects)  | Complex joins + aggregations belong in DB, enables mobile reuse   |

## Log

| Date       | Time  | Event                                            |
| ---------- | ----- | ------------------------------------------------ |
| 2026-03-22 | 02:02 | Feature started                                  |
| 2026-03-22 | 02:30 | DB schema complete (16 enums, 11 tables, 42 RLS) |
| 2026-03-22 | 02:45 | Functions + RPCs complete                        |
| 2026-03-22 | 03:00 | Types + telemetry complete                       |
| 2026-03-22 | 03:15 | All 10 hooks complete                            |
| 2026-03-22 | 03:30 | All 12 UI components complete                    |
| 2026-03-22 | 03:35 | Sidebar navigation added                         |
| 2026-03-22 | 03:40 | Auto-create triggers added                       |
| 2026-03-22 | 03:45 | Dev server verified, Phase 1 web complete        |
| 2026-03-22 | 04:42 | Feature closed and merged to development         |
| 2026-03-22 | 04:44 | Feature closed and merged to development         |
| 2026-03-22 | 04:53 | Feature closed and merged to development         |
