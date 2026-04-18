SET search_path TO public, extensions;

-- ============================================
-- 20260513000005_pg_cron_integration_poll.sql
-- Billing Engine Fase 3B — B1 Migration F
--
-- Registers a pg_cron job that fires the `billing integration_poll_tick`
-- event every hour on the hour. The event spawns
-- integration_poll_payments (Migration E) via the engine_trigger wired
-- in that migration.
--
-- The cron body is a direct INSERT INTO engine_event — matches the
-- pattern from 20260512000008_pg_cron_dunning_tick.sql. The existing
-- engine_event → engine_state spawn pipeline handles the rest.
--
-- Idempotency:
--   - idempotency_key = 'integration_poll_tick_YYYY-MM-DD_HH' makes a
--     same-hour re-run a no-op via engine_event's partial unique index
--     on idempotency_key WHERE idempotency_key IS NOT NULL.
--   - payment_external_id_company_unique (Migration B) guards the
--     downstream handler against double-insert of the same vendor
--     payment.
--
-- Guarded with pg_extension check so local dev without pg_cron does
-- not fail the migration (same precedent as dunning tick).
--
-- Schedule: hourly at minute 0. Earlier-hour crons run while the
-- overnight batch is idle, and hourly cadence is frequent enough that
-- "auto mark-paid" feels immediate to workspace users.
--
-- Ref: Fase 3B spec §4.3, ADR-0138.
-- ============================================

DO $cmd$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'smartout-integration-poll-hourly',
      '0 * * * *',
      $sql$
        INSERT INTO public.engine_event (event_type, workspace_id, payload, idempotency_key)
        VALUES (
          'billing integration_poll_tick',
          NULL,
          jsonb_build_object(
            'tick_hour', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24')
          ),
          'integration_poll_tick_' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD_HH24')
        )
        ON CONFLICT (idempotency_key) DO NOTHING
      $sql$
    );
  END IF;
END
$cmd$;
