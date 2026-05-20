---
title: "Journey — billing-cron-pg-trigger"
status: done
updated: 2026-05-21
created: 2026-05-21
module: billing
tags: [journey, billing, cron, pg_cron]
---

# User Journeys — billing-cron-pg-trigger

## Journey: System fires monthly invoice generation via pg_cron
**Precondition:** pg_cron extension installed (production/cloud); GUCs `app.supabase_url` + `app.watchdog_cron_secret` configured (already set, ops-monitor depends on them).
1. pg_cron job `generate-monthly-invoices` fires `1 0 5 * *` (00:01 UTC day 5) → `net.http_post` to `/functions/v1/generate-monthly-invoices` with `Authorization: Bearer <app.watchdog_cron_secret>`.
2. The EF auth check (`index.ts:42-43`) validates the bearer → runs generation for all active-contract companies (atomic per-company RPC).
**Postcondition:** Invoices generated + issued without any external/droplet dependency; the trigger is versioned in a migration + replays on provisioning.
**Error paths:** pg_cron absent (local dev) → migration guard skips the schedule, applies clean. GUC missing → net.http_post sends no/empty bearer → EF returns 401 (fail-closed, no silent run).

## Journey: Operator manually re-fires a missed/failed run
**Precondition:** A scheduled run was missed (pg_cron down) or failed mid-way.
1. Operator runs the runbook curl: `POST /functions/v1/generate-monthly-invoices` with the WATCHDOG_CRON_SECRET bearer.
2. The EF re-runs; the unique index `idx_invoice_one_recurring_per_period` + early-exit guarantee exactly one invoice per company per period.
**Postcondition:** Missed companies are billed; already-billed companies are untouched. Re-firing is SAFE — documented explicitly in the runbook so the operator does not hesitate.
**Error paths:** Re-fire after a partial pre-C1 crash → C2 cleanup (already shipped) + the atomic RPC mean no stuck drafts; re-fire completes the missing invoices.

## Journey: Operator disables the legacy n8n workflow (one-time cutover)
**Precondition:** pg_cron job confirmed registered + firing (`SELECT jobname, schedule FROM cron.job WHERE jobname='generate-monthly-invoices'`).
1. Operator disables the old day-5 workflow on the droplet n8n (n8n.smartout.ai, Tailscale 100.115.242.65) per the runbook cutover section.
**Postcondition:** Single trigger source (pg_cron). No double-runs.
**Error paths:** If both fire before cutover → double POST, but idempotency makes it harmless (one invoice per period), only wasteful.
