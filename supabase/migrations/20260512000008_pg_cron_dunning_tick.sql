SET search_path TO public, extensions;

-- ============================================
-- 20260512000008_pg_cron_dunning_tick.sql
-- Billing Engine Fase 3A — B1 Migration I
--
-- Registers a pg_cron job that fires the dunning_daily_tick event every
-- day at 07:00 UTC (≈ 08:00–09:00 Europe/Oslo depending on DST). The
-- event spawns dunning_escalation_scan (Migration G) via the
-- engine_trigger wired in that migration.
--
-- The cron body is a direct INSERT INTO engine_event rather than an
-- Edge Function call — the engine_trigger machinery picks up the row
-- and the existing engine_event → engine_state spawn pipeline does the
-- rest.
--
-- Idempotency:
--   - idempotency_key = 'dunning_daily_tick_YYYY-MM-DD' makes a same-day
--     re-run a no-op via engine_event's partial unique index on
--     idempotency_key WHERE idempotency_key IS NOT NULL.
--   - dunning_escalation_log UNIQUE(invoice_id, to_stage) guards the
--     downstream handler against double-escalation.
--
-- Guarded with pg_extension check so local dev without pg_cron does not
-- fail the migration.
--
-- Ref: Fase 3A spec §4.2, ADR-0143.
-- ============================================

DO $cmd$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'smartout-dunning-daily',
      '0 7 * * *',
      $sql$
        INSERT INTO public.engine_event (event_type, workspace_id, payload, idempotency_key)
        VALUES (
          'dunning_daily_tick',
          NULL,
          jsonb_build_object('tick_date', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')),
          'dunning_daily_tick_' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')
        )
        ON CONFLICT (idempotency_key) DO NOTHING
      $sql$
    );
  END IF;
END
$cmd$;
