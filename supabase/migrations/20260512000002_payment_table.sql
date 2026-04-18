SET search_path TO public, extensions;

-- ============================================
-- 20260512000002_payment_table.sql
-- Billing Engine Fase 3A — B1 Migration C
--
-- The payment table is the C3 Commercial record of a single settlement
-- attempt against an invoice. Stripe webhooks drive most rows (status
-- transitions on payment_intent.* events); platform-admin "bank_transfer"
-- + "manual_adjustment" flows write rows directly.
--
-- invoice.status stays the authority: a payment row succeeding bumps the
-- parent invoice to 'paid' only via the stripe-webhook handler's guarded
-- UPDATE (spec §3.4), never via a trigger from here.
--
-- company_id is a SNAPSHOT from invoice.company_id at creation time so
-- the payment audit trail is stable even if an invoice is ever re-
-- assigned (it should not be, but defensive).
--
-- Ref: Fase 3A spec §3.2, ADR-0131, ADR-0142.
-- ============================================

CREATE TABLE public.payment (
  payment_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       uuid NOT NULL REFERENCES public.invoice(invoice_id),
  company_id       uuid NOT NULL REFERENCES public.company(company_id),
  payment_method   payment_method_type NOT NULL,
  amount           decimal(12,2) NOT NULL CHECK (amount > 0),
  currency         currency NOT NULL,
  status           payment_status NOT NULL DEFAULT 'pending',

  -- Stripe PaymentIntent id (pi_*). NULL for bank_transfer + manual_adjustment.
  external_id      text,

  -- Set by stripe-webhook on payment_intent.succeeded (event.created) or by
  -- platform-admin at mark-paid time for manual rows.
  paid_at          timestamptz,

  -- Aggregate refunded amount across charge.refunded events. NULL until first
  -- refund; stays <= amount.
  refunded_amount  decimal(12,2) CHECK (refunded_amount IS NULL OR refunded_amount >= 0),

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- refunded_amount logically gated to the settled state. Partial refunds
  -- land at 'partially_refunded'; full refund transitions to 'refunded'.
  CONSTRAINT payment_refund_status_coherent CHECK (
    (refunded_amount IS NULL)
    OR (status IN ('refunded', 'partially_refunded'))
  ),

  -- refunded_amount can never exceed the original amount.
  CONSTRAINT payment_refund_amount_bounded CHECK (
    refunded_amount IS NULL OR refunded_amount <= amount
  )
);

-- ── Updated-at trigger ───────────────────────────────────────
CREATE TRIGGER set_payment_updated_at
  BEFORE UPDATE ON public.payment
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Indexes ──────────────────────────────────────────────────
-- Hot path: show payments for an invoice.
CREATE INDEX idx_payment_invoice
  ON public.payment(invoice_id);

-- Dashboard: recent payments per company (platform-admin /billing/payments).
CREATE INDEX idx_payment_company_created
  ON public.payment(company_id, created_at DESC);

-- Webhook idempotency path: find the payment by Stripe PaymentIntent id
-- during payment_intent.* event handling. Partial unique index avoids
-- colliding with rows where external_id IS NULL (manual_adjustment).
CREATE UNIQUE INDEX idx_payment_external_id_unique
  ON public.payment(external_id)
  WHERE external_id IS NOT NULL;

-- ── Comments ─────────────────────────────────────────────────
COMMENT ON TABLE public.payment IS
  'C3 Commercial. Single settlement attempt against an invoice. Stripe-driven for stripe_* methods; platform-admin-written for bank_transfer / manual_adjustment. invoice.status owns the parent invoice lifecycle — payment does not trigger invoice updates directly.';

COMMENT ON COLUMN public.payment.external_id IS
  'Stripe PaymentIntent id (pi_*). UNIQUE partial index enforces webhook idempotency. NULL for non-Stripe methods.';

COMMENT ON COLUMN public.payment.company_id IS
  'Snapshot of invoice.company_id at payment creation. Stable even if invoice is ever re-parented (defensive).';

COMMENT ON COLUMN public.payment.refunded_amount IS
  'Aggregate across charge.refunded events. <= amount. Combined with status to disambiguate refunded (full) vs partially_refunded.';
