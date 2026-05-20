---
title: Slice 13 — Webhook Integration Audit
status: done
created: 2026-05-20
updated: 2026-05-20
module: audit
tags: [audit, webhook-integration, adr, security]
---

# Slice 13 — Webhook Integration Audit

**Surface:** `supabase/functions/*-webhook/`, `apps/web/src/app/api/webhooks/**`
**Handlers audited:** stripe-webhook, sendgrid-webhook, livekit-webhook, docuseal (Next.js Route Handler), heartbeat/sixten
**Baseline:** 2026-05-18-adr-contract-validation-02/13-webhook-integration.md (0C/0H/0M/1I)

---

## Summary

1. **MEDIUM WH-01** — `docuseal/route.ts:320` inserts `entity_type`, `entity_id`, `event_name` into `engine_event` but those columns do not exist in schema; insert is cast `as never` to bypass TypeScript and fire-and-forgotten. Cascade coupling for `contract.signed` → D2 transition is silently failing.
2. **LOW WH-02** — `/api/heartbeat/sixten` (POST) has zero authentication by documented intentional design ("uten å spøre eller validere", MVP+ deferred). Any actor can inject arbitrary payloads into `engine_event` and trigger `sixten.pulse_received` events. Not in scope of webhook-provider surface but adjacent.
3. **INFO WH-03** — Stripe webhook uses `emitViaEndpoint` (HTTP call to `INTERNAL_EMIT_URL`) rather than direct `emit()`. If `INTERNAL_EMIT_URL` is absent, telemetry is silently swallowed (warn-logged). Payment events are in the telemetry registry but observability gap exists on misconfigured deployments.
4. **INFO WH-04** — Twilio inbound webhook still absent. Unchanged from baseline. No delivery-status callback endpoint.
5. All four provider webhooks (Stripe, SendGrid, LiveKit, DocuSeal) pass signature verification, fail-closed on missing secrets, and maintain idempotency guards — zero regressions vs. 2026-05-18 baseline.

---

## Findings Table

| ID | Severity | File:Line | ADR | Evidence |
|----|----------|-----------|-----|----------|
| WH-01 | MEDIUM | `apps/web/src/app/api/webhooks/docuseal/route.ts:320–334` | schema | `engine_event.insert({entity_type, entity_id, event_name})` — none of these columns exist in `engine_event` schema (migration 20260304100000). Cast `as never` bypasses TS. Insert silently fails; `.catch(() => {})` swallows error. D2→active cascade coupling for employee contracts broken. |
| WH-02 | LOW | `apps/web/src/app/api/heartbeat/sixten/route.ts:8` | n/a | No authentication — intentional per Pontus directive 2026-04-30; HMAC + IP allowlist deferred to MVP+. Allows unconstrained POST injection to `engine_event`. Documented intent; LOW not MEDIUM because engine_event is consumed passively. |
| WH-03 | INFO | `supabase/functions/stripe-webhook/index.ts:107–129` | telemetry | `emitViaEndpoint` silently swallows when `INTERNAL_EMIT_URL` or `WATCHDOG_CRON_SECRET` absent. Payment events registered in telemetry registry but observability gap on misconfigured deployments. `console.error` logged server-side only. |
| WH-04 | INFO | `supabase/functions/` (absent) | n/a | No Twilio inbound/delivery-status webhook handler. Unchanged from 2026-05-18 baseline. Relevant only if Twilio delivery callbacks are activated. |

---

## Per-ADR Rollup

| ADR | Description | Result | Notes |
|-----|-------------|--------|-------|
| ADR-0079 | employment_contract vs contract system separation | ✅ compliant | DocuSeal route correctly separates `contract` (signing) from `employment_contract` (HR). `signing_contract_id` FK used as integration point per ADR-0079. Status sync writes to correct table per contract_type branch. |

**Overall slice verdict:** ✅ No CRITICAL or HIGH findings. One MEDIUM (WH-01 schema mismatch). Two INFO. No regressions vs. 2026-05-18 baseline.

---

## Handler-by-Handler Verdict

