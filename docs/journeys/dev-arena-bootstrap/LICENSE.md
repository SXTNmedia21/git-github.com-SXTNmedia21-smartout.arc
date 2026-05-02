---
title: "License — dev-arena-bootstrap"
mission_id: dev-arena-bootstrap
authority_profile: internal-platform-admin
phase: 0
---

# Authority License

Phase 0 dummy mission — performs no capability calls, no shell, no DB
mutations beyond engine_state self-update. Operates at
`internal-platform-admin` scope only. No customer-data access.

## Allowed

- Update own engine_state row (status, dispatch_lock_id, completed_at).
- Emit telemetry events to engine_event/activity_trail via @smartout/telemetry.

## Denied

- Any other table mutation.
- Any capability tool invocation.
- Shell, network, filesystem outside `docs/journeys/dev-arena-bootstrap/`.
