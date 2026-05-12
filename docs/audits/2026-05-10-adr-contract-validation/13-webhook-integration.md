---
title: Audit Slice 13 — Webhook Integration
status: done
updated: 2026-05-10
created: 2026-05-10
module: webhooks
tags: [audit, webhook, security, idempotency, stripe, sendgrid, livekit, docuseal]
---

# Audit Slice 13 — Webhook Integration

**Date:** 2026-05-10
**Branch:** campaign/botsson-arena
**Auditor:** claude-sonnet-4-6 (automated slice)
**ADR cluster:** ADR-0079 + webhook-specific
**Surfaces audited:**
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/sendgrid-webhook/index.ts`
- `supabase/functions/livekit-webhook/index.ts`
- `apps/web/src/app/api/webhooks/docuseal/route.ts`

---

## Summary

| ID | Severity | Surface | Finding |
|----|----------|---------|---------|
| F-WH-01 | HIGH | `docuseal/route.ts:217` | DB error message leaked in 500 response |
| F-WH-02 | MEDIUM | `livekit-webhook/index.ts:10-12` | Missing null guard on LIVEKIT_API_KEY/SECRET — uncaught runtime crash on misconfiguration |
| F-WH-03 | MEDIUM | `sendgrid-webhook/index.ts:122-163` | `open` and `click` counter increments not idempotent — replayed events double-count |
| F-WH-04 | MEDIUM | `livekit-webhook/index.ts:161` | `call_log` insert has no idempotency constraint — `room_finished` replay creates duplicate rows |
| F-WH-05 | LOW | `docuseal/route.ts:58,67` | Signature errors return HTTP 401 instead of 403 |
| F-WH-06 | LOW | `apps/web/src/env.ts:9` | `STRIPE_WEBHOOK_SECRET` declared `.optional()` — misleads health-check tooling |
| F-WH-07 | INFO | all handlers | No `channel_ai_policy` bypass detected — PASS |
| F-WH-08 | INFO | all handlers | All secrets are `op://` references in `.env.template` — PASS |

---

## Findings

### F-WH-01 — HIGH: DB error message leaked in docuseal 500 response

**File:** `apps/web/src/app/api/webhooks/docuseal/route.ts:217`

```ts
return NextResponse.json({ error: updateError.message }, { status: 500 });
```

`updateError.message` is the raw Supabase/PostgREST error string. These can contain table names, column names, constraint names, and partial row values. DocuSeal retries on non-2xx, so this string appears in DocuSeal's retry logs — outside the trust boundary.

**Fix:** Return a generic message.

```ts
return NextResponse.json({ error: "Update failed" }, { status: 500 });
```

Log the full `updateError` server-side via `console.error`.

---

### F-WH-02 — MEDIUM: Missing null guard on LIVEKIT_API_KEY/SECRET in livekit-webhook

**File:** `supabase/functions/livekit-webhook/index.ts:10-12`

```ts
const receiver = new WebhookReceiver(
  Deno.env.get("LIVEKIT_API_KEY")!,
  Deno.env.get("LIVEKIT_API_SECRET")!,
);
```

The `!` non-null assertions suppress TypeScript warnings but do not prevent `undefined` from being passed to `WebhookReceiver` at runtime if the env vars are absent. There is no surrounding `try/catch` at this construction point (the `catch` at line 24 only covers `receiver.receive()`). If `LIVEKIT_API_KEY` or `LIVEKIT_API_SECRET` is unset, `WebhookReceiver` will throw an uncaught error — the Edge Function crashes with a 500 before the `Authorization` header check runs, potentially revealing server state through Deno's default error response.

Compare: `stripe-webhook` explicitly guards with:
```ts
if (!webhookSecret) { return new Response("Misconfigured", { status: 500 }); }
```

**Fix:** Add explicit null guards before constructing `WebhookReceiver`:

```ts
const apiKey = Deno.env.get("LIVEKIT_API_KEY");
const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
if (!apiKey || !apiSecret) {
  return new Response("Misconfigured", { status: 500 });
}
const receiver = new WebhookReceiver(apiKey, apiSecret);
```

