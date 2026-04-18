SET search_path TO public, extensions;

-- ============================================
-- 20260511200003_invoice_dispatch_table.sql
-- Billing Engine Fase 2 — B1 Migration D
--
-- Runtime per-channel dispatch state. One row per (invoice, channel, target)
-- — the source of truth for "did this invoice reach its recipients?". Per
-- ADR-0128 this replaces the legacy invoice.delivery_* columns during dual-
-- write (B2) and is the only reader after B3.
--
-- Orchestrated by engine_process 'invoice_dispatch_delivery' (seeded in
-- Migration I). engine_state_id links back to the workflow instance that
-- owns retry/backoff.
--
-- Ref: Fase 2 spec §3.2, ADR-0126 (engine-orchestrated), ADR-0128 (dual-write).
-- ============================================

CREATE TABLE public.invoice_dispatch (
  invoice_dispatch_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id            uuid NOT NULL REFERENCES public.invoice(invoice_id),
  -- NULL for ad-hoc dispatches ("Send på nytt" from UI without attaching a rule).
  dispatch_rule_id      uuid REFERENCES public.billing_dispatch_rule(dispatch_rule_id),

  channel               billing_dispatch_channel NOT NULL,
  -- Snapshot of target jsonb at dispatch-time (preserves WHO the invoice
  -- was actually sent to even if the rule later changes).
  target                jsonb NOT NULL,

  status                dispatch_status NOT NULL DEFAULT 'pending',

  -- FK to the engine_state that orchestrates this dispatch (retry, backoff,
  -- audit). NULL until engine_process starts the instance.
  engine_state_id       uuid REFERENCES public.engine_state(id),

  -- Synchronised with engine_state.retry_count but denormalised for fast
  -- retry-scan queries without joining engine_state.
  attempts              integer NOT NULL DEFAULT 0,
  last_attempt_at       timestamptz,
  delivered_at          timestamptz,

  error_code            text,
  error_message         text,

  -- SendGrid message_id, Fiken response ID, etc. — set on success/failure.
  external_reference    text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── Updated-at trigger ───────────────────────────────────────
CREATE TRIGGER set_invoice_dispatch_updated_at
  BEFORE UPDATE ON public.invoice_dispatch
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Indexes ──────────────────────────────────────────────────
-- Fast lookup of all dispatches for an invoice (admin UI, AI-tool).
CREATE INDEX idx_invoice_dispatch_invoice
  ON public.invoice_dispatch(invoice_id);

-- Partial index for retry-scan per spec §3.2: cheap scan over only the
-- dispatches that need engine attention (pending + in_flight).
CREATE INDEX idx_invoice_dispatch_retry
  ON public.invoice_dispatch(status)
  WHERE status IN ('pending', 'in_flight');

-- Engine instance backpointer (debug/admin traversal).
CREATE INDEX idx_invoice_dispatch_engine_state
  ON public.invoice_dispatch(engine_state_id)
  WHERE engine_state_id IS NOT NULL;

-- ── Comments ─────────────────────────────────────────────────
COMMENT ON TABLE public.invoice_dispatch IS
  'Per-channel dispatch state per invoice. Source of truth for delivery (ADR-0128). Orchestrated by engine_process invoice_dispatch_delivery (ADR-0126).';

COMMENT ON COLUMN public.invoice_dispatch.target IS
  'Snapshot of dispatch_rule.target at dispatch time. Preserves audit: who the invoice actually went to, even if rule changes later.';

COMMENT ON COLUMN public.invoice_dispatch.engine_state_id IS
  'FK to engine_state. NULL until the dispatch_invoice action starts. retry_count lives on engine_state; attempts is a denormalised mirror.';

COMMENT ON COLUMN public.invoice_dispatch.external_reference IS
  'Adapter-returned identifier (SendGrid message_id, Fiken response ID, etc.). NULL for pending/in_flight.';
