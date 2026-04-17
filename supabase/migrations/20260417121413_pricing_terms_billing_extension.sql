SET search_path TO public, extensions;

-- ============================================
-- 20260417121413_pricing_terms_billing_extension.sql
-- Billing Engine Fase 1 — Task 1.2
-- Extends pricing_terms with 5 columns required by the billing engine.
-- Additive migration — ADR-0027 preserved, ADR-0121 amends it.
-- ============================================

ALTER TABLE public.pricing_terms
  ADD COLUMN free_users               int NOT NULL DEFAULT 10,
  ADD COLUMN overage_price_per_user   decimal(12,2),
  ADD COLUMN delivery_channel         text NOT NULL DEFAULT 'manual'
    CHECK (delivery_channel IN ('manual', 'stripe', 'ehf')),
  ADD COLUMN invoice_format           text NOT NULL DEFAULT 'pdf'
    CHECK (invoice_format IN ('pdf', 'ehf')),
  ADD COLUMN agreement_period         daterange;

COMMENT ON COLUMN public.pricing_terms.free_users IS
  'Number of users included in monthly_cost (default 10).';
COMMENT ON COLUMN public.pricing_terms.overage_price_per_user IS
  'Price per user above free_users threshold. NULL = no overage billing.';
COMMENT ON COLUMN public.pricing_terms.delivery_channel IS
  'Invoice delivery channel. Fase 1: manual only. Fase 2: stripe, ehf.';
COMMENT ON COLUMN public.pricing_terms.invoice_format IS
  'Invoice format: pdf (default) or ehf (XML for e-faktura).';
COMMENT ON COLUMN public.pricing_terms.agreement_period IS
  'Contract duration for display (ADR-0121). Distinct from effective_from/until which govern price validity for computation.';
