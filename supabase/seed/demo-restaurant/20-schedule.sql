-- =============================================================================
-- DEMO RESTAURANT SEED: 20-schedule.sql
-- D6 Production layer — full current week (Mon–Sun)
-- =============================================================================
-- Target workspace : b0000000-0000-0000-0000-000000000000
-- Week anchor      : date_trunc('week', CURRENT_DATE)::date  (Monday)
-- Busy Saturday    : anchor + 5
-- Purpose          : Realistic weekly restaurant roster + session_tasks,
--                    time_entry punches for closed days, absences, deviations.
--                    Consolidates and replaces supabase/seed/demo-day-2026-05-29.sql
-- Safe to re-run   : YES — child→parent delete before each insert block.
-- Do NOT use       : against production. LOCAL Supabase only.
-- Date-dynamic     : NO hardcoded 'YYYY-MM-DD' business dates anywhere.
--
-- ============ CANONICAL ID MAP ===============================================
-- WORKSPACE      b0000000-0000-0000-0000-000000000000  "Demo Restaurant"
-- LOCATION       c0000000-0000-0000-0000-000000000000  Oslo Downtown Hub
-- ZONE Hovedsal  d1000000-0000-0000-0000-000000000001
-- ZONE Terrasse  d1000000-0000-0000-0000-000000000002
-- ZONE Bar-omr.  d1000000-0000-0000-0000-000000000003
-- ZONE Privat    d1000000-0000-0000-0000-000000000004
-- DEPT Operations d0000000-0000-0000-0000-000000000000
-- DEPT Kitchen   d0000000-0000-0000-0000-000000000001
-- DEPT Service   d0000000-0000-0000-0000-000000000002
-- DEPT Bar       d0000000-0000-0000-0000-000000000003
-- PROFILES f0…0 (Admin/owner) | f0…1 (Anna Olsen, Kitchen, active)
--          f0…2 (Erik Pedersen, Kitchen, manager) | f0…4 (Ole Torp, Bar, active)
--          f0…5 (Kari Nilsen, Service, trainee)   | f0…8 (Jonas Bakken, Kitchen, trainee)
--          f0…9 (Silje Ruud, Service, trainee)    | f0…a (Sofia Berg, Service, active)
--          f0…b (Mats Holm, Bar, active)           | f0…c (Nora Lie, Kitchen, active)
--          f0…d (Even Aas, Service, active)        | f0…3 (Lise Markussen, Service, inactive)
-- =============================================================================
--
-- SHIFT ID SCHEME (32 shifts total; stable UUIDs for shift_zone DO-blocks):
--   Mon(+0)  : 1000…0011..0014   Tue(+1) : 1000…0021..0024
--   Wed(+2)  : 1000…0031..0034   Thu(+3) : 1000…0041..0045
--   Fri(+4)  : 1000…0051..0056   Sat(+5) : 1000…0061..006e (busy, 14 shifts)
--   Sun(+6)  : 1000…0071..0073
-- =============================================================================

BEGIN;

-- ===========================================================================
-- STEP 1: CLEAN — full child-before-parent ordering
--
-- FK topology for this workspace (NO ACTION = must delete explicitly):
--   deviation            → schedule_shift (linked_shift_id NO ACTION)
--   deviation            → session_task   (source_task_id NO ACTION)
--   deviation            → department_session (session_id NO ACTION)
--   deviation            → day_line       (day_line_id NO ACTION)
--   timesheet.time_entry → schedule_shift (shift_id NO ACTION)
--   shift_approval       → schedule_shift (shift_id NO ACTION)
--   tip_distribution     → schedule_shift (shift_id NO ACTION)
--   shift_cost_snapshot  → schedule_shift (shift_id NO ACTION) + CASCADE on schedule_shift_id
--   daily_reconciliation → department_session (session_id NO ACTION)
--   channel              → department_session (session_id NO ACTION)
--   haccp_log            → department_session (session_id NO ACTION)
--   waste_log            → department_session (session_id NO ACTION)
--   schedule_day_booking → day_line        (day_line_id NO ACTION)
--   session_task         → day_line        (day_line_id NO ACTION; CASCADE from dept_session)
--   shift_zone           → day_line        (day_line_id NO ACTION; also CASCADE via shift_session_day_line)
--   shift_session        → department_session (NO ACTION)
--
-- Safe ordering: deviation first (it references the most tables), then all
-- leaf children of schedule_shift, then schedule_shift itself (cascades
-- shift_session → shift_session_day_line → shift_zone), then channel/
-- daily_reconciliation/haccp_log/waste_log children of department_session,
-- then day_line (after shift_zone is gone), then department_session.
-- ===========================================================================

-- Deviation references: shift, session_task, department_session, day_line
-- Delete deviation first so nothing blocks below.
DELETE FROM public.deviation
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- Other leaf children of schedule_shift (NO ACTION FKs)
DELETE FROM timesheet.time_entry
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

DELETE FROM public.shift_approval
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

DELETE FROM public.tip_distribution
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- shift_cost_snapshot: has CASCADE (schedule_shift_id) AND NO ACTION (shift_id)
-- Explicit delete before schedule_shift to avoid NO ACTION violation.
DELETE FROM public.shift_cost_snapshot
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- schedule_absence (no FK to shift — standalone)
DELETE FROM public.schedule_absence
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- Temporal lock trigger blocks DELETE on shifts whose time has passed.
-- Disable it locally — never against prod.
ALTER TABLE public.schedule_shift DISABLE TRIGGER trg_schedule_shift_temporal_lock;

-- Delete shifts: cascades shift_session → shift_session_day_line → shift_zone
DELETE FROM public.schedule_shift
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- Children of department_session that must go before department_session delete
DELETE FROM public.daily_reconciliation
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

DELETE FROM public.channel
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

DELETE FROM public.haccp_log
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

DELETE FROM public.waste_log
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- shift_zone may still reference day_line (NO ACTION) after above cascades
-- if the trigger didn't fire for all rows. Delete explicitly.
DELETE FROM public.shift_zone
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- schedule_day_booking references day_line (NO ACTION)
DELETE FROM public.schedule_day_booking
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- session_task references day_line (NO ACTION) — also cascades from department_session.
-- session_task already gone (either via shift cascade or explicit below);
-- delete explicitly to be safe before day_line.
DELETE FROM public.session_task
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- Day lines
DELETE FROM public.day_line
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- shift_session may still reference department_session (NO ACTION).
-- After schedule_shift CASCADE it should be empty — delete guard.
DELETE FROM public.shift_session
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- Department sessions (session_task already gone above)
DELETE FROM public.department_session
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- ===========================================================================
-- STEP 2: DEPARTMENT SESSIONS — 4 depts × 7 days = 28 rows
-- session_date relative to week anchor.
-- Status logic:
--   session_date < CURRENT_DATE → closed
--   session_date = CURRENT_DATE → active
--   session_date > CURRENT_DATE → upcoming
-- ===========================================================================

