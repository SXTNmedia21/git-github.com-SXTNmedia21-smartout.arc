---
title: Slice 13 — Webhook Integration Audit
status: done
created: 2026-05-12
updated: 2026-05-12
module: audit
tags: [audit, webhook-integration, adr]
---

# Slice 13 — Webhook Integration Audit

**ADR in scope:** ADR-0079 (ADR-0024 Amendment — employment_contract vs contract separation), ADR-0141 (PII redaction), ADR-0142 (Stripe refund / credit-note flow)

**Surfaces audited:**
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/sendgrid-webhook/index.ts`
- `supabase/functions/livekit-webhook/index.ts`
- `apps/web/src/app/api/webhooks/docuseal/route.ts`
- `supabase/functions/_shared/twilio.ts`

---

## Summary

| Rank | ID | Severity | One-line |
|---|---|---|---|
| 1 | CF-13-01 | HIGH | ADR-0142 text specifies negative credit-note amounts; ADR-0120 §8 and code both use positive — ADR-0142 prose is contradictory and misleading |
| 2 | CF-13-02 | MEDIUM | LiveKit `participant_joined` has no DB-level dedup guard; replayed events insert duplicate `channel_call_participant` rows |
| 3 | CF-13-03 | MEDIUM | SendGrid `open`/`click` counter increments are not idempotent when `sg_message_id` is null — replay inflates `open_count`/`click_count` |
| 4 | CF-13-04 | MEDIUM | DocuSeal `contract_event` INSERT has no unique constraint; replayed webhook event-types produce duplicate audit-log rows |
| 5 | CF-13-05 | LOW | No Twilio inbound webhook receiver exists; `_shared/twilio.ts` is outbound-only — undocumented gap if Twilio status callbacks are expected |

---

## Findings table

| ID | Severity | File:line | ADR | Evidence |
|---|---|---|---|---|
| CF-13-01 | HIGH | `docs/decisions/0142-invoice-refund-flow-adr-0120-amendment.md:44–49` | ADR-0142 vs ADR-0120 §8 | ADR-0142 decision text says `amount_excl_vat = -(original.amount_excl_vat)` (negative); ADR-0120 §8 explicitly mandates positive amounts with `invoice_type` as the sign flag; code at `stripe-webhook/index.ts:260` follows ADR-0120 §8 correctly with comment "Amounts stay POSITIVE". ADR-0142 prose is wrong — it contradicts the ADR it amends and will mislead future implementors. |
| CF-13-02 | MEDIUM | `supabase/functions/livekit-webhook/index.ts:55` | General idempotency | `channel_call_participant.insert()` called on `participant_joined` with no ON CONFLICT guard. Comment at line 48 says "partial unique index prevents duplicates for active participants" but no such index exists in migrations (checked `20260428200000_idempotent_indexes.sql` — only non-unique performance indexes on `workspace_id`, `call_session_id`, `profile_id`). LiveKit replays or double-fires yield duplicate rows, breaking `max_participants` count. |
| CF-13-03 | MEDIUM | `supabase/functions/sendgrid-webhook/index.ts:133` | General idempotency | `open_count` and `click_count` incremented unconditionally on matching `platform_communication_recipient`. The `platform_webhook_event` upsert dedup only fires when `sg_message_id IS NOT NULL`. Events without `sg_message_id` (some transactional sends) are not deduplicated; replayed webhook batches inflate counters. No read-before-write check prevents double-counting. |
| CF-13-04 | MEDIUM | `apps/web/src/app/api/webhooks/docuseal/route.ts:221` | General idempotency | `contract_event` INSERT on every DocuSeal event with no unique constraint on `(contract_id, event_type)` or `(contract_id, submission_id, event_type)`. Status-regression guard (lines 104–116) prevents double contract-status updates but does not prevent duplicate `contract_event` rows. DocuSeal retries (recommended 3-retry policy) create duplicate audit entries per event. |
| CF-13-05 | LOW | `supabase/functions/_shared/twilio.ts` (entire file) | None | File is purely outbound (SMS dispatch). No inbound Twilio webhook handler exists anywhere in the repo. If Twilio delivery-status callbacks (e.g. `delivered`, `failed`, `undelivered`) are expected to update `platform_communication_recipient` or suppress re-sends, there is no handler for them. Tech stack doc mentions Twilio as a supported integration. |

---

## Per-ADR rollup

| ADR | Files checked | Compliant | Partial | Violation |
|---|---|---|---|---|
| ADR-0079 (contract system separation) | `docuseal/route.ts` | ✅ | — | — |
| ADR-0141 (Stripe PII redaction) | `stripe-webhook/index.ts` | ✅ | — | — |
| ADR-0142 (credit-note auto-create) | `stripe-webhook/index.ts`, `0142` ADR text | — | ⚠️ | — |
| ADR-0120 §8 (credit-note amount sign) | `stripe-webhook/index.ts` | ✅ | — | — |
| General idempotency patterns | all four webhook files | — | ⚠️ (sendgrid, docuseal, livekit) | — |

**ADR-0079 compliance note:** DocuSeal handler correctly routes `contract_type='employee'` updates to `employment_contract` via `signing_contract_id` FK (lines 163, 264, 300) and routes non-employee contracts to `workspace` table (lines 330-338). Separation boundary is respected. No HR fields written to `contract` table; no platform-legal fields written to `employment_contract`. Compliant.

**ADR-0141 compliance note:** `redactStripeEvent()` implements whitelist-only PII redaction at `stripe-webhook/index.ts:66-94`. Forbidden keys (`billing_details`, `customer`, `source`, `receipt_url`) are never written. `payment_attempt.redacted_payload` receives only the whitelisted shape. Compliant.

**ADR-0142 partial note:** Business logic (auto credit-note on refund, full vs partial handling, idempotency via `stripe_event_id` UNIQUE) is correctly implemented. The violation is documentary only — ADR-0142's spec text contradicts ADR-0120 §8 on amount sign. The code is correct; the ADR prose needs an amendment.

---

## Verified intentional

None of the findings from the known-false-positives list (FP-001 through FP-004) apply to this slice's surfaces.

**New intentional pattern confirmed:** `stripe-webhook/index.ts:417–433` — `actor_id: null` and `workspace_id: null` in `emitViaEndpoint()` calls. This is correct: Stripe payment events are platform-level (company-scoped, not workspace-scoped). `payment` table links to `company_id`, not `workspace_id`. Null workspace in telemetry for billing events is by design per the billing engine's company-level architecture. Not a finding.

---

## In-progress (mid-campaign)

None of the audited files are in active campaign worktrees. All findings above are production-path code on `campaign/payroll`.

---

## Appendix — Signature verification checklist

| Provider | Handler | Method | Fail-closed? |
|---|---|---|---|
| Stripe | `stripe-webhook/index.ts:626` | `constructEventAsync` (WebCrypto) | ✅ — 403 on failure, 500 if secret missing |
| SendGrid | `sendgrid-webhook/index.ts:74` | ECDSA P-256 SHA-256 | ✅ — 403 on failure, 500 if key missing (fixed H-02 2026-05-06) |
| LiveKit | `livekit-webhook/index.ts:21` | `WebhookReceiver.receive()` JWT | ✅ — 403 on failure, 401 if header missing |
| DocuSeal | `docuseal/route.ts:62-66` | HMAC-SHA256 `timingSafeEqual` | ✅ — 401 on failure |
| Twilio inbound | N/A | N/A | N/A — no handler |
