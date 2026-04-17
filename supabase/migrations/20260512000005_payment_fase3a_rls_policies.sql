SET search_path TO public, extensions;

-- ============================================
-- 20260512000005_payment_fase3a_rls_policies.sql
-- Billing Engine Fase 3A — B1 Migration F
--
-- Enables RLS on the three new Fase 3A tables from Migrations C-E and
-- applies the spec §7 matrix:
--
-- | Table                   | Platform-admin | Workspace-admin                     |
-- |-------------------------|----------------|-------------------------------------|
-- | payment                 | ALL            | SELECT via invoice→company          |
-- | payment_attempt         | ALL            | NONE (ADR-0132 platform-only)       |
-- | dunning_escalation_log  | ALL            | SELECT via invoice→company          |
--
-- Helpers used:
--   - is_godmode inline check (matches Fase 2 precedent — no
--     is_platform_admin() helper exists).
--   - is_admin_in_company(uuid, uuid) — for workspace-admin reads via
--     the invoice → company join (same pattern as
--     invoice_dispatch_workspace_admin_read in Fase 2).
--
-- Defensive: service-role Server Actions bypass RLS; these policies
-- only matter if a godmode user authenticates via JWT directly.
--
-- Ref: Fase 3A spec §7, ADR-0131, ADR-0132.
-- ============================================

-- ═══════════════════════════════════════════════════════════════
-- payment
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.payment ENABLE ROW LEVEL SECURITY;

-- Platform-admin: full access.
CREATE POLICY payment_platform_admin_all
  ON public.payment
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_identity
    WHERE user_id = auth.uid() AND is_godmode = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_identity
    WHERE user_id = auth.uid() AND is_godmode = true
  ));

-- Workspace-admin: read payments for their own company's invoices. We
-- traverse payment.invoice_id → invoice.company_id and reuse
-- is_admin_in_company (same pattern as invoice_dispatch_workspace_admin_read
-- in Fase 2 Migration G).
CREATE POLICY payment_workspace_admin_read
  ON public.payment
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoice i
    WHERE i.invoice_id = payment.invoice_id
      AND public.is_admin_in_company(auth.uid(), i.company_id)
  ));

COMMENT ON POLICY payment_platform_admin_all ON public.payment IS
  'Godmode users: full access. Defensive — service-role Server Actions bypass RLS.';
COMMENT ON POLICY payment_workspace_admin_read ON public.payment IS
  'Workspace admins read payments for their own company invoices. Mirrors invoice_dispatch_workspace_admin_read (Fase 2).';

-- ═══════════════════════════════════════════════════════════════
-- payment_attempt (ADR-0132: platform-only — no workspace policy)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.payment_attempt ENABLE ROW LEVEL SECURITY;

-- Platform-admin: full access. Intentionally NO workspace-admin policy —
-- redacted_payload is PCI-filtered but the platform-only boundary is a
-- defence-in-depth stance per ADR-0132 (§7 matrix: "Ingen tilgang").
CREATE POLICY payment_attempt_platform_admin_all
  ON public.payment_attempt
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_identity
    WHERE user_id = auth.uid() AND is_godmode = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_identity
    WHERE user_id = auth.uid() AND is_godmode = true
  ));

COMMENT ON POLICY payment_attempt_platform_admin_all ON public.payment_attempt IS
  'ADR-0132 platform-only: no workspace-admin policy. Even redacted_payload stays behind the platform boundary (defence-in-depth).';

-- ═══════════════════════════════════════════════════════════════
-- dunning_escalation_log
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.dunning_escalation_log ENABLE ROW LEVEL SECURITY;

-- Platform-admin: full access.
CREATE POLICY dunning_escalation_log_platform_admin_all
  ON public.dunning_escalation_log
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_identity
    WHERE user_id = auth.uid() AND is_godmode = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_identity
    WHERE user_id = auth.uid() AND is_godmode = true
  ));

-- Workspace-admin: read escalations for their own company's invoices.
-- Same invoice → company → is_admin_in_company traversal as payment.
CREATE POLICY dunning_escalation_log_workspace_admin_read
  ON public.dunning_escalation_log
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoice i
    WHERE i.invoice_id = dunning_escalation_log.invoice_id
      AND public.is_admin_in_company(auth.uid(), i.company_id)
  ));

COMMENT ON POLICY dunning_escalation_log_workspace_admin_read ON public.dunning_escalation_log IS
  'Workspace admins read escalation history for their own company invoices. Surfaces the "Automatiske påminnelser" audit in workspace UI (Fase 3A §4.5).';
