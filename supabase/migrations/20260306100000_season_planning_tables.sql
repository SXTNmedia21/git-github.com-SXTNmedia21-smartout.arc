SET search_path TO public, extensions;

-- ============================================
-- 20260306100000_season_planning_tables.sql
-- Module 15: Season Planning & Budget Engine (MVP)
-- Creates 3 tables:
--   season_budget  — 1:1 with season, revenue targets + labor model
--   day_factor     — per-weekday revenue distribution factors
--   hour_factor    — per-hour revenue distribution factors
-- Source: docs/modules/SMARTOUT_MODULE_15_SEASON_PLANNING.md
-- ============================================

-- ── Enum ──────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budget_status') THEN
    CREATE TYPE public.budget_status AS ENUM ('draft', 'active', 'locked');
  END IF;
END $$;;

-- ── season_budget ─────────────────────────────
-- Strategic season-level planning: total target, labor model, base pricing.
-- 1:1 with season. NOT the same as workspace_budget (operational per-date targets).
CREATE TABLE IF NOT EXISTS public.season_budget (
  season_budget_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id            UUID NOT NULL REFERENCES public.season(season_id) ON DELETE CASCADE,
  workspace_id         UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,

  -- Revenue target
  total_target_revenue DECIMAL NOT NULL DEFAULT 0,

  -- Base pricing
  base_price_per_guest DECIMAL,
  season_price_factor  DECIMAL NOT NULL DEFAULT 1.0,

  -- Labor target
  target_labor_percentage DECIMAL NOT NULL DEFAULT 0.30,
  avg_hourly_wage         DECIMAL,

  -- Status (mirrors season lifecycle)
  status               public.budget_status NOT NULL DEFAULT 'draft',

  created_by           UUID REFERENCES public.profile(profile_id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One budget per season
  CONSTRAINT uq_season_budget_season UNIQUE (season_id)
);

COMMENT ON TABLE public.season_budget IS 'Season-level financial planning. 1:1 with season. Module 15.';
COMMENT ON COLUMN public.season_budget.total_target_revenue IS 'Total NOK revenue target for the entire season period.';
COMMENT ON COLUMN public.season_budget.target_labor_percentage IS 'Target labor cost as fraction of revenue (0.30 = 30%).';
COMMENT ON COLUMN public.season_budget.season_price_factor IS 'Multiplier on base_price_per_guest for this season (e.g. 1.2 for Christmas).';

-- RLS
ALTER TABLE public.season_budget ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_season_budget" ON public.season_budget;
CREATE POLICY "jwt_read_season_budget" ON public.season_budget
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_write_season_budget" ON public.season_budget;
CREATE POLICY "jwt_write_season_budget" ON public.season_budget
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "api_key_read_season_budget" ON public.season_budget;
CREATE POLICY "api_key_read_season_budget" ON public.season_budget
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_season_budget_workspace ON public.season_budget(workspace_id);
CREATE INDEX IF NOT EXISTS idx_season_budget_season ON public.season_budget(season_id);

-- Trigger
DROP TRIGGER IF EXISTS set_season_budget_updated_at ON public.season_budget;
CREATE TRIGGER set_season_budget_updated_at
  BEFORE UPDATE ON public.season_budget
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── day_factor ────────────────────────────────
-- Per-weekday revenue distribution. Relative factors (not percentages).
-- Factor 2.5 = 2.5x the baseline. System normalizes at calculation time.
CREATE TABLE IF NOT EXISTS public.day_factor (
  day_factor_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_budget_id UUID NOT NULL REFERENCES public.season_budget(season_budget_id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,

  weekday         INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  factor          DECIMAL NOT NULL DEFAULT 1.0 CHECK (factor > 0),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One factor per weekday per budget
  CONSTRAINT uq_day_factor_weekday UNIQUE (season_budget_id, weekday)
);

COMMENT ON TABLE public.day_factor IS 'Per-weekday revenue distribution factors. 0=Mon...6=Sun. Module 15.';
COMMENT ON COLUMN public.day_factor.factor IS 'Relative weight. Higher = more revenue expected. Normalized at calc time.';

-- RLS
ALTER TABLE public.day_factor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_day_factor" ON public.day_factor;
CREATE POLICY "jwt_read_day_factor" ON public.day_factor
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_write_day_factor" ON public.day_factor;
CREATE POLICY "jwt_write_day_factor" ON public.day_factor
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "api_key_read_day_factor" ON public.day_factor;
CREATE POLICY "api_key_read_day_factor" ON public.day_factor
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_day_factor_budget ON public.day_factor(season_budget_id);

-- Trigger
DROP TRIGGER IF EXISTS set_day_factor_updated_at ON public.day_factor;
CREATE TRIGGER set_day_factor_updated_at
  BEFORE UPDATE ON public.day_factor
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── hour_factor ───────────────────────────────
-- Per-hour revenue distribution within a day.
-- Only relevant for open hours. Factor 2.4 at 19:00 = peak dinner.
CREATE TABLE IF NOT EXISTS public.hour_factor (
  hour_factor_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_budget_id UUID NOT NULL REFERENCES public.season_budget(season_budget_id) ON DELETE CASCADE,
  workspace_id     UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,

  hour             INTEGER NOT NULL CHECK (hour BETWEEN 0 AND 23),
  factor           DECIMAL NOT NULL DEFAULT 1.0 CHECK (factor > 0),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One factor per hour per budget
  CONSTRAINT uq_hour_factor_hour UNIQUE (season_budget_id, hour)
);

COMMENT ON TABLE public.hour_factor IS 'Per-hour revenue distribution factors. 0-23 hour slots. Module 15.';
COMMENT ON COLUMN public.hour_factor.factor IS 'Relative weight within day. 19:00 peak might be 2.4, 15:00 quiet might be 0.6.';

-- RLS
ALTER TABLE public.hour_factor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_hour_factor" ON public.hour_factor;
CREATE POLICY "jwt_read_hour_factor" ON public.hour_factor
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_write_hour_factor" ON public.hour_factor;
CREATE POLICY "jwt_write_hour_factor" ON public.hour_factor
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "api_key_read_hour_factor" ON public.hour_factor;
CREATE POLICY "api_key_read_hour_factor" ON public.hour_factor
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hour_factor_budget ON public.hour_factor(season_budget_id);

-- Trigger
DROP TRIGGER IF EXISTS set_hour_factor_updated_at ON public.hour_factor;
CREATE TRIGGER set_hour_factor_updated_at
  BEFORE UPDATE ON public.hour_factor
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
