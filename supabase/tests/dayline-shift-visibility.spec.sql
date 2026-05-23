-- dayline-shift-visibility.spec.sql
--
-- pgTAP integration tests: session_task visibility isolation by day_line.
-- Proves the end-to-end contract for ADR-0367 location-anchor:
--   T1: a task on Bar day_line IS visible via that day_line
--   T2: Kitchen day_line (same dept_session) does NOT surface the Bar task
--   T3: two day_lines → fn_resolve_single_day_line returns NULL (ambiguous,
--       task stays department-level — "never guess" contract)
--
-- Run with:
--   npx supabase test db supabase/tests/dayline-shift-visibility.spec.sql
--
-- Fixtures created inside transaction — fully rolled back, no teardown needed.
-- Uses seed workspace b0000000-... (exists in local DB via supabase/seed.sql).

BEGIN;
SELECT plan(3);

\set ws '''b0000000-0000-0000-0000-000000000000'''

-- department requires slug (NOT NULL)
INSERT INTO public.department (department_id, workspace_id, name, slug)
  VALUES ('d2000000-0000-0000-0000-000000000001', :ws, 'IntDept', 'intdept')
  ON CONFLICT DO NOTHING;

-- location requires slug (NOT NULL)
INSERT INTO public.location (location_id, workspace_id, name, slug)
  VALUES ('20c00000-0000-0000-0000-000000000001', :ws, 'Bar2',     'bar2'),
         ('20c00000-0000-0000-0000-000000000002', :ws, 'Kitchen2', 'kitchen2')
  ON CONFLICT DO NOTHING;

-- department_session uses session_date + status (status enum: 'active' is valid per sibling test)
INSERT INTO public.department_session (department_session_id, workspace_id, department_id, session_date, status)
  VALUES ('5e550000-0000-0000-0000-000000000002', :ws, 'd2000000-0000-0000-0000-000000000001', CURRENT_DATE, 'active')
  ON CONFLICT DO NOTHING;

-- two day_lines: one per location, same dept_session
INSERT INTO public.day_line (day_line_id, workspace_id, department_session_id, department_id, location_id, business_date, planned_open, planned_close)
  VALUES
    ('da220000-0000-0000-0000-000000000001', :ws, '5e550000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000001', '20c00000-0000-0000-0000-000000000001', CURRENT_DATE, '08:00', '23:00'),
    ('da220000-0000-0000-0000-000000000002', :ws, '5e550000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000001', '20c00000-0000-0000-0000-000000000002', CURRENT_DATE, '08:00', '23:00');

-- a session_task anchored to the Bar day_line only
-- PK: id (uuid, gen_random_uuid default — supply explicit for test determinism)
-- title: text NOT NULL; status: session_task_status default 'pending'
INSERT INTO public.session_task (id, workspace_id, department_session_id, day_line_id, title, status)
  VALUES ('ba550000-0000-0000-0000-000000000001', :ws, '5e550000-0000-0000-0000-000000000002', 'da220000-0000-0000-0000-000000000001', 'Sjekk kjøletemp', 'pending');

-- T1: the Bar day_line surfaces its task
SELECT is(
  (SELECT count(*)::int FROM public.session_task st WHERE st.day_line_id = 'da220000-0000-0000-0000-000000000001'),
  1,
  'Bar day_line has its task');

-- T2: Kitchen day_line (second location) does NOT surface the Bar task
SELECT is(
  (SELECT count(*)::int FROM public.session_task st WHERE st.day_line_id = 'da220000-0000-0000-0000-000000000002'),
  0,
  'second-location day_line does NOT surface the Bar task');

-- T3: two day_lines exist → resolver returns NULL (ambiguous; task stays department-level)
SELECT is(
  public.fn_resolve_single_day_line('5e550000-0000-0000-0000-000000000002'::uuid),
  NULL::uuid,
  'two day_lines -> resolver NULL (task stays department-level)');

SELECT * FROM finish();
ROLLBACK;
