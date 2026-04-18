SET search_path TO public, extensions;

-- ============================================
-- 20260513000004_integration_poll_payments_engine_process.sql
-- Billing Engine Fase 3B — B1 Migration E
--
-- Seeds the `integration_poll_payments` engine_process blueprint per
-- ADR-0138. This is ontologically distinct from `integration_sync`
-- (Fase 2) because:
--
--   - trigger shape:   sync = event-triggered ('customer created', ...)
--                      poll = cron-triggered ('billing.integration_poll_tick')
--   - direction:       sync = per-entity outbound push
--                      poll = per-integration inbound pull
--   - retry semantics: sync = per-entity retry
--                      poll = per-cycle retry (idempotency on vendor side)
--
-- Action handler `poll_integration_payments` lands in B3 (separate
-- commit/plan). Until then, engine-dispatch returns "Unknown action
-- type" for this step — same staging pattern as Fase 2 B1 used for
-- dispatch_invoice / sync_integration.
--
-- allowed_channels = ['autonomous']: ADR-0078 channel restriction. The
-- poll process runs without human interaction; no user channels apply.
--
-- action_payload.include_types: which adapter types the handler should
-- call pollPayments on. PlaceholderAdapter + Stripe do NOT implement
-- pollPayments (the interface method is optional per B1.4) — only
-- Fiken + Tripletex ship real implementations in B2.
--
-- Retry: 3 attempts with 15-minute backoff. Matches the hourly cadence
-- — within-hour retries are fine; next cron tick is the real guard.
--
-- Ref: Fase 3B spec §4.3, ADR-0138.
-- ============================================

-- ═══════════════════════════════════════════════════════════════
-- engine_process blueprint
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.engine_process (id, name, description, workspace_id, is_active, allowed_channels)
VALUES (
  'integration_poll_payments',
  'Integration Poll Payments',
  'Fase 3B Spor D: hourly inbound-poll of payments from Fiken/Tripletex. Matches vendor payments against Smartout invoices and auto mark-paid via Fase 3A reconcileInvoiceOnPayment. Idempotent via payment_external_id_company_unique. Handler action_type=poll_integration_payments lands in B3. See ADR-0138.',
  NULL,
  true,
  ARRAY['autonomous']::TEXT[]
)
ON CONFLICT (id) DO UPDATE SET
  description      = EXCLUDED.description,
  is_active        = EXCLUDED.is_active,
  allowed_channels = EXCLUDED.allowed_channels;

-- ═══════════════════════════════════════════════════════════════
-- engine_step — single step. Handler fans out over enabled
-- integrations whose type is in include_types.
-- ═══════════════════════════════════════════════════════════════
INSERT INTO public.engine_step
  (process_id, step_order, step_group, action_type, action_payload, assignee_rule)
VALUES
  (
    'integration_poll_payments', 1, NULL, 'poll_integration_payments',
    jsonb_build_object(
      'description', 'For each enabled integration (integration_type IN include_types, is_placeholder=false), call adapter.pollPayments(since=integration.last_poll_at). Match returned payments against Smartout invoices and auto mark-paid.',
      'include_types', jsonb_build_array('fiken', 'tripletex'),
      'retry', jsonb_build_object(
        'max_attempts',    3,
        'backoff_seconds', jsonb_build_array(900, 900, 900)
      )
    ),
    NULL
  )
ON CONFLICT (process_id, step_order) DO UPDATE SET
  action_payload = EXCLUDED.action_payload;

-- ═══════════════════════════════════════════════════════════════
-- engine_trigger — billing.integration_poll_tick → integration_poll_payments
-- ═══════════════════════════════════════════════════════════════
-- Platform-scoped trigger: NULL workspace_id so the hourly pg_cron
-- event (Migration F) spawns the process globally. The handler
-- iterates all workspaces' enabled integrations — no per-workspace
-- trigger fan-out needed.
--
-- Event name uses SPACE separator per telemetry convention. Fase 2
-- CHECK on billing_dispatch_rule.trigger_event forbids '.' separators;
-- the same convention extends to engine_trigger.event_type for billing
-- triggers.
INSERT INTO public.engine_trigger (event_type, process_id, workspace_id, is_active, delay_seconds)
SELECT 'billing integration_poll_tick', 'integration_poll_payments', NULL::uuid, true, 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.engine_trigger t
  WHERE t.event_type = 'billing integration_poll_tick'
    AND t.process_id = 'integration_poll_payments'
    AND t.workspace_id IS NULL
);

-- ═══════════════════════════════════════════════════════════════
-- Comments
-- ═══════════════════════════════════════════════════════════════
COMMENT ON COLUMN public.engine_step.action_payload IS
  'Action-specific payload. poll_integration_payments reads include_types (array of integration_type values whose adapters implement pollPayments) and retry config. See integration_poll_payments blueprint (ADR-0138).';
