---
title: Slice 13 — Webhook + Integration Security Audit
status: done
created: 2026-05-02
updated: 2026-05-02
module: webhook-security
tags: [audit, webhook, security, signature-verification, idempotency]
---

## Summary

Four inbound webhook surfaces audited: `stripe-webhook` (Edge Function), `sendgrid-webhook` (Edge Function), `livekit-webhook` (Edge Function), and `docuseal-webhook` (Next.js API route at `apps/web/src/app/api/webhooks/docuseal/`). No Twilio inbound webhook exists — Twilio is outbound-only (`_shared/twilio.ts`, `send-login-code`, `push-dispatch`). All four have `verify_jwt=false` or equivalent public exposure. Two webhooks have critical or high-severity gaps: `sendgrid-webhook` (conditional verification = optional off-switch) and `docuseal-webhook` (timing-attack-vulnerable comparison + optional enforcement).

---

## Webhook Compliance Table

| Webhook | sig-verify | idempotent | replay-proof | verify_jwt | verdict |
|---|---|---|---|---|---|
| stripe-webhook | ✅ Stripe SDK `constructEventAsync` — mandatory, fail-closed | ✅ UNIQUE on `payment_attempt.stripe_event_id` (23505 trap) | ✅ Stripe SDK enforces 300s timestamp window internally | ✅ `verify_jwt=false` (correct) | PASS |
| sendgrid-webhook | ⚠️ ECDSA P-256 verify — but conditional on `WEBHOOK_VERIFICATION_KEY` being set | ⚠️ Bulk INSERT to `platform_webhook_event` (no unique constraint on `sg_message_id` — open to duplicate rows) | ⚠️ Timestamp included in signed payload but no window validation in code | ✅ `verify_jwt=false` (correct) | PARTIAL — CF-04 confirmed |
| livekit-webhook | ✅ `WebhookReceiver.receive()` from livekit-server-sdk — mandatory, fail-closed (401 on missing header, 403 on bad sig) | ⚠️ `idempotency_key` includes `Date.now()` — keys are never equal between retries; no dedup on `channel_call_participant` insert beyond partial index | ✅ livekit-server-sdk validates JWT expiry internally | ✅ `verify_jwt=false` (correct) | PARTIAL |
| docuseal-webhook | 🔴 String equality `signature !== webhookSecret` — (1) conditional on env var being set, (2) not constant-time (timing attack) | ✅ Status-weight regression guard prevents double-processing for same event | ⚠️ No timestamp window check on `timestamp` field in payload | N/A — Next.js API route, not Edge Function | CRITICAL |

---

## Critical Findings

### CF-13-01 — DocuSeal: conditional signature enforcement + timing-attack comparison

**File:** `apps/web/src/app/api/webhooks/docuseal/route.ts:53-59`
**Severity:** Critical

`DOCUSEAL_WEBHOOK_SECRET` is declared `z.string().optional()` in `env.ts:25`. When the env var is absent, the entire signature block is skipped and any caller can trigger contract status changes. When the var is present, the check uses string equality (`signature !== webhookSecret`), which is not constant-time and leaks secret length via timing.

```ts
// Current — two bugs in 5 lines
if (webhookSecret) {
  const signature = request.headers.get("x-docuseal-signature");
  if (signature !== webhookSecret) {          // ← not constant-time
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
}
```

DocuSeal's own documentation states the `x-docuseal-signature` header is an HMAC-SHA256 hex digest (not the raw secret). The current code compares the header value against the raw secret directly — this will always reject valid requests when a proper HMAC is configured.

**Required fix:**
1. Make `DOCUSEAL_WEBHOOK_SECRET` required (remove `.optional()`).
2. Implement HMAC-SHA256 comparison using `crypto.subtle.verify` or `timingSafeEqual`.
3. Fail-closed: reject if env var absent.

---

### CF-13-02 — SendGrid: optional verification gate (CF-04 cross-reference confirmed)

**File:** `supabase/functions/sendgrid-webhook/index.ts:56-70`
**Severity:** High

