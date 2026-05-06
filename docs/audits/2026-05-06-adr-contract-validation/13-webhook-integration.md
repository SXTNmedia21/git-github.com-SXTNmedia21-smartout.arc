---
title: "Slice 13 — Webhook Integration Audit"
status: done
updated: 2026-05-06
created: 2026-05-06
module: webhook-integration
tags: [audit, webhook, security, hmac, idempotency]
---

# Slice 13: Webhook Integration Audit

**Date:** 2026-05-06
**Scope:** `supabase/functions/*-webhook/` + `apps/web/src/app/api/webhooks/**`
**ADRs checked:** ADR-0079 (DocuSeal/contract integration), plus provider-specific webhook specs
**Baseline:** 2026-05-02 audit findings re DocuSeal

---

## Endpoints Audited

| Endpoint | Type | Auth mechanism |
|---|---|---|
| `apps/web/src/app/api/webhooks/docuseal/route.ts` | Next.js Route Handler | HMAC-SHA256 + `timingSafeEqual` |
| `supabase/functions/stripe-webhook/index.ts` | Edge Function | Stripe SDK `constructEventAsync` |
| `supabase/functions/sendgrid-webhook/index.ts` | Edge Function | ECDSA P-256 SHA-256 (WebCrypto) |
| `supabase/functions/livekit-webhook/index.ts` | Edge Function | LiveKit `WebhookReceiver` (JWT) |

---

## Findings

### CRITICAL

None. (Baseline DocuSeal issues from 2026-05-02 are resolved — see Delta section.)

---

### HIGH

#### H-01: `STRIPE_WEBHOOK_SECRET` optional in env.ts — Next.js app boots without it

**File:** `apps/web/src/env.ts:9`

```ts
STRIPE_WEBHOOK_SECRET: z.string().optional(),
```

The Stripe webhook is handled by the Edge Function (`supabase/functions/stripe-webhook/`), not by a Next.js route handler — so `env.ts` is the wrong validation layer for it. However, the env.ts `optional()` classification means any Next.js code that accidentally references `env.STRIPE_WEBHOOK_SECRET` gets `undefined` at runtime with no startup error. The Edge Function does its own `Deno.env.get` with a hard fail-closed guard (line 601-604), which is correct. The risk is that the `optional()` in env.ts creates a false sense that this value is non-critical to the web app startup.

**Impact:** Low in isolation (EF guards correctly), but creates a maintenance trap — any future Next.js route that tries to validate Stripe webhooks would silently get `undefined` and have no protection.

**Recommendation:** Mark `STRIPE_WEBHOOK_SECRET` as `.min(1).optional()` at minimum, or remove it from env.ts entirely since it is not consumed by the Next.js app (add a comment explaining it lives in Supabase secrets, not .env).

---

#### H-02: `SENDGRID_WEBHOOK_VERIFICATION_KEY` missing from env.ts entirely

**File:** `supabase/functions/sendgrid-webhook/index.ts:4` vs `apps/web/src/env.ts`

`SENDGRID_WEBHOOK_VERIFICATION_KEY` is used in the Edge Function via `Deno.env.get(...)` — but it is NOT declared in `apps/web/src/env.ts` at all, and it IS present in `.env.template:113`.

The sendgrid-webhook Edge Function (lines 59-71) gates verification on `if (WEBHOOK_VERIFICATION_KEY)` — so if the env var is missing, verification is **skipped entirely** and the endpoint processes unauthenticated payloads. This is a fail-**open** pattern.

```ts
// sendgrid-webhook/index.ts:59
if (WEBHOOK_VERIFICATION_KEY) {
  // ... verify
}
// if not configured — passes through with no auth
```

**Severity:** HIGH — an attacker who can POST to the sendgrid-webhook Edge Function URL can inject arbitrary `bounce`, `spamreport`, `unsubscribe` events, manipulating `platform_email_suppression` and `platform_communication_recipient` tables without authentication.

**Recommendation:** Change to fail-closed: if `WEBHOOK_VERIFICATION_KEY` is not set, return 500 ("Misconfigured"). SendGrid ECDSA verification must always be active in production.

---

#### H-03: `LIVEKIT_WEBHOOK_SECRET` in env.ts is `.optional()` but Edge Function uses `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` for verification

**File:** `supabase/functions/livekit-webhook/index.ts:10-13`, `apps/web/src/env.ts:36-38`

The LiveKit Edge Function constructs `WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)` — both marked `.optional()` in env.ts. If either is missing (`!`-asserted via `Deno.env.get(...)!`), the receiver construction will pass `undefined` as arguments. The `WebhookReceiver` from `livekit-server-sdk@2.15.0` does not throw on construction with undefined credentials — it fails on `receiver.receive()`, returning a 403. This is marginally fail-closed but via exception rather than explicit guard.

Additionally, `LIVEKIT_WEBHOOK_SECRET` is declared in env.ts (line 38) but is **not used anywhere** in the livekit-webhook Edge Function — the function uses `API_KEY` + `API_SECRET`. The env.ts entry for `LIVEKIT_WEBHOOK_SECRET` is dead code and creates confusion about which secret gates the webhook.

