-- M0: is_manager_in_workspace helper for V2 announcement RPC defense-in-depth.
-- Pattern mirrors is_admin_in_workspace (00004_rls_policies.sql:33).
-- Returns TRUE if profile has manager+ role in workspace and status=active/trainee.
-- ADR-0369, ADR-0370, ADR-0371.

CREATE OR REPLACE FUNCTION public.is_manager_in_workspace(
  p_profile_id uuid,
  p_workspace_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile p
    WHERE p.profile_id = p_profile_id
      AND p.workspace_id = p_workspace_id
      AND p.role IN ('manager', 'admin', 'owner')
      AND p.status IN ('active', 'trainee')
  );
$$;

REVOKE ALL ON FUNCTION public.is_manager_in_workspace(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_manager_in_workspace(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.is_manager_in_workspace IS
  'Helper for V2 announcement RPC defense-in-depth (ADR-0369). Returns TRUE if profile has manager+ role (manager/admin/owner) in workspace and status=active/trainee.';