INSERT INTO public.department_session (
  department_session_id, workspace_id, department_id,
  session_date, status,
  planned_open, planned_close,
  planned_shifts, duty_leader_id,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  'b0000000-0000-0000-0000-000000000000',
  dept_id,
  (date_trunc('week', CURRENT_DATE)::date + day_offset),
  CASE
    WHEN (date_trunc('week', CURRENT_DATE)::date + day_offset) < CURRENT_DATE THEN 'closed'::department_session_status
    WHEN (date_trunc('week', CURRENT_DATE)::date + day_offset) = CURRENT_DATE THEN 'active'::department_session_status
    ELSE 'upcoming'::department_session_status
  END,
  '10:00'::time,
  '23:00'::time,
  CASE
    WHEN day_offset = 5 THEN 4  -- Saturday: full roster per dept
    ELSE 2
  END,
  'f0000000-0000-0000-0000-000000000000',
  now(),
  now()
FROM (VALUES
  ('d0000000-0000-0000-0000-000000000000'::uuid),
  ('d0000000-0000-0000-0000-000000000001'::uuid),
  ('d0000000-0000-0000-0000-000000000002'::uuid),
  ('d0000000-0000-0000-0000-000000000003'::uuid)
) AS depts(dept_id)
CROSS JOIN generate_series(0, 6) AS day_offset;

-- ===========================================================================
-- STEP 3: DAY LINES — one per dept per day, mirroring department_session
-- business_date = session_date
-- created_by = Local Admin f0000000-…-0
-- ===========================================================================

INSERT INTO public.day_line (
  day_line_id, workspace_id, department_session_id,
  department_id, location_id, business_date,
  planned_open, planned_close,
  is_backfilled, created_by,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  'b0000000-0000-0000-0000-000000000000',
  ds.department_session_id,
  ds.department_id,
  'c0000000-0000-0000-0000-000000000000',
  ds.session_date,
  '10:00'::time,
  '23:00'::time,
  false,
  'f0000000-0000-0000-0000-000000000000',
  now(),
  now()
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- ===========================================================================
-- STEP 4: SCHEDULE SHIFTS
--
-- The trigger trg_ensure_shift_session auto-creates shift_session +
-- shift_session_day_line when a schedule_shift with employee_id is inserted.
-- Keep it ENABLED — it needs the day_line for (dept, date) to already exist.
--
-- Temporal lock trigger remains DISABLED through all shift inserts.
-- We re-enable it at STEP 7 after all inserts are complete.
--
-- Shift ID scheme: 10000000-0000-0000-0000-00000000XXYY
--   XX = day offset (00=Mon … 06=Sun), YY = shift number within day
-- ===========================================================================

-- ── MONDAY (anchor + 0) — light coverage ─────────────────────────────────────

-- Kitchen: Anna Olsen, Kokk morning
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000011',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001', 'Kokk',
  date_trunc('week', CURRENT_DATE)::date + 0, '08:00', '16:00', 7.50, 30,
  'morning', 'published', true, 'orange', 'operational');

-- Service: Kari Nilsen, Servitør midday
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000012',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002',
  'f0000000-0000-0000-0000-000000000005', 'Servitør',
  date_trunc('week', CURRENT_DATE)::date + 0, '11:00', '19:00', 7.50, 30,
  'midday', 'published', true, 'blue', 'operational');

-- Bar: Ole Torp, Bartender evening
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000013',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000003',
  'f0000000-0000-0000-0000-000000000004', 'Bartender',
  date_trunc('week', CURRENT_DATE)::date + 0, '16:00', '23:00', 6.50, 30,
  'evening', 'published', true, 'purple', 'operational');

-- Operations: Local Admin
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000014',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000000',
  'f0000000-0000-0000-0000-000000000000', 'Daglig leder',
  date_trunc('week', CURRENT_DATE)::date + 0, '09:00', '17:00', 7.50, 30,
  'morning', 'published', true, 'emerald', 'operational');

-- ── TUESDAY (anchor + 1) — light coverage ────────────────────────────────────

-- Kitchen: Erik Pedersen, Kjøkkensjef
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000021',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000002', 'Kjøkkensjef',
  date_trunc('week', CURRENT_DATE)::date + 1, '10:00', '20:00', 9.50, 30,
  'midday', 'published', true, 'orange', 'operational');

-- Service: Even Aas, Vertinne
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000022',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002',
  'f0000000-0000-0000-0000-00000000000d', 'Vertinne',
  date_trunc('week', CURRENT_DATE)::date + 1, '12:00', '20:00', 7.50, 30,
  'midday', 'published', true, 'blue', 'operational');

-- Bar: Mats Holm, Bartender
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000023',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000003',
  'f0000000-0000-0000-0000-00000000000b', 'Bartender',
  date_trunc('week', CURRENT_DATE)::date + 1, '16:00', '23:00', 6.50, 30,
  'evening', 'published', true, 'purple', 'operational');

-- Operations: Local Admin (short day, admin tasks)
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000024',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000000',
  'f0000000-0000-0000-0000-000000000000', 'Daglig leder',
  date_trunc('week', CURRENT_DATE)::date + 1, '09:00', '15:00', 5.50, 30,
  'morning', 'published', true, 'emerald', 'operational');

-- ── WEDNESDAY (anchor + 2) — medium coverage ─────────────────────────────────

-- Kitchen: Anna Olsen, Kokk
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000031',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001', 'Kokk',
  date_trunc('week', CURRENT_DATE)::date + 2, '08:00', '16:00', 7.50, 30,
  'morning', 'published', true, 'orange', 'operational');

-- Kitchen: Nora Lie, Konditor
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000032',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-00000000000c', 'Konditor',
  date_trunc('week', CURRENT_DATE)::date + 2, '10:00', '18:00', 7.50, 30,
  'morning', 'published', true, 'orange', 'operational');

-- Service: Silje Ruud, Servitør evening
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000033',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002',
  'f0000000-0000-0000-0000-000000000009', 'Servitør',
  date_trunc('week', CURRENT_DATE)::date + 2, '16:00', '23:00', 6.50, 30,
  'evening', 'published', true, 'blue', 'operational');

-- Bar: Ole Torp, Bartender
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000034',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000003',
  'f0000000-0000-0000-0000-000000000004', 'Bartender',
  date_trunc('week', CURRENT_DATE)::date + 2, '16:00', '23:00', 6.50, 30,
  'evening', 'published', true, 'purple', 'operational');

-- ── THURSDAY (anchor + 3) — medium coverage ──────────────────────────────────

-- Kitchen: Erik Pedersen, Kjøkkensjef
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000041',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000002', 'Kjøkkensjef',
  date_trunc('week', CURRENT_DATE)::date + 3, '12:00', '22:00', 9.50, 30,
  'midday', 'published', true, 'orange', 'operational');

-- Kitchen: Jonas Bakken, Kokk lærling
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000042',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000008', 'Kokk lærling',
  date_trunc('week', CURRENT_DATE)::date + 3, '15:00', '22:00', 6.50, 30,
  'afternoon', 'published', true, 'orange', 'operational');

-- Service: Sofia Berg, Sommelier
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000043',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002',
  'f0000000-0000-0000-0000-00000000000a', 'Sommelier',
  date_trunc('week', CURRENT_DATE)::date + 3, '16:00', '23:00', 6.50, 30,
  'evening', 'published', true, 'blue', 'operational');

