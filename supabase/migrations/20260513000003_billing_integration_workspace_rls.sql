SET search_path TO public, extensions;

-- ============================================
-- 20260513000003_billing_integration_workspace_rls.sql
-- Billing Engine Fase 3B — B1 Migration D
--
-- Extends billing_integration RLS to allow workspace-admins to CRUD
-- their own integrations (Fase 3B Spor E), and enables RLS on the new
-- oauth_state table with a platform-admin-only policy.
--
-- Fase 2 locked billing_integration to platform-admin only (see
-- 20260511200006_billing_fase2_rls_policies.sql Migration G). Fase 3B
-- introduces workspace self-serve OAuth, so workspace-admins need to
-- read + create + update + delete their own integration rows.
--
-- Constraint on workspace-admin writes: `is_placeholder = false`. A
-- workspace cannot create a placeholder row; placeholders are a
-- Smartout-owned construct for pre-real-adapter testing (ADR-0129).
-- This keeps workspace flows clean of placeholder semantics.
--
-- Platform-admin policy stays untouched — godmode users still see all
-- integrations across all workspaces.
--
-- oauth_state RLS: platform-admin only. The integration-oauth-callback
-- Edge Function writes + reads via service_role (bypasses RLS). No
-- workspace-user ever queries oauth_state directly.
--
-- Ref: Fase 3B spec §5.3.
-- ============================================

-- ═══════════════════════════════════════════════════════════════
-- billing_integration — add workspace-admin CRUD policy
-- ═══════════════════════════════════════════════════════════════
-- Note: RLS is already ENABLED from Fase 2. We only add a new policy;
-- the existing billing_integration_platform_admin_all policy stays.
CREATE POLICY billing_integration_workspace_admin_own_crud
  ON public.billing_integration
  FOR ALL
  TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
    AND is_placeholder = false
  );

COMMENT ON POLICY billing_integration_workspace_admin_own_crud ON public.billing_integration IS
  'Fase 3B Spor E: workspace-admins CRUD their own integration rows. WITH CHECK also enforces is_placeholder=false — placeholders are a Smartout-owned construct. Platform rows (workspace_id NULL) remain godmode-only.';

-- ═══════════════════════════════════════════════════════════════
-- billing_integration_oauth_state — enable RLS + policies
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE public.billing_integration_oauth_state ENABLE ROW LEVEL SECURITY;

-- Platform-admin: full access for audit purposes.
CREATE POLICY billing_integration_oauth_state_platform_admin_all
  ON public.billing_integration_oauth_state
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

COMMENT ON POLICY billing_integration_oauth_state_platform_admin_all ON public.billing_integration_oauth_state IS
  'Godmode users: full access for OAuth-flow audit. integration-oauth-callback Edge Function uses service_role and bypasses RLS. Workspace users have no direct access — the callback is the only write path + reads happen inside the Edge Function.';
