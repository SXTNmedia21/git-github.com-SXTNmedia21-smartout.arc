SET search_path TO public, extensions;

-- ============================================
-- 20260511200006_billing_fase2_rls_policies.sql
-- Billing Engine Fase 2 — B1 Migration G
--
-- Enables RLS on the four new tables from Migrations B-E and applies the
-- §7 matrix:
--
-- | Table                      | Platform-admin | Workspace-admin                           |
-- |----------------------------|----------------|-------------------------------------------|
-- | billing_dispatch_rule      | ALL            | SELECT platform rows + CRUD own workspace |
-- | billing_dispatch_template  | ALL            | SELECT all (read-only reference)          |
-- | invoice_dispatch           | ALL            | SELECT for own workspace invoices         |
-- | billing_integration        | ALL            | No access in Fase 2                       |
--
-- Fase 1 precedent (20260417123732_billing_rls_policies.sql):
-- service-role Server Actions bypass RLS, so the "platform_admin_all"
-- policies below only matter if a godmode user authenticates with JWT
-- and reads via the Supabase client. We keep them for defensibility.
--
-- Naming: {table}_platform_admin_all / _workspace_admin_read /
-- _workspace_admin_own_crud per mission spec.
--
-- Helpers used: is_admin_in_workspace(uuid, uuid) — workspace-scoped;
-- is_admin_in_company(uuid, uuid) — company-scoped via invoice join.
-- Platform-admin detected via inline is_godmode check on user_identity.
-- ============================================

-- ═══════════════════════════════════════════════════════════════
-- billing_dispatch_rule
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.billing_dispatch_rule ENABLE ROW LEVEL SECURITY;

-- Platform-admin: full access (defensive — service role already bypasses RLS).
CREATE POLICY billing_dispatch_rule_platform_admin_all
  ON public.billing_dispatch_rule
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

-- Workspace-admin: SELECT platform rows (workspace_id IS NULL) AND own
-- workspace rows. Matches spec §3.6 "Fra Smartout" (read-only) + "Dine regler".
CREATE POLICY billing_dispatch_rule_workspace_admin_read
  ON public.billing_dispatch_rule
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IS NULL
    OR (
      workspace_id IS NOT NULL
      AND public.is_admin_in_workspace(auth.uid(), workspace_id)
    )
  );

-- Workspace-admin: full CRUD on rules scoped to their own workspace (never
-- on platform rows). Spec §3.6: workspace admins add/remove their own rules
-- + create suppress rows against platform defaults.
CREATE POLICY billing_dispatch_rule_workspace_admin_own_crud
  ON public.billing_dispatch_rule
  FOR ALL
  TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );

COMMENT ON POLICY billing_dispatch_rule_platform_admin_all ON public.billing_dispatch_rule IS
  'Godmode users: full access. Defensive — service-role Server Actions bypass RLS.';
COMMENT ON POLICY billing_dispatch_rule_workspace_admin_read ON public.billing_dispatch_rule IS
  'Workspace admins see platform baseline rules (read-only "Fra Smartout" section) + own workspace rules.';
COMMENT ON POLICY billing_dispatch_rule_workspace_admin_own_crud ON public.billing_dispatch_rule IS
  'Workspace admins can CRUD only rules scoped to their own workspace. Platform rules (workspace_id NULL) stay godmode-only.';

-- ═══════════════════════════════════════════════════════════════
-- billing_dispatch_template
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.billing_dispatch_template ENABLE ROW LEVEL SECURITY;

-- Platform-admin: full access.
CREATE POLICY billing_dispatch_template_platform_admin_all
  ON public.billing_dispatch_template
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

-- Workspace-admin: read-only reference (see spec §7). Any authenticated
-- workspace-admin can SELECT any template — templates are not sensitive and
-- workspace UI needs to render platform templates inline in the "Fra
-- Smartout" read-only section.
CREATE POLICY billing_dispatch_template_workspace_admin_read
  ON public.billing_dispatch_template
  FOR SELECT
  TO authenticated
  USING (
    -- At least one admin workspace for the user — any workspace-admin
    -- qualifies since templates are read-only reference data.
    EXISTS (
      SELECT 1
      FROM public.get_workspace_ids_for_user(auth.uid()) AS ws_id
      WHERE public.is_admin_in_workspace(auth.uid(), ws_id)
    )
  );

COMMENT ON POLICY billing_dispatch_template_workspace_admin_read ON public.billing_dispatch_template IS
  'Workspace admins see all templates as reference data. Not sensitive; no CRUD in Fase 2.';

-- ═══════════════════════════════════════════════════════════════
-- invoice_dispatch
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.invoice_dispatch ENABLE ROW LEVEL SECURITY;

-- Platform-admin: full access.
CREATE POLICY invoice_dispatch_platform_admin_all
  ON public.invoice_dispatch
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

-- Workspace-admin: SELECT dispatches for invoices owned by their
-- company(ies). Traverses invoice.company_id and reuses is_admin_in_company
-- (same pattern as invoice_line_item RLS in Fase 1).
CREATE POLICY invoice_dispatch_workspace_admin_read
  ON public.invoice_dispatch
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoice i
    WHERE i.invoice_id = invoice_dispatch.invoice_id
      AND public.is_admin_in_company(auth.uid(), i.company_id)
  ));

COMMENT ON POLICY invoice_dispatch_workspace_admin_read ON public.invoice_dispatch IS
  'Company admins read dispatches for their own company invoices. Mirrors invoice_line_item RLS (Fase 1).';

-- ═══════════════════════════════════════════════════════════════
-- billing_integration
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.billing_integration ENABLE ROW LEVEL SECURITY;

-- Platform-admin ONLY — no workspace-admin policy in Fase 2 per spec §7.
-- Service-role bypass handles writes; godmode handles ad-hoc JWT reads.
CREATE POLICY billing_integration_platform_admin_all
  ON public.billing_integration
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

COMMENT ON POLICY billing_integration_platform_admin_all ON public.billing_integration IS
  'Platform-admin only in Fase 2. Workspace self-serve integration config is Fase 3 (spec §4.5).';