-- Bar: Mats Holm, Bartender
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000044',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000003',
  'f0000000-0000-0000-0000-00000000000b', 'Bartender',
  date_trunc('week', CURRENT_DATE)::date + 3, '16:00', '23:00', 6.50, 30,
  'evening', 'published', true, 'purple', 'operational');

-- Operations: Local Admin
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000045',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000000',
  'f0000000-0000-0000-0000-000000000000', 'Daglig leder',
  date_trunc('week', CURRENT_DATE)::date + 3, '09:00', '17:00', 7.50, 30,
  'morning', 'published', true, 'emerald', 'operational');

-- ── FRIDAY (anchor + 4) — busy pre-weekend ───────────────────────────────────

-- Kitchen: Anna Olsen, Kokk morning
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000051',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001', 'Kokk',
  date_trunc('week', CURRENT_DATE)::date + 4, '08:00', '16:00', 7.50, 30,
  'morning', 'published', true, 'orange', 'operational');

-- Kitchen: Erik Pedersen, Kjøkkensjef evening
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000052',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000002', 'Kjøkkensjef',
  date_trunc('week', CURRENT_DATE)::date + 4, '14:00', '23:00', 8.50, 30,
  'afternoon', 'published', true, 'orange', 'operational');

-- Service: Kari Nilsen, Servitør
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000053',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002',
  'f0000000-0000-0000-0000-000000000005', 'Servitør',
  date_trunc('week', CURRENT_DATE)::date + 4, '11:00', '19:00', 7.50, 30,
  'midday', 'published', true, 'blue', 'operational');

-- Service: Even Aas, Vertinne evening
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000054',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002',
  'f0000000-0000-0000-0000-00000000000d', 'Vertinne',
  date_trunc('week', CURRENT_DATE)::date + 4, '17:00', '23:00', 5.50, 30,
  'evening', 'published', true, 'blue', 'operational');

-- Bar: Ole Torp, Bartender
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000055',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000003',
  'f0000000-0000-0000-0000-000000000004', 'Bartender',
  date_trunc('week', CURRENT_DATE)::date + 4, '16:00', '00:00', 7.50, 30,
  'evening', 'published', true, 'purple', 'operational');

-- Operations: Local Admin
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000056',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000000',
  'f0000000-0000-0000-0000-000000000000', 'Daglig leder',
  date_trunc('week', CURRENT_DATE)::date + 4, '09:00', '18:00', 8.50, 30,
  'morning', 'published', true, 'emerald', 'operational');

-- ── SATURDAY (anchor + 5) — BUSY DAY: 14 shifts ──────────────────────────────

-- KITCHEN (4 shifts):

-- Anna Olsen: Kokk 08:00–16:00 (prep + lunsj)
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000061',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001', 'Kokk',
  date_trunc('week', CURRENT_DATE)::date + 5, '08:00', '16:00', 7.50, 30,
  'morning', 'published', true, 'orange', 'operational');

-- Erik Pedersen: Kjøkkensjef 12:00–22:00 (kveld)
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000062',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000002', 'Kjøkkensjef',
  date_trunc('week', CURRENT_DATE)::date + 5, '12:00', '22:00', 9.50, 30,
  'midday', 'published', true, 'orange', 'operational');

-- Jonas Bakken: Kokk lærling 15:00–23:00
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000063',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000008', 'Kokk lærling',
  date_trunc('week', CURRENT_DATE)::date + 5, '15:00', '23:00', 7.50, 30,
  'afternoon', 'published', true, 'orange', 'operational');

-- Nora Lie: Konditor 09:00–17:00 (pastry + desserts)
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000064',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-00000000000c', 'Konditor',
  date_trunc('week', CURRENT_DATE)::date + 5, '09:00', '17:00', 7.50, 30,
  'morning', 'published', true, 'orange', 'operational');

-- SERVICE (5 shifts incl. 1 open):

-- Kari Nilsen: Servitør 11:00–19:00 (lunsj)
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000065',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002',
  'f0000000-0000-0000-0000-000000000005', 'Servitør',
  date_trunc('week', CURRENT_DATE)::date + 5, '11:00', '19:00', 7.50, 30,
  'midday', 'published', true, 'blue', 'operational');

-- Silje Ruud: Servitør 16:00–23:00 (kveld)
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000066',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002',
  'f0000000-0000-0000-0000-000000000009', 'Servitør',
  date_trunc('week', CURRENT_DATE)::date + 5, '16:00', '23:00', 6.50, 30,
  'evening', 'published', true, 'blue', 'operational');

-- Sofia Berg: Sommelier 15:00–23:00 (wine service)
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000067',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002',
  'f0000000-0000-0000-0000-00000000000a', 'Sommelier',
  date_trunc('week', CURRENT_DATE)::date + 5, '15:00', '23:00', 7.50, 30,
  'afternoon', 'published', true, 'blue', 'operational');

-- Even Aas: Vertinne 10:00–18:00 (host + lunch)
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000068',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002',
  'f0000000-0000-0000-0000-00000000000d', 'Vertinne',
  date_trunc('week', CURRENT_DATE)::date + 5, '10:00', '18:00', 7.50, 30,
  'morning', 'published', true, 'blue', 'operational');

-- OPEN SHIFT: Servitør kveld 17:00–23:00 (unassigned — needs fill)
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000069',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002',
  NULL, 'Servitør kveld',
  date_trunc('week', CURRENT_DATE)::date + 5, '17:00', '23:00', 6.00, 0,
  'evening', 'created', false, 'blue', 'operational');

-- BAR (3 shifts):

-- Ole Torp: Bartender 16:00–00:00
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-00000000006a',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000003',
  'f0000000-0000-0000-0000-000000000004', 'Bartender',
  date_trunc('week', CURRENT_DATE)::date + 5, '16:00', '00:00', 7.50, 30,
  'evening', 'published', true, 'purple', 'operational');

-- Mats Holm: Bartender 14:00–22:00 (split coverage)
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-00000000006b',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000003',
  'f0000000-0000-0000-0000-00000000000b', 'Bartender',
  date_trunc('week', CURRENT_DATE)::date + 5, '14:00', '22:00', 7.50, 30,
  'afternoon', 'published', true, 'purple', 'operational');

-- OPEN BAR shift: Bartender hjelp 18:00–00:00 (extra cover for Saturday peak)
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-00000000006c',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000003',
  NULL, 'Bartender hjelp',
  date_trunc('week', CURRENT_DATE)::date + 5, '18:00', '00:00', 6.00, 0,
  'evening', 'created', false, 'purple', 'operational');

-- OPERATIONS (1 shift):

-- Local Admin: Daglig leder 10:00–18:00
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-00000000006d',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000000',
  'f0000000-0000-0000-0000-000000000000', 'Daglig leder',
  date_trunc('week', CURRENT_DATE)::date + 5, '10:00', '18:00', 7.50, 30,
  'morning', 'published', true, 'emerald', 'operational');

-- ── SUNDAY (anchor + 6) — light / close day ───────────────────────────────────

-- Kitchen: Nora Lie, Konditor (prep for the week)
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000071',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-00000000000c', 'Konditor',
  date_trunc('week', CURRENT_DATE)::date + 6, '10:00', '16:00', 5.50, 30,
  'morning', 'published', true, 'orange', 'operational');

