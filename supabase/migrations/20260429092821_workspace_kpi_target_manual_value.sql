-- Migration: workspace_kpi_target manual override
-- Adds optional manual_value to KPI targets so admin can fill in numbers
-- (varekostnad, fraværsrate, personalomsetning, etc.) when the system
-- doesn't have data yet. Surfaced on the "Innsikt" view (formerly "Strategi").
--
-- Persistence is co-located on the existing target row — same enum metric,
-- same workspace scope. RLS already covers the row.

SET search_path TO public, extensions;

ALTER TABLE public.workspace_kpi_target
  ADD COLUMN IF NOT EXISTS manual_value DECIMAL,
  ADD COLUMN IF NOT EXISTS manual_value_unit TEXT,
  ADD COLUMN IF NOT EXISTS manual_value_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manual_value_set_by UUID REFERENCES public.profile(profile_id);

COMMENT ON COLUMN public.workspace_kpi_target.manual_value IS
  'Admin-entered actual value for the metric when system data is unavailable. Renders on Innsikt view alongside system-computed value.';
COMMENT ON COLUMN public.workspace_kpi_target.manual_value_set_at IS
  'Timestamp when manual_value was last set/updated.';
COMMENT ON COLUMN public.workspace_kpi_target.manual_value_set_by IS
  'Profile that set the manual_value last. Null when system-computed only.';
