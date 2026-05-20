---
title: "Plan — billing-cron-pg-trigger"
status: in_progress
updated: 2026-05-21
created: 2026-05-21
module: billing
tags: [plan, billing, cron, pg_cron, n8n, runbook]
---

# Plan — billing-cron-pg-trigger

> Branch: `feat/billing-cron-pg-trigger` | Worktree: /home/sxtnl/dev/smartout.ai-wt-9 | Base: `development` | Module: billing
>
> Council 2026-05-20 TIER 3 R2+R3. Closes the cron-reliability operational gaps left after
> the correctness fix (feat/billing-cron-correctness): the GENERATION trigger was external,
> unversioned n8n with a dead runbook pointer.

## Goal

Move the monthly invoice GENERATION trigger from unversioned droplet n8n to in-DB pg_cron
(parity with ~13 other crons + dunning in the same engine), write the missing runbook, and
fix the dead `index.ts:4` pointer.

## Tasks

- [ ] **R3 — pg_cron trigger migration.** New migration mirroring `20260414240000_ops_monitor_cron.sql`:
  `cron.schedule('generate-monthly-invoices', '1 0 5 * *', net.http_post(url := current_setting('app.supabase_url',true) || '/functions/v1/generate-monthly-invoices', headers := jsonb_build_object('Authorization','Bearer ' || current_setting('app.watchdog_cron_secret',true), 'Content-Type','application/json')))`.
  Guard with `IF EXISTS (pg_extension WHERE extname='pg_cron')` + unschedule-if-exists. GUCs
  `app.supabase_url` + `app.watchdog_cron_secret` already configured (ops-monitor relies on them).
  EF auth check is `WATCHDOG_CRON_SECRET` bearer (index.ts:42-43) — matches.
- [ ] **ADR-0386 — pg_cron over n8n for billing generation trigger.** Records: convention parity
  (all other recurring jobs are in-DB pg_cron migrations, incl. dunning `20260512000008` in the
  SAME billing engine), versioned + replayable + visible to migration provisioning, removes the
  unversioned-droplet single point of failure. n8n workflow must be DISABLED on the droplet after
  pg_cron is live (operator step) to avoid double-fire (idempotent anyway, but wasteful). Register
  in 0000-decision-log.md.
- [ ] **R2 — runbook `docs/runbooks/billing-monthly-cron.md`.** Documents: the pg_cron trigger
  (job name, schedule, GUC dependencies), manual re-fire (`curl` with WATCHDOG_CRON_SECRET — re-run
  is SAFE per the idempotency unique index, say so explicitly), the R1 watchdog
  (`fn_check_billing_run`) + its `invoice generation_missing` signal, and the one-time droplet
  step to disable the old n8n workflow.
- [ ] **Fix dead pointer.** Update `supabase/functions/generate-monthly-invoices/index.ts:4-5`:
  trigger is now pg_cron (not n8n); point to `docs/runbooks/billing-monthly-cron.md`.

## Out of scope

- R4 (due_at→pricing_terms) — separate sortie.
- Auto-charge — ADR-0385 manual V1.
- Stale-`issued` collection watchdog — future.

## Acceptance Criteria

- [ ] pg_cron migration applies clean on local Supabase (`db reset`); job registered (verify `cron.job` row when pg_cron present).
- [ ] index.ts pointer updated + no longer says n8n.
- [ ] ADR-0386 registered in decision log; runbook exists at the referenced path.
- [ ] Typecheck passes (no app code changed except a Deno comment).
- [ ] User journeys written.

## Journeys

1. System (pg_cron) fires monthly invoice generation day 5 — versioned, replayable, no droplet dependency.
2. Operator manually re-fires a missed/failed generation run safely (idempotent).
3. Operator disables the legacy n8n workflow after pg_cron goes live (one-time cutover).

## Knowledge to capture (at closure)

- ADR-0386 (pg_cron over n8n). Learning if anything non-obvious surfaces about GUC/net.http_post auth.
