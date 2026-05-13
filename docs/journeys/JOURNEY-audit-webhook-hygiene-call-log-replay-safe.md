---
title: "Journey — call_log replay-safe via UNIQUE constraint"
feature: audit-webhook-hygiene
journey: call-log-replay-safe
status: draft
verified_at: null
e2e_test: null
created: 2026-05-13
updated: 2026-05-13
module: cross-cutting
tags: [journey, webhook, livekit, idempotency, f-wh-04]
---

# Journey: LiveKit room_finished retry creates 0 duplicate rows

**Role:** LiveKit webhook caller (retry scenario)

**Precondition:** Migration applied. Handler upserts on conflict.

## Happy Path

1. First `room_finished` POST → INSERT call_log row + emit `channel.call.ended`
2. Network retry → duplicate POST same `call_session_id`
3. ON CONFLICT (call_session_id) DO NOTHING (or DO UPDATE late status)
4. 0 new rows. 0 duplicate emits.

**Postcondition:** Audit-trail integrity. No count inflation.

## Verification

- [ ] Migration applied: `call_log.call_session_id` UNIQUE constraint exists
- [ ] Replay test: same payload twice → 1 row total
- [ ] Synthesis F-WH-04 → CLOSED

**Mark verified when checked.**
