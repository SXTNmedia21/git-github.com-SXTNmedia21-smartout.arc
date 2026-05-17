---
title: Slice 13 — Webhook Integration Audit
status: done
updated: 2026-05-15
created: 2026-05-15
module: webhooks
tags: [audit, webhooks, adr]
---

# Slice 13 — Webhook Integration

**Audited:** 2026-05-15 | HEAD: development | Auditor: subagent-sonnet

## ADRs in scope

- **ADR-0079** — ADR-0024 amendment: employment_contract vs contract system separation (contracts context for DocuSeal webhook)
- **ADR-0142** — Invoice refund flow amendment (Stripe webhook credit-note behaviour)

## Webhook surfaces audited

| Surface | Path | Provider auth |
|---|---|---|
| stripe-webhook | `supabase/functions/stripe-webhook/index.ts` | HMAC via Stripe SDK `constructEventAsync` |
| sendgrid-webhook | `supabase/functions/sendgrid-webhook/index.ts` | ECDSA P-256 via WebCrypto |
| livekit-webhook | `supabase/functions/livekit-webhook/index.ts` | JWT via `WebhookReceiver` (livekit-server-sdk) |
| docuseal-webhook | `apps/web/src/app/api/webhooks/docuseal/route.ts` | HMAC-SHA256 + `timingSafeEqual` |

`pos-sync` is cron-triggered (bearer token, not provider webhook) — excluded from provider-webhook findings but noted.

---

## Summary

**0 CRITICAL · 1 HIGH · 2 MEDIUM · 3 LOW · 0 INFO**

All four webhook endpoints set `verify_jwt = false` in `config.toml` (correct). All have provider-issued signature verification as the auth boundary. The baseline F-WH-04 finding (call_log no UNIQUE on `call_session_id`) is **CLOSED** — migration `20260611100000_call_log_unique_session.sql` shipped in commit `cbd25c9b2`. One new HIGH finding: DocuSeal webhook uses a non-unique index on `docuseal_submission_id`, meaning a Stripe-style replay (DocuSeal retries on non-2xx) can double-process a `form.completed` event and double-write `employment_contract.signed_at`.

---

## Findings table

| ID | Severity | Surface | File:line | Description | ADR |
|---|---|---|---|---|---|
| F-WH-05 | HIGH | docuseal-webhook | `route.ts:96` | No idempotency key on DocuSeal webhook — `docuseal_submission_id` has INDEX only, not UNIQUE; `submission.completed` replay can double-write `employment_contract.status=active` + duplicate `engine_event`. | ADR-0079 |
| F-WH-06 | MEDIUM | sendgrid-webhook | `sendgrid-webhook/index.ts:37` | No timestamp-window check on SendGrid ECDSA signature — the signature covers `timestamp + rawBody` but timestamp staleness is never validated against `Date.now()`. A captured signature+body pair remains valid indefinitely. | — |
| F-WH-07 | MEDIUM | livekit-webhook | `livekit-webhook/index.ts:44` | `workspace_id` derived from room name string split (`{workspace_id}:{channel_id}`) — format validated only by length check (`!workspaceId`), not UUID format. Malformed room names that still contain a colon will write garbage `workspace_id` into `channel_call_participant` and `engine_event`. | — |
| F-WH-08 | LOW | stripe-webhook | `stripe-webhook/index.ts:420,472,561,579` | `workspace_id: null` emitted in all Stripe telemetry calls (`payment succeeded`, `payment failed`, `payment refunded`, `invoice credit_note_auto_created`). Platform-level events without workspace context, but `activity_trail` routing rules require non-null `workspace_id` or actor_kind discriminator; null silently bypasses audit trail routing. | — |
| F-WH-09 | LOW | docuseal-webhook | `route.ts:177` | `x-forwarded-for` written to `contract_event.ip_address` directly from request header without validation — header can be spoofed by intermediate proxies; no Vercel `x-real-ip` fallback. | — |
| F-WH-10 | LOW | sendgrid-webhook | `sendgrid-webhook/index.ts:116–130` | Open/click events with `null` sg_message_id are still written to `platform_webhook_event` audit log without deduplication (comment acknowledges this). These rows accumulate unboundedly for any SendGrid retry burst on events missing `sg_message_id`. | — |

