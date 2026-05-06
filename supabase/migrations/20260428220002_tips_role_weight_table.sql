-- ============================================
-- 20260428220002_tips_role_weight_table.sql
-- tip_role_weight: role → weight mapping for by_role policies.
-- Campaign: tips-handling · Sub-sortie: tips-data-model
-- ============================================

SET search_path TO public, extensions;

CREATE TABLE IF NOT EXISTS public.tip_role_weight (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id   UUID NOT NULL REFERENCES tip_policy(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  weight      NUMERIC(4,2) NOT NULL CHECK (weight >= 0 AND weight <= 10),
  CONSTRAINT uq_tip_role_weight_policy_role UNIQUE (policy_id, role)
);

CREATE INDEX IF NOT EXISTS idx_tip_role_weight_policy ON tip_role_weight (policy_id);

ALTER TABLE tip_role_weight ENABLE ROW LEVEL SECURITY;

-- JWT: read via parent policy's workspace membership
DROP POLICY IF EXISTS "jwt_select_tip_role_weight" ON tip_role_weight;
CREATE POLICY "jwt_select_tip_role_weight" ON tip_role_weight
  FOR SELECT USING (
    policy_id IN (
      SELECT id FROM tip_policy
      WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    )
  );

-- JWT: admin inserts via parent policy
DROP POLICY IF EXISTS "jwt_insert_tip_role_weight" ON tip_role_weight;
CREATE POLICY "jwt_insert_tip_role_weight" ON tip_role_weight
  FOR INSERT WITH CHECK (
    policy_id IN (
      SELECT id FROM tip_policy
      WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
        AND public.is_admin_in_workspace(auth.uid(), workspace_id)
    )
  );

-- JWT: admin updates via parent policy
DROP POLICY IF EXISTS "jwt_update_tip_role_weight" ON tip_role_weight;
CREATE POLICY "jwt_update_tip_role_weight" ON tip_role_weight
  FOR UPDATE USING (
    policy_id IN (
      SELECT id FROM tip_policy
      WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
        AND public.is_admin_in_workspace(auth.uid(), workspace_id)
    )
  );

-- JWT: admin deletes via parent policy
DROP POLICY IF EXISTS "jwt_delete_tip_role_weight" ON tip_role_weight;
CREATE POLICY "jwt_delete_tip_role_weight" ON tip_role_weight
  FOR DELETE USING (
    policy_id IN (
      SELECT id FROM tip_policy
      WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
        AND public.is_admin_in_workspace(auth.uid(), workspace_id)
    )
  );

-- API key: workspace-scoped read via parent policy
DROP POLICY IF EXISTS "api_key_read_tip_role_weight" ON tip_role_weight;
CREATE POLICY "api_key_read_tip_role_weight" ON tip_role_weight
  FOR SELECT USING (
    policy_id IN (
      SELECT id FROM tip_policy
      WHERE workspace_id = get_api_workspace_id()
    )
  );

-- Service role: full access
DROP POLICY IF EXISTS "service_role_tip_role_weight" ON tip_role_weight;
CREATE POLICY "service_role_tip_role_weight" ON tip_role_weight
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE tip_role_weight IS 'Role-weight mapping for tip distribution. Only relevant when tip_policy.method = by_role.';
