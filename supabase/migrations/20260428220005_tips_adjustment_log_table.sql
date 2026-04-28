-- ============================================
-- 20260428220005_tips_adjustment_log_table.sql
-- tip_adjustment_log: INSERT-only audit. Visible to affected employee.
-- Campaign: tips-handling · Sub-sortie: tips-data-model
-- ============================================

SET search_path TO public, extensions;

CREATE TABLE IF NOT EXISTS public.tip_adjustment_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  distribution_id   UUID NOT NULL REFERENCES tip_distribution(id) ON DELETE CASCADE,
  changed_by        UUID NOT NULL REFERENCES profile(profile_id),
  changed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  old_amount        NUMERIC(10,2),
  new_amount        NUMERIC(10,2) NOT NULL CHECK (new_amount >= 0),
  reason            TEXT NOT NULL CHECK (length(reason) >= 5)
);

CREATE INDEX IF NOT EXISTS idx_tip_adjustment_log_dist
  ON tip_adjustment_log (distribution_id, changed_at DESC);

ALTER TABLE tip_adjustment_log ENABLE ROW LEVEL SECURITY;

-- JWT: workspace members (leaders) read in workspace
DROP POLICY IF EXISTS "jwt_select_tip_adjustment_log_leader" ON tip_adjustment_log;
CREATE POLICY "jwt_select_tip_adjustment_log_leader" ON tip_adjustment_log
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- JWT: employee reads own adjustment log
DROP POLICY IF EXISTS "jwt_select_tip_adjustment_log_employee" ON tip_adjustment_log;
CREATE POLICY "jwt_select_tip_adjustment_log_employee" ON tip_adjustment_log
  FOR SELECT USING (
    distribution_id IN (
      SELECT id FROM tip_distribution
      WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    )
  );

-- JWT: leader inserts (capability-gated; RLS as defense)
DROP POLICY IF EXISTS "jwt_insert_tip_adjustment_log" ON tip_adjustment_log;
CREATE POLICY "jwt_insert_tip_adjustment_log" ON tip_adjustment_log
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND changed_by IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
  );

-- INSERT-only: no UPDATE/DELETE policies (deny by default — audit immutability)

-- API key: workspace-scoped read
DROP POLICY IF EXISTS "api_key_read_tip_adjustment_log" ON tip_adjustment_log;
CREATE POLICY "api_key_read_tip_adjustment_log" ON tip_adjustment_log
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- Service role: full access
DROP POLICY IF EXISTS "service_role_tip_adjustment_log" ON tip_adjustment_log;
CREATE POLICY "service_role_tip_adjustment_log" ON tip_adjustment_log
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE tip_adjustment_log IS 'INSERT-only audit log of tip distribution adjustments. Employee can read own. No UPDATE/DELETE policies — immutable audit trail.';