---

## Per-ADR rollup

### ADR-0079 (contract system separation)

DocuSeal webhook at `route.ts:92–96` correctly looks up contracts via `docuseal_submission_id`. The two-contract system separation (employment_contract vs contract) is respected — `form.completed` updates `employment_contract` via FK (`signing_contract_id`) rather than writing to the contract table directly (lines 151–163). Partial-signing logic correctly holds `contract.status='sent'` until both employer and employee have signed (lines 145–183).

**Gap (F-WH-05):** The lookup at line 96 uses `.single()` but the underlying column has only a non-unique index, not a UNIQUE constraint. DocuSeal retries on non-2xx responses (5xx or timeout) will cause a second `handlePaymentIntentSucceeded`-equivalent path: `employment_contract` gets a second `status='active'` write and a second `engine_event` insert. The status write is idempotent in value but triggers double cascade events.

### ADR-0142 (invoice refund flow)

Stripe webhook implements ADR-0142 correctly: `charge.refunded` creates a credit note via `issueCreditNoteForRefund()` with `is_full_refund` flag, amounts stay positive, and `invoice.status` is never regressed from `paid` to a lesser status. The delta-refund computation (lines 513–528) is correct: it diffs against `payment.refunded_amount` to prevent double-counting on Stripe re-delivery. UNIQUE on `payment_attempt.stripe_event_id` (migration `20260512000003`) backs this up at DB level.

No findings against ADR-0142 compliance.

---

## Verified intentional

| Surface | Pattern | Rationale |
|---|---|---|
| stripe-webhook | `workspace_id: null` in emit | Stripe events are platform-level (company, not workspace); null is intentional per billing model |
| stripe-webhook | `constructEventAsync` (no explicit tolerance) | Stripe SDK default tolerance = 300 s; timestamp replay window is enforced by SDK |
| sendgrid-webhook | Fail-closed on missing `SENDGRID_WEBHOOK_VERIFICATION_KEY` (→ 500) | Audit comment H-02 (2026-05-06, slice 13) documents the prior bypass was intentional fix |
| livekit-webhook | `workspace_id` from room name not payload | Correct — prevents spoofed workspace in payload; room name is server-assigned |
| pos-sync | Bearer token not provider HMAC | Cron-only pattern; not a provider webhook |
| all four EFs | `verify_jwt = false` | Required for public provider endpoints; each has provider-native auth boundary instead |

---

## In-progress / known gaps

- F-WH-05 (docuseal idempotency): Remediation = add `UNIQUE` on `contract.docuseal_submission_id` + switch `route.ts:96` to `.maybeSingle()` with early-return on duplicate.
- F-WH-06 (SendGrid timestamp window): Low exploit surface because ECDSA key is server-side only (not shared secret), but a stolen signed-payload replay is a theoretical vector. Remediation = reject `timestamp` older than 300 s.

---

## Delta vs 2026-05-13 baseline

| Baseline finding | Status | Notes |
|---|---|---|
| F-WH-04 — call_log no UNIQUE on session_id | **CLOSED** | Migration `20260611100000_call_log_unique_session.sql` + livekit handler `upsert(..., ignoreDuplicates: true)` shipped in commit `cbd25c9b2`. |

**New findings this run:** F-WH-05 (HIGH), F-WH-06 (MEDIUM), F-WH-07 (MEDIUM), F-WH-08 (LOW), F-WH-09 (LOW), F-WH-10 (LOW)

**Net delta:** −1 resolved (F-WH-04) / +6 new = +5 open findings vs baseline.
