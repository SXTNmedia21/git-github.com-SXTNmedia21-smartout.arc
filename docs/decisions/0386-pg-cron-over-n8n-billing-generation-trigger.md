---
id: ADR-0386
title: pg_cron over n8n for monthly invoice generation trigger
status: accepted
updated: 2026-05-21
created: 2026-05-21
module: billing
tags: [billing, invoice, cron, pg_cron, n8n, trigger, generation]
---

# ADR-0386 — pg_cron over n8n for monthly invoice generation trigger

## Status

accepted (2026-05-21)

## Context

The `generate-monthly-invoices` Edge Function is responsible for freezing
usage snapshots and generating recurring invoices on day 5 of each month
(ADR-0118, ADR-0119, ADR-0384). Until now its trigger was an external n8n
workflow running on the Tailscale droplet at `100.115.242.65`
(`n8n.smartout.ai`).

A council review on 2026-05-20 flagged three problems with this setup:

1. **Unversioned, outside migration control.** The n8n workflow is not
   tracked in the repository and is invisible to the standard migration
   provisioning path. Any re-deployment or environment clone silently
   loses the trigger.
2. **Dead runbook pointer.** `generate-monthly-invoices/index.ts:4`
   referenced `docs/runbooks/billing-monthly-cron-n8n.md`, which never
   existed. Operators had no documented re-fire or cutover procedure.
3. **Droplet single point of failure.** All other recurring jobs in the
   same billing engine — dunning tick (`20260512000008`), ops-monitor
   (`20260414240000`), session replenish (`20260428100100`), and ~10 more
   — use in-DB pg_cron via `net.http_post`. The n8n dependency was the
   only exception and created an asymmetric operational burden.

## Decision

Register the `generate-monthly-invoices` trigger as a pg_cron job via a
new migration (`20260621200003_pg_cron_generate_monthly_invoices.sql`),
mirroring the canonical `net.http_post` pattern from `ops-monitor`
(`20260414240000_ops_monitor_cron.sql`) and the dunning engine
(`20260512000008_pg_cron_dunning_tick.sql`).

Job specification:

- **Name:** `generate-monthly-invoices`
- **Schedule:** `1 0 5 * *` (00:01 UTC on day 5 of each month)
- **Transport:** `net.http_post` to
  `current_setting('app.supabase_url') || '/functions/v1/generate-monthly-invoices'`
- **Auth:** `Authorization: Bearer <app.watchdog_cron_secret>` — the same
  GUC already used by ops-monitor and daily-session-replenish; no new
  secret wiring needed.
- **Content-Type:** `application/json` added alongside the bearer header
  (the EF reads a POST body).
- **Guards:** pg_extension existence check (skips silently on local dev
  without pg_cron) + `cron.unschedule` before re-scheduling (idempotent
  re-run).

## Rationale

- **Convention parity.** All ~13 other recurring jobs already use in-DB
  pg_cron. Having one external n8n exception imposes asymmetric
  operational knowledge on every operator who touches billing.
- **Versioned and replayable.** The migration is in `supabase/migrations/`,
  so every environment clone, branch reset, and `db reset` automatically
  provisions the trigger. n8n re-configuration was a silent manual step.
- **Removes droplet SPOF.** If the Tailscale droplet is unavailable,
  pg_cron still fires. The inverse is also true: pg_cron failure is
  detectable via `fn_check_billing_run` (see ADR-0118 R1 watchdog), while
  n8n failure was opaque from the DB side.
- **GUC reuse.** `app.watchdog_cron_secret` and `app.supabase_url` are
  already configured on the database. The EF already validates the same
  bearer value at `index.ts:42-43`. Zero new credential surface.

## Consequences

1. **Operator one-time cutover step (required).** After the migration
   applies and the first pg_cron firing is confirmed, the legacy n8n
   workflow on the droplet (`n8n.smartout.ai`) MUST be disabled to avoid
   double-runs. Double-fire is idempotent-safe via
   `idx_invoice_one_recurring_per_period` + the generator's early-exit
   guard, but wasteful and confusing in logs. See
   `docs/runbooks/billing-monthly-cron.md` § Legacy n8n cutover.
2. **Local dev without pg_cron.** The `IF EXISTS pg_extension` guard means
   the migration applies cleanly but no job is registered. This is the
   existing behavior for all other cron migrations — acceptable.
3. **Runbook created.** `docs/runbooks/billing-monthly-cron.md` replaces
   the dead `billing-monthly-cron-n8n.md` pointer and documents re-fire,
   watchdog query, and the n8n cutover step.

## References

- ADR-0384 — Billing gate on signed contract
- ADR-0385 — Billing collection is manual V1
- ADR-0118 — Invoice Engine as C3 Commercial Consumer (generation spec)
- Migration `20260414240000_ops_monitor_cron.sql` — canonical net.http_post cron pattern
- Migration `20260512000008_pg_cron_dunning_tick.sql` — dunning cron in same billing engine
- Council review 2026-05-20 — TIER 3 R2+R3 findings
