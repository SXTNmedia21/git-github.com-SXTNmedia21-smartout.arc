---
title: "Handoff — billing-cron-pg-trigger"
status: done
updated: 2026-05-21
created: 2026-05-21
module: billing
tags: [handoff, billing, cron, pg_cron, runbook]
---

# Handoff — billing-cron-pg-trigger

## Summary

Closes council 2026-05-20 TIER 3 R2+R3. The monthly invoice GENERATION trigger was an
external, unversioned n8n workflow on the droplet with a dead runbook pointer. This sortie
moves it to in-DB pg_cron (parity with ~13 other crons + dunning in the same engine), writes
the missing runbook, and fixes the dead pointer.

## What was built

- **R3 — pg_cron trigger** (`<ts>_pg_cron_generate_monthly_invoices.sql`): `cron.schedule('generate-monthly-invoices','1 0 5 * *', net.http_post(...))` mirroring `20260414240000_ops_monitor_cron.sql`. Reuses GUCs `app.supabase_url` + `app.watchdog_cron_secret` (already configured). `pg_extension` guard + unschedule-if-exists guard (idempotent). EF bearer auth (`index.ts:42-43`) matches the GUC value — no new secret wiring.
- **ADR-0386** — pg_cron over n8n for billing generation. Registered in decision log (ordered after 0385).
- **R2 — runbook** `docs/runbooks/billing-monthly-cron.md`: trigger spec, manual re-fire curl (explicit SAFE/idempotent note), missing-run detection via `fn_check_billing_run`, legacy n8n cutover steps, verify-cron SQL.
- **Dead-pointer fix** — `index.ts:4-5` now says pg_cron + points to `docs/runbooks/billing-monthly-cron.md` (was dead n8n path); CET→UTC corrected.

## Verification

- Local `db reset` applies the migration clean. pg_cron not installed locally → guard skips the schedule (expected); on cloud the job registers. Verify on cloud: `SELECT jobname, schedule FROM cron.job WHERE jobname='generate-monthly-invoices'`.

## Decisions

- ADR-0386 (accepted). No other architectural decisions.

## Known issues / debt

- **Operator one-time step (NOT automatable from repo):** after pg_cron is confirmed firing on cloud, disable the legacy n8n workflow on the droplet to stop double-runs. Documented in the runbook + ADR. Double-fire is idempotent-safe but wasteful until done.
- Local dev cannot exercise the actual net.http_post (no pg_cron locally) — migration correctness verified by db-reset apply + pattern-parity with the working ops-monitor cron.

## Next steps

1. On next production deploy: confirm the cron registers; run the runbook cutover to disable n8n.
2. R4 (due_at → pricing_terms) — separate sortie.
