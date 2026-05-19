-- supabase/migrations/20260620120000_is_admin_or_manager_helper.sql
--
-- New SECURITY DEFINER helper extending is_admin_in_workspace to admit
-- the 'manager' role. Signature (uid, wid) mirrors existing helper at
-- 00004_rls_policies.sql:33. Locked search_path per L-0172.

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
  );
$$;

COMMENT ON FUNCTION public.is_admin_or_manager_in_workspace(uuid, uuid) IS
  'ADR-0367. Returns true if uid has role manager/admin/owner in wid. Used by day_line + department_location RLS.';
