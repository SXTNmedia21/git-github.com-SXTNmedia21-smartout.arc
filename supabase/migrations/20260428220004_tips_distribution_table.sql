-- ============================================
-- 20260428220004_tips_distribution_table.sql
-- tip_distribution: per-employee share. Locked once parent pool approved.
-- Campaign: tips-handling · Sub-sortie: tips-data-model
-- ============================================

SET search_path TO public, extensions;

CREATE TABLE IF NOT EXISTS public.tip_distribution (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  pool_id             UUID NOT NULL REFERENCES tip_pool(id) ON DELETE CASCADE,
  profile_id          UUID NOT NULL REFERENCES profile(profile_id),
  shift_id            UUID REFERENCES schedule_shift(shift_id),
  role                TEXT NOT NULL,
  hours_worked        NUMERIC(5,2) NOT NULL CHECK (hours_worked >= 0),
  weight_applied      NUMERIC(4,2) NOT NULL CHECK (weight_applied >= 0),
  algorithm_snapshot  JSONB NOT NULL,
  calculated_amount   NUMERIC(10,2) NOT NULL CHECK (calculated_amount >= 0),
  adjusted_amount     NUMERIC(10,2) CHECK (adjusted_amount IS NULL OR adjusted_amount >= 0),
  adjustment_reason   TEXT CHECK (adjustment_reason IS NULL OR length(adjustment_reason) >= 5),
  payroll_period_id   UUID,
  paid_at             TIMESTAMPTZ,
  status              tip_distribution_status NOT NULL DEFAULT 'calculated',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_tip_distribution_pool_profile UNIQUE (pool_id, profile_id),
  CONSTRAINT chk_tip_dist_adjustment CHECK ((adjusted_amount IS NULL) = (adjustment_reason IS NULL)),
  CONSTRAINT chk_tip_dist_paid CHECK ((paid_at IS NOT NULL) = (status = 'paid'))
);

CREATE INDEX IF NOT EXISTS idx_tip_distribution_pool ON tip_distribution (pool_id);
CREATE INDEX IF NOT EXISTS idx_tip_distribution_profile ON tip_distribution (profile_id, status);
CREATE INDEX IF NOT EXISTS idx_tip_distribution_payroll ON tip_distribution (payroll_period_id) WHERE payroll_period_id IS NOT NULL;

ALTER TABLE tip_distribution ENABLE ROW LEVEL SECURITY;

-- JWT: workspace members (leaders) read via pool's workspace
DROP POLICY IF EXISTS "jwt_select_tip_distribution_leader" ON tip_distribution;
CREATE POLICY "jwt_select_tip_distribution_leader" ON tip_distribution
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- JWT: employee reads own (approved or paid only)
DROP POLICY IF EXISTS "jwt_select_tip_distribution_employee" ON tip_distribution;
CREATE POLICY "jwt_select_tip_distribution_employee" ON tip_distribution
  FOR SELECT USING (
    profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND status IN ('approved', 'paid')
  );

-- JWT: leader inserts (capability-gated; RLS as defense)
DROP POLICY IF EXISTS "jwt_insert_tip_distribution" ON tip_distribution;
CREATE POLICY "jwt_insert_tip_distribution" ON tip_distribution
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- JWT: leader updates only when parent pool not approved
DROP POLICY IF EXISTS "jwt_update_tip_distribution" ON tip_distribution;
CREATE POLICY "jwt_update_tip_distribution" ON tip_distribution
  FOR UPDATE USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND pool_id IN (SELECT id FROM tip_pool WHERE status != 'approved')
  ) WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- API key: workspace-scoped read
DROP POLICY IF EXISTS "api_key_read_tip_distribution" ON tip_distribution;
CREATE POLICY "api_key_read_tip_distribution" ON tip_distribution
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- Service role: full access
DROP POLICY IF EXISTS "service_role_tip_distribution" ON tip_distribution;
CREATE POLICY "service_role_tip_distribution" ON tip_distribution
  FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_tip_distribution_updated_at
  BEFORE UPDATE ON public.tip_distribution
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE tip_distribution IS 'Per-employee share of a pool. RLS UPDATE locks once parent pool.status=approved. payroll_period_id + paid_at populated by future payroll-campaign.';
