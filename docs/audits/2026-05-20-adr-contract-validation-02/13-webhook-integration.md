---
title: Slice 13 — Webhook Integration Audit
status: done
created: 2026-05-20
updated: 2026-05-20
module: webhook
tags: [audit, webhook, docuseal, stripe, sendgrid, livekit, engine_event]
---

# Slice 13: Webhook Integration

**Surfaces audited:**
- `apps/web/src/app/api/webhooks/docuseal/route.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/sendgrid-webhook/index.ts`
- `supabase/functions/livekit-webhook/index.ts`

**ADRs in scope:** ADR-0079 (DocuSeal / employment_contract separation), ADR-0141 (PII redaction)

**Baseline:** `docs/audits/2026-05-20-adr-contract-validation/00-SYNTHESIS.md`
- WH-01 was listed as MEDIUM (NEW). Verification status: **STILL OPEN** — no fix shipped in PR #432 or any commit touching `route.ts` after the baseline.

---

## Summary

4 findings: **0 CRITICAL / 1 HIGH / 1 MEDIUM / 2 LOW**.

The WH-01 baseline finding is confirmed present and re-classified **HIGH** (severity upgraded from MEDIUM): the `engine_event` insert uses 4 non-existent column names, is cast as `never` to suppress TS, and the `.catch(()=>{})` swallows all errors silently. The three Edge Functions (Stripe, SendGrid, LiveKit) are substantially well-formed — HMAC/ECDSA/JWT signatures verified, secrets fail-closed, idempotency gates present. Two lower-severity findings identified: a silent-drop path on unrecognised participant events (LOW) and missing `webhook.received` / `webhook.failed` telemetry events on Stripe and LiveKit (LOW).

---

## Findings

### WH-01 — MEDIUM → HIGH (upgraded) — docuseal `engine_event` column mismatch still present

**File:** `apps/web/src/app/api/webhooks/docuseal/route.ts:320-334`
**Status:** OPEN (was listed MEDIUM in baseline; upgrading to HIGH — column mismatch + silent swallow combined)

The `engine_event` insert at line 320 uses four columns that do not exist in the schema:

| Column sent | Reality in schema | Correct column |
|---|---|---|
| `entity_type` | NOT in schema | — (belongs in `payload`) |
| `entity_id` | NOT in schema | — (belongs in `payload`) |
| `event_name` | NOT in schema | `event_type` |
| `created_at` | NOT in schema | `fired_at` |

Valid `engine_event` Insert columns (from `database.types.ts:8843-8850`):
`event_type`, `fired_at`, `id`, `idempotency_key`, `payload`, `workspace_id`.

The insert is cast `as never` to silence the TypeScript error, bypassing the compiler contract. The `.catch(() => { /* non-blocking */ })` on line 331 swallows the runtime error without logging, so every `contract.signed` cascade event fires silently into the void. The comment ("engine_event table may not exist yet in all envs") may have been valid in early development but is no longer an excuse in production — the table exists and the columns are wrong.

**Impact:** Every employee contract signing fails to fire the `contract.signed` engine_event that triggers the cascade D2 active + C4 trainee→active transition. Profile status (`trainee → active`) never progresses automatically. Fix: replace the four wrong column names, move `entity_type`/`entity_id` into `payload`, add `idempotency_key: \`docuseal:${data.submission_id}:signed\`` to prevent replay double-fires.

**Fix boundary:** `apps/web/src/app/api/webhooks/docuseal/route.ts:320-334`

---

### WH-02 — NEW MEDIUM — LiveKit `participant_joined` / `participant_left` silently dropped on lookup failure

**File:** `supabase/functions/livekit-webhook/index.ts:66-108`

`getActiveSessionId()` returns `null` when no active session exists for a channel. On `participant_joined`, the handler breaks out (`break`) with only a `console.error` — no 2xx acknowledgment after the error log. On `participant_left`, the handler is gated with `if (sessionId)` and silently no-ops when null. Both cases log to console but the webhook still returns `200 ok` (line 217). The behaviour is not incorrect but the failure is invisible to operators: LiveKit will consider the event delivered, and there is no emitted `webhook.failed` event to surface the miss in the activity trail.

**Impact:** A race condition where the webhook arrives before the `channel_call_session` row is created (e.g. within the first ~200 ms of room creation) produces a silent participant miss with no retry path.

**Severity note:** LiveKit retries webhooks on non-2xx only. Returning 200 unconditionally closes the retry window.

---

### WH-03 — NEW LOW — Missing `webhook.received` / `webhook.failed` telemetry events on Stripe + LiveKit

**Files:** `supabase/functions/stripe-webhook/index.ts`, `supabase/functions/livekit-webhook/index.ts`

