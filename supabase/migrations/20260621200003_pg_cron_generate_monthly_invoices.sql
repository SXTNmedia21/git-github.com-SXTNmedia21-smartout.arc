-- ============================================
-- 20260621200003_pg_cron_generate_monthly_invoices.sql
-- Billing Engine — pg_cron trigger for monthly invoice generation.
--
-- ADR-0386: Migrates the GENERATION trigger from an external, unversioned
-- n8n workflow on the Tailscale droplet (100.115.242.65) to an in-DB
-- pg_cron job. All other recurring billing and ops jobs already use
-- pg_cron (dunning: 20260512000008, ops-monitor: 20260414240000, etc.);
-- this aligns generation with that convention and removes the droplet
-- single point of failure.
--
-- Schedule: '1 0 5 * *' — 00:01 UTC on day 5 of each month.
--   Day 5 gives the EF a 4-day buffer after month close for any lagging
--   shift completions before the snapshot is frozen.
--
-- Auth: calls EF via net.http_post with Authorization bearer =
--   current_setting('app.watchdog_cron_secret', true).
--   The GUC 'app.watchdog_cron_secret' is already configured on this DB
--   (ops-monitor and daily-session-replenish crons depend on it).
--   The EF auth check (index.ts:42-43) expects exactly this bearer value —
--   no new secret wiring required.
--
-- GUC dependencies:
--   app.supabase_url          — already set (ops-monitor relies on it)
--   app.watchdog_cron_secret  — already set (ops-monitor relies on it)
--
-- Idempotency:
--   - Unschedules any pre-existing job with the same name before
--     re-scheduling, so re-applying this migration is a no-op.
--   - The EF itself is idempotent via unique index
--     idx_invoice_one_recurring_per_period + early-exit guard.
--
-- Guarded with pg_extension check so local dev without pg_cron does not
-- fail the migration (schedule simply skips; migration still applies
-- clean).
--
-- Operator one-time step: after confirming the pg_cron job fires, disable
-- the legacy n8n workflow on the droplet (n8n.smartout.ai) to avoid
-- double-runs. Double-fire is idempotent-safe but wasteful.
--
-- Refs: ADR-0386, ADR-0385, ADR-0118, ADR-0384.
-- ============================================

DO $cmd$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove stale job if it already exists (idempotent re-run).
    PERFORM cron.unschedule('generate-monthly-invoices')
      FROM cron.job
     WHERE jobname = 'generate-monthly-invoices';

    PERFORM cron.schedule(
      'generate-monthly-invoices',
      '1 0 5 * *',
      $sql$SELECT net.http_post(
        url     := current_setting('app.supabase_url', true) || '/functions/v1/generate-monthly-invoices',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.watchdog_cron_secret', true),
          'Content-Type',  'application/json'
        )
      )$sql$
    );
  END IF;
END $cmd$;
