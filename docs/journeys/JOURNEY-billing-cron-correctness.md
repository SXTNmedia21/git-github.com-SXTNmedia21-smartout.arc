---
title: "Journey — billing-cron-correctness"
status: done
updated: 2026-05-20
created: 2026-05-20
module: billing
tags: [journey, billing, cron, invoice]
---

# User Journeys — billing-cron-correctness

## Journey: System (cron) generates a monthly invoice atomically
**Precondition:** A company has effective `pricing_terms` and at least one workspace with `contract_status='active'`. No non-void recurring invoice exists yet for the previous-month period.
1. n8n cron POSTs to `generate-monthly-invoices` (WATCHDOG_CRON_SECRET) → System runs `generateForCompany` → computes usage snapshots + amounts + line items in TS.
2. System calls `fn_generate_company_invoice` RPC → DB inserts invoice (draft) + all line items + transitions draft→issued **in one transaction** → `assign_invoice_number` trigger allocates the number → returns `(invoice_id, invoice_number)`.
3. System emits `usage_snapshot created`, `invoice generated`, `invoice issued` (after the RPC) → accountant sees a complete `issued` invoice in apps/admin.
**Postcondition:** Exactly one complete `issued` invoice (header + line items + number) per company per period.
**Error paths:**
- RPC error mid-write → entire transaction rolls back; NO partial/header-only draft is left. Next run retries cleanly.
- Duplicate (company, period) → unique index `idx_invoice_one_recurring_per_period` blocks; the TS early-exit skips before calling the RPC.
- Telemetry endpoint down → emits fail silently (caught/logged); the invoice is already complete and persisted.

## Journey: Operator/cron detects a missing billing run
**Precondition:** It is on/after day 7 of the month; a company with an active contract was NOT billed for the previous month (cron failed to fire, or skipped).
1. pg_cron fires `fn_check_billing_run()` (day 7, 06:00 UTC).
2. System finds every company with `workspace.contract_status='active'` and no non-void recurring invoice for the previous-month period → inserts one `billing_activity_log` row `event='invoice generation_missing'` per missing company.
3. Operator audits `billing_activity_log` (or downstream alerting) → sees which companies were not billed → re-triggers generation manually.
**Postcondition:** Every missing billing run leaves an auditable signal; silent zero-billing becomes detectable.
**Error paths:** No active-contract companies / all billed → returns 0, writes nothing (no false positives).

## Journey: Maintenance — pre-existing stuck drafts are voided
**Precondition:** Before this sortie, a crash left header-only recurring `draft` invoices that block re-billing.
1. C2 migration runs once on deploy → voids recurring drafts with zero line items.
2. The void exclusion in the partial index releases the (company, period) slot → affected companies are re-billed on the next cron run.
**Postcondition:** No header-only stuck drafts remain; affected companies are billable again.
**Error paths:** Fresh DB / no stuck drafts → no-op. Re-running the migration → no-op (WHERE filters `status='draft'`).
