SET search_path TO public, extensions;

-- ============================================
-- 20260621200002_fn_check_billing_run.sql
-- feat/billing-cron-correctness — R1 Missing-run watchdog
--
-- fn_check_billing_run() detects companies that should have been
-- billed for the previous calendar month but have no non-void
-- recurring invoice for that period. For each missing company it
-- inserts a billing_activity_log row (event = 'invoice generation_missing')
-- so operators can audit and re-trigger generation.
--
-- Scheduled via pg_cron to run on day 7 of each month at 06:00 UTC —
-- enough lag for the generation cron (day 1–2) to have completed plus
-- a catch-up window. Guards with pg_extension check so local dev
-- without pg_cron does not fail the migration.
--
-- ADR-0125: billing_activity_log is platform-scoped. SECURITY DEFINER
-- function inserts directly — no workspace_id, actor_user_id=NULL for
-- cron writers.
-- ============================================

CREATE OR REPLACE FUNCTION public.fn_check_billing_run()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_from date;
  v_period_to   date;
  v_company     record;
  v_count       integer := 0;
BEGIN
  -- Previous calendar month (UTC)
  v_period_from := date_trunc('month', now() AT TIME ZONE 'UTC' - INTERVAL '1 month')::date;
  v_period_to   := (date_trunc('month', now() AT TIME ZONE 'UTC') - INTERVAL '1 day')::date;

  -- For each company that has at least one workspace with contract_status='active'
  -- and has NO non-void recurring invoice for the previous-month period.
  FOR v_company IN
    SELECT DISTINCT c.company_id
    FROM public.company c
    JOIN public.workspace w ON w.company_id = c.company_id
    WHERE w.contract_status = 'active'
      AND NOT EXISTS (
        SELECT 1
        FROM public.invoice i
        WHERE i.company_id = c.company_id
          AND i.invoice_type = 'recurring'
          AND i.period_from  = v_period_from
          AND i.period_to    = v_period_to
          AND i.status <> 'void'
      )
  LOOP
    INSERT INTO public.billing_activity_log (
      company_id,
      invoice_id,
      event,
      entity_type,
      entity_id,
      data,
      changes,
      actor_user_id,
      source
    ) VALUES (
      v_company.company_id,
      NULL,                             -- no invoice row yet; that is the problem
      'invoice generation_missing',
      'company',
      v_company.company_id,
      jsonb_build_object(
        'company_id',   v_company.company_id,
        'period_from',  v_period_from::text,
        'period_to',    v_period_to::text,
        'detected_at',  now()
      ),
      '{}'::jsonb,
      NULL,                             -- cron writer, no user_identity
      'cron'
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.fn_check_billing_run() IS
  'Watchdog: detects companies with contract_status=''active'' that have no non-void recurring invoice '
  'for the previous calendar month. Inserts billing_activity_log event ''invoice generation_missing'' '
  'for each missing company so operators can audit and re-trigger generation. '
  'Returns count of missing companies. Runs via pg_cron on day 7 at 06:00 UTC. '
  'SECURITY DEFINER — inserts into billing_activity_log directly (ADR-0125, platform-scoped). '
  'feat/billing-cron-correctness R1, 2026-05-20.';

-- ── pg_cron schedule ─────────────────────────────────────────────────
-- Day 7 of each month at 06:00 UTC. Guarded: local dev may lack pg_cron.
-- Unschedule-if-exists guard prevents duplicate job on re-run.
DO $cmd$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove any prior version of this job so re-running migration is idempotent.
    PERFORM cron.unschedule('check-billing-run')
    FROM cron.job
    WHERE jobname = 'check-billing-run';

    PERFORM cron.schedule(
      'check-billing-run',
      '0 6 7 * *',
      $$SELECT public.fn_check_billing_run();$$
    );
  END IF;
END
$cmd$;
