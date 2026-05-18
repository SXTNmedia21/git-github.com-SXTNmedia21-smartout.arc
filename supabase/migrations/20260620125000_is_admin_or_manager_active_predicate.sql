-- supabase/migrations/20260620125000_is_admin_or_manager_active_predicate.sql
--
-- ADR-0367 / G-A review WARN-1 patch. Adds is_active = true predicate to
-- is_admin_or_manager_in_workspace, matching is_admin_in_workspace
-- pattern at 00004_rls_policies.sql:33.
--
-- Without this, an offboarded manager/admin/owner with profile.is_active=false
-- could still pass the gate. RLS bypass on day_line + department_location
-- INSERT/UPDATE/DELETE policies.

CREATE OR REPLACE FUNCTION public.is_admin_or_manager_in_workspace(uid uuid, wid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile
    WHERE user_id = uid
      AND workspace_id = wid
      AND role IN ('manager', 'admin', 'owner')
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.is_admin_or_manager_in_workspace(uuid, uuid) IS
  'ADR-0367 + G-A WARN-1. Returns true if uid has active role manager/admin/owner in wid. is_active = true predicate added 2026-05-18 to match is_admin_in_workspace pattern.';