-- Service: Even Aas, Vertinne (brunch service)
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000072',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002',
  'f0000000-0000-0000-0000-00000000000d', 'Vertinne',
  date_trunc('week', CURRENT_DATE)::date + 6, '11:00', '17:00', 5.50, 30,
  'midday', 'published', true, 'blue', 'operational');

-- Bar: Mats Holm, Bartender (afternoon only)
INSERT INTO schedule_shift (schedule_shift_id, workspace_id, department_id, employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks, day_category, status, is_published, indicator, source)
VALUES ('10000000-0000-0000-0000-000000000073',
  'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000003',
  'f0000000-0000-0000-0000-00000000000b', 'Bartender',
  date_trunc('week', CURRENT_DATE)::date + 6, '13:00', '20:00', 6.50, 30,
  'afternoon', 'published', true, 'purple', 'operational');

-- ===========================================================================
-- STEP 5: Re-enable temporal lock trigger
-- All shifts are inserted. The trigger is safe to re-enable.
-- ===========================================================================

ALTER TABLE public.schedule_shift ENABLE TRIGGER trg_schedule_shift_temporal_lock;

-- ===========================================================================
-- STEP 6: SHIFT_ZONE ASSIGNMENTS — FoH zones via DO-block lookup
--
-- The trigger trg_ensure_shift_session has auto-created shift_session rows
-- for all assigned shifts above. We look them up by schedule_shift_id.
-- Only Service and Bar get zones (FoH). Kitchen + Ops = BoH, no zone.
-- We seed zones for Saturday (anchor+5) fully, plus Monday–Friday sample rows
-- for Service shifts, so the validation query sees zones≥4.
-- ===========================================================================

DO $$
DECLARE
  v_ws_id  uuid := 'b0000000-0000-0000-0000-000000000000';
  v_loc_id uuid := 'c0000000-0000-0000-0000-000000000000';
  v_z_sal  uuid := 'd1000000-0000-0000-0000-000000000001';  -- Hovedsal
  v_z_ter  uuid := 'd1000000-0000-0000-0000-000000000002';  -- Terrasse
  v_z_bar  uuid := 'd1000000-0000-0000-0000-000000000003';  -- Bar-område

  -- Shift session IDs (resolved by schedule_shift_id)
  v_ss uuid;
  v_dl uuid;
BEGIN

  -- ── Helper: zone a single assigned FoH shift onto one zone ──────────────
  -- Saturday — Service
  FOR v_ss, v_dl IN
    SELECT ss.shift_session_id, ssdl.day_line_id
    FROM shift_session ss
    JOIN shift_session_day_line ssdl ON ssdl.shift_session_id = ss.shift_session_id
    WHERE ss.schedule_shift_id IN (
      '10000000-0000-0000-0000-000000000065',  -- Kari Sat
      '10000000-0000-0000-0000-000000000066',  -- Silje Sat
      '10000000-0000-0000-0000-000000000067',  -- Sofia Sat
      '10000000-0000-0000-0000-000000000068'   -- Even Sat
    )
  LOOP
    INSERT INTO shift_session_day_line (shift_session_id, day_line_id)
    VALUES (v_ss, v_dl) ON CONFLICT DO NOTHING;

    INSERT INTO shift_zone (workspace_id, shift_session_id, day_line_id, zone_id, location_id)
    VALUES (v_ws_id, v_ss, v_dl, v_z_sal, v_loc_id)
    ON CONFLICT (shift_session_id, day_line_id, zone_id) DO NOTHING;
  END LOOP;

  -- Silje + Sofia also cover Terrasse on busy Saturday
  SELECT ss.shift_session_id INTO v_ss
  FROM shift_session ss WHERE ss.schedule_shift_id = '10000000-0000-0000-0000-000000000066';
  IF v_ss IS NOT NULL THEN
    SELECT ssdl.day_line_id INTO v_dl FROM shift_session_day_line ssdl WHERE ssdl.shift_session_id = v_ss LIMIT 1;
    INSERT INTO shift_zone (workspace_id, shift_session_id, day_line_id, zone_id, location_id)
    VALUES (v_ws_id, v_ss, v_dl, v_z_ter, v_loc_id)
    ON CONFLICT (shift_session_id, day_line_id, zone_id) DO NOTHING;
  END IF;

  SELECT ss.shift_session_id INTO v_ss
  FROM shift_session ss WHERE ss.schedule_shift_id = '10000000-0000-0000-0000-000000000067';
  IF v_ss IS NOT NULL THEN
    SELECT ssdl.day_line_id INTO v_dl FROM shift_session_day_line ssdl WHERE ssdl.shift_session_id = v_ss LIMIT 1;
    INSERT INTO shift_zone (workspace_id, shift_session_id, day_line_id, zone_id, location_id)
    VALUES (v_ws_id, v_ss, v_dl, v_z_ter, v_loc_id)
    ON CONFLICT (shift_session_id, day_line_id, zone_id) DO NOTHING;
  END IF;

  -- Saturday — Bar (Ole + Mats → Bar-område)
  FOR v_ss, v_dl IN
    SELECT ss.shift_session_id, ssdl.day_line_id
    FROM shift_session ss
    JOIN shift_session_day_line ssdl ON ssdl.shift_session_id = ss.shift_session_id
    WHERE ss.schedule_shift_id IN (
      '10000000-0000-0000-0000-00000000006a',  -- Ole Sat
      '10000000-0000-0000-0000-00000000006b'   -- Mats Sat
    )
  LOOP
    INSERT INTO shift_session_day_line (shift_session_id, day_line_id)
    VALUES (v_ss, v_dl) ON CONFLICT DO NOTHING;

    INSERT INTO shift_zone (workspace_id, shift_session_id, day_line_id, zone_id, location_id)
    VALUES (v_ws_id, v_ss, v_dl, v_z_bar, v_loc_id)
    ON CONFLICT (shift_session_id, day_line_id, zone_id) DO NOTHING;
  END LOOP;

  -- Weekday FoH samples (Monday Service + Bar, Friday Service)
  FOR v_ss, v_dl IN
    SELECT ss.shift_session_id, ssdl.day_line_id
    FROM shift_session ss
    JOIN shift_session_day_line ssdl ON ssdl.shift_session_id = ss.shift_session_id
    WHERE ss.schedule_shift_id IN (
      '10000000-0000-0000-0000-000000000012',  -- Kari Mon
      '10000000-0000-0000-0000-000000000053',  -- Kari Fri
      '10000000-0000-0000-0000-000000000054'   -- Even Fri
    )
  LOOP
    INSERT INTO shift_session_day_line (shift_session_id, day_line_id)
    VALUES (v_ss, v_dl) ON CONFLICT DO NOTHING;

    INSERT INTO shift_zone (workspace_id, shift_session_id, day_line_id, zone_id, location_id)
    VALUES (v_ws_id, v_ss, v_dl, v_z_sal, v_loc_id)
    ON CONFLICT (shift_session_id, day_line_id, zone_id) DO NOTHING;
  END LOOP;

  -- Monday Bar → Bar-område
  SELECT ss.shift_session_id INTO v_ss
  FROM shift_session ss WHERE ss.schedule_shift_id = '10000000-0000-0000-0000-000000000013';
  IF v_ss IS NOT NULL THEN
    SELECT ssdl.day_line_id INTO v_dl FROM shift_session_day_line ssdl WHERE ssdl.shift_session_id = v_ss LIMIT 1;
    INSERT INTO shift_session_day_line (shift_session_id, day_line_id)
    VALUES (v_ss, v_dl) ON CONFLICT DO NOTHING;
    INSERT INTO shift_zone (workspace_id, shift_session_id, day_line_id, zone_id, location_id)
    VALUES (v_ws_id, v_ss, v_dl, v_z_bar, v_loc_id)
    ON CONFLICT (shift_session_id, day_line_id, zone_id) DO NOTHING;
  END IF;

