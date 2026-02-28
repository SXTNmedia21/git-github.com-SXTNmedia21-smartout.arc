-- ── API Key RLS Policies ──
-- Allows workspace-api Edge Function to access data via set_config('app.workspace_id', ...)
-- Coexists with existing JWT-based policies (OR logic).
-- See: docs/protocols/SECURITY.md §4.3

-- Helper: extract workspace_id from GUC variable (returns NULL if not set)
CREATE OR REPLACE FUNCTION public.get_api_workspace_id()
RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.workspace_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- ── Profile ──
CREATE POLICY "api_key_read_profile" ON public.profile
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- ── Department ──
CREATE POLICY "api_key_read_department" ON public.department
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- ── Location ──
CREATE POLICY "api_key_read_location" ON public.location
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- ── Team ──
CREATE POLICY "api_key_read_team" ON public.team
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- ── Team Member ──
CREATE POLICY "api_key_read_team_member" ON public.team_member
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM public.team
      WHERE workspace_id = get_api_workspace_id()
    )
  );

-- ── Season ──
CREATE POLICY "api_key_read_season" ON public.season
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- ── Policy (governance) ──
CREATE POLICY "api_key_read_policy" ON public.policy
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- ── Protocol ──
CREATE POLICY "api_key_read_protocol" ON public.protocol
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- ── Protocol Assignment ──
CREATE POLICY "api_key_read_protocol_assignment" ON public.protocol_assignment
  FOR SELECT USING (
    protocol_id IN (
      SELECT protocol_id FROM public.protocol
      WHERE workspace_id = get_api_workspace_id()
    )
  );

-- ── Employment Contract ──
CREATE POLICY "api_key_read_employment_contract" ON public.employment_contract
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- ── Position ──
CREATE POLICY "api_key_read_position" ON public.position
  FOR SELECT USING (workspace_id = get_api_workspace_id());
