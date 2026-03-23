-- Workspace join code and searchability for mobile app onboarding.
-- Employees can join a workspace by entering a 6-character code (shared verbally by manager)
-- or by searching for the workspace name.

-- ── New columns ─────────────────────────────────────────────────
ALTER TABLE public.workspace ADD COLUMN IF NOT EXISTS join_code CHAR(6) UNIQUE;
ALTER TABLE public.workspace ADD COLUMN IF NOT EXISTS is_searchable BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.workspace.join_code IS '6-character code for employee mobile onboarding. Generated at workspace creation, shared verbally.';
COMMENT ON COLUMN public.workspace.is_searchable IS 'Whether this workspace appears in search results. Default true.';

-- ── Generate codes for existing workspaces ──────────────────────
UPDATE public.workspace
SET join_code = upper(substr(md5(random()::text), 1, 6))
WHERE join_code IS NULL;

-- ── RPC: lookup workspace by join code ──────────────────────────
-- Anon-accessible, returns only public info (name + logo).
-- SECURITY DEFINER so anon users can read workspace table.
CREATE OR REPLACE FUNCTION public.lookup_workspace_by_code(code TEXT)
RETURNS TABLE (workspace_id UUID, name TEXT, logo_url TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT w.workspace_id, w.name, w.logo_url
  FROM public.workspace w
  WHERE w.join_code = upper(code)
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.lookup_workspace_by_code IS 'Look up a workspace by its 6-char join code. Returns name + logo only. Anon-accessible.';

-- Grant execute to anon so unauthenticated mobile users can look up workspaces
GRANT EXECUTE ON FUNCTION public.lookup_workspace_by_code(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_workspace_by_code(TEXT) TO authenticated;

-- ── RPC: search workspaces by name ──────────────────────────────
-- Anon-accessible, minimum 3 characters, max 10 results.
-- Only returns workspaces with is_searchable = true.
CREATE OR REPLACE FUNCTION public.search_workspaces(query TEXT)
RETURNS TABLE (workspace_id UUID, name TEXT, logo_url TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT w.workspace_id, w.name, w.logo_url
  FROM public.workspace w
  WHERE w.is_searchable = true
    AND length(query) >= 3
    AND w.name ILIKE '%' || query || '%'
  ORDER BY w.name
  LIMIT 10;
$$;

COMMENT ON FUNCTION public.search_workspaces IS 'Search workspaces by name. Min 3 chars, max 10 results, only searchable workspaces. Anon-accessible.';

GRANT EXECUTE ON FUNCTION public.search_workspaces(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.search_workspaces(TEXT) TO authenticated;
