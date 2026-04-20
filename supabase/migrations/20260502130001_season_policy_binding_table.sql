-- ============================================
-- 20260502130001_season_policy_binding_table.sql
-- Per-season activation of workspace policies (HMS binding).
-- Allows managers to decide which existing policies/procedures
-- should be enforced during a specific season without modifying
-- the global policy.is_active flag.
-- ============================================

-- ── Table ──

CREATE TABLE IF NOT EXISTS public.season_policy_binding (
  season_policy_binding_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES public.season(season_id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES public.policy(policy_id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  activated_by UUID REFERENCES public.profile(profile_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_season_policy UNIQUE(season_id, policy_id)
);

CREATE TRIGGER set_season_policy_binding_updated_at
  BEFORE UPDATE ON public.season_policy_binding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Indexes ──

CREATE INDEX idx_season_policy_binding_season
  ON public.season_policy_binding(season_id);

CREATE INDEX idx_season_policy_binding_workspace
  ON public.season_policy_binding(workspace_id);

-- ── RLS ──

ALTER TABLE public.season_policy_binding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_season_policy_binding" ON public.season_policy_binding;
CREATE POLICY "jwt_read_season_policy_binding" ON public.season_policy_binding
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

DROP POLICY IF EXISTS "jwt_write_season_policy_binding" ON public.season_policy_binding;
CREATE POLICY "jwt_write_season_policy_binding" ON public.season_policy_binding
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "api_key_read_season_policy_binding" ON public.season_policy_binding;
CREATE POLICY "api_key_read_season_policy_binding" ON public.season_policy_binding
  FOR SELECT USING (workspace_id = get_api_workspace_id());
