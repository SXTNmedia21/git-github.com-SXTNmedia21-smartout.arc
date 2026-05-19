---
title: "Slice 13 — Webhook Integration Audit"
status: done
updated: 2026-05-18
created: 2026-05-18
module: webhook
tags: [audit, webhook, security, idempotency]
---

# Slice 13 — Webhook Integration Audit

**Surface:** `supabase/functions/*-webhook/`, `apps/web/src/app/api/webhooks/**`
**Handlers audited:** stripe-webhook, sendgrid-webhook, livekit-webhook, docuseal (Next.js Route Handler)
**Twilio status:** no inbound webhook handler found — Twilio used as outbound SMS sender only (`_shared/twilio.ts`, `send-login-code`, `push-dispatch`). No delivery-status callback endpoint exists. NOTED, not CRITICAL.

---

## PASS — Stripe webhook (`supabase/functions/stripe-webhook/index.ts`)

- `verify_jwt = false` in config.toml. Signature boundary is `stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret)` using WebCrypto-safe async variant — correct for Deno.
- Fails closed when `STRIPE_WEBHOOK_SECRET` is absent (HTTP 500, no passthrough).
- Missing signature → HTTP 400 before any processing.
- Idempotency: UPSERT on `payment_attempt.stripe_event_id UNIQUE` prevents double-processing of Stripe retries. `charge.refunded` additionally guards against zero-delta replays with explicit warn + early return.
- PII redaction: `redactStripeEvent()` whitelist-only, ADR-0141 compliant. Forbidden fields (billing_details, customer, source, receipt_url) never touch the DB.
- Error handling: unhandled exceptions in event handlers return HTTP 500 to trigger Stripe retry; handlers are documented as idempotent.
- No secrets logged — errors log error objects but not key values.
- **No issues found.**

---

## PASS — SendGrid webhook (`supabase/functions/sendgrid-webhook/index.ts`)

- `verify_jwt = false`. ECDSA P-256 SHA-256 signature via WebCrypto (`crypto.subtle`).
- Fails closed: missing `SENDGRID_WEBHOOK_VERIFICATION_KEY` → HTTP 500. Comment references prior audit finding H-02 (2026-05-06) where missing env var skipped verification silently — that gap is closed.
- Timestamp replay defense: rejects events older than 300 seconds (comment: F-WH-06). This is beyond standard ECDSA signature scope and is a deliberate hardening addition.
- Missing signature headers → HTTP 401 before body parsing.
- Idempotency: counter events (open/click) use `platform_webhook_event` upsert with `ignoreDuplicates: true` on `(provider, sg_message_id)` unique key before mutating counters. Events without `sg_message_id` skip counter mutation with warn.
- No raw PII logged — email values logged only in warn-level dedupe messages, not secret material.
- **No issues found.**

---

## PASS — LiveKit webhook (`supabase/functions/livekit-webhook/index.ts`)

- `verify_jwt = false`. Signature via `WebhookReceiver` from `livekit-server-sdk` using `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET`. Missing env → HTTP 500 (fail-closed, F-WH-02 comment).
- Missing `Authorization` header → HTTP 401.
- UUID format validation on parsed room name parts prevents corrupt `workspace_id`/`channel_id` from reaching DB writes (F-WH-07 comment).
- Idempotency: `call_log` upsert on `call_session_id` UNIQUE with `ignoreDuplicates: true` handles `room_finished` retries (F-WH-04 comment). Engine event insert uses `idempotency_key: livekit:{eventId}:{eventType}`.
- No secrets exposed in error responses.
- **No issues found.**

---

## PASS — DocuSeal webhook (`apps/web/src/app/api/webhooks/docuseal/route.ts`)

- Next.js Route Handler (not an Edge Function). HMAC-SHA256 via Node `crypto.createHmac` with `timingSafeEqual` constant-time comparison — correct, prevents timing oracle.
- Missing signature → HTTP 401 before body parsing.
- Payload validated with Zod schema before any DB access.
- Idempotency: status regression guard (weight table) prevents out-of-order webhook events from overwriting a higher status. `maybeSingle()` on `docuseal_submission_id` with partial UNIQUE index (migration 20260616100500) prevents duplicate contract rows (F-WH-05 comment). Contract-not-found → HTTP 404, not 500.
- DB errors logged server-side only; caller receives generic `{ error: "internal" }` (F-WH-01 comment).
- Telemetry emitted on viewed/signed/declined/expired via `emit()`.
- `engine_event` insert for contract.signed uses `void Promise.resolve(...).catch(() => {})` — non-blocking fire-and-forget; failure silently swallowed. Acceptable for non-critical downstream; no data loss on primary flow.
- **No issues found.**

---

## OBSERVATION — Twilio inbound webhook absent

Twilio is used for outbound SMS (login codes, notifications). No inbound delivery-status or reply webhook handler exists. If Twilio delivery callbacks are enabled on the account, there is no receiving endpoint and no signature verification in scope. This is consistent with the current feature set but should be noted if SMS delivery tracking is added.

**Severity: INFO** — no handler to audit; gap only matters if Twilio callbacks are activated.

---

## Summary

| Handler | Signature Verification | Fail-Closed on Missing Secret | Idempotency | No Secrets in Logs | Result |
|---|---|---|---|---|---|
| stripe-webhook | HMAC via constructEventAsync | YES | UPSERT + unique violation guard | YES | PASS |
| sendgrid-webhook | ECDSA P-256 + timestamp window | YES | upsert ignoreDuplicates on sg_message_id | YES | PASS |
| livekit-webhook | JWT via WebhookReceiver | YES | upsert ignoreDuplicates + idempotency_key | YES | PASS |
| docuseal route | HMAC-SHA256 timingSafeEqual | YES (env.ts Zod gate) | status weight guard + maybeSingle unique | YES | PASS |

**Total findings: 0 CRITICAL, 0 HIGH, 0 MEDIUM, 1 INFO (Twilio inbound absent)**
