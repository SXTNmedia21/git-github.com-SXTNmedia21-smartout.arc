---
title: n8n Workflow — billing-monthly-trigger
status: ready
updated: 2026-04-17
created: 2026-04-17
module: billing
tags: [runbook, billing, cron, n8n, edge-function]
---

# n8n Workflow — billing-monthly-trigger

> Phase 4 Task 4.2 of Billing Engine Fase 1. External scheduler config for
> the `generate-monthly-invoices` Edge Function. n8n is the single external
> dependency the billing cron has — everything else (auth, idempotency,
> emit pipeline) is self-contained.

## Purpose

Invoke the `generate-monthly-invoices` Edge Function once per month. The
function:

1. Freezes `usage_snapshot` rows for the previous month per workspace (ADR-0119 predicate).
2. Generates one `recurring` invoice per active company (idempotent via `idx_invoice_one_recurring_per_period`).
3. Emits `usage_snapshot created`, `invoice generated`, `invoice issued` via `/api/internal/emit`.
4. Scans existing `issued` / `sent` invoices past their `due_at`, flips to `overdue`, emits `invoice overdue_detected`.

## Schedule

| Property | Value |
|----------|-------|
| Day of month | 5 |
| Time | 00:01 |
| Timezone | Europe/Oslo |
| Cron expression | `1 0 5 * *` |

**Why day 5, not day 1?** The invoice period covers the previous month. Running on day 5 allows any late shift-settlement writes from the final days of the billing period to land before the ADR-0119 snapshot is frozen. Any retroactive `schedule_shift` edits after day 5 are caught by `basis_drift_event`, reviewed by platform-admin, and resolved via credit note (ADR-0120).

## Node configuration

### Node 1 — Schedule Trigger

- **Type:** Cron
- **Expression:** `1 0 5 * *`
- **Timezone:** Europe/Oslo

### Node 2 — HTTP Request

- **Method:** POST
- **URL:** `https://<supabase-project-ref>.supabase.co/functions/v1/generate-monthly-invoices`
- **Headers:**
  - `Authorization: Bearer {{$env.WATCHDOG_CRON_SECRET}}`
  - `Content-Type: application/json`
- **Body:** empty (the function computes the period from `Date.now()`)
- **Timeout:** 300 s (cron can take minutes on multi-workspace companies)

### Node 3 — Success branch

- **On success:** append one line to `ops/activity-log.md` via the Second Brain log action (or Slack `#billing-ops` notification, per tenant preference)

### Node 4 — Error branch

- **On error:** Telegram notification to `@sixtenclaw_bot` with status code + `companies_processed` + `errors[]` summary
- **Retry policy:** none (idempotency relies on DB-level unique constraint; re-invoking manually is safe)

## Expected response shape

```json
{
  "period_from": "2026-03-01",
  "period_to": "2026-03-31",
  "companies_processed": 12,
  "invoices_created": 9,
  "invoices_skipped": 3,
  "overdue_flipped": 2,
  "errors": []
}
```

- `invoices_skipped` is non-zero when a recurring invoice already exists for a company (idempotency fast-path).
- `errors[]` entries carry `{ company_id, stage, error }` — `stage` is one of `list_companies`, `generate_for_company`, `mark_overdue`.

## Secrets

| Name | Where | Purpose |
|------|-------|---------|
| `WATCHDOG_CRON_SECRET` | Supabase + n8n credentials + `op://smartout_ai_prod/watchdog/secret` | Bearer auth shared across cron Edge Functions |
| `INTERNAL_EMIT_URL` | Supabase Edge Function env | `https://app.smartout.ai/api/internal/emit` — the Next.js bridge that calls `emit()` |

The Next.js route at `/api/internal/emit` uses the same `WATCHDOG_CRON_SECRET` as the bearer. Do not introduce a separate secret for the bridge.

## Deployment checklist

- [ ] `WATCHDOG_CRON_SECRET` set in Supabase Edge Function env (`npx supabase secrets set WATCHDOG_CRON_SECRET=$(op read "op://smartout_ai_prod/watchdog/secret")`)
- [ ] `INTERNAL_EMIT_URL` set in Supabase Edge Function env (`https://app.smartout.ai/api/internal/emit` for prod)
- [ ] Edge Function deployed: `npx supabase functions deploy generate-monthly-invoices`
- [ ] n8n workflow imported via n8n UI at `n8n.smartout.ai`
- [ ] n8n `WATCHDOG_CRON_SECRET` credential set
- [ ] Workflow activated; verify next run shows day 5 00:01 CET
- [ ] Manual dry-run via n8n "Execute Workflow" — verify response JSON shape + empty `errors[]`

## Manual invocation (dry-run or backfill)

Safe to call ad-hoc:

```bash
curl -X POST https://<supabase-project>.supabase.co/functions/v1/generate-monthly-invoices \
  -H "Authorization: Bearer $(op read 'op://smartout_ai_prod/watchdog/secret')"
```

The idempotency constraint guarantees a duplicate invoice is never written. Re-invocation on the same day is harmless (`invoices_skipped` increments, `overdue_flipped` may catch freshly-overdue rows).

## Observability

- **Per-company errors:** returned in the response body (n8n captures these)
- **Structured logs:** Supabase Functions dashboard (Dashboard → Edge Functions → generate-monthly-invoices → Logs)
- **Event pipeline:** PostHog + `billing_activity_log` via the `/api/internal/emit` bridge. An n8n execution that returns 200 but shows 0 `invoices_created` and 0 `companies_processed` indicates a listing or auth failure — check the `errors[]` array.

## Dependencies

- Supabase Cloud — Edge Functions runtime
- n8n server at `n8n.smartout.ai` (Tailscale IP 100.115.242.65)
- Next.js app deployed at `app.smartout.ai` (for `/api/internal/emit`)
- 1Password vault `smartout_ai_prod` (for `WATCHDOG_CRON_SECRET`)

## Related

- Edge Function source: `supabase/functions/generate-monthly-invoices/{index,generator}.ts`
- Plan: `docs/superpowers/plans/2026-04-17-billing-engine-fase-1.md` §Phase 4
- Module doc: `docs/modules/MODULE_BILLING.md` §6 invoice lifecycle
- ADR-0118 (C3 Commercial placement), ADR-0119 (usage reproducibility), ADR-0120 (immutability + credit note), ADR-0121 (pricing_terms extension), ADR-0125 (billing_activity_log)
