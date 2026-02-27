-- Watchdog integrity helper functions
-- Called by the watchdog-integrity Edge Function via supabase.rpc()
-- All use SECURITY DEFINER to bypass RLS (watchdog runs with service role)
-- search_path pinned to prevent schema-based privilege escalation
-- EXECUTE revoked from PUBLIC — only service_role can call these

-- Count company_member rows whose user_id has no matching user_identity row.
-- Under normal operation this returns 0 (FK with ON DELETE RESTRICT prevents orphans).
-- This is a defense-in-depth check against manual DB edits or disabled triggers.
CREATE OR REPLACE FUNCTION count_dangling_company_members()
RETURNS integer AS $$
  SELECT count(*)::integer
  FROM public.company_member cm
  LEFT JOIN public.user_identity ui ON cm.user_id = ui.user_id
  WHERE ui.user_id IS NULL;
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

-- Count workspaces that have zero profiles.
CREATE OR REPLACE FUNCTION count_empty_workspaces()
RETURNS integer AS $$
  SELECT count(*)::integer
  FROM public.workspace w
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profile p WHERE p.workspace_id = w.workspace_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public;

-- Restrict to service_role only (anon/authenticated should not call these)
REVOKE ALL ON FUNCTION count_dangling_company_members() FROM PUBLIC;
REVOKE ALL ON FUNCTION count_empty_workspaces() FROM PUBLIC;
