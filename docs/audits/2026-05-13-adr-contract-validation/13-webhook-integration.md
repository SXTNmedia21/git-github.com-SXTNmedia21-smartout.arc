---
title: Slice 13 — Webhook Integration Audit
slice: 13
scope: webhook-integration
date: 2026-05-13
auditor: claude-opus
status: complete
---

# Slice 13 — Webhook Integration

## Surfaces audited

| Handler | Path | Auth model |
|---|---|---|
| `livekit-webhook` | `supabase/functions/livekit-webhook/index.ts` | LiveKit `WebhookReceiver` (JWT in `Authorization`) |
| `sendgrid-webhook` | `supabase/functions/sendgrid-webhook/index.ts` | ECDSA P-256 SHA-256 (Event Webhook signature) |
| `stripe-webhook` | `supabase/functions/stripe-webhook/index.ts` | Stripe `constructEventAsync` (HMAC-SHA256) |
| `docuseal` | `apps/web/src/app/api/webhooks/docuseal/route.ts` | HMAC-SHA256 `x-docuseal-signature` + `timingSafeEqual` |

All four Edge Functions have `verify_jwt = false` in `supabase/config.toml` (verified). Signature verification is the real auth boundary on each.

## Baseline status (2026-05-10)

| ID | Severity | Description | Status today |
|---|---|---|---|
| F-WH-01 | MEDIUM | docuseal webhook leaks DB error message in 500 response | **OPEN** |
| F-WH-02 | LOW | livekit-webhook missing null guard on env | **OPEN** |
| F-WH-03 | MEDIUM | sendgrid open/click counter not idempotent — replay double-counts | **PARTIALLY MITIGATED** |
| F-WH-04 | HIGH | `call_log` no UNIQUE on session_id — room_finished replay creates dupes | **OPEN** |

## Findings

### CRITICAL — none

### HIGH

#### F-WH-04 — `call_log` lacks idempotency key (UNCHANGED from baseline)
- **Where:** `supabase/migrations/20260422301000_channel_voice.sql:93-106`. No UNIQUE constraint or partial index on `call_session_id`, `livekit_room_name`, or any combination thereof. Grepped all migrations 2026-04-22 → 2026-05-13: zero `ALTER TABLE call_log ADD CONSTRAINT … UNIQUE`.
- **Risk:** LiveKit retries `room_finished` on 5xx. Handler at `livekit-webhook/index.ts:161` does an unconditional `supabase.from("call_log").insert(...)`. Replay → duplicate immutable audit rows. `c1_observability` metric `channel.call.ended` then over-counts call volume.
- **Note:** The participant-level emits at `:70`, `:107`, `:175`, `:185` DO have idempotency via `engine_event.idempotency_key = livekit:${event.id}:${eventType}`. Only the `call_log` row insert is unguarded.
- **Fix:** `CREATE UNIQUE INDEX call_log_call_session_id_key ON call_log(call_session_id);` plus convert the insert at `livekit-webhook/index.ts:161` to `.upsert({...}, { onConflict: "call_session_id", ignoreDuplicates: true })`.

### MEDIUM

#### F-WH-01 — docuseal leaks DB error in 500 body (UNCHANGED)
- **Where:** `apps/web/src/app/api/webhooks/docuseal/route.ts:216-218`.
  ```ts
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  ```
- **Risk:** PG error messages can leak schema details (column names, constraint names, RLS hints). DocuSeal is an external integration; the webhook surface is unauthenticated apart from signature, so a forged-but-valid-signature attacker (or curious DocuSeal operator) sees DB internals.
- **Fix:** Log `updateError` server-side, return `NextResponse.json({ error: "internal" }, { status: 500 })`.

#### F-WH-03 — sendgrid open/click counter not idempotent (PARTIALLY MITIGATED)
- **Where:** `sendgrid-webhook/index.ts:118-167` (`open` + `click` branches).
- **What's mitigated:** Event-level dedup landed in `20260520150000_platform_webhook_event_idempotency.sql` — partial UNIQUE `(provider, sg_message_id) WHERE sg_message_id IS NOT NULL`. The bulk upsert at `:241` uses `ignoreDuplicates: true`.
- **What's still broken:** The dedup happens AT THE END of the handler in the bulk upsert. The open/click `open_count + 1` updates and the `increment_communication_counter` RPC calls (`:131-141` and `:154-167`) execute BEFORE that dedup runs. If SendGrid re-delivers an event (network blip, retry policy), the counters double-increment even though the `platform_webhook_event` row is rejected as duplicate. Worse: events without `sg_message_id` skip dedup entirely (partial index `WHERE sg_message_id IS NOT NULL`).
- **Fix:** Move the dedup INSERT to the top of the per-event loop using `INSERT … ON CONFLICT DO NOTHING RETURNING id`. If zero rows returned, skip the counter mutations. Or: drop the counter increment, derive open/click totals via SQL aggregate on `platform_webhook_event` when needed (cleaner, fully idempotent).