END $$;

-- ===========================================================================
-- STEP 7: SESSION_TASKS — Saturday full 18-task set (ported from demo-day)
-- + lightweight tasks on Mon/Thu/Fri for timeline realism.
-- scheduled_at: date-dynamic using anchor+5 for Saturday.
-- status = 'pending' (future/today) or 'completed' (past days, session closed).
-- origin = 'manual', generated_by = 'manager'.
-- department_session_id resolved by (workspace_id, department_id, session_date) lookup.
-- ===========================================================================

-- ── SATURDAY KITCHEN tasks (18 tasks total across 4 depts) ───────────────────

-- 08:00 Mise-en-place frokost (Anna)
INSERT INTO session_task (id, workspace_id, department_session_id,
  title, description, status, assigned_to, is_compliance_required, origin, generated_by, scheduled_at, duration_minutes)
SELECT '40000000-0000-0000-0000-000000000101',
  'b0000000-0000-0000-0000-000000000000',
  ds.department_session_id,
  'Mise-en-place frokost',
  'Sett frem og klargjør frokostelementene. Sjekk dybfryser og kjølerom.',
  CASE WHEN ds.session_date < CURRENT_DATE THEN 'completed'::session_task_status ELSE 'pending'::session_task_status END,
  'f0000000-0000-0000-0000-000000000001',
  false, 'manual', 'manager',
  ((date_trunc('week', CURRENT_DATE)::date + 5)::timestamp + time '08:00') AT TIME ZONE 'Europe/Oslo',
  60
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ds.department_id = 'd0000000-0000-0000-0000-000000000001'
  AND ds.session_date = date_trunc('week', CURRENT_DATE)::date + 5;

-- 10:30 Lunsjprep (Anna)
INSERT INTO session_task (id, workspace_id, department_session_id,
  title, description, status, assigned_to, is_compliance_required, origin, generated_by, scheduled_at, duration_minutes)
SELECT '40000000-0000-0000-0000-000000000102',
  'b0000000-0000-0000-0000-000000000000',
  ds.department_session_id,
  'Lunsjprep',
  'Klargjøring av lunsjmenyen: suppe, dagensrett og salater.',
  CASE WHEN ds.session_date < CURRENT_DATE THEN 'completed'::session_task_status ELSE 'pending'::session_task_status END,
  'f0000000-0000-0000-0000-000000000001',
  false, 'manual', 'manager',
  ((date_trunc('week', CURRENT_DATE)::date + 5)::timestamp + time '10:30') AT TIME ZONE 'Europe/Oslo',
  90
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ds.department_id = 'd0000000-0000-0000-0000-000000000001'
  AND ds.session_date = date_trunc('week', CURRENT_DATE)::date + 5;

-- 11:00 HACCP kjøletemp (Anna) — compliance
INSERT INTO session_task (id, workspace_id, department_session_id,
  title, description, status, assigned_to, is_compliance_required, origin, generated_by, scheduled_at, duration_minutes)
SELECT '40000000-0000-0000-0000-000000000103',
  'b0000000-0000-0000-0000-000000000000',
  ds.department_session_id,
  'HACCP — kjøletemp skap 1–3',
  'Mål og loggfør temperatur i alle kjøleskap. Maks +4°C. Dokumentér avvik.',
  CASE WHEN ds.session_date < CURRENT_DATE THEN 'completed'::session_task_status ELSE 'pending'::session_task_status END,
  'f0000000-0000-0000-0000-000000000001',
  true, 'manual', 'manager',
  ((date_trunc('week', CURRENT_DATE)::date + 5)::timestamp + time '11:00') AT TIME ZONE 'Europe/Oslo',
  15
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ds.department_id = 'd0000000-0000-0000-0000-000000000001'
  AND ds.session_date = date_trunc('week', CURRENT_DATE)::date + 5;

-- 12:00 Lunsjservice (unassigned)
INSERT INTO session_task (id, workspace_id, department_session_id,
  title, description, status, assigned_to, is_compliance_required, origin, generated_by, scheduled_at, duration_minutes)
SELECT '40000000-0000-0000-0000-000000000104',
  'b0000000-0000-0000-0000-000000000000',
  ds.department_session_id,
  'Lunsjservice',
  'Aktiv lunsjservice 12:00–15:00. Prioriter rask omsetning.',
  CASE WHEN ds.session_date < CURRENT_DATE THEN 'completed'::session_task_status ELSE 'pending'::session_task_status END,
  NULL,
  false, 'manual', 'manager',
  ((date_trunc('week', CURRENT_DATE)::date + 5)::timestamp + time '12:00') AT TIME ZONE 'Europe/Oslo',
  180
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ds.department_id = 'd0000000-0000-0000-0000-000000000001'
  AND ds.session_date = date_trunc('week', CURRENT_DATE)::date + 5;

-- 15:00 Middagsprep fisk (Erik)
INSERT INTO session_task (id, workspace_id, department_session_id,
  title, description, status, assigned_to, is_compliance_required, origin, generated_by, scheduled_at, duration_minutes)
SELECT '40000000-0000-0000-0000-000000000105',
  'b0000000-0000-0000-0000-000000000000',
  ds.department_session_id,
  'Middagsprep — fisk',
  'Porsjoner og mariner kveldsmenyen. Sjekk fangstdato og kjerne-temp.',
  CASE WHEN ds.session_date < CURRENT_DATE THEN 'completed'::session_task_status ELSE 'pending'::session_task_status END,
  'f0000000-0000-0000-0000-000000000002',
  false, 'manual', 'manager',
  ((date_trunc('week', CURRENT_DATE)::date + 5)::timestamp + time '15:00') AT TIME ZONE 'Europe/Oslo',
  120
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ds.department_id = 'd0000000-0000-0000-0000-000000000001'
  AND ds.session_date = date_trunc('week', CURRENT_DATE)::date + 5;

-- 18:00 Kveldsservice (Erik)
INSERT INTO session_task (id, workspace_id, department_session_id,
  title, description, status, assigned_to, is_compliance_required, origin, generated_by, scheduled_at, duration_minutes)
