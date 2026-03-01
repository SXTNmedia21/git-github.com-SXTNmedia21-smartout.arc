---
title: "Worklog — landing-analytics"
status: in_progress
updated: 2026-03-01
created: 2026-03-01
module: landing
tags: []
---
# Worklog — landing-analytics
> Branch: `feat/landing-analytics` | Worktree: wt-6 | Started: 2026-03-01
## Status: 🟡 In Progress
## Done
- [x] Task 1: Database migration — landing_visitor + landing_session + extend landing_event

## Remaining
- [ ] Task 2: Visitor cookie manager (smo_vid)
- [ ] Task 3: Enhanced client-side tracking hooks
- [ ] Task 4: Enhanced /api/track endpoint
- [ ] Task 5: Wire up tracking in landing page components
- [ ] Task 6: Admin page.tsx — session data fetching
- [ ] Task 7: Admin sessions tab + columns + tab container
- [ ] Task 8: Admin session detail sheet
- [ ] Task 9: Session events API route
- [ ] Task 10: Visitor tag dialog + API
- [ ] Task 11: Auto-link visitor at signup
- [ ] Task 12: Update landing event columns for new event types
- [ ] Task 13: Type check + build verification
- [ ] Task 14: Update documentation

## Decisions
| Date | Decision | Reason |
|------|----------|--------|
| 2026-03-01 | No RLS on landing tables | Platform-admin only, accessed via service role |
| 2026-03-01 | landing_visitor PK = smo_vid cookie value | Avoids separate lookup; cookie IS the identifier |
| 2026-03-01 | ON DELETE CASCADE for session->visitor, SET NULL for event->visitor | Sessions are meaningless without visitor; events have independent value |

## Log
| Date | Time | Event |
|------|------|-------|
| 2026-03-01 | 22:27 | Feature started |
| 2026-03-01 | 22:30 | Task 1: Created migration 20260301600000_landing_session_tracking.sql |
