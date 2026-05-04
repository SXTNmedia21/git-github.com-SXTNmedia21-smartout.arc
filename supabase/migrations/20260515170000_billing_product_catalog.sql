SET search_path TO public, extensions;

-- ============================================
-- 20260515170000_billing_product_catalog.sql
-- Platform-level product catalog for ad-hoc invoice line items.
--
-- Why:
--   Platform-admin creates ad-hoc invoices (startup fees, consulting,
--   custom agreements) via the Sheet drawer. Today every line is free
--   text + re-typed each time. This table lets admins pick from a set
--   of pre-registered products to fill description/unit_price/vat_rate.
--
--   workspace_id is nullable so a workspace-specific override can be
--   added later (the same pattern as pricing_terms). For now the seed
--   is platform-wide (workspace_id NULL = platform preset).
--
--   RLS: read gated on super-admin identity (is_godmode = true) via the
--   existing platform-admin identity check. Writes happen through the admin
--   client which bypasses RLS (service_role) — matches the godmode RLS
--   pattern used by billing_integration. (pricing_terms uses an older
--   service-role-only pattern with RLS disabled; this table uses the modern
--   godmode-policy pattern instead.)
-- ============================================

CREATE TABLE public.billing_product (
  product_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,

  name                text NOT NULL,
  description         text,
  default_unit_price  decimal(12,2) NOT NULL CHECK (default_unit_price >= 0),
  default_vat_rate    decimal(5,2) NOT NULL DEFAULT 25.00
                        CHECK (default_vat_rate >= 0 AND default_vat_rate <= 100),
  currency            currency NOT NULL DEFAULT 'NOK',
  is_active           boolean NOT NULL DEFAULT true,

  created_by          uuid REFERENCES public.user_identity(user_id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_billing_product_updated_at
  BEFORE UPDATE ON public.billing_product
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Partial unique — one active product per (workspace, name). Inactive
-- rows allow renaming + soft-delete without conflicting with a fresh
-- registration under the same name.
CREATE UNIQUE INDEX idx_billing_product_unique_active_name
  ON public.billing_product (COALESCE(workspace_id::text, ''), lower(name))
  WHERE is_active = true;

CREATE INDEX idx_billing_product_active
  ON public.billing_product (is_active, name)
  WHERE is_active = true;

-- ── RLS ──────────────────────────────────────────────────────
-- Service-role (admin client) bypasses RLS — that's the primary write
-- path. Authenticated reads are gated on the godmode flag on
-- user_identity (matches the pattern used by journey_system +
-- landing_variant).
ALTER TABLE public.billing_product ENABLE ROW LEVEL SECURITY;

CREATE POLICY godmode_billing_product_all ON public.billing_product
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_identity
      WHERE user_id = auth.uid() AND is_godmode = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_identity
      WHERE user_id = auth.uid() AND is_godmode = true
    )
  );

COMMENT ON TABLE public.billing_product IS
  'Platform-level product catalog (ad-hoc invoice line item presets). Products are selected in the platform-admin ad-hoc invoice drawer to pre-fill description/unit_price/vat_rate. workspace_id nullable for future per-workspace overrides; NULL = platform preset.';

-- ── Seed: baseline products ──────────────────────────────────
-- Three common ad-hoc charges. Prices are plausible defaults — admins
-- can override per line at invoice time. Update via standard UPDATE.
INSERT INTO public.billing_product (name, description, default_unit_price, default_vat_rate, currency)
VALUES
  ('Oppstartsgebyr',       'Engangsavgift for ny kundeoppsett',              5000.00, 25.00, 'NOK'),
  ('Konsultasjon',         'Rådgivningstimer utenfor abonnement (per time)',  1500.00, 25.00, 'NOK'),
  ('Spesialtilpasning',    'Skreddersydd utvikling eller integrasjon',       10000.00, 25.00, 'NOK'),
  ('Opplæring',            'Opplæring og onboarding-sesjon',                  2500.00, 25.00, 'NOK'),
  ('Datamigrering',        'Engangsmigrering av eksisterende data',           7500.00, 25.00, 'NOK');
