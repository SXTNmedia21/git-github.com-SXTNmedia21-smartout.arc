SET search_path TO public, extensions;

-- ============================================
-- 20260513000006_oauth_state_cleanup_trigger.sql
-- Billing Engine Fase 3B — B1 Migration G
--
-- Sweeper for billing_integration_oauth_state. Deletes rows that are:
--   - past TTL (expires_at < now()), AND
--   - never consumed (consumed_at IS NULL), AND
--   - older than 1 day (retention guard — keep recent consumed rows
--     for audit, drop old abandoned nonces).
--
-- Also deletes consumed rows older than 7 days so the table does not
-- grow unbounded. Audit queries against OAuth flows typically happen
-- within days, not weeks.
--
-- Runs once a day at 03:00 UTC (low-traffic window). Using pg_cron
-- over a per-row trigger because:
--   - Cleanup is bulk-friendly (single DELETE per cron pass)
--   - No per-row hook overhead on INSERT / UPDATE
--   - Matches the `smartout-dunning-daily` + `smartout-integration-poll-hourly`
--     pattern so devops only needs to look in one place for scheduled
--     jobs.
--
-- Guarded with pg_extension check so local dev without pg_cron does
-- not fail. The Edge Function integration-oauth-callback also does an
-- opportunistic cleanup on every call (delete expired rows before
-- inserting the new nonce) — this cron is the belt to that suspenders.
--
-- Ref: Fase 3B spec §5.
-- ============================================

DO $cmd$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'smartout-oauth-state-cleanup-daily',
      '0 3 * * *',
      $sql$
        DELETE FROM public.billing_integration_oauth_state
        WHERE (consumed_at IS NULL AND expires_at < now() - INTERVAL '1 day')
           OR (consumed_at IS NOT NULL AND consumed_at < now() - INTERVAL '7 days')
      $sql$
    );
  END IF;
END
$cmd$;