`WEBHOOK_VERIFICATION_KEY` is read at module scope with `Deno.env.get()` — no default, no required check. When the env var is absent the entire ECDSA block is skipped. The function accepts and processes any POST with a valid JSON array body.

The signature implementation itself (ECDSA P-256 SHA-256 over `timestamp + rawBody`) is correct when active. The gap is entirely in conditional enforcement.

**Required fix:** Fail-closed on missing key — return 500 (misconfigured) before processing any events if `WEBHOOK_VERIFICATION_KEY` is not set.

---

### CF-13-03 — SendGrid: no idempotency key on `platform_webhook_event`

**File:** `supabase/functions/sendgrid-webhook/index.ts:233`
**Severity:** Medium

Events are bulk-inserted without a unique constraint on `(provider, sg_message_id)`. SendGrid retries on non-2xx and can also re-send during dashboard replays. Open_count / click_count increments are additive — duplicate events inflate counters. The `platform_webhook_event` table may also accumulate duplicate raw payloads.

**Required fix:** Add UNIQUE constraint on `(provider, sg_message_id)` + use upsert with `onConflict` skip.

---

### CF-13-04 — LiveKit: `idempotency_key` includes `Date.now()` — dedup is broken

**File:** `supabase/functions/livekit-webhook/index.ts:235`
**Severity:** Medium

The `engine_event` insert uses `Date.now()` as part of the key, guaranteeing a new key on every call including retries. LiveKit retries on non-2xx. A `participant_joined` retry creates a second participant row; the partial index comment (`// Insert participant (partial unique index prevents duplicates for active participants)`) is the only dedup layer, and only covers concurrent inserts — not retried webhook deliveries arriving seconds apart.

**Required fix:** Derive idempotency key from a stable payload field (`event.id` from the LiveKit SDK is available on the webhook event object) instead of `Date.now()`.

---

### CF-13-05 — DocuSeal: no replay window on `timestamp` field

**File:** `apps/web/src/app/api/webhooks/docuseal/route.ts`
**Severity:** Low (secondary to CF-13-01)

The `timestamp` in the Zod-validated payload is parsed but never checked against `Date.now()`. A captured + replayed webhook from hours earlier would be accepted if the signature check passes. Low severity because the status-weight guard (CF noted above as idempotency PASS) limits blast radius.

---

## Outbound Integration Secrets Check

| Integration | Secret reference | Hardcoded? |
|---|---|---|
| Stripe API | `Deno.env.get("STRIPE_SECRET_KEY")` in stripe-webhook; env.ts `STRIPE_SECRET_KEY` for web | No — op:// in .env.template |
| Stripe webhook secret | `Deno.env.get("STRIPE_WEBHOOK_SECRET")` | No — op:// in .env.template |
| SendGrid webhook key | `Deno.env.get("SENDGRID_WEBHOOK_VERIFICATION_KEY")` | No — op:// in .env.template |
| LiveKit API key/secret | `Deno.env.get("LIVEKIT_API_KEY")` + `LIVEKIT_API_SECRET` | No — op:// in .env.template |
| DocuSeal webhook secret | `env.DOCUSEAL_WEBHOOK_SECRET` via `t3-oss/env-nextjs` | No — op:// in .env.template (`op://smartout_ai/DocuSeal/webhook_secret`) |
| Internal emit bearer (`WATCHDOG_CRON_SECRET`) | Used in stripe-webhook outbound emit call | No — env var only |

No hardcoded secrets found in any webhook handler. All references use `Deno.env.get()` or the validated `env` object. The `Bearer ${secret}` pattern in `stripe-webhook/index.ts:117` is runtime-composed from an env var — not a literal.

---

## Summary of Gaps

| ID | Severity | Webhook | Gap |
|---|---|---|---|
| CF-13-01 | Critical | docuseal | Signature optional + wrong comparison (string equality, not HMAC) |
| CF-13-02 | High | sendgrid | Verification entirely optional when env var absent |
| CF-13-03 | Medium | sendgrid | No unique constraint on event ID — duplicate delivery inflates counters |
| CF-13-04 | Medium | livekit | `Date.now()` in idempotency key breaks dedup on retry |
| CF-13-05 | Low | docuseal | No replay timestamp window |
