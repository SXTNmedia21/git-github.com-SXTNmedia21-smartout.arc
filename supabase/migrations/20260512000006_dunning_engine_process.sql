SET search_path TO public, extensions;

-- ============================================
-- 20260512000006_dunning_engine_process.sql
-- Billing Engine Fase 3A — B1 Migration G
--
-- Seeds the dunning_escalation_scan engine_process blueprint + its
-- engine_trigger mapping. Per ADR-0143, automatic dunning lives inside the
-- Smartout engine_process runtime, not n8n — a second workflow engine
-- would break the CLAUDE.md "no second event system" rule and fragment
-- idempotency/RLS/telemetry.
--
-- Trigger flow (written here):
--   pg_cron (Migration I) inserts engine_event 'dunning_daily_tick'
--     → engine_trigger matches → engine_state spawned
--       → engine-dispatch Edge Function resolves step 1
--         → action_type='scan_overdue_invoices' handler (B4, not yet
--           implemented — this migration only wires blueprint + trigger)
--
-- Until the handler lands, engine-dispatch returns "Unknown action type"
-- for this step. That's the intended behaviour per the Fase 2 precedent
-- (spec §13 staging — blueprint wire-up predates handler code).
--
-- allowed_channels = ['autonomous']: ADR-0078 channel restriction. Dunning
-- runs without human interaction; the handler dispatches via the existing
-- email_customer channel at the INVOICE_DISPATCH level, not at the
-- engine_step level. The 'autonomous' channel flag here governs the
-- engine_process's own authority layer.
--
-- Escalation stages config (action_payload):
--   - issued/sent → reminder_1         at 3 days overdue
--   - reminder_1  → reminder_2         at 7 days overdue
--   - reminder_2  → collection_notice  at 14 days overdue
--
-- Retry: max 3 attempts, backoff 5m / 15m / 1h. Matches the cadence of a
-- daily-scheduled job (retries within the same day are fine; next day's
-- tick is the real guard).
--
-- Ref: Fase 3A spec §4.2, ADR-0143.
-- ============================================

-- ═══════════════════════════════════════════════════════════════
-- engine_process blueprint
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.engine_process (id, name, description, workspace_id, is_active, allowed_channels)
VALUES (
  'dunning_escalation_scan',
  'Dunning Escalation Scan',
  'Fase 3A Spor C: daily scan of overdue invoices. Advances invoice.dunning_status per stage config and enqueues invoice_dispatch rows for customer emails. Idempotent via dunning_escalation_log UNIQUE(invoice_id, to_stage). Handler action_type=scan_overdue_invoices lands in B4.',
  NULL,
  true,
  ARRAY['autonomous']::TEXT[]
)
ON CONFLICT (id) DO UPDATE SET
  description      = EXCLUDED.description,
  is_active        = EXCLUDED.is_active,
  allowed_channels = EXCLUDED.allowed_channels;

-- ═══════════════════════════════════════════════════════════════
-- engine_step — single step with stages config in action_payload
-- ═══════════════════════════════════════════════════════════════
-- Stages list read by the scan_overdue_invoices handler (B4). Days = days
-- past invoice.due_at. from=NULL matches rows still at the initial dunning
-- state (not yet escalated).
INSERT INTO public.engine_step
  (process_id, step_order, step_group, action_type, action_payload, assignee_rule)
VALUES
  (
    'dunning_escalation_scan', 1, NULL, 'scan_overdue_invoices',
    jsonb_build_object(
      'description', 'Walk each stage and escalate any invoice that crossed the boundary. Idempotent via dunning_escalation_log UNIQUE(invoice_id, to_stage).',
      'stages', jsonb_build_array(
        jsonb_build_object('days', 3,  'from', NULL,          'to', 'reminder_1'),
        jsonb_build_object('days', 7,  'from', 'reminder_1',  'to', 'reminder_2'),
        jsonb_build_object('days', 14, 'from', 'reminder_2',  'to', 'collection_notice')
      ),
      'retry', jsonb_build_object(
        'max_attempts',    3,
        'backoff_seconds', jsonb_build_array(300, 900, 3600)
      )
    ),
    NULL
  )
ON CONFLICT (process_id, step_order) DO UPDATE SET
  action_payload = EXCLUDED.action_payload;

-- ═══════════════════════════════════════════════════════════════
-- engine_trigger — dunning_daily_tick → dunning_escalation_scan
-- ═══════════════════════════════════════════════════════════════
-- Platform-scoped trigger: NULL workspace_id so the daily pg_cron event
-- (Migration I) spawns the process globally. The handler iterates ALL
-- workspaces' overdue invoices; no per-workspace trigger fan-out needed.
INSERT INTO public.engine_trigger (event_type, process_id, workspace_id, is_active, delay_seconds)
SELECT 'dunning_daily_tick', 'dunning_escalation_scan', NULL::uuid, true, 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.engine_trigger t
  WHERE t.event_type = 'dunning_daily_tick'
    AND t.process_id = 'dunning_escalation_scan'
    AND t.workspace_id IS NULL
);

-- ═══════════════════════════════════════════════════════════════
-- Comments
-- ═══════════════════════════════════════════════════════════════
COMMENT ON COLUMN public.engine_step.action_payload IS
  'Action-specific payload. scan_overdue_invoices reads stages (ordered list of {days, from, to}) and retry config (max_attempts, backoff_seconds). See dunning_escalation_scan blueprint.';
