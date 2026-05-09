---
title: "HANDOFF — Phase A6: pg_notify Guardian Bus"
status: done
type: handoff
created: 2026-04-22
updated: 2026-05-09
module: MODULE_BOTSSON
tags: [botsson, guardian, pg_notify, websocket, handoff, phase-a6]
decisions: [ADR-0186]
learnings: []
---

# HANDOFF — Phase A6: pg_notify Guardian Bus

## What Was Built

Phase A6 replaced the in-process `Set<ClientInfo>` in Guardian Bus with a PostgreSQL
`pg_notify('guardian_events')` pattern. Prior to this phase, Guardian Evaluator emitted
verdicts to a bus that no WebSocket client outside the current process instance could receive —
multi-process / multi-container deployments meant platform-admin clients on different instances
missed events.

### Deliverables

| Artifact | Path | Status |
|---|---|---|
| `pg-notify-bus.ts` | `services/stage-engine/src/core/pg-notify-bus.ts` | 🟢 |
| `guardian-bus.ts` update | `services/stage-engine/src/core/guardian-bus.ts` | 🟢 |
| AFTER INSERT trigger on `guardian_log` | `supabase/migrations/...` | 🟢 |
| Guardian route WebSocket broadcast | `services/stage-engine/src/routes/guardian.ts` | 🟢 |
| ADR-0186 accepted | `docs/decisions/0186-guardian-pg-notify-bus.md` | 🟢 |

### Architecture

```
Guardian Evaluator
    │
    ▼  emitGuardianEvent()
guardian_log INSERT
    │
    ▼  AFTER INSERT trigger
pg_notify('guardian_events', payload)
    │
    ▼  stage-engine LISTEN (per instance)
broadcastGuardianEvent()
    │
    ▼  WebSocket → /platform-admin/guardian (workspace-filtered)
```

- Stage-engine LISTENs on startup; each instance handles its own WS clients.
- Payload is workspace-filtered before WS fanout — godmode sees own workspace via WS.
- Telegram bridge reuses the same pg_notify pattern as a reference implementation.

## Decisions Made

- **ADR-0186**: Guardian Bus uses PostgreSQL pg_notify for cross-process fan-out.
  In-process Set was a single-instance limitation. pg_notify solves this without Redis/Upstash.

## Learnings

- `pg-notify-bus.ts:95` originally had a godmode wildcard (`broadcastGuardianEvent` used
  hard-filter `profile.workspace_id`) — platform-admin godmode sees only own workspace via WS.
  The recorder feed (Guardian feed proper) is platform-wide via RLS already. Godmode WS gap
  is a known outstanding item (documented in BOTSSON-SYSTEM-MAP.md §Guardian route).
- Docker Compose missed `DATABASE_URL` passthrough for pg_notify initially — stage-engine
  connected but could not LISTEN. Always verify DATABASE_URL is passed through in
  `docker-compose.yml` when adding pg_notify consumers.
- `stale dist/` lacked `core/pg-notify-bus.js` after first deploy — needed explicit `pnpm build`.
  Cached dist builds do not auto-pick up new source files.

## Known Issues / Debt

- Godmode WS wildcard: platform-admin godmode platform-wide guardian feed via WS not yet
  implemented (outstanding sortie). Recorder feed is correct via RLS.
- `pg-notify-bus.ts:95` hard-filters on `profile.workspace_id` — godmode WS sees only
  own workspace. Full platform-wide WS feed needs separate ADR.

## Next Steps

- Godmode wildcard in `guardian-route.ts:66` + `pg-notify-bus.ts:95` — outstanding sortie.
- WS reconnect / heartbeat test coverage for pg_notify bus.
