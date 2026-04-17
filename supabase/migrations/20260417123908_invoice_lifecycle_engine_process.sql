SET search_path TO public, extensions;

-- ============================================
-- 20260417123908_invoice_lifecycle_engine_process.sql
-- Billing Engine Fase 1 — Task 1.10
--
-- Seeds the invoice_lifecycle engine_process blueprint.
-- Two-table pattern (engine_process + engine_step) matches
-- 20260304300000_seed_daily_close_process.sql — NOT the plan's original
-- single-row jsonb "definition" shape, which didn't match the real schema
-- (ADR-0122 drift resolution).
--
-- Event names use space-separator per telemetry convention (not dots)
-- so engine_dispatch matches literal emit() event strings.
--
-- Fase 1: engine observes lifecycle transitions.
-- Fase 2: will add payment webhook handlers + dunning escalation steps.
-- ============================================

-- ── Blueprint row ────────────────────────────────────────────
-- workspace_id = NULL marks a platform-scoped (global) blueprint.
-- Every customer invoice's engine_state instance references this single
-- blueprint row.
INSERT INTO public.engine_process (id, name, description, workspace_id, is_active) VALUES
(
  'invoice_lifecycle',
  'Invoice Lifecycle',
  'Fase 1: tracks invoice draft -> issued -> paid|voided|overdue. Fase 2 wires payment webhooks + dunning escalation.',
  NULL,
  true
)
ON CONFLICT (id) DO NOTHING;

-- ── Steps ────────────────────────────────────────────────────
-- 1. Wait for the invoice to be issued (draft -> issued).
-- 2. Wait for a terminal settlement event: marked_paid | voided | overdue_detected.
INSERT INTO public.engine_step
  (process_id, step_order, step_group, action_type, action_payload, assignee_rule)
VALUES
  ('invoice_lifecycle', 1, NULL, 'wait_for_event',
    '{"event": "invoice issued"}'::jsonb, NULL),
  ('invoice_lifecycle', 2, NULL, 'wait_for_event',
    '{"events": ["invoice marked_paid", "invoice voided", "invoice overdue_detected"]}'::jsonb, NULL)
ON CONFLICT (process_id, step_order) DO NOTHING;