| Handler | Sig Verify | Fail-Closed | Idempotency | Telemetry | ADR-0079 | Result |
|---------|-----------|-------------|-------------|-----------|----------|--------|
| stripe-webhook | ✅ constructEventAsync | ✅ | ✅ UPSERT stripe_event_id UNIQUE | ⚠️ emitViaEndpoint gap | n/a | PASS |
| sendgrid-webhook | ✅ ECDSA P-256 + 300s window | ✅ | ✅ upsert ignoreDuplicates sg_message_id | n/a | n/a | PASS |
| livekit-webhook | ✅ WebhookReceiver JWT | ✅ | ✅ upsert ignoreDuplicates call_session_id | ✅ engine_event insert | n/a | PASS |
| docuseal route.ts | ✅ HMAC-SHA256 timingSafeEqual | ✅ (env.ts Zod gate) | ✅ status weight guard + maybeSingle | ⚠️ engine_event insert broken (WH-01) | ✅ | PASS-WITH-GAP |
| heartbeat/sixten | ❌ none (intentional) | n/a | ✅ each pulse fresh UUID | ✅ engine_event | n/a | INFO-ONLY |

---

## Verified Intentional

- **Stripe `emitViaEndpoint` pattern** — stripe-webhook (Deno) cannot import `@smartout/telemetry` (Node); HTTP bridge via `INTERNAL_EMIT_URL` is the correct pattern per the `api/internal/emit` route design. The gap is only at env misconfiguration, not normal operation.
- **Heartbeat/sixten no-auth** — explicitly authorized by Pontus 2026-04-30 ("uten å spøre eller validere"). Listed as LOW not violation.
- **DocuSeal `void Promise.resolve(...).catch(() => {})` on engine_event** — the comment acknowledges "engine_event table may not exist yet in all envs". This was the original intent, but WH-01 flags that the INSERT column mismatch means even in envs where the table exists, the insert fails silently due to wrong column names.

---

## In-Progress (Mid-Campaign)

None. All four webhook handlers are on `development` tip; no in-progress campaign files identified.

---

## WH-01 Detail — engine_event schema mismatch

**Location:** `apps/web/src/app/api/webhooks/docuseal/route.ts:318–334`

**What code inserts:**
```ts
admin.from("engine_event").insert({
  workspace_id: contract.workspace_id,
  entity_type: "employment_contract",   // ← does NOT exist in engine_event
  entity_id: contract.contract_id,       // ← does NOT exist in engine_event
  event_name: "contract.signed",         // ← does NOT exist in engine_event
  payload: { ... },
  created_at: new Date().toISOString(),  // ← does NOT exist in engine_event
} as never)
```

**Actual `engine_event` columns** (migration `20260304100000_engine_process_tables.sql:101`):
`id`, `event_type`, `payload`, `workspace_id`, `idempotency_key`, `fired_at`

**Impact:** `contract.signed` engine_event for employee cascade (D2→active, C4 trainee→active transition) never fires. The `employment_contract.status` is updated via the role-aware branch (lines 155–188) or the `submission.completed` path, but the engine_event that drives `engine_process` cascade coupling is silently dropped on every employee contract signing.

**Fix:** Replace the non-existent column names:
```ts
admin.from("engine_event").insert({
  event_type: "contract.signed",
  workspace_id: contract.workspace_id,
  payload: {
    entity_type: "employment_contract",
    entity_id: contract.contract_id,
    signed_at: new Date().toISOString(),
    contract_type: "employee",
  },
  idempotency_key: `contract.signed:${contract.contract_id}`,
})
```

---

## Delta vs. 2026-05-18 Baseline

| Area | 2026-05-18 | 2026-05-20 | Change |
|------|-----------|-----------|--------|
| Stripe | PASS | PASS | No change |
| SendGrid | PASS | PASS | No change |
| LiveKit | PASS | PASS | No change |
| DocuSeal | PASS | PASS-WITH-GAP (WH-01 MEDIUM) | New finding: engine_event schema mismatch |
| Twilio | INFO absent | INFO absent | No change |

**New finding this run:** WH-01 (MEDIUM) — previously undetected because 2026-05-18 audit noted "engine_event insert fire-and-forget acceptable" without verifying column names match schema.