**Recommendation:** Remove the unused `LIVEKIT_WEBHOOK_SECRET` from env.ts and add explicit null-guards in the Edge Function before constructing `WebhookReceiver`.

---

### MEDIUM

#### M-01: LiveKit idempotency key uniqueness not enforced at DB level

**File:** `supabase/functions/livekit-webhook/index.ts:236`

```ts
idempotency_key: `livekit:${livekitEventId}:${eventType}`,
```

The `engine_event` INSERT uses an `idempotency_key` field, but there is no evidence of a UNIQUE constraint on `(idempotency_key)` in the `engine_event` table. Without a DB-level unique constraint, LiveKit webhook retries for the same event would insert duplicate telemetry rows. Participant join/leave/room_finished events are non-idempotent at the `channel_call_participant` table level as well (INSERT without UPSERT for `participant_joined`).

**Recommendation:** Add `UNIQUE(idempotency_key)` to `engine_event` table. For `channel_call_participant`, use UPSERT or add unique partial index on `(call_session_id, profile_id)` where `left_at IS NULL`.

---

#### M-02: SendGrid bounce/suppression does not deduplicate by `sg_message_id`

**File:** `supabase/functions/sendgrid-webhook/index.ts:97-231`

The bulk upsert at line 234-238 uses `platform_webhook_event_provider_sg_msg_id_key` for deduplication, but the per-event business logic (open count increment, bounce recording, suppression insert) is executed in the loop BEFORE the bulk upsert. On SendGrid retry (identical batch), the `platform_communication_recipient.open_count` would be incremented again — there is no guard on the business-logic path.

**Recommendation:** Check for existing `platform_webhook_event` row with matching `sg_message_id` before processing business logic, or move business logic to execute only after successful unique upsert of the event record.

---

#### M-03: No rate-limit on any webhook endpoint

None of the four webhook endpoints implement rate limiting. Edge Functions rely on Supabase's global request throttle (~500 req/s). A compromised sender credential (or open endpoint in sendgrid-webhook's fail-open case) could flood `platform_communication_recipient` updates.

**Recommendation:** Low priority for DocuSeal (low volume), medium for SendGrid (batch events up to 10k/req). Add Upstash Redis rate limit at the sendgrid-webhook entry point (already used elsewhere in the codebase).

---

### LOW

#### L-01: `actor_id` hardcoded to `"system"` string in DocuSeal telemetry

**File:** `apps/web/src/app/api/webhooks/docuseal/route.ts:283`

```ts
actor_id: nonEmpty("system", "actor_id"),
```

`nonEmpty()` accepts the literal `"system"` which is not a valid UUID profile. This works (telemetry routes on string match), but differs from the sentinel UUID pattern used for `platform_audit_log` on line 179. Inconsistent sentinel values complicate audit queries.

---

#### L-02: DocuSeal event `"form.started"` mapped to `"viewed"` — semantic mismatch

**File:** `apps/web/src/app/api/webhooks/docuseal/route.ts:43`

`form.started` means the signer clicked "Start" in DocuSeal (distinct from `form.viewed`). Both map to `"viewed"` status, losing the distinction. Not a security issue, but creates inaccurate audit trail.

---

## Delta vs 2026-05-02 Baseline

The 2026-05-02 baseline reported three CRITICAL issues on `docuseal/route.ts`:

| Baseline finding | Status |
|---|---|
| `DOCUSEAL_WEBHOOK_SECRET` optional in env.ts (should be required) | **RESOLVED** — now `z.string().min(16)` (required, no `.optional()`) |
| Raw-secret string equality (not HMAC, not constant-time → timing leak) | **RESOLVED** — now HMAC-SHA256 with `createHmac` + `timingSafeEqual` |
| DocuSeal sends HMAC-SHA256, not raw secret → current check rejected valid requests | **RESOLVED** — signature algorithm now correct |

All three baseline CRITICALs are closed. No regressions observed on Stripe or LiveKit since baseline.

**New findings introduced since baseline:** H-02 (SendGrid fail-open) was not present in baseline scope. H-01, H-03, M-01, M-02, M-03, L-01, L-02 are new findings from this audit pass.

---

## Summary

| Severity | Count | Items |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 3 | H-01, H-02, H-03 |
| MEDIUM | 3 | M-01, M-02, M-03 |
| LOW | 2 | L-01, L-02 |

**Top 3 actionable findings:**

1. **H-02 (SendGrid fail-open)** — signature verification skipped when env var missing. Short sortie: flip to fail-closed (add `else return 500`).
2. **H-01 (STRIPE_WEBHOOK_SECRET optional)** — env.ts classification creates maintenance trap. Quick fix: remove from env.ts or add comment.
3. **M-01 (LiveKit idempotency not DB-enforced)** — duplicate telemetry on webhook retry. Migration: add UNIQUE constraint to `engine_event.idempotency_key`.
