-- ============================================
-- 20260515170400_contract_template_rls_workspace_vs_platform.sql
--
-- Council 2026-04-22, Gate G5 (RLS half): split contract_template write
-- access into workspace-scope vs platform-scope.
--
-- State before this migration
--   G1 (20260515170100) re-created a single "Admins can manage workspace
--   templates" policy with the canonical is_admin_in_workspace(auth.uid(),
--   workspace_id) signature and WITH CHECK. That policy gates every row
--   regardless of is_system — meaning a workspace admin could, through
--   RLS, update a system (K1a) template row they happen to see. The new
--   is_system immutability trigger (170300) plugs the column-flip vector,
--   but the row-level split below is the other half.
--
-- State after this migration
--   - Workspace admins: FOR ALL on rows where is_system = false AND
--     workspace_id belongs to one of the admin's workspaces. Both JWT
--     (is_admin_in_workspace) and API key (get_api_workspace_id) paths.
--   - Platform godmode: FOR ALL on rows where is_system = true. Gated by
--     user_identity.is_godmode = true.
--   - Read of system templates by any authenticated user is preserved via
--     the existing "Users can view system templates" SELECT policy (not
--     touched here).
--   - Read of workspace templates via the existing "Users can view
--     workspace templates" SELECT policy is preserved (not touched here).
--
-- All FOR ALL policies use WITH CHECK so INSERT/UPDATE cannot create a row
-- outside the policy's scope (e.g. a workspace admin cannot insert an
-- is_system=true row).
-- ============================================

BEGIN;

-- ── Drop the old monolithic admin-manage policy ──
-- G1 re-created it under the name below; drop idempotently.
DROP POLICY IF EXISTS "Admins can manage workspace templates"
  ON public.contract_template;

-- ── Workspace admin (JWT path) ──
-- Applies only to non-system templates owned by one of the admin's
-- workspaces. is_admin_in_workspace is called with the canonical
-- (auth.uid(), workspace_id) signature (council Gate G1).
CREATE POLICY "Workspace admins manage workspace templates (JWT)"
  ON public.contract_template
  FOR ALL
  USING (
    is_system = false
    AND workspace_id IS NOT NULL
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  )
  WITH CHECK (
    is_system = false
    AND workspace_id IS NOT NULL
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- ── Workspace admin (API key path) ──
-- get_api_workspace_id() returns the workspace bound to the current API
-- key JWT claim. Symmetric to the JWT policy above — scoped to non-system
-- rows in the caller's workspace.
CREATE POLICY "Workspace admins manage workspace templates (API key)"
  ON public.contract_template
  FOR ALL
  USING (
    is_system = false
    AND workspace_id IS NOT NULL
    AND workspace_id = public.get_api_workspace_id()
  )
  WITH CHECK (
    is_system = false
    AND workspace_id IS NOT NULL
    AND workspace_id = public.get_api_workspace_id()
  );

-- ── Platform godmode on K1a catalog ──
-- Only platform admins (is_godmode=true on user_identity) can manage
-- system templates. No workspace scoping — K1a belongs to the platform.
CREATE POLICY "Platform godmode manages system templates"
  ON public.contract_template
  FOR ALL
  USING (
    is_system = true
    AND EXISTS (
      SELECT 1 FROM public.user_identity
      WHERE user_id = auth.uid()
        AND is_godmode = true
    )
  )
  WITH CHECK (
    is_system = true
    AND EXISTS (
      SELECT 1 FROM public.user_identity
      WHERE user_id = auth.uid()
        AND is_godmode = true
    )
  );

COMMIT;
