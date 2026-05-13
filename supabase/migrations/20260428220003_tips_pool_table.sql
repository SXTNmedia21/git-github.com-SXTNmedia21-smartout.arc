-- ============================================
-- 20260428220003_tips_pool_table.sql
-- tip_pool: one pool per department_session (kveldsgrense, not kalenderdag).
-- Campaign: tips-handling · Sub-sortie: tips-data-model
-- ============================================

SET search_path TO public, extensions;

CREATE TABLE IF NOT EXISTS public.tip_pool (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_session_id           UUID NOT NULL REFERENCES department_session(department_session_id) ON DELETE CASCADE,
  policy_id                       UUID NOT NULL REFERENCES tip_policy(id),
  amount_nok                      NUMERIC(10,2) NOT NULL CHECK (amount_nok >= 0),
  currency                        TEXT NOT NULL DEFAULT 'NOK',
  status                          tip_pool_status NOT NULL DEFAULT 'recorded',
  recorded_by                     UUID NOT NULL REFERENCES profile(profile_id),
  recorded_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by                     UUID REFERENCES profile(profile_id),
  approved_at                     TIMESTAMPTZ,
  algorithm_version_at_approval   TEXT,
  notes                           TEXT,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_tip_pool_session UNIQUE (department_session_id),
  CONSTRAINT chk_tip_pool_approval CHECK (
    (status = 'approved' AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
    OR (status != 'approved' AND approved_by IS NULL AND approved_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_tip_pool_session ON tip_pool (department_session_id);
CREATE INDEX IF NOT EXISTS idx_tip_pool_workspace_status ON tip_pool (workspace_id, status) WHERE status != 'paid';

ALTER TABLE tip_pool ENABLE ROW LEVEL SECURITY;

-- JWT: workspace members read pools in their workspace
DROP POLICY IF EXISTS "jwt_select_tip_pool" ON tip_pool;
CREATE POLICY "jwt_select_tip_pool" ON tip_pool
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- JWT: leader inserts (capability-gated; RLS as defense-in-depth)
DROP POLICY IF EXISTS "jwt_insert_tip_pool" ON tip_pool;
CREATE POLICY "jwt_insert_tip_pool" ON tip_pool
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- JWT: leader updates — locked when status=approved
DROP POLICY IF EXISTS "jwt_update_tip_pool" ON tip_pool;
CREATE POLICY "jwt_update_tip_pool" ON tip_pool
  FOR UPDATE USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND status != 'approved'
  ) WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- API key: workspace-scoped full access
DROP POLICY IF EXISTS "api_key_read_tip_pool" ON tip_pool;
CREATE POLICY "api_key_read_tip_pool" ON tip_pool
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- Service role: full access
DROP POLICY IF EXISTS "service_role_tip_pool" ON tip_pool;
CREATE POLICY "service_role_tip_pool" ON tip_pool
  FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS set_tip_pool_updated_at ON public.tip_pool;
CREATE TRIGGER set_tip_pool_updated_at
  BEFORE UPDATE ON public.tip_pool
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE tip_pool IS 'One pool per department_session. UNIQUE on department_session_id enforces kveldsgrense (not kalenderdag). approved → distributions locked.';
