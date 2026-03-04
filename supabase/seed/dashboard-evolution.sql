-- Seed Data: Dashboard Evolution Tables
-- ==============================================================================
-- Populates workspace_kpi_target, operating_hours, workspace_budget,
-- and schedule_day_info for the seed workspace (b0000000-...).
-- Safe to re-run: uses ON CONFLICT DO NOTHING or WHERE NOT EXISTS guards.
-- ==============================================================================

-- Workspace ID from seed.sql
-- 'b0000000-0000-0000-0000-000000000000' = HQ Workspace

-- ============================================================================
-- 1. KPI Targets (6 metrics)
-- ============================================================================

INSERT INTO public.workspace_kpi_target (workspace_id, metric, target_value, benchmark_value)
VALUES
  ('b0000000-0000-0000-0000-000000000000', 'cost_of_sales',      30,  30),
  ('b0000000-0000-0000-0000-000000000000', 'turnover_90d',       15,  15),
  ('b0000000-0000-0000-0000-000000000000', 'absence_rate',        4,   4),
  ('b0000000-0000-0000-0000-000000000000', 'time_to_job_ready',   7,   7),
  ('b0000000-0000-0000-0000-000000000000', 'task_completion',     90,  90),
  ('b0000000-0000-0000-0000-000000000000', 'training_readiness', 100, 100)
ON CONFLICT (workspace_id, metric) DO NOTHING;

-- ============================================================================
-- 2. Operating Hours (Mon-Sun, workspace-level — location_id NULL)
-- ============================================================================
-- Note: The UNIQUE constraint on (workspace_id, location_id, day_of_week) treats
-- NULLs as distinct in standard PostgreSQL, so ON CONFLICT won't match NULL
-- location_id rows. We use a NOT EXISTS guard instead for idempotency.

INSERT INTO public.operating_hours (workspace_id, day_of_week, open_time, close_time, is_closed)
SELECT v.workspace_id, v.day_of_week, v.open_time::time, v.close_time::time, v.is_closed
FROM (VALUES
  ('b0000000-0000-0000-0000-000000000000'::uuid, 0, '07:00', '23:00', false),
  ('b0000000-0000-0000-0000-000000000000'::uuid, 1, '07:00', '23:00', false),
  ('b0000000-0000-0000-0000-000000000000'::uuid, 2, '07:00', '23:00', false),
  ('b0000000-0000-0000-0000-000000000000'::uuid, 3, '07:00', '23:00', false),
  ('b0000000-0000-0000-0000-000000000000'::uuid, 4, '07:00', '00:00', false),
  ('b0000000-0000-0000-0000-000000000000'::uuid, 5, '10:00', '00:00', false),
  ('b0000000-0000-0000-0000-000000000000'::uuid, 6, '10:00', '22:00', false)
) AS v(workspace_id, day_of_week, open_time, close_time, is_closed)
WHERE NOT EXISTS (
  SELECT 1 FROM public.operating_hours oh
  WHERE oh.workspace_id = v.workspace_id
    AND oh.day_of_week = v.day_of_week
    AND oh.location_id IS NULL
);

-- ============================================================================
-- 3. Workspace Budget — Monthly (March 2026)
-- ============================================================================

INSERT INTO public.workspace_budget (
  workspace_id, period_type, period_date,
  revenue_target, labor_cost_target, food_cost_target,
  cost_of_sales_target, currency
)
VALUES (
  'b0000000-0000-0000-0000-000000000000', 'monthly', '2026-03-01',
  500000, 150000, 100000, 30, 'NOK'
)
ON CONFLICT (workspace_id, location_id, department_id, period_type, period_date, hour_slot)
DO NOTHING;

-- ============================================================================
-- 4. Workspace Budget — Daily (first 2 weeks of March 2026)
-- ============================================================================

INSERT INTO public.workspace_budget (workspace_id, period_type, period_date, revenue_target, labor_cost_target, currency)
SELECT
  'b0000000-0000-0000-0000-000000000000'::uuid,
  'daily'::budget_period_type,
  d::date,
  CASE EXTRACT(dow FROM d::date)
    WHEN 0 THEN 12000
    WHEN 5 THEN 25000
    WHEN 6 THEN 22000
    ELSE 16000
  END,
  CASE EXTRACT(dow FROM d::date)
    WHEN 0 THEN 4000
    WHEN 5 THEN 8000
    WHEN 6 THEN 7000
    ELSE 5000
  END,
  'NOK'
FROM generate_series('2026-03-01'::date, '2026-03-14'::date, '1 day') AS d
ON CONFLICT (workspace_id, location_id, department_id, period_type, period_date, hour_slot)
DO NOTHING;

-- ============================================================================
-- 5. Schedule Day Info (events, alerts, notes)
-- ============================================================================

INSERT INTO public.schedule_day_info (workspace_id, date, title, content, category, scope_type)
VALUES
  ('b0000000-0000-0000-0000-000000000000', '2026-03-05', 'Wine Tasting Evening',
   'Special event: 40 guests expected', 'event', 'workspace'),
  ('b0000000-0000-0000-0000-000000000000', '2026-03-08', 'Health Inspector Visit',
   'Annual inspection — HACCP docs ready', 'alert', 'workspace'),
  ('b0000000-0000-0000-0000-000000000000', '2026-03-10', 'New Menu Launch',
   'Spring menu starts', 'note', 'workspace'),
  ('b0000000-0000-0000-0000-000000000000', '2026-03-12', 'Staff Training Day',
   'Wine training 10:00-12:00', 'event', 'workspace');