SELECT '40000000-0000-0000-0000-000000000106',
  'b0000000-0000-0000-0000-000000000000',
  ds.department_session_id,
  'Kveldsservice',
  'Koordiner kjøkkenet gjennom kveldsservice. Følg à la carte-timingen.',
  CASE WHEN ds.session_date < CURRENT_DATE THEN 'completed'::session_task_status ELSE 'pending'::session_task_status END,
  'f0000000-0000-0000-0000-000000000002',
  false, 'manual', 'manager',
  ((date_trunc('week', CURRENT_DATE)::date + 5)::timestamp + time '18:00') AT TIME ZONE 'Europe/Oslo',
  240
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ds.department_id = 'd0000000-0000-0000-0000-000000000001'
  AND ds.session_date = date_trunc('week', CURRENT_DATE)::date + 5;

-- 22:30 Nedvask + HACCP-logg (Jonas) — compliance
INSERT INTO session_task (id, workspace_id, department_session_id,
  title, description, status, assigned_to, is_compliance_required, origin, generated_by, scheduled_at, duration_minutes)
SELECT '40000000-0000-0000-0000-000000000107',
  'b0000000-0000-0000-0000-000000000000',
  ds.department_session_id,
  'Nedvask + HACCP-logg',
  'Avslutt vaskeplan. Fyll ut HACCP-daglogg. Signér og arkivér.',
  CASE WHEN ds.session_date < CURRENT_DATE THEN 'completed'::session_task_status ELSE 'pending'::session_task_status END,
  'f0000000-0000-0000-0000-000000000008',
  true, 'manual', 'manager',
  ((date_trunc('week', CURRENT_DATE)::date + 5)::timestamp + time '22:30') AT TIME ZONE 'Europe/Oslo',
  45
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ds.department_id = 'd0000000-0000-0000-0000-000000000001'
  AND ds.session_date = date_trunc('week', CURRENT_DATE)::date + 5;

-- ── SATURDAY SERVICE tasks ────────────────────────────────────────────────────

-- 11:00 Rigg sal + dekke (Kari)
INSERT INTO session_task (id, workspace_id, department_session_id,
  title, description, status, assigned_to, is_compliance_required, origin, generated_by, scheduled_at, duration_minutes)
SELECT '40000000-0000-0000-0000-000000000201',
  'b0000000-0000-0000-0000-000000000000',
  ds.department_session_id,
  'Rigg sal + dekke',
  'Sett frem bestikk, glass og menyer. Sjekk blomster og lys.',
  CASE WHEN ds.session_date < CURRENT_DATE THEN 'completed'::session_task_status ELSE 'pending'::session_task_status END,
  'f0000000-0000-0000-0000-000000000005',
  false, 'manual', 'manager',
  ((date_trunc('week', CURRENT_DATE)::date + 5)::timestamp + time '11:00') AT TIME ZONE 'Europe/Oslo',
  45
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ds.department_id = 'd0000000-0000-0000-0000-000000000002'
  AND ds.session_date = date_trunc('week', CURRENT_DATE)::date + 5;

-- 12:00 Lunsjservice (Kari)
INSERT INTO session_task (id, workspace_id, department_session_id,
  title, description, status, assigned_to, is_compliance_required, origin, generated_by, scheduled_at, duration_minutes)
SELECT '40000000-0000-0000-0000-000000000202',
  'b0000000-0000-0000-0000-000000000000',
  ds.department_session_id,
  'Lunsjservice',
  'Server lunsj. Koordiner med kjøkkenet på timing.',
  CASE WHEN ds.session_date < CURRENT_DATE THEN 'completed'::session_task_status ELSE 'pending'::session_task_status END,
  'f0000000-0000-0000-0000-000000000005',
  false, 'manual', 'manager',
  ((date_trunc('week', CURRENT_DATE)::date + 5)::timestamp + time '12:00') AT TIME ZONE 'Europe/Oslo',
  180
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ds.department_id = 'd0000000-0000-0000-0000-000000000002'
  AND ds.session_date = date_trunc('week', CURRENT_DATE)::date + 5;

-- 16:00 Dekke om til kveld (Silje)
INSERT INTO session_task (id, workspace_id, department_session_id,
  title, description, status, assigned_to, is_compliance_required, origin, generated_by, scheduled_at, duration_minutes)
SELECT '40000000-0000-0000-0000-000000000203',
  'b0000000-0000-0000-0000-000000000000',
  ds.department_session_id,
  'Dekke om til kveld',
  'Bytt til kveldsoppsett: stearinlys, mørk duk, kveldsmeny på bordet.',
  CASE WHEN ds.session_date < CURRENT_DATE THEN 'completed'::session_task_status ELSE 'pending'::session_task_status END,
  'f0000000-0000-0000-0000-000000000009',
  false, 'manual', 'manager',
  ((date_trunc('week', CURRENT_DATE)::date + 5)::timestamp + time '16:00') AT TIME ZONE 'Europe/Oslo',
  45
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ds.department_id = 'd0000000-0000-0000-0000-000000000002'
  AND ds.session_date = date_trunc('week', CURRENT_DATE)::date + 5;

-- 18:00 Kveldsservice (Silje)
INSERT INTO session_task (id, workspace_id, department_session_id,
  title, description, status, assigned_to, is_compliance_required, origin, generated_by, scheduled_at, duration_minutes)
SELECT '40000000-0000-0000-0000-000000000204',
  'b0000000-0000-0000-0000-000000000000',
  ds.department_session_id,
  'Kveldsservice',
  'Server à la carte. Koordiner dessert og kaffe med kjøkkenet.',
  CASE WHEN ds.session_date < CURRENT_DATE THEN 'completed'::session_task_status ELSE 'pending'::session_task_status END,
  'f0000000-0000-0000-0000-000000000009',
  false, 'manual', 'manager',
  ((date_trunc('week', CURRENT_DATE)::date + 5)::timestamp + time '18:00') AT TIME ZONE 'Europe/Oslo',
  300
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ds.department_id = 'd0000000-0000-0000-0000-000000000002'
  AND ds.session_date = date_trunc('week', CURRENT_DATE)::date + 5;

-- 23:00 Kasseoppgjør (Silje)
INSERT INTO session_task (id, workspace_id, department_session_id,
  title, description, status, assigned_to, is_compliance_required, origin, generated_by, scheduled_at, duration_minutes)
SELECT '40000000-0000-0000-0000-000000000205',
  'b0000000-0000-0000-0000-000000000000',
  ds.department_session_id,
  'Kasseoppgjør',
  'Tell opp kasse, match mot POS. Lever kontant til daglig leder.',
  CASE WHEN ds.session_date < CURRENT_DATE THEN 'completed'::session_task_status ELSE 'pending'::session_task_status END,
  'f0000000-0000-0000-0000-000000000009',
  false, 'manual', 'manager',
  ((date_trunc('week', CURRENT_DATE)::date + 5)::timestamp + time '23:00') AT TIME ZONE 'Europe/Oslo',
  30
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ds.department_id = 'd0000000-0000-0000-0000-000000000002'
  AND ds.session_date = date_trunc('week', CURRENT_DATE)::date + 5;

-- ── SATURDAY BAR tasks ────────────────────────────────────────────────────────

-- 16:00 Bar-rigg + cocktail-prep (Ole)
INSERT INTO session_task (id, workspace_id, department_session_id,
  title, description, status, assigned_to, is_compliance_required, origin, generated_by, scheduled_at, duration_minutes)
