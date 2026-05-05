-- ============================================
-- 20260428220001_tips_policy_table.sql
-- tip_policy: per-department, versioned via active_from/to.
-- Campaign: tips-handling · Sub-sortie: tips-data-model
-- ============================================

SET search_path TO public, extensions;

CREATE TABLE IF NOT EXISTS public.tip_policy (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id   UUID NOT NULL REFERENCES department(department_id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  method          tip_algorithm NOT NULL,
  active_from     DATE NOT NULL,
  active_to       DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID NOT NULL REFERENCES profile(profile_id),
  CONSTRAINT chk_tip_policy_valid_dates CHECK (active_to IS NULL OR active_to >= active_from)
);

CREATE INDEX IF NOT EXISTS idx_tip_policy_active
  ON tip_policy (department_id, active_from DESC)
  WHERE active_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_tip_policy_workspace
  ON tip_policy (workspace_id);

ALTER TABLE tip_policy ENABLE ROW LEVEL SECURITY;

-- JWT: all workspace members can read policies in their workspace
DROP POLICY IF EXISTS "jwt_select_tip_policy" ON tip_policy;
CREATE POLICY "jwt_select_tip_policy" ON tip_policy
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- JWT: admin inserts
DROP POLICY IF EXISTS "jwt_insert_tip_policy" ON tip_policy;
CREATE POLICY "jwt_insert_tip_policy" ON tip_policy
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- JWT: admin updates
DROP POLICY IF EXISTS "jwt_update_tip_policy" ON tip_policy;
CREATE POLICY "jwt_update_tip_policy" ON tip_policy
  FOR UPDATE USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  ) WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- JWT: admin deletes (soft-delete via active_to preferred, but allow hard-delete for admins)
DROP POLICY IF EXISTS "jwt_delete_tip_policy" ON tip_policy;
CREATE POLICY "jwt_delete_tip_policy" ON tip_policy
  FOR DELETE USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- API key: workspace-scoped full access
DROP POLICY IF EXISTS "api_key_read_tip_policy" ON tip_policy;
CREATE POLICY "api_key_read_tip_policy" ON tip_policy
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- Service role: full access
DROP POLICY IF EXISTS "service_role_tip_policy" ON tip_policy;
CREATE POLICY "service_role_tip_policy" ON tip_policy
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_tip_policy_updated_at
  BEFORE UPDATE ON public.tip_policy
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE tip_policy IS 'Per-department, versioned tip distribution policy. active_to NULL = active. New policy = INSERT new row + UPDATE old row active_to atomically.';