### LOW

#### F-WH-02 — livekit-webhook env-var null guard missing (UNCHANGED)
- **Where:** `livekit-webhook/index.ts:11-12`.
  ```ts
  Deno.env.get("LIVEKIT_API_KEY")!,
  Deno.env.get("LIVEKIT_API_SECRET")!,
  ```
- **Risk:** Non-null assertion (`!`) means if either env var is missing in deploy, `WebhookReceiver` constructor receives `undefined`, throws "secret cannot be empty", and the request 500s WITHOUT logging which var is missing. Compare to stripe-webhook `:601-605` and `:617-619` which explicitly check and log `"STRIPE_WEBHOOK_SECRET not configured"`. Compare to sendgrid-webhook `:63-65` which has the same fail-closed pattern.
- **Severity stays LOW:** an attacker cannot reach the receiver before signature verification (it fails open-not-closed because constructor throws before checking signature). It IS a misconfig-debuggability gap, not a security boundary.
- **Fix:** Mirror stripe-webhook pattern: explicit env check at top of handler, return 500 "Misconfigured" + console.error with var name.

## New findings (not in baseline)

### LOW (new) — F-WH-05: docuseal webhook does not log signature verification failures
- `docuseal/route.ts:57-68` — both the missing-header path and the `timingSafeEqual` failure path return 401 silently. No `console.error`, no `platform_audit_log` insert. Forged-signature attempts are not auditable.
- **Fix:** Log to `platform_audit_log` (with `super_admin_id` sentinel) on signature failure, including `request.headers.get("x-forwarded-for")`.

### LOW (new) — F-WH-06: stripe-webhook missing `INTERNAL_EMIT_URL` falls back to console.error and continues
- `stripe-webhook/index.ts:109-112` — when env vars are missing, `emitViaEndpoint` logs and returns; the handler proceeds and writes to DB anyway. The user sees a successful 200; the analytics/audit trail loses the event. Not a security risk but a silent observability gap. Parallel to F-WH-02 in style.

## Positive observations (worth noting)

- **stripe-webhook** is the gold standard: explicit env-var checks (`:601-605`), idempotency via `payment_attempt.stripe_event_id` UNIQUE + 23505 fast-path (`:165-175`), PII redaction whitelist (`:66-94`), invoice status-flip guarded by `WHERE status IN (payable set)` against late events (`:233-237`), HTTP 500 retry-friendly handler errors (`:653-659`). ADR-0141 + ADR-0142 enforced in code.
- **sendgrid-webhook** correctly went fail-closed in audit finding H-02 (2026-05-06): missing `SENDGRID_WEBHOOK_VERIFICATION_KEY` returns 500 instead of skipping verification (`:63-65`). The prior `if (KEY) { verify }` pattern is gone.
- **docuseal** uses `timingSafeEqual` correctly + length-check guard (`:66`) against `Buffer.from` length-mismatch crash.
- **livekit-webhook** uses room-name parsing (`workspace_id:channel_id`) with explicit fail-soft return on malformed names (`:38-41`) — avoids RLS bypass via tenant confusion.

## ADR compliance check

| ADR | Concern | Status |
|---|---|---|
| 0079 | Third-party integration patterns | OK — all four use signature verification, none rely on JWT |
| 0141 | PII redaction in webhook persistence | OK in stripe-webhook (`redactStripeEvent` whitelist); N/A for others |
| 0142 | Auto credit-note on Stripe refund | OK — `issueCreditNoteForRefund` called from `charge.refunded` handler |
| 0238 | Domain chat ownership (irrelevant to webhooks) | N/A |

No new ADR drift detected.

## Counts

- Baseline findings: 4
- Confirmed open: 4 (1 HIGH, 2 MEDIUM, 1 LOW)
- New findings: 2 (both LOW)
- Total live findings: 6

## Top 3 critical one-liners

1. **HIGH F-WH-04** — `call_log` has no UNIQUE on `call_session_id`; LiveKit `room_finished` retry duplicates immutable audit rows + over-counts `channel.call.ended`. Fix: `CREATE UNIQUE INDEX call_log_call_session_id_key ON call_log(call_session_id);` + upsert in handler.
2. **MEDIUM F-WH-03** — SendGrid open/click counter idempotency only kicks in at the END of the handler (bulk upsert); the `+1` RPC calls in the per-event loop still double-count on retry, and events without `sg_message_id` bypass dedup entirely.
3. **MEDIUM F-WH-01** — docuseal returns raw PG `updateError.message` in 500 body; replace with generic `"internal"` and log server-side only.
