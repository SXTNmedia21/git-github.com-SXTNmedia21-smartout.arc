-- Migration: workspace_kpi_manual_value
-- Per-day admin-entered KPI values. Replaces the one-row override on
-- workspace_kpi_target.manual_value with a time-series. Each manual save
-- registers the value for a specific date, so admin can backfill or
-- update day-by-day. The Innsikt view reads the latest row.

SET search_path TO public, extensions;

CREATE TABLE IF NOT EXISTS public.workspace_kpi_manual_value (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  metric TEXT NOT NULL CHECK (metric IN (
    'cost_of_sales',
    'turnover_90d',
    'absence_rate',
    'time_to_job_ready',
    'task_completion',
    'training_readiness'
  )),
  value_date DATE NOT NULL DEFAULT CURRENT_DATE,
  value DECIMAL NOT NULL,
  unit TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profile(profile_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, metric, value_date)
);

COMMENT ON TABLE public.workspace_kpi_manual_value IS
  'Per-day admin-entered KPI values for the Innsikt view. Falls back when system data is unavailable. Latest value_date wins for the live display.';

ALTER TABLE public.workspace_kpi_manual_value ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_workspace_kpi_manual_value" ON public.workspace_kpi_manual_value;
CREATE POLICY "jwt_read_workspace_kpi_manual_value" ON public.workspace_kpi_manual_value
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_write_workspace_kpi_manual_value" ON public.workspace_kpi_manual_value;
CREATE POLICY "jwt_write_workspace_kpi_manual_value" ON public.workspace_kpi_manual_value
  FOR ALL USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "service_role_workspace_kpi_manual_value" ON public.workspace_kpi_manual_value;
CREATE POLICY "service_role_workspace_kpi_manual_value" ON public.workspace_kpi_manual_value
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_workspace_kpi_manual_value_lookup
  ON public.workspace_kpi_manual_value (workspace_id, metric, value_date DESC);

DROP TRIGGER IF EXISTS set_workspace_kpi_manual_value_updated_at ON public.workspace_kpi_manual_value;
CREATE TRIGGER set_workspace_kpi_manual_value_updated_at
  BEFORE UPDATE ON public.workspace_kpi_manual_value
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