SELECT '40000000-0000-0000-0000-000000000301',
  'b0000000-0000-0000-0000-000000000000',
  ds.department_session_id,
  'Bar-rigg + cocktail-prep',
  'Fyll opp is, juice, saft og garnish. Forbered husets signaturer.',
  CASE WHEN ds.session_date < CURRENT_DATE THEN 'completed'::session_task_status ELSE 'pending'::session_task_status END,
  'f0000000-0000-0000-0000-000000000004',
  false, 'manual', 'manager',
  ((date_trunc('week', CURRENT_DATE)::date + 5)::timestamp + time '16:00') AT TIME ZONE 'Europe/Oslo',
  60
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ds.department_id = 'd0000000-0000-0000-0000-000000000003'
  AND ds.session_date = date_trunc('week', CURRENT_DATE)::date + 5;

-- 19:00 Kveldsservice bar (Ole)
INSERT INTO session_task (id, workspace_id, department_session_id,
  title, description, status, assigned_to, is_compliance_required, origin, generated_by, scheduled_at, duration_minutes)
SELECT '40000000-0000-0000-0000-000000000302',
  'b0000000-0000-0000-0000-000000000000',
  ds.department_session_id,
  'Kveldsservice bar',
  'Betjen bar-gjester og restaurant-gjester. Prioriter hurtighet.',
  CASE WHEN ds.session_date < CURRENT_DATE THEN 'completed'::session_task_status ELSE 'pending'::session_task_status END,
  'f0000000-0000-0000-0000-000000000004',
  false, 'manual', 'manager',
  ((date_trunc('week', CURRENT_DATE)::date + 5)::timestamp + time '19:00') AT TIME ZONE 'Europe/Oslo',
  300
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ds.department_id = 'd0000000-0000-0000-0000-000000000003'
  AND ds.session_date = date_trunc('week', CURRENT_DATE)::date + 5;

-- Midnight bar oppgjør — uses anchor+6 00:00 as the clock timestamp
INSERT INTO session_task (id, workspace_id, department_session_id,
  title, description, status, assigned_to, is_compliance_required, origin, generated_by, scheduled_at, duration_minutes)
SELECT '40000000-0000-0000-0000-000000000303',
  'b0000000-0000-0000-0000-000000000000',
  ds.department_session_id,
  'Bar-oppgjør',
  'Tøm kasse, match mot bongsystem, lås ned bar.',
  CASE WHEN ds.session_date < CURRENT_DATE THEN 'completed'::session_task_status ELSE 'pending'::session_task_status END,
  'f0000000-0000-0000-0000-000000000004',
  false, 'manual', 'manager',
  ((date_trunc('week', CURRENT_DATE)::date + 6)::timestamp + time '00:00') AT TIME ZONE 'Europe/Oslo',
  30
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ds.department_id = 'd0000000-0000-0000-0000-000000000003'
  AND ds.session_date = date_trunc('week', CURRENT_DATE)::date + 5;

-- ── SATURDAY OPERATIONS tasks ─────────────────────────────────────────────────

-- 10:00 Morgenbrief + dagsplan (Local Admin)
INSERT INTO session_task (id, workspace_id, department_session_id,
  title, description, status, assigned_to, is_compliance_required, origin, generated_by, scheduled_at, duration_minutes)
SELECT '40000000-0000-0000-0000-000000000401',
  'b0000000-0000-0000-0000-000000000000',
  ds.department_session_id,
  'Morgenbrief + dagsplan',
  'Gå gjennom dagsplan med kjøkkensjef og serviceleder. Sjekk reservasjoner.',
  CASE WHEN ds.session_date < CURRENT_DATE THEN 'completed'::session_task_status ELSE 'pending'::session_task_status END,
  'f0000000-0000-0000-0000-000000000000',
  false, 'manual', 'manager',
  ((date_trunc('week', CURRENT_DATE)::date + 5)::timestamp + time '10:00') AT TIME ZONE 'Europe/Oslo',
  30
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ds.department_id = 'd0000000-0000-0000-0000-000000000000'
  AND ds.session_date = date_trunc('week', CURRENT_DATE)::date + 5;

-- 14:00 Mottak vareleveranse (Local Admin)
INSERT INTO session_task (id, workspace_id, department_session_id,
  title, description, status, assigned_to, is_compliance_required, origin, generated_by, scheduled_at, duration_minutes)
SELECT '40000000-0000-0000-0000-000000000402',
  'b0000000-0000-0000-0000-000000000000',
  ds.department_session_id,
  'Mottak vareleveranse',
  'Kontroller leveranse mot bestilling. Signér følgeseddel. Flytt til lager.',
  CASE WHEN ds.session_date < CURRENT_DATE THEN 'completed'::session_task_status ELSE 'pending'::session_task_status END,
  'f0000000-0000-0000-0000-000000000000',
  false, 'manual', 'manager',
  ((date_trunc('week', CURRENT_DATE)::date + 5)::timestamp + time '14:00') AT TIME ZONE 'Europe/Oslo',
  45
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ds.department_id = 'd0000000-0000-0000-0000-000000000000'
  AND ds.session_date = date_trunc('week', CURRENT_DATE)::date + 5;

-- 18:00 Dagsoppgjør + Z-rapport (Local Admin)
INSERT INTO session_task (id, workspace_id, department_session_id,
  title, description, status, assigned_to, is_compliance_required, origin, generated_by, scheduled_at, duration_minutes)
SELECT '40000000-0000-0000-0000-000000000403',
  'b0000000-0000-0000-0000-000000000000',
  ds.department_session_id,
  'Dagsoppgjør + Z-rapport',
  'Kjør Z-rapport fra POS. Summer kassene. Send rapport til regnskapspartner.',
  CASE WHEN ds.session_date < CURRENT_DATE THEN 'completed'::session_task_status ELSE 'pending'::session_task_status END,
  'f0000000-0000-0000-0000-000000000000',
  false, 'manual', 'manager',
  ((date_trunc('week', CURRENT_DATE)::date + 5)::timestamp + time '18:00') AT TIME ZONE 'Europe/Oslo',
  30
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ds.department_id = 'd0000000-0000-0000-0000-000000000000'
  AND ds.session_date = date_trunc('week', CURRENT_DATE)::date + 5;

-- ── WEEKDAY TASKS (Monday Kitchen — give closed days some completed tasks) ────

-- Monday HACCP check (Anna)
INSERT INTO session_task (id, workspace_id, department_session_id,
  title, description, status, assigned_to, is_compliance_required, origin, generated_by, scheduled_at, duration_minutes)
SELECT '40000000-0000-0000-0000-000000000501',
  'b0000000-0000-0000-0000-000000000000',
  ds.department_session_id,
  'HACCP — kjøletemp daglig',
  'Mål og loggfør temperatur i alle kjøleskap.',
  CASE WHEN ds.session_date < CURRENT_DATE THEN 'completed'::session_task_status ELSE 'pending'::session_task_status END,
  'f0000000-0000-0000-0000-000000000001',
  true, 'manual', 'manager',
  ((date_trunc('week', CURRENT_DATE)::date + 0)::timestamp + time '11:00') AT TIME ZONE 'Europe/Oslo',
  15
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ds.department_id = 'd0000000-0000-0000-0000-000000000001'
  AND ds.session_date = date_trunc('week', CURRENT_DATE)::date + 0;