The SendGrid EF has no telemetry emit either, but its `platform_webhook_event` bulk upsert serves as a functional audit trail. Stripe and LiveKit have no equivalent: `emitViaEndpoint` is called only on successful business-logic outcomes (`payment succeeded`, `payment failed`, `payment refunded`) — not on the raw webhook receipt. LiveKit emits `engine_event` rows via `emitCallEvent` per event type but does not emit a normalised `webhook.received` / `webhook.failed` event to `activity_trail`. Under ADR-0079 cross-cutting webhook pattern, every webhook surface should emit at ingress so the activity trail can answer "was this webhook received and processed?"

---

### WH-04 — NEW LOW — `livekit-webhook` carries `@ts-nocheck`; column safety relies on Supabase CLI deploy-time check

**File:** `supabase/functions/livekit-webhook/index.ts:1`

`// @ts-nocheck` at line 1 is standard for Deno Edge Functions but means the `engine_event` insert column names are never validated by `tsc` in the monorepo typecheck pass. The livekit insert (`event_type`, `workspace_id`, `payload`, `idempotency_key`) is in fact schema-correct — this is a LOW noting the dependency on Supabase CLI for validation rather than the monorepo gate. Given WH-01 (where `@ts-nocheck`-equivalent `as never` was used to hide a real mismatch in a non-Deno file), this pattern deserves explicit tracking.

---

## Per-ADR Rollup

| ADR | Finding | Status |
|---|---|---|
| ADR-0079 (DocuSeal/employment separation) | WH-01: `engine_event` insert uses 4 wrong columns, cast as `never`, `.catch(()=>{})` swallows error silently | OPEN (HIGH) |
| ADR-0141 (PII redaction) | Stripe `redactStripeEvent()` whitelist is correctly implemented; no forbidden fields persisted | COMPLIANT |
| Webhook signature patterns | Stripe (HMAC + `constructEventAsync`), SendGrid (ECDSA P-256 + timestamp window), LiveKit (`WebhookReceiver` JWT) — all fail-closed on missing secrets | COMPLIANT |
| Idempotency | Stripe: `payment_attempt.stripe_event_id` UNIQUE + upsert duplicate-guard. SendGrid: `platform_webhook_event` upsert with sg_message_id. LiveKit: `call_log.call_session_id` UNIQUE + upsert, `engine_event.idempotency_key`. DocuSeal: status-weight guard on `contract`, but no idempotency key on `engine_event` (unfired due to WH-01) | MIXED |
| Error handling / silent swallow | SendGrid: bulk upsert errors not checked (non-critical). Stripe: handler errors return 500 (allows Stripe retry). LiveKit: participant errors return 200 (closes retry window — WH-02). DocuSeal: `engine_event` `.catch(()=>{})` (WH-01) | MIXED |

---

## Verified Intentional

- **Stripe `actor_id: null` / `workspace_id: null`** in `emitViaEndpoint` calls: billing is company-scoped, not workspace-scoped. Intentional per ADR-0141 domain separation.
- **SendGrid `if (KEY)` guard removed → fail-closed 500**: explicitly noted in comment as fixing audit finding H-02 from 2026-05-06. Correct.
- **DocuSeal `isFinalSignature` partial-signing guard**: two-party signing flow (Leverandør + Kunde) — partial `form.completed` intentionally returns 200 early and keeps `contract.status='sent'`.
- **Stripe returns 500 on handler error**: deliberately allows Stripe retry. Payment handlers are idempotent via `stripe_event_id` UNIQUE.
- **LiveKit UUID format validation** on room parts (line 54-58): intentional hardening per F-WH-07 comment.

---

## In-Progress / Campaign Context

The campaign `campaign/payroll` touches `contract-service` + DocuSeal surfaces. WH-01 is squarely in the payroll campaign's domain: the `contract.signed` engine_event drives the trainee→active profile transition which is a D2/C4 gate in the payroll readiness flow. The fix should be included in the next payroll campaign sub-sortie or as a standalone hotfix — it is a silent data loss bug affecting every new employee onboarding.

---

## Finding Counts

| Severity | Count | IDs |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 1 | WH-01 |
| MEDIUM | 1 | WH-02 |
| LOW | 2 | WH-03, WH-04 |

**Top 3:**
1. **WH-01 (HIGH)** — `engine_event` insert in docuseal route has 4 wrong column names + `as never` TS bypass + silent `.catch()`. Every employee contract signing silently fails to trigger the cascade trainee→active transition.
2. **WH-02 (MEDIUM)** — LiveKit participant events silently drop on session-not-found; webhook still returns 200 closing LiveKit's retry window.
3. **WH-03 (LOW)** — No `webhook.received` / `webhook.failed` normalised telemetry on Stripe + LiveKit; operator has no activity-trail visibility into raw webhook ingress.
