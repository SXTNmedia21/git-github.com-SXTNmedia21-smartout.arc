-- Cleanup: remove the lookup_workspace_by_code RPC.
-- The workspace join code flow has been replaced by OTP-based passwordless login.
-- The join_code column on workspace is left in place (nullable, no longer used)
-- to avoid a destructive migration for minimal benefit.

DROP FUNCTION IF EXISTS public.lookup_workspace_by_code(TEXT);
DROP FUNCTION IF EXISTS public.search_workspaces(TEXT);
