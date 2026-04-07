---
title: "Worklog — guardian"
status: in_progress
updated: 2026-03-14
created: 2026-03-03
module: ai
tags: [guardian, capability, stage-engine, websocket, dashboard]
---

# Worklog — guardian

> Branch: `feat/guardian` | Worktree: wt-1 | Started: 2026-03-03

## Status: 🟡 In Progress

## Done

### Layer 0: DB + Types

- [x] guardian_signal table migration (20260314000000)
- [x] guardian_log table migration (20260314100000) — RLS, indexes, API key policy
- [x] engine_authority_config seed for guardian capability
- [x] database.types.ts regenerated

### Layer 1: AI Capability (engine-architect agent)

- [x] Add "guardian" to CapabilityName, Situation, intent classifier
- [x] Guardian capability definition + 3 tool stubs (get_signals, acknowledge_signal, get_workspace_health)
- [x] Register in capability registry
- [x] Posture adjustments, agent-router situation mapping

### Layer 2: Stage Engine — WebSocket + Event Bus

- [x] Install `ws` dependency
- [x] Guardian types (GuardianEvent, GuardianCommand, GuardianServerMessage)
- [x] Guardian event bus (guardian-bus.ts) — emit, subscribe, persist
- [x] WebSocket endpoint (/guardian/ws) — auth, commands, session list
- [x] Wire emitGuardianEvent into 6 lifecycle files
- [x] Attach WebSocketServer to HTTP server in index.ts

### Layer 3: Dashboard

- [x] useGuardianSocket hook — WebSocket client with auto-reconnect
- [x] GuardianMonitor — three-panel layout
- [x] SessionList — active sessions sidebar
- [x] EventFeed — auto-scrolling event log with actor colors
- [x] SessionDetails — session info + activity stats
- [x] WhisperInput — admin whisper form
- [x] Sidebar NavItem (Shield icon, under AI section)

### Review Fixes

- [x] C1: Added updated_at to guardian_log
- [x] C2: Added API key RLS policy on guardian_log
- [x] C3: Removed duplicate events in ultravox advance (stage-manager already emits)
- [x] I1: Added admin/owner role check on WebSocket auth
- [x] I2: Fixed WebSocket JWT auth (query param instead of subprotocol)
- [x] I3: Documented hardcoded actor colors as deliberate exception
- [x] I4: Added workspace validation on whisper command

### Closure Prep

- [x] ADR-0052: Guardian WebSocket architecture decision (was ADR-0049, renumbered 2026-04-07)
- [x] API key RLS + JWT UPDATE policies on guardian_signal (20260314200000)
- [x] Learning log entries (2 learnings: WS auth, event dedup)
- [x] Fixed stage engine default URL to port 5022

## Remaining (v2)

- [ ] Guardian sweep Edge Function (cron-based detection)
- [ ] Signal expiry cleanup job
- [ ] End-to-end manual test (start stage engine, open dashboard, trigger session)
- [ ] Typecheck full pass (needs all workspace packages built)
- [ ] User journeys doc

## Decisions

| Date       | Decision                                                      | Reason                                                                        |
| ---------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 2026-03-14 | Guardian = real-time session monitor (not just cron signals)  | Pontus vision: "second hand on the wheel" — watch every conversation          |
| 2026-03-14 | Direct WebSocket from stage engine (not Supabase Realtime)    | True real-time, bidirectional commands, zero latency                          |
| 2026-03-14 | Whisper = one-shot system message injected into agent context | Stored in collected_data.\_whispers[], consumed on next response cycle        |
| 2026-03-14 | Guardian operates through agent mode, not mission stages      | Health monitoring is conversational, not a multi-stage workflow               |
| 2026-03-14 | Tools split into readOnlyTools + suggestTools                 | Reads are safe; acknowledge_signal is mutation gated behind suggest authority |
| 2026-03-14 | Actor colors are hardcoded (exception to CSS variable rule)   | Semantic coloring for chat-like actor distinction                             |

## Log

| Date       | Time  | Event                                                                       |
| ---------- | ----- | --------------------------------------------------------------------------- |
| 2026-03-03 | 17:28 | Feature started                                                             |
| 2026-03-14 | —     | guardian_signal migration committed                                         |
| 2026-03-14 | —     | Brainstorming: pivoted from cron-based signals to real-time session monitor |
| 2026-03-14 | —     | Design doc + implementation plan written and committed                      |
| 2026-03-14 | —     | Engine-architect agent: guardian capability skeleton (8 files)              |
| 2026-03-14 | —     | Team spawned: backend (5 tasks) + frontend (3 tasks) in parallel            |
| 2026-03-14 | —     | All 8 implementation tasks complete (11 commits)                            |
| 2026-03-14 | —     | Code review: 3 critical + 5 important issues found                          |
| 2026-03-14 | —     | All review fixes applied and committed                                      |
| 2026-03-14 | —     | ADR-0049 (now ADR-0052), learning logs, guardian_signal RLS policies, port fix committed   |
