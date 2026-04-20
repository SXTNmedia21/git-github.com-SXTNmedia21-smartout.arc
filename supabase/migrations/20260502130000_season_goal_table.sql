-- ============================================
-- 20260502130000_season_goal_table.sql
-- Season-scoped goals for tracking KPIs and targets.
-- Each goal belongs to a season and can have an optional
-- numeric target with a unit (e.g., 30%, 500000 NOK).
-- ============================================

-- ── Enum ──

CREATE TYPE season_goal_status AS ENUM ('active', 'completed', 'cancelled');

-- ── Table ──

CREATE TABLE IF NOT EXISTS public.season_goal (
  season_goal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES public.season(season_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  metric_key TEXT,
  target_value NUMERIC(12,2),
  target_unit TEXT,
  status season_goal_status NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profile(profile_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_season_goal_updated_at
  BEFORE UPDATE ON public.season_goal
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Indexes ──

CREATE INDEX idx_season_goal_season
  ON public.season_goal(season_id);

CREATE INDEX idx_season_goal_workspace
  ON public.season_goal(workspace_id);

-- ── RLS ──

ALTER TABLE public.season_goal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_season_goal" ON public.season_goal;
CREATE POLICY "jwt_read_season_goal" ON public.season_goal
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

DROP POLICY IF EXISTS "jwt_write_season_goal" ON public.season_goal;
CREATE POLICY "jwt_write_season_goal" ON public.season_goal
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "api_key_read_season_goal" ON public.season_goal;
CREATE POLICY "api_key_read_season_goal" ON public.season_goal
  FOR SELECT USING (workspace_id = get_api_workspace_id());
