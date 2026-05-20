---
title: Billing Monthly Invoice Generation — Cron Runbook
status: done
updated: 2026-05-21
created: 2026-05-21
module: billing
tags: [runbook, billing, cron]
---

# Billing Monthly Invoice Generation — Cron Runbook

Operational reference for the `generate-monthly-invoices` pg_cron job.
Covers trigger details, manual re-fire, missing-run detection, and the
one-time legacy n8n cutover.

---

## Trigger

**pg_cron job:** `generate-monthly-invoices`
**Schedule:** `1 0 5 * *` — 00:01 UTC on day 5 of each month.
**Transport:** `net.http_post` from pg_cron → Supabase Edge Function
`/functions/v1/generate-monthly-invoices`.
**Auth:** `Authorization: Bearer <app.watchdog_cron_secret>` — the GUC
value resolved at runtime inside the DB.

### GUC dependencies

| GUC | Purpose | Already configured by |
|-----|---------|----------------------|
| `app.supabase_url` | Base URL for net.http_post | ops-monitor cron (migration 20260414240000) |
| `app.watchdog_cron_secret` | Bearer token for EF auth check | ops-monitor cron (migration 20260414240000) |

Both GUCs must be set on the database. If they are missing, the EF call
will return 401 or fail to connect. Verify with:

```sql
SELECT current_setting('app.supabase_url', true),
       length(current_setting('app.watchdog_cron_secret', true)) > 0 AS secret_set;
```

### Verify the cron job is registered

```sql
SELECT jobname, schedule, active
  FROM cron.job
 WHERE jobname = 'generate-monthly-invoices';
```

Expected result:

```
       jobname              | schedule  | active
----------------------------+-----------+--------
 generate-monthly-invoices  | 1 0 5 * * | t
```

Empty result means pg_cron is not installed locally (acceptable in dev —
the migration guard skips the schedule) or the migration has not yet been
applied.

---

## What the EF does

For every active company (contract signed, `pricing_terms` present):

1. Freezes a `usage_snapshot` for the previous calendar month.
2. Generates a `draft` invoice with base-plan + user-overage line items.
3. Transitions the invoice to `issued` (triggers `assign_invoice_number`).
4. Emits `usage_snapshot.created`, `invoice.generated`, `invoice.issued`
   telemetry events via the `/api/internal/emit` bridge.
5. Scans existing `issued`/`sent` invoices past `due_at` and flips them
   to `overdue`, emitting `invoice.overdue_detected`.

Collection (Stripe charge) is intentionally NOT triggered by this cron —
see ADR-0385.

---

## Manual re-fire (missed or failed run)

**Re-running is SAFE.** The unique index `idx_invoice_one_recurring_per_period`
prevents double-generation at the DB level. The EF also early-exits if a
non-void invoice already exists for `(company_id, period_from, period_to)`.
You can re-fire without fear of duplicate invoices.

```bash
curl -X POST "$SUPABASE_URL/functions/v1/generate-monthly-invoices" \
  -H "Authorization: Bearer $WATCHDOG_CRON_SECRET" \
  -H "Content-Type: application/json"
```

Substitute values from your environment (`.env.template` or 1Password):

- `SUPABASE_URL` — the project URL (e.g. `https://<ref>.supabase.co`)
- `WATCHDOG_CRON_SECRET` — the same secret stored in `app.watchdog_cron_secret` GUC

The EF returns `200 OK` with a JSON summary on success, or `401` if the
secret does not match.

---

## Missing-run detection

The day-7 watchdog `fn_check_billing_run()` (registered via migration
`20260621200002_fn_check_billing_run.sql`) runs on pg_cron and checks
whether an invoice was generated for each active company in the current
period. When a company is un-billed past day 7, it writes an
`invoice generation_missing` row to `billing_activity_log`.

Query to find un-billed companies:

```sql
SELECT company_id, period_from, created_at, message
  FROM billing_activity_log
 WHERE event_type = 'invoice generation_missing'
 ORDER BY created_at DESC
 LIMIT 20;
```

If rows appear, investigate whether:
- The pg_cron job fired (check `cron.job_run_details` for the job name).
- The EF returned a non-200 response (check Supabase Edge Function logs).
- `pricing_terms` or `contract_status` gating excluded the company
  (check ADR-0384).

After diagnosing, re-fire manually (see section above) — the idempotency
guard makes it safe.

---

## Legacy n8n cutover (one-time operator step)

**Background.** Before ADR-0386 (2026-05-21) the generation trigger was an
n8n workflow on the Tailscale droplet (`100.115.242.65`, `n8n.smartout.ai`).
Once pg_cron is confirmed live, the n8n workflow MUST be disabled to avoid
double-runs. Double-fire is idempotent-safe (no duplicate invoices) but
wasteful and confusing in logs.

**Steps:**

1. Confirm the pg_cron job is registered:

   ```sql
   SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'generate-monthly-invoices';
   ```

2. Confirm the first automatic fire succeeded (check `cron.job_run_details`
   or Supabase Edge Function logs for a day-5 run).

3. Log in to `n8n.smartout.ai` (Tailscale: `100.115.242.65`).

4. Find the workflow named "Generate monthly invoices" (or similar) and
   **disable** it (toggle the active switch to off). Do NOT delete it yet
   — keep it as an audit trail until at least one full billing cycle has
   run cleanly via pg_cron.

5. Record the cutover in the activity log:

   ```bash
   ~/.claude/scripts/log-activity.sh system claude "Disabled legacy n8n monthly-invoice workflow on droplet; pg_cron ADR-0386 now sole trigger."
   ```

---

## References

- ADR-0386 — pg_cron over n8n for billing generation trigger
- ADR-0385 — Billing collection is manual V1
- ADR-0384 — Billing gate on signed contract
- ADR-0118 — Invoice Engine as C3 Commercial Consumer
- Migration `20260621200003_pg_cron_generate_monthly_invoices.sql` — job registration
- Migration `20260621200002_fn_check_billing_run.sql` — day-7 watchdog