---

### F-WH-03 — MEDIUM: SendGrid open/click counter increments not idempotent

**File:** `supabase/functions/sendgrid-webhook/index.ts:122-163`

The `platform_webhook_event` upsert (line 242-243) correctly deduplicates on `(provider, sg_message_id) WHERE sg_message_id IS NOT NULL`. However, the `open` and `click` event handlers execute **before** the dedup upsert:

```ts
case "open": {
  // ...
  await supabase.from("platform_communication_recipient")
    .update({ open_count: (r.open_count ?? 0) + 1 })   // ← not idempotent
    .eq("recipient_id", r.recipient_id);

  await supabase.rpc("increment_communication_counter", { ... }); // ← not idempotent
}
```

SendGrid retries any non-2xx response. On retry (or manual replay), the counter increments execute again even though `platform_webhook_event` would eventually deduplicate the log row. The result: `open_count` and communication-level `opened_count` are overcounted.

**Fix:** Move the dedup check **before** counter logic, or gate the counter update on whether a `platform_webhook_event` row was actually inserted (i.e., use the upsert result's `count` to detect "already processed").

---

### F-WH-04 — MEDIUM: `call_log` insert has no idempotency constraint — room_finished replay creates duplicate rows

**File:** `supabase/functions/livekit-webhook/index.ts:161`
**Migration:** `supabase/migrations/20260422301000_channel_voice.sql`

The `room_finished` handler inserts into `call_log`:

```ts
await supabase.from("call_log").insert({ call_session_id: session.id, ... });
```

The `call_log` table has no `UNIQUE` constraint on `call_session_id` or `livekit_room_name`. LiveKit guarantees at-least-once delivery for webhook events. A duplicate `room_finished` event inserts a second `call_log` row for the same session, producing:
- Two rows in `call_log` for the same call (incorrect billing/analytics)
- The `channel_call_session.status` update (`ended`) is idempotent, but the `call_log` insert is not

**Fix (preferred):** Add a partial unique constraint:

```sql
ALTER TABLE call_log ADD CONSTRAINT call_log_session_unique UNIQUE (call_session_id);
```

**Fix (handler-level):** Use `upsert` with `onConflict: "call_session_id"` and `ignoreDuplicates: true`.

---

### F-WH-05 — LOW: Docuseal signature errors return HTTP 401 instead of 403

**File:** `apps/web/src/app/api/webhooks/docuseal/route.ts:58,67`

```ts
return NextResponse.json({ error: "Missing signature" }, { status: 401 });
return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
```

RFC 7235 defines 401 as "unauthenticated" (triggers `WWW-Authenticate` challenge). Signature failures are authorization failures — the request is identifiable but rejected. The correct status is `403 Forbidden`. DocuSeal's retry logic treats 4xx responses as non-retryable, so functional impact is nil, but the semantic mismatch may confuse monitoring and upstream DocuSeal retry classification.

Compare: `stripe-webhook` correctly returns `403` for invalid signature (line 629), `sendgrid-webhook` correctly returns `403` (line 76), `livekit-webhook` correctly returns `403` (line 26).

**Fix:**

```ts
return NextResponse.json({ error: "Missing signature" }, { status: 403 });
return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
```

---

### F-WH-06 — LOW: STRIPE_WEBHOOK_SECRET declared optional in env.ts — misleads health-check tooling

**File:** `apps/web/src/env.ts:9`

```ts
STRIPE_WEBHOOK_SECRET: z.string().optional(),
```

The `STRIPE_WEBHOOK_SECRET` is consumed by the Supabase Edge Function `stripe-webhook`, not by the Next.js app directly. Declaring it `.optional()` in `env.ts` means the platform-admin health/keys UI (which reads this registry) shows the variable as "not required" — staff could miss a missing secret during environment setup. The Edge Function itself (line 601-604) already guards with a hard fail. The mismatch is a tooling/observability gap, not a security gap.

**Fix:** Either remove from `env.ts` entirely (with a comment pointing to the Edge Function), or change to `.string().min(1)` and provide it only in the server-side env group so it's present in production but not exposed to client.

---

### F-WH-07 — INFO: No channel_ai_policy bypass — PASS

All four webhook handlers are concerned with infrastructure events (payment, email delivery, voice calls, contract signing). None invoke LLM capabilities or route AI messages. The `channel_ai_policy` enforcement point lives in `livekit-token/index.ts` (token issuance), not in the webhook receiver. The webhook merely records presence/absence metadata without policy evaluation.

No finding.

---

### F-WH-08 — INFO: All webhook secrets use op:// references — PASS

`.env.template` confirms all webhook secrets are stored in 1Password:

| Secret | op:// reference |
|--------|-----------------|
| `STRIPE_WEBHOOK_SECRET` | `op://smartout_ai/Stripe/webhook_secret` |
| `SENDGRID_WEBHOOK_VERIFICATION_KEY` | `op://smartout_ai/SendGrid/webhook_verification_key` |
| `LIVEKIT_API_KEY` | `op://smartout_ai/livekit/api-key` |
| `LIVEKIT_API_SECRET` | `op://smartout_ai/livekit/api-secret` |
| `DOCUSEAL_WEBHOOK_SECRET` | `op://smartout_ai/DocuSeal/webhook_secret` |

No hardcoded secrets found. Rotation is supported — changing the 1Password entry and redeploying is the rotation path for all four handlers.

---

## Confirm-PASS items

| Check | Result |
|-------|--------|
| All webhook functions have `verify_jwt = false` in config.toml | PASS — stripe (line 577), sendgrid (line 445), livekit (line 496) |
| Stripe: HMAC/signature verified before body processing | PASS — `constructEventAsync` called before any handler (lines 626-630) |
| SendGrid: ECDSA P-256 signature verified before body processing | PASS — WebCrypto verify before handler (lines 74-76). Previous silent-skip-on-missing-key bug was fixed (comment at line 60). |
| LiveKit: JWT/HMAC verified via `WebhookReceiver.receive()` before processing | PASS — line 24, though null guard is missing (F-WH-02) |
| DocuSeal: HMAC-SHA256 with `timingSafeEqual` before processing | PASS — lines 62-67, constant-time comparison prevents timing attacks |
| Stripe: idempotency via `payment_attempt.stripe_event_id` UNIQUE | PASS — `upsertPaymentAttempt` returns `"duplicate"` on 23505, handlers early-return |
| SendGrid: dedup via `platform_webhook_event` upsert | PARTIAL — covers log rows with `sg_message_id`, but counter RPCs execute before dedup (F-WH-03) |
| LiveKit: telemetry idempotency via `engine_event.idempotency_key` | PASS — line 236: `livekit:{eventId}:{eventType}` |
| LiveKit: participant_joined dedup via partial unique index | PASS — `idx_call_participant_active ON (call_session_id, profile_id) WHERE left_at IS NULL` |
| DocuSeal: status-weight gate prevents out-of-order events | PASS — lines 104-117 |
| Error responses don't leak stack traces | PASS — except F-WH-01 (updateError.message) |
| Webhook secrets support rotation (no hardcoded values) | PASS — all op:// |

---

## Recommended Remediation Order

1. **F-WH-01** (HIGH) — 1-line fix, no risk, prevents information disclosure to DocuSeal logs.
2. **F-WH-02** (MEDIUM) — 5-line fix in Edge Function, prevents unhandled crash on env misconfiguration.
3. **F-WH-04** (MEDIUM) — Add `UNIQUE (call_session_id)` to `call_log` via migration + handler upsert. Low risk, single migration.
4. **F-WH-03** (MEDIUM) — Requires architectural decision on dedup ordering for SendGrid open/click. Best done as a dedicated sub-sortie.
5. **F-WH-05** (LOW) — Cosmetic; safe to batch with any docuseal touchpoint.
6. **F-WH-06** (LOW) — Env registry cleanup; no security impact.
