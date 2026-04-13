---
title: "STATE Summary — Quick Session Start"
updated: 2026-04-13
derived-from: docs/STATE.md (82KB full version)
---

# STATE Summary

> Read this instead of STATE.md at session start. For deep dives, use semantic search on STATE.md.

## Active Work

| Branch | Status | Notes |
|--------|--------|-------|
| `feat/otp-login-replace-join-code` | in_progress | OTP login replacing join codes, mobile verify/welcome, Edge Function |

See `docs/DASHBOARD.md` for full worktree map.

## Top Priority Gaps

1. **Shift Publish -> Session** (D6, HIGH) — end-to-end flow untested (emit -> trigger -> upsert_session -> hooks)
2. **Notifications delivery** (HIGH) — `send_notification` works, downstream channel adapters missing
3. **Settings incomplete** — 13/16 tabs working, missing: general, KPI, teams
4. **Trainee first-day redirect** (D2, MEDIUM) — no redirect to my-training after invite accept
5. **my-schedule realtime** (D6, LOW) — no Realtime subscription on employee shift view

## Cascade Status (~55% complete)

- Phase A (Schema): DONE
- Phase B (Pure Functions): DONE — 9 functions, 8 test files
- Phase C (Bootstrap): 85% — framework seeded, I1 bootstrap wired
- Phase D (Adapters): NOT STARTED
- Phase E (Control Planes): NOT STARTED — C4 governance first

## Recent Merges (last 2 weeks)

- Employee contract CRUD + invitation RLS fix (Apr 7)
- Skills authority model, CLAUDE.md slim (Apr 7)
- Deployment pipeline, 3-branch flow (Apr 6)

## Quick References

- 75 ADRs, 29 Learnings, 91 Journeys, 124 enums, ~216 tables
- Canonical cascade spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
- Full state: `docs/STATE.md` | Worktrees: `docs/DASHBOARD.md` | Boot cheat sheet: `docs/ORIENTATION.md`
