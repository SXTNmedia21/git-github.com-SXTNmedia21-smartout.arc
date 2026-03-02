-- Migration: Dashboard Evolution Tables
-- Creates 4 new tables for dashboard KPI targets, operating hours, budgets, and schedule day info.
-- All tables follow mandatory RLS pattern: JWT read/write + API key read.

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE public.budget_period_type AS ENUM ('monthly', 'weekly', 'daily', 'hourly');
CREATE TYPE public.day_info_scope AS ENUM ('workspace', 'department', 'team');
CREATE TYPE public.day_info_category AS ENUM ('note', 'event', 'alert', 'budget_note');

-- ============================================================================
-- TABLE 1: workspace_kpi_target
-- Per-workspace KPI targets and benchmarks for the strategic dashboard view.
-- ============================================================================

CREATE TABLE public.workspace_kpi_target (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  metric TEXT NOT NULL CHECK (metric IN (
    'cost_of_sales', 'turnover_90d', 'absence_rate',
    'time_to_job_ready', 'task_completion', 'training_readiness'
  )),
  target_value DECIMAL NOT NULL,
  benchmark_value DECIMAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, metric)
);

-- RLS
ALTER TABLE public.workspace_kpi_target ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_workspace_kpi_target" ON public.workspace_kpi_target
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "jwt_write_workspace_kpi_target" ON public.workspace_kpi_target
  FOR ALL USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "api_key_read_workspace_kpi_target" ON public.workspace_kpi_target
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- Indexes
CREATE INDEX idx_workspace_kpi_target_workspace_id ON public.workspace_kpi_target(workspace_id);

-- ============================================================================
-- TABLE 2: operating_hours
-- Per-workspace (optionally per-location) weekly operating hours.
-- ============================================================================

CREATE TABLE public.operating_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.location(location_id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time TIME NOT NULL DEFAULT '08:00',
  close_time TIME NOT NULL DEFAULT '22:00',
  is_closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, location_id, day_of_week)
);

-- RLS
ALTER TABLE public.operating_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_operating_hours" ON public.operating_hours
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "jwt_write_operating_hours" ON public.operating_hours
  FOR ALL USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "api_key_read_operating_hours" ON public.operating_hours
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- Indexes
CREATE INDEX idx_operating_hours_workspace_id ON public.operating_hours(workspace_id);
CREATE INDEX idx_operating_hours_location_id ON public.operating_hours(location_id);

-- ============================================================================
-- TABLE 3: workspace_budget
-- Granular budget targets per workspace/location/department with flexible periods.
-- ============================================================================

CREATE TABLE public.workspace_budget (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.location(location_id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.department(department_id) ON DELETE CASCADE,
  period_type public.budget_period_type NOT NULL,
  period_date DATE NOT NULL,
  hour_slot INT CHECK (hour_slot BETWEEN 0 AND 23),
  revenue_target DECIMAL,
  food_cost_target DECIMAL,
  cost_of_sales_target DECIMAL,
  labor_cost_target DECIMAL,
  labor_hours_target DECIMAL,
  overtime_limit_hours DECIMAL,
  turnover_target DECIMAL,
  absence_threshold DECIMAL,
  time_to_job_target DECIMAL,
  currency TEXT NOT NULL DEFAULT 'NOK',
  notes TEXT,
  created_by UUID REFERENCES public.user_identity(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (workspace_id, location_id, department_id, period_type, period_date, hour_slot)
);

-- RLS
ALTER TABLE public.workspace_budget ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_workspace_budget" ON public.workspace_budget
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "jwt_write_workspace_budget" ON public.workspace_budget
  FOR ALL USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "api_key_read_workspace_budget" ON public.workspace_budget
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- Indexes
CREATE INDEX idx_workspace_budget_workspace_id ON public.workspace_budget(workspace_id);
CREATE INDEX idx_workspace_budget_location_id ON public.workspace_budget(location_id);
CREATE INDEX idx_workspace_budget_department_id ON public.workspace_budget(department_id);
CREATE INDEX idx_workspace_budget_period ON public.workspace_budget(workspace_id, period_type, period_date);

-- ============================================================================
-- TABLE 4: schedule_day_info
-- Day-level notes, events, alerts attached to the schedule view.
-- ============================================================================

CREATE TABLE public.schedule_day_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  scope_type public.day_info_scope NOT NULL DEFAULT 'workspace',
  scope_id UUID,
  title TEXT NOT NULL,
  content TEXT,
  category public.day_info_category NOT NULL DEFAULT 'note',
  created_by UUID REFERENCES public.user_identity(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.schedule_day_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_schedule_day_info" ON public.schedule_day_info
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "jwt_write_schedule_day_info" ON public.schedule_day_info
  FOR ALL USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "api_key_read_schedule_day_info" ON public.schedule_day_info
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- Indexes
CREATE INDEX idx_schedule_day_info_workspace_id ON public.schedule_day_info(workspace_id);
CREATE INDEX idx_schedule_day_info_date ON public.schedule_day_info(workspace_id, date);
CREATE INDEX idx_schedule_day_info_scope ON public.schedule_day_info(scope_type, scope_id);

-- ============================================================================
-- updated_at triggers (reuse existing public.set_updated_at() function)
-- ============================================================================

CREATE TRIGGER set_workspace_kpi_target_updated_at
  BEFORE UPDATE ON public.workspace_kpi_target
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_operating_hours_updated_at
  BEFORE UPDATE ON public.operating_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_workspace_budget_updated_at
  BEFORE UPDATE ON public.workspace_budget
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_schedule_day_info_updated_at
  BEFORE UPDATE ON public.schedule_day_info
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
