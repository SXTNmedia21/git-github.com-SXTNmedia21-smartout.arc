-- Migration: pricing_terms table + default_pricing on contract_template
-- Purpose: Store workspace pricing terms (onboarding, monthly, per-employee)
--          driven by real contract patterns (e.g. Spatind agreement).
-- ADR: 0027

-- ============================================================================
-- 1. Pricing Terms Table (platform-admin, no RLS, service role only)
-- ============================================================================
CREATE TABLE public.pricing_terms (
  pricing_terms_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           uuid NOT NULL REFERENCES public.company(company_id),
  workspace_id         uuid REFERENCES public.workspace(workspace_id),
  contract_id          uuid REFERENCES public.contract(contract_id),

  -- Pricing
  monthly_cost         decimal(12,2),
  price_per_employee   decimal(12,2) NOT NULL,
  currency             currency NOT NULL DEFAULT 'NOK',
  billing_interval     text NOT NULL DEFAULT 'monthly'
    CHECK (billing_interval IN ('monthly', 'quarterly', 'yearly')),

  -- Onboarding
  onboarding_package   text
    CHECK (onboarding_package IN ('small', 'medium', 'large', 'enterprise', 'custom')),
  onboarding_cost      decimal(12,2),

  -- Discount & trial
  discount_percent     decimal(5,2)
    CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)),
  discount_label       text,
  trial_days           integer
    CHECK (trial_days IS NULL OR trial_days >= 0),

  -- Validity
  effective_from       date NOT NULL,
  effective_until      date,
  notes                text,

  -- Audit
  created_by           uuid REFERENCES public.user_identity(user_id),
  created_at           timestamptz DEFAULT now() NOT NULL,
  updated_at           timestamptz DEFAULT now() NOT NULL
);

-- Trigger: auto-set updated_at
CREATE TRIGGER set_pricing_terms_updated_at
  BEFORE UPDATE ON public.pricing_terms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX idx_pricing_terms_company ON public.pricing_terms(company_id);
CREATE INDEX idx_pricing_terms_workspace ON public.pricing_terms(workspace_id);
CREATE INDEX idx_pricing_terms_contract ON public.pricing_terms(contract_id);
CREATE INDEX idx_pricing_terms_active ON public.pricing_terms(company_id, effective_from)
  WHERE effective_until IS NULL;

COMMENT ON TABLE public.pricing_terms IS
  'Platform-admin pricing terms per workspace. No RLS — service role only.';

-- ============================================================================
-- 2. Add default_pricing JSONB to contract_template
-- ============================================================================
ALTER TABLE public.contract_template
  ADD COLUMN IF NOT EXISTS default_pricing jsonb;

COMMENT ON COLUMN public.contract_template.default_pricing IS
  'Optional default pricing that pre-fills when this template is selected.
   Shape: { monthly_cost, price_per_employee, billing_interval, onboarding_package,
            onboarding_cost, discount_percent, discount_label, trial_days }';
