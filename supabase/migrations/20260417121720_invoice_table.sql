SET search_path TO public, extensions;

-- ============================================
-- 20260417121720_invoice_table.sql
-- Billing Engine Fase 1 — Task 1.4
-- invoice table + invoice_number_seq + triggers + CHECK constraints.
-- Per spec §5.2. Embodies ADR-0118 (C3 Commercial consumer),
-- ADR-0120 (immutability, continuous numbering, credit note policy).
-- ============================================

-- ── Sequence ─────────────────────────────────────────────────
-- Continuous invoice numbering per bokføringslov §5.
-- Start at 1001 to distinguish from legacy/test data (any four-digit
-- number below 1000 signals non-production data).
CREATE SEQUENCE public.invoice_number_seq START 1001;

-- ── Table ────────────────────────────────────────────────────
CREATE TABLE public.invoice (
  invoice_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number          int UNIQUE,  -- NULL until draft → issued transition (ADR-0120)
  company_id              uuid NOT NULL REFERENCES public.company(company_id),

  invoice_type            invoice_type NOT NULL,
  status                  invoice_status NOT NULL DEFAULT 'draft',
  dunning_status          dunning_status,

  period_from             date NOT NULL,
  period_to               date NOT NULL,
  issued_at               timestamptz,
  due_at                  date,
  sent_at                 timestamptz,
  paid_at                 timestamptz,
  voided_at               timestamptz,

  amount_excl_vat         decimal(12,2) NOT NULL,
  vat_rate                decimal(5,2) NOT NULL DEFAULT 25.00,
  vat_amount              decimal(12,2) NOT NULL,
  amount_incl_vat         decimal(12,2) NOT NULL,
  -- T5: currency inherited from company.default_currency at generation time.
  -- Default 'NOK' here is a fallback for direct inserts (credit notes, tests).
  currency                currency NOT NULL DEFAULT 'NOK',

  payment_date            date,
  payment_reference       text,
  payment_channel         text,

  delivery_channel        text NOT NULL DEFAULT 'manual'
    CHECK (delivery_channel IN ('manual', 'stripe', 'ehf')),
  delivery_status         text,
  external_reference      text,

  voided_by               uuid REFERENCES public.user_identity(user_id),
  void_reason             text,
  credits_invoice_id      uuid REFERENCES public.invoice(invoice_id),

  created_by              uuid REFERENCES public.user_identity(user_id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ── Updated-at trigger ───────────────────────────────────────
CREATE TRIGGER set_invoice_updated_at
  BEFORE UPDATE ON public.invoice
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Invoice-number assignment trigger ────────────────────────
-- Assigns a number from invoice_number_seq on draft → issued transition.
-- Draft invoices keep NULL number; only numbered once they commit to
-- bokføringslov-compliant immutability.
CREATE OR REPLACE FUNCTION public.assign_invoice_number() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'issued' AND NEW.invoice_number IS NULL THEN
    NEW.invoice_number := nextval('public.invoice_number_seq');
    NEW.issued_at := COALESCE(NEW.issued_at, now());
  END IF;
  RETURN NEW;
END;
$$;

-- G4 fix: fire on INSERT for credit notes + onboarding invoices that
-- skip draft state and insert directly as 'issued'.
CREATE TRIGGER trg_invoice_assign_number_insert
  BEFORE INSERT ON public.invoice
  FOR EACH ROW
  WHEN (NEW.status = 'issued' AND NEW.invoice_number IS NULL)
  EXECUTE FUNCTION public.assign_invoice_number();

CREATE TRIGGER trg_invoice_assign_number_update
  BEFORE UPDATE OF status ON public.invoice
  FOR EACH ROW
  WHEN (NEW.status = 'issued' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.assign_invoice_number();

-- ── Credit-note linkage CHECK ────────────────────────────────
-- credit_note MUST have credits_invoice_id; others MUST NOT.
ALTER TABLE public.invoice
  ADD CONSTRAINT invoice_credit_note_linkage
  CHECK (
    (invoice_type = 'credit_note' AND credits_invoice_id IS NOT NULL)
    OR (invoice_type <> 'credit_note' AND credits_invoice_id IS NULL)
  );

-- ── Legal (status × dunning_status) combinations CHECK ───────
-- Per ADR-0120 §5: 7 status × 4 dunning_status = 28 combos; ~8 legal.
ALTER TABLE public.invoice
  ADD CONSTRAINT invoice_status_dunning_legal
  CHECK (
    (status IN ('draft', 'paid', 'void', 'uncollectible') AND dunning_status IS NULL)
    OR (status IN ('issued', 'sent') AND dunning_status IN ('none', 'in_negotiation'))
    OR (status = 'overdue')  -- overdue accepts any dunning_status (including NULL)
  );

-- ── Nested credit-note prevention trigger ────────────────────
-- Cross-row constraint — can't express as CHECK.
CREATE OR REPLACE FUNCTION public.prevent_nested_credit_notes() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_original_type invoice_type;
BEGIN
  IF NEW.credits_invoice_id IS NOT NULL THEN
    SELECT invoice_type INTO v_original_type
    FROM public.invoice
    WHERE invoice_id = NEW.credits_invoice_id;

    IF v_original_type = 'credit_note' THEN
      RAISE EXCEPTION 'Cannot issue credit note against another credit note (invoice_id=%)', NEW.credits_invoice_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoice_prevent_nested_credit_notes
  BEFORE INSERT OR UPDATE OF credits_invoice_id ON public.invoice
  FOR EACH ROW EXECUTE FUNCTION public.prevent_nested_credit_notes();

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_invoice_company ON public.invoice(company_id);
CREATE INDEX idx_invoice_status ON public.invoice(status)
  WHERE status IN ('issued', 'sent', 'overdue');
CREATE INDEX idx_invoice_period ON public.invoice(period_from, period_to);
CREATE INDEX idx_invoice_due_at ON public.invoice(due_at)
  WHERE status IN ('issued', 'sent');

-- C4 fix (council round 3): invoice idempotency. One recurring invoice
-- per (company, period). Prevents double-generation on cron retry
-- after partial failure. Void invoices are excluded so a void+reissue
-- is possible.
CREATE UNIQUE INDEX idx_invoice_one_recurring_per_period
  ON public.invoice(company_id, period_from, period_to)
  WHERE invoice_type = 'recurring' AND status <> 'void';

-- ── Comments ─────────────────────────────────────────────────
COMMENT ON TABLE public.invoice IS
  'Smartout internal fakturamotor. C3 Commercial consumer (ADR-0118). Immutable once issued (ADR-0120). Company-scoped (workspace_id exception documented in ADR-0118).';

COMMENT ON COLUMN public.invoice.invoice_number IS
  'Human-facing display number (ADR-0120 invoice identity contract). NULL until draft -> issued. Never used as an internal FK — use invoice_id.';

COMMENT ON COLUMN public.invoice.credits_invoice_id IS
  'Set on credit_note invoices, points to the invoice being credited. Nested credit notes blocked by trigger.';

COMMENT ON COLUMN public.invoice.due_at IS
  'Payment due date. Dunning age = CURRENT_DATE - due_at (ADR-0120 §7).';
