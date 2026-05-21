-- dayline-anchor.spec.sql
--
-- pgTAP tests for fn_resolve_single_day_line (migration 20260621200103).
-- Verifies the NULL-on-ambiguity contract from ADR-0367 + council Q-C:
--   - zero day_lines  → NULL
--   - exactly one     → that day_line_id
--   - two or more     → NULL (never guess)
--
-- Run with:
--   npx supabase test db supabase/tests/dayline-anchor.spec.sql
--
-- Fixtures created inside transaction — fully rolled back, no teardown needed.
-- Uses seed workspace b0000000-... (exists in local DB via supabase/seed.sql).

BEGIN;
SELECT plan(3);

\set ws '''b0000000-0000-0000-0000-000000000000'''

-- department requires slug (NOT NULL)
INSERT INTO public.department (department_id, workspace_id, name, slug)
  VALUES ('d1000000-0000-0000-0000-000000000001', :ws, 'TestDept', 'testdept')
  ON CONFLICT DO NOTHING;

-- location requires slug (NOT NULL)
INSERT INTO public.location (location_id, workspace_id, name, slug)
  VALUES ('10c00000-0000-0000-0000-000000000001', :ws, 'Bar',     'bar'),
         ('10c00000-0000-0000-0000-000000000002', :ws, 'Kitchen', 'kitchen')
  ON CONFLICT DO NOTHING;

-- department_session uses session_date (not business_date)
INSERT INTO public.department_session (department_session_id, workspace_id, department_id, session_date, status)
  VALUES ('5e550000-0000-0000-0000-000000000001', :ws, 'd1000000-0000-0000-0000-000000000001', CURRENT_DATE, 'upcoming')
  ON CONFLICT DO NOTHING;

-- T1: zero day_lines → NULL
SELECT is(
  public.fn_resolve_single_day_line('5e550000-0000-0000-0000-000000000001'::uuid),
  NULL::uuid,
  'zero day_lines returns NULL');

-- T2: exactly one day_line → its id
INSERT INTO public.day_line (day_line_id, workspace_id, department_session_id, department_id, location_id, business_date, planned_open, planned_close)
  VALUES ('da110000-0000-0000-0000-000000000001', :ws, '5e550000-0000-0000-0000-000000000001',
          'd1000000-0000-0000-0000-000000000001', '10c00000-0000-0000-0000-000000000001', CURRENT_DATE, '08:00', '23:00');

SELECT is(
  public.fn_resolve_single_day_line('5e550000-0000-0000-0000-000000000001'::uuid),
  'da110000-0000-0000-0000-000000000001'::uuid,
  'one day_line returns its id');

-- T3: two day_lines → NULL (no guess)
INSERT INTO public.day_line (day_line_id, workspace_id, department_session_id, department_id, location_id, business_date, planned_open, planned_close)
  VALUES ('da110000-0000-0000-0000-000000000002', :ws, '5e550000-0000-0000-0000-000000000001',
          'd1000000-0000-0000-0000-000000000001', '10c00000-0000-0000-0000-000000000002', CURRENT_DATE, '08:00', '23:00');

SELECT is(
  public.fn_resolve_single_day_line('5e550000-0000-0000-0000-000000000001'::uuid),
  NULL::uuid,
  'multiple day_lines returns NULL (no guess)');

SELECT * FROM finish();
ROLLBACK;
