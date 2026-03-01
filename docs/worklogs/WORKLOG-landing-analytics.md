---
title: "Worklog — landing-analytics"
status: done
updated: 2026-03-01
created: 2026-03-01
module: landing
tags: []
---

# Worklog — landing-analytics

> Branch: `feat/landing-analytics` | Worktree: wt-6 | Started: 2026-03-01

## Status: 🟢 Done

## Done

- [x] Task 1: Database migration — landing_visitor + landing_session + extend landing_event
- [x] Task 2: Visitor cookie manager (smo_vid)
- [x] Task 3: Enhanced client-side tracking hooks
- [x] Task 4: Enhanced /api/track endpoint
- [x] Task 5: Wire up tracking in landing page components
- [x] Task 6: Admin page.tsx — session data fetching
- [x] Task 7: Admin sessions tab + columns + tab container
- [x] Task 8: Admin session detail sheet (Sheet panel with visitor info, summary stats, event timeline)
- [x] Task 9: Session events API route (GET /api/admin/session-events)
- [x] Task 10: Visitor tag dialog + API (Dialog + POST /api/admin/tag-visitor)

## Remaining

- [x] Task 11: Auto-link visitor at signup
- [x] Task 12: Update landing event columns for new event types
- [x] Task 13: Type check + build verification — all 18 turbo tasks pass
- [x] Task 14: Update documentation

## Decisions

| Date       | Decision                                                            | Reason                                                                            |
| ---------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 2026-03-01 | No RLS on landing tables                                            | Platform-admin only, accessed via service role                                    |
| 2026-03-01 | landing_visitor PK = smo_vid cookie value                           | Avoids separate lookup; cookie IS the identifier                                  |
| 2026-03-01 | ON DELETE CASCADE for session->visitor, SET NULL for event->visitor | Sessions are meaningless without visitor; events have independent value           |
| 2026-03-01 | UUIDv4 for visitor cookie, hex for session ID                       | Cookie is stored in DB as PK (standard format); session ID is transient (compact) |
| 2026-03-01 | sendBeacon for session_end, fetch for everything else               | sendBeacon survives page unload; fetch is cancellable on unload                   |
| 2026-03-01 | sessionStorage guards for scroll thresholds                         | Each threshold fires once per tab session to avoid flood                          |

## Log

| Date       | Time  | Event                                                                                                                                                                           |
| ---------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-01 | 22:27 | Feature started                                                                                                                                                                 |
| 2026-03-01 | 22:30 | Task 1: Created migration 20260301600000_landing_session_tracking.sql                                                                                                           |
| 2026-03-01 | 22:45 | Task 2: Created visitor-cookie.ts with getOrCreateVisitorId + getVisitorId                                                                                                      |
| 2026-03-01 | 22:50 | Task 3: Enhanced useTracking.ts (exports, visitor_id, beaconEvent), created useScrollTracking, useClickTracking, useSessionLifecycle                                            |
| 2026-03-01 | 23:10 | Task 4: Enhanced /api/track with visitor/session upsert, 7 event types, device detection                                                                                        |
| 2026-03-01 | 23:15 | Task 5: Created FullTracker component, replaced PageTracker in 5 pages (kept in signup)                                                                                         |
| 2026-03-01 | 23:30 | Task 6+7: Rewrote page.tsx with session data fetches + KPIs; created landing-tabs.tsx, session-columns.tsx, sessions-tab.tsx                                                    |
| 2026-03-01 | 23:45 | Task 8+9+10: Created session-detail.tsx (Sheet panel), session-events API route, visitor-tag-dialog.tsx + tag-visitor API route. Wired into sessions-tab.tsx                    |
| 2026-03-01 | 23:55 | Task 11+12: Created signup-visitor-linker.tsx, wired into signup page. Updated landing-columns.tsx with 4 new event types (click, scroll_depth, session_heartbeat, session_end) |
| 2026-03-01 | 24:00 | Task 13: Type errors fixed with UntypedClient casts (pending type regeneration). All 18 turbo tasks pass                                                                        |
| 2026-03-01 | 24:05 | Task 14: Documentation updated. Feature complete                                                                                                                                |
