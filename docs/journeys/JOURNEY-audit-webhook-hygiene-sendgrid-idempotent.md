---
title: "Journey — sendgrid counter idempotent on replay"
feature: audit-webhook-hygiene
journey: sendgrid-idempotent
status: verified
verified_at: 2026-05-13
e2e_test: null
created: 2026-05-13
updated: 2026-05-14
module: cross-cutting
tags: [journey, webhook, sendgrid, idempotency, f-wh-03]
---

# Journey: SendGrid open/click counter unchanged on payload replay

**Role:** SendGrid webhook retry / duplicate delivery

**Precondition:** Handler upgraded to upsert-with-dedup.

## Happy Path

1. SendGrid POSTs open event payload
2. Handler upserts on `sg_message_id + event_type` → counter +1
3. Replay same payload → upsert no-op → counter unchanged
4. Event without `sg_message_id` → log + skip (or fallback dedup)

**Postcondition:** No double-count. Audit accurate.

## Verification

- [x] Replay test: same payload twice → counter +1 only — upsert with `count: "exact"` gates counter; duplicate returns count=0, `continue` skips RPC
- [x] Missing sg_message_id → `console.warn` + `continue` (no counter update; event still logged to `platform_webhook_event` for audit)
- [x] Synthesis F-WH-03 → CLOSED

**Verified 2026-05-13.**
