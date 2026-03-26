-- Fix spokesperson RLS: restrict admin_all_spokesperson to actual admins
-- Previously allowed all workspace members to INSERT/UPDATE/DELETE — should be admin-only.
-- Plan: docs/superpowers/plans/2026-03-22-website-factory-b2b.md (security fix)

BEGIN;

-- Drop the overly permissive policy that allowed any workspace member full access
DROP POLICY IF EXISTS "admin_all_spokesperson" ON websites.website_spokesperson;

-- Admin-only: INSERT/UPDATE/DELETE restricted to workspace admins
CREATE POLICY "admin_all_spokesperson"
  ON websites.website_spokesperson
  FOR ALL
  USING (is_admin_in_workspace(auth.uid(), workspace_id))
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));

COMMIT;
