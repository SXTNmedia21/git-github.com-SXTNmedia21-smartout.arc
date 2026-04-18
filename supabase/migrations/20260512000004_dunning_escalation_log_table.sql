SET search_path TO public, extensions;

-- ============================================
-- 20260512000004_dunning_escalation_log_table.sql
-- Billing Engine Fase 3A — B1 Migration E
--
-- dunning_escalation_log is the idempotency + audit layer for the
-- automatic dunning engine_process. Each row = "this invoice crossed
-- this escalation boundary". Stages in Fase 3A:
--   reminder_1   — +3 days overdue
--   reminder_2   — +7 days overdue
--   collection_notice — +14 days overdue
--
-- UNIQUE(invoice_id, to_stage) is the idempotency contract: the
-- scan_overdue_invoices action handler INSERT ... ON CONFLICT DO NOTHING
-- lets the daily cron run harmlessly re-attempt transitions already
-- recorded.
--
-- bigserial PK: append-heavy audit table, no natural composite key
-- warrants uuid overhead.
--
-- Ref: Fase 3A spec §3.2 + §4, ADR-0143.
-- ============================================

CREATE TABLE public.dunning_escalation_log (
  log_id         bigserial PRIMARY KEY,
  invoice_id     uuid NOT NULL REFERENCES public.invoice(invoice_id),

  -- NULL on the first escalation (issued → reminder_1).
  from_stage     text,

  -- reminder_1 | reminder_2 | collection_notice. Not enum-typed so new
  -- stages can be added by engine_process action_payload without a
  -- schema migration; validation lives in the handler + pgTAP.
  to_stage       text NOT NULL,

  escalated_at   timestamptz NOT NULL DEFAULT now(),

  -- Idempotency contract. Matches the scan_overdue_invoices handler's
  -- INSERT ... ON CONFLICT DO NOTHING behaviour.
  CONSTRAINT dunning_escalation_log_invoice_stage_unique
    UNIQUE (invoice_id, to_stage)
);

-- No updated_at trigger: append-only audit records.

-- ── Indexes ──────────────────────────────────────────────────
-- Hot path: history per invoice (platform-admin + workspace-admin drawer).
CREATE INDEX idx_dunning_escalation_log_invoice
  ON public.dunning_escalation_log(invoice_id);

-- Reporting path: recent escalations per stage.
CREATE INDEX idx_dunning_escalation_log_stage_date
  ON public.dunning_escalation_log(to_stage, escalated_at DESC);

-- ── Comments ─────────────────────────────────────────────────
COMMENT ON TABLE public.dunning_escalation_log IS
  'ADR-0143 idempotency + audit for automatic dunning. UNIQUE(invoice_id, to_stage) makes the daily engine_process action_type=scan_overdue_invoices safely re-runnable.';

COMMENT ON CONSTRAINT dunning_escalation_log_invoice_stage_unique ON public.dunning_escalation_log IS
  'Idempotency contract for scan_overdue_invoices handler. ON CONFLICT DO NOTHING pattern in the handler relies on this constraint.';