-- Thursday Ops: bestilling gjennomgang
INSERT INTO session_task (id, workspace_id, department_session_id,
  title, description, status, assigned_to, is_compliance_required, origin, generated_by, scheduled_at, duration_minutes)
SELECT '40000000-0000-0000-0000-000000000502',
  'b0000000-0000-0000-0000-000000000000',
  ds.department_session_id,
  'Bestilling helg',
  'Gå gjennom lagerstatus. Send helgebestilling til leverandør.',
  CASE WHEN ds.session_date < CURRENT_DATE THEN 'completed'::session_task_status ELSE 'pending'::session_task_status END,
  'f0000000-0000-0000-0000-000000000000',
  false, 'manual', 'manager',
  ((date_trunc('week', CURRENT_DATE)::date + 3)::timestamp + time '10:00') AT TIME ZONE 'Europe/Oslo',
  45
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ds.department_id = 'd0000000-0000-0000-0000-000000000000'
  AND ds.session_date = date_trunc('week', CURRENT_DATE)::date + 3;

-- Friday Kitchen HACCP
INSERT INTO session_task (id, workspace_id, department_session_id,
  title, description, status, assigned_to, is_compliance_required, origin, generated_by, scheduled_at, duration_minutes)
SELECT '40000000-0000-0000-0000-000000000503',
  'b0000000-0000-0000-0000-000000000000',
  ds.department_session_id,
  'HACCP — kjølerom fredag',
  'Ukentlig kontroll av kjølerom og frysere. Dokumentér funn.',
  CASE WHEN ds.session_date < CURRENT_DATE THEN 'completed'::session_task_status ELSE 'pending'::session_task_status END,
  'f0000000-0000-0000-0000-000000000002',
  true, 'manual', 'manager',
  ((date_trunc('week', CURRENT_DATE)::date + 4)::timestamp + time '09:00') AT TIME ZONE 'Europe/Oslo',
  30
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ds.department_id = 'd0000000-0000-0000-0000-000000000001'
  AND ds.session_date = date_trunc('week', CURRENT_DATE)::date + 4;

-- ===========================================================================
-- STEP 8: TIMESHEET TIME_ENTRY — punch rows for CLOSED-day assigned shifts
-- Only shifts from past days (shift_date < CURRENT_DATE) get punches.
-- status = 'completed' (full shift punched out).
-- punch_in ≈ shift start, punch_out ≈ shift end.
-- source = 'manual' (seed / supervisor entry).
-- ===========================================================================

INSERT INTO timesheet.time_entry (
  time_entry_id, shift_id, profile_id, workspace_id,
  punch_in, punch_out, status, source,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  ss.schedule_shift_id,
  ss.employee_id,
  ss.workspace_id,
  (ss.shift_date::timestamp + ss.start_time) AT TIME ZONE 'Europe/Oslo',
  -- Handle midnight-cross shifts (end_time = '00:00' means next calendar day)
  CASE
    WHEN ss.end_time = '00:00'
    THEN ((ss.shift_date + interval '1 day')::timestamp + time '00:00') AT TIME ZONE 'Europe/Oslo'
    ELSE (ss.shift_date::timestamp + ss.end_time) AT TIME ZONE 'Europe/Oslo'
  END,
  'completed'::timesheet.time_entry_status,
  'operational',
  now(),
  now()
FROM public.schedule_shift ss
WHERE ss.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ss.employee_id IS NOT NULL
  AND ss.shift_date < CURRENT_DATE;

-- ===========================================================================
-- STEP 9: SCHEDULE ABSENCES — 2 absences within the week
-- 1. Lise Markussen (inactive staff, f0…3) — sick leave Mon
-- 2. Jon Doe (inactive, f0…6) — approved vacation Tue–Wed
-- These are realistic: inactive staff may have open absence records.
-- ===========================================================================

INSERT INTO public.schedule_absence (
  schedule_absence_id, workspace_id, employee_id,
  shift_date, absence_type, request_type, reason,
  start_date, end_date, is_full_day, status,
  created_at, updated_at
)
VALUES
  -- Sick leave: Lise Markussen, Monday
  (
    gen_random_uuid(),
    'b0000000-0000-0000-0000-000000000000',
    'f0000000-0000-0000-0000-000000000003',
    date_trunc('week', CURRENT_DATE)::date + 0,
    'sick_leave',
    'self_reported',
    'Meldt syk mandag morgen.',
    date_trunc('week', CURRENT_DATE)::date + 0,
    date_trunc('week', CURRENT_DATE)::date + 0,
    true,
    'approved',
    now(), now()
  ),
  -- Vacation: Jon Doe, Tuesday–Wednesday
  (
    gen_random_uuid(),
    'b0000000-0000-0000-0000-000000000000',
    'f0000000-0000-0000-0000-000000000006',
    date_trunc('week', CURRENT_DATE)::date + 1,
    'vacation',
    'manager_approved',
    'Avspasering akkumulert overtid.',
    date_trunc('week', CURRENT_DATE)::date + 1,
    date_trunc('week', CURRENT_DATE)::date + 2,
    true,
    'approved',
    now(), now()
  );

-- ===========================================================================
-- STEP 10: DEVIATIONS — 2 realistic deviations linked to Saturday sessions
-- Resolved by lookup on department_session (workspace_id, dept, date).
-- ===========================================================================

-- Deviation 1: Kitchen cost overrun Saturday
INSERT INTO public.deviation (
  deviation_id, workspace_id, department_id, session_id,
  domain, subcategory, severity,
  title, description,
  status, reported_by, requires_action, payroll_impact, blocks_day_approval,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  'b0000000-0000-0000-0000-000000000000',
  'd0000000-0000-0000-0000-000000000001',
  ds.department_session_id,
  'material',
  'cost_overrun',
  'medium',
  'Råvarekost lørdag over budsjett',
  'Fiskeleveransen var 15% dyrere enn budsjettert. Kontakt leverandør.',
  'open',
  'f0000000-0000-0000-0000-000000000002',
  true, false, false,
  now(), now()
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ds.department_id = 'd0000000-0000-0000-0000-000000000001'
  AND ds.session_date = date_trunc('week', CURRENT_DATE)::date + 5;

-- Deviation 2: Late open on Friday (procedure issue)
INSERT INTO public.deviation (
  deviation_id, workspace_id, department_id, session_id,
  domain, subcategory, severity,
  title, description,
  status, reported_by, requires_action, payroll_impact, blocks_day_approval,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  'b0000000-0000-0000-0000-000000000000',
  'd0000000-0000-0000-0000-000000000002',
  ds.department_session_id,
  'procedure',
  'late_open',
  'low',
  'Sal åpnet 20 min forsinket fredag',
  'Nøkkelen til ytterdøren ble borte. Ny nøkkelrutine innføres fra neste uke.',
  'acknowledged',
  'f0000000-0000-0000-0000-000000000000',
  false, false, false,
  now(), now()
FROM public.department_session ds
WHERE ds.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND ds.department_id = 'd0000000-0000-0000-0000-000000000002'
  AND ds.session_date = date_trunc('week', CURRENT_DATE)::date + 4;

COMMIT;
