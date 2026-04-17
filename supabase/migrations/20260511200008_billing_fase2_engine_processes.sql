SET search_path TO public, extensions;

-- ============================================
-- 20260511200008_billing_fase2_engine_processes.sql
-- Billing Engine Fase 2 — B1 Migration I
--
-- Seeds the two engine_process blueprints for Fase 2 Spor A + B plus the
-- engine_trigger rows that fan events out to them.
--
-- Action-type handlers (dispatch_invoice, sync_integration) are implemented
-- in B2/B4 in supabase/functions/engine-dispatch/index.ts. This migration
-- only wires the blueprints + triggers — dispatch of unknown action types
-- raises an explicit "Unknown action type" error in the current handler,
-- which is the intended behaviour until B2 ships.
--
-- Event names use space-separator per telemetry convention.
--
-- Ref: Fase 2 spec §3.4 + §4.4, ADR-0126.
-- ============================================

-- ═══════════════════════════════════════════════════════════════
-- invoice_dispatch_delivery (Spor A)
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.engine_process (id, name, description, workspace_id, is_active)
VALUES (
  'invoice_dispatch_delivery',
  'Invoice Dispatch Delivery',
  'Fase 2 Spor A: per-channel invoice dispatch with retry/backoff. Triggered by "invoice issued" + "invoice dispatch retry_requested". Action handler dispatch_invoice lands in B2.',
  NULL,  -- platform-scoped blueprint
  true
)
ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  is_active   = EXCLUDED.is_active;

-- Steps. Single dispatch_invoice action with retry_config in action_payload
-- so the B2 action-handler can read backoff schedule + max_retries without
-- a separate table. Matches the pattern used by existing contract processes.
INSERT INTO public.engine_step
  (process_id, step_order, step_group, action_type, action_payload, assignee_rule)
VALUES
  (
    'invoice_dispatch_delivery', 1, NULL, 'dispatch_invoice',
    jsonb_build_object(
      'description', 'Send invoice through configured channel. Retries with exponential backoff.',
      'retry', jsonb_build_object(
        'max_attempts', 5,
        'backoff_seconds', jsonb_build_array(60, 300, 900, 3600, 21600)
      )
    ),
    NULL
  )
ON CONFLICT (process_id, step_order) DO UPDATE SET
  action_payload = EXCLUDED.action_payload;

-- Trigger rows: map canonical events to the blueprint. engine_trigger is
-- workspace-scoped but NULL workspace_id means the trigger applies to any
-- workspace (same pattern as engine_process). Idempotent via explicit
-- existence check (engine_trigger has no unique constraint we can target).
INSERT INTO public.engine_trigger (event_type, process_id, workspace_id, is_active, delay_seconds)
SELECT v.event_type, v.process_id, NULL::uuid, true, 0
FROM (VALUES
  ('invoice issued',                  'invoice_dispatch_delivery'),
  ('invoice dispatch retry_requested','invoice_dispatch_delivery')
) AS v(event_type, process_id)
WHERE NOT EXISTS (
  SELECT 1 FROM public.engine_trigger t
  WHERE t.event_type = v.event_type
    AND t.process_id = v.process_id
    AND t.workspace_id IS NULL
);

-- ═══════════════════════════════════════════════════════════════
-- integration_sync (Spor B)
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.engine_process (id, name, description, workspace_id, is_active)
VALUES (
  'integration_sync',
  'Integration Sync',
  'Fase 2 Spor B: outbound sync to billing_integration targets. Triggered by lifecycle events for customers, contracts, invoices. Action handler sync_integration lands in B2/B4.',
  NULL,
  true
)
ON CONFLICT (id) DO UPDATE SET
  description = EXCLUDED.description,
  is_active   = EXCLUDED.is_active;

INSERT INTO public.engine_step
  (process_id, step_order, step_group, action_type, action_payload, assignee_rule)
VALUES
  (
    'integration_sync', 1, NULL, 'sync_integration',
    jsonb_build_object(
      'description', 'Fan out to all enabled billing_integration rows matching the event. Retries with exponential backoff.',
      'retry', jsonb_build_object(
        'max_attempts', 5,
        'backoff_seconds', jsonb_build_array(60, 300, 900, 3600, 21600)
      )
    ),
    NULL
  )
ON CONFLICT (process_id, step_order) DO UPDATE SET
  action_payload = EXCLUDED.action_payload;

-- Trigger rows. All events use space-separator per telemetry convention.
-- "customer created" and "contract signed"/"contract terminated" are NOT
-- guaranteed to exist in the registry yet (Fase 2 adds them); if emit()
-- later registers any of these, existing triggers will fire correctly.
INSERT INTO public.engine_trigger (event_type, process_id, workspace_id, is_active, delay_seconds)
SELECT v.event_type, v.process_id, NULL::uuid, true, 0
FROM (VALUES
  ('customer created',   'integration_sync'),
  ('invoice generated',  'integration_sync'),
  ('invoice issued',     'integration_sync'),
  ('contract signed',    'integration_sync'),
  ('contract terminated','integration_sync')
) AS v(event_type, process_id)
WHERE NOT EXISTS (
  SELECT 1 FROM public.engine_trigger t
  WHERE t.event_type = v.event_type
    AND t.process_id = v.process_id
    AND t.workspace_id IS NULL
);

-- ═══════════════════════════════════════════════════════════════
-- Comments
-- ═══════════════════════════════════════════════════════════════
COMMENT ON COLUMN public.engine_step.action_payload IS
  'Action-specific payload. For retry-capable actions (dispatch_invoice, sync_integration) includes nested retry.max_attempts + retry.backoff_seconds array, read by the action-handler to schedule engine_delayed_trigger rows.';
