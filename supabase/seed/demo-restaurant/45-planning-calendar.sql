-- ============ DEMO RESTAURANT CANONICAL ID MAP (do not edit per-file) ============
-- COMPANY        a0000000-0000-0000-0000-000000000000  Smartout AS
-- WORKSPACE      b0000000-0000-0000-0000-000000000000  "Demo Restaurant"
-- LOCATION       c0000000-0000-0000-0000-000000000000  Oslo Downtown Hub
-- ZONE Hovedsal  d1000000-0000-0000-0000-000000000001  | Terrasse d1…2 | Bar d1…3 | Privat d1…4
-- DEPT Operations d0000000-0000-0000-0000-000000000000 | Kitchen d0…1 | Service d0…2 | Bar d0…3
-- PROFILES f0000000-…-{0..9} + {a..d}; AUTH e0000000-…-{0..9} + {a..d}
-- LOCAL ONLY — never prod. Idempotent (delete/re-insert). No session vars, no \set.
--
-- D4 PLANNING + CALENDAR IDs:
-- SEASON           ac000000-0000-0000-0000-000000000001  Vinter 2026 (seeded by 40-governance)
--                  ac000000-0000-0000-0000-000000000002  Vår 2026    (Q2, ACTIVE + default)
--                  ac000000-0000-0000-0000-000000000003  Sommer 2026 (Q3, draft)
--                  ac000000-0000-0000-0000-000000000004  Høst/Jul 2026 (Q4, draft)
-- Quarters: Vinter Q1 (40-governance, archived) · Vår Q2 active · Sommer Q3 · Høst Q4. Contiguous.
-- SEASON_BUDGET    ad000000-0000-0000-0000-000000000001  Vinter budget
--                  ad000000-0000-0000-0000-000000000002  Vår budget
--                  ad000000-0000-0000-0000-000000000003  Sommer budget
--                  ad000000-0000-0000-0000-000000000004  Høst/Jul budget
-- PLANNING_CYCLE   ae000000-0000-0000-0000-000000000001  Driftsår 2026
-- HOLIDAY_CALENDAR af200000-0000-0000-0000-000000000001  Norske helligdager
-- =================================================================================

SET search_path = public, extensions, pg_catalog;

BEGIN;

-- ============================================================================
-- IDEMPOTENCY — child → parent order; 45 owns all rows below.
-- NOTE: Vinter season row (ac…1) is owned by 40-governance; we touch only its
--       budget + season_policy_bindings for the NEW seasons.
-- ============================================================================

-- 0a. hour_factor + day_factor (cascade from season_budget but explicit is safer)
DELETE FROM public.hour_factor
  WHERE season_budget_id IN (
    SELECT season_budget_id FROM public.season_budget
    WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
  );

DELETE FROM public.day_factor
  WHERE season_budget_id IN (
    SELECT season_budget_id FROM public.season_budget
    WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
  );

-- 0b. season_budget (all 4; unique per season_id)
DELETE FROM public.season_budget
  WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- 0c. season_goal
DELETE FROM public.season_goal
  WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- 0d. season_policy_binding for the 3 NEW seasons only (Vinter's bindings = 40's)
DELETE FROM public.season_policy_binding
  WHERE season_id IN (
    'ac000000-0000-0000-0000-000000000002',
    'ac000000-0000-0000-0000-000000000003',
    'ac000000-0000-0000-0000-000000000004'
  );

-- 0e. planning_event
DELETE FROM public.planning_event
  WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- 0f. planning_cycle (GIST no-overlap: only 1 allowed per workspace anyway)
DELETE FROM public.planning_cycle
  WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- 0g. season-scoped operating hours (season_id IS NOT NULL)
DELETE FROM public.department_operating_hours
  WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
    AND season_id IS NOT NULL;

-- 0h. holiday_entry + holiday_calendar
DELETE FROM payroll.holiday_entry
  WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

DELETE FROM payroll.holiday_calendar
  WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- 0i. The 3 new seasons (cascade drops their dept_operating_hours + bindings already cleared)
DELETE FROM public.season
  WHERE season_id IN (
    'ac000000-0000-0000-0000-000000000002',
    'ac000000-0000-0000-0000-000000000003',
    'ac000000-0000-0000-0000-000000000004'
  );


-- ============================================================================
-- 1. PLANNING CYCLE — 1 row (Driftsår 2026, full calendar year)
-- ============================================================================
INSERT INTO public.planning_cycle (
  planning_cycle_id, workspace_id, name,
  start_date, end_date,
  total_revenue_target, status, created_by
) VALUES (
  'ae000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000000',
  'Driftsår 2026',
  make_date(extract(year from CURRENT_DATE)::int, 1, 1),
  make_date(extract(year from CURRENT_DATE)::int, 12, 31),
  18500000.00,
  'active',
  'f0000000-0000-0000-0000-000000000000'
);


-- ============================================================================
-- 2. THREE FOCUS SEASONS (Vinter ac…1 already seeded by 40-governance)
-- ============================================================================
INSERT INTO public.season (
  season_id, workspace_id, name, slug, description,
  season_type, status, is_default,
  start_date, end_date,
  color, created_by
) VALUES
  -- Vår 2026 — Q2, ACTIVE season (current quarter) + workspace default
  (
    'ac000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000000',
    'Vår 2026', 'var-2026',
    'Vårsesongen med påske og nasjonaldag — inneværende kvartal',
    'focus', 'active', true,
    make_date(extract(year from CURRENT_DATE)::int, 4, 1),
    make_date(extract(year from CURRENT_DATE)::int, 6, 30),
    '#10B981',
    'f0000000-0000-0000-0000-000000000000'
  ),
  -- Sommer 2026 — draft focus season (peak season, coming up)
  (
    'ac000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000000',
    'Sommer 2026', 'sommer-2026',
    'Høysesong — terrasse full, utvidet åpningstider, økt bemanning',
    'focus', 'draft', false,
    make_date(extract(year from CURRENT_DATE)::int, 7, 1),
    make_date(extract(year from CURRENT_DATE)::int, 9, 30),
    '#F59E0B',
    'f0000000-0000-0000-0000-000000000000'
  ),
  -- Høst/Jul 2026 — draft focus season (autumn + Christmas rush)
  (
    'ac000000-0000-0000-0000-000000000004',
    'b0000000-0000-0000-0000-000000000000',
    'Høst/Jul 2026', 'host-2026',
    'Høst og julesesong — firmafester, julelunsj, adventsbuffet',
    'focus', 'draft', false,
    make_date(extract(year from CURRENT_DATE)::int, 10, 1),
    make_date(extract(year from CURRENT_DATE)::int, 12, 31),
    '#8B5CF6',
    'f0000000-0000-0000-0000-000000000000'
  );


-- ============================================================================
-- 3. SEASON BUDGETS — 4 rows (one per season; unique per season_id)
-- ============================================================================
INSERT INTO public.season_budget (
  season_budget_id, season_id, workspace_id,
  total_target_revenue, base_price_per_guest,
  season_price_factor, target_labor_percentage,
  avg_hourly_wage, status, created_by
) VALUES
  -- Vinter (ac…1) — Q1 (past), factor 0.95, archived season → draft budget
  (
    'ad000000-0000-0000-0000-000000000001',
    'ac000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000000',
    3800000.00, 645.00, 0.95, 0.30,
    220.00, 'draft',
    'f0000000-0000-0000-0000-000000000000'
  ),
  -- Vår (ac…2) — baseline factor 1.0, ACTIVE season → active budget
  (
    'ad000000-0000-0000-0000-000000000002',
    'ac000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000000',
    4200000.00, 650.00, 1.00, 0.29,
    220.00, 'active',
    'f0000000-0000-0000-0000-000000000000'
  ),
  -- Sommer (ac…3) — peak factor 1.25, high revenue, more staff
  (
    'ad000000-0000-0000-0000-000000000003',
    'ac000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000000',
    5900000.00, 680.00, 1.25, 0.28,
    225.00, 'draft',
    'f0000000-0000-0000-0000-000000000000'
  ),
  -- Høst/Jul (ac…4) — second peak (Christmas), factor 1.15
  (
    'ad000000-0000-0000-0000-000000000004',
    'ac000000-0000-0000-0000-000000000004',
    'b0000000-0000-0000-0000-000000000000',
    5200000.00, 660.00, 1.15, 0.31,
    222.00, 'draft',
    'f0000000-0000-0000-0000-000000000000'
  );


-- ============================================================================
-- 4. DAY FACTORS — 7 rows per budget = 28 total
--    Weekday 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
-- ============================================================================
INSERT INTO public.day_factor (
  day_factor_id, season_budget_id, workspace_id, weekday, factor
)
SELECT
  gen_random_uuid(),
  budget_id::uuid,
  'b0000000-0000-0000-0000-000000000000'::uuid,
  weekday,
  factor
FROM (VALUES
  -- Vinter (ad…1) — typical mid-week slow, Fri/Sat peak
  ('ad000000-0000-0000-0000-000000000001', 0, 0.75::numeric),
  ('ad000000-0000-0000-0000-000000000001', 1, 0.75::numeric),
  ('ad000000-0000-0000-0000-000000000001', 2, 0.80::numeric),
  ('ad000000-0000-0000-0000-000000000001', 3, 0.82::numeric),
  ('ad000000-0000-0000-0000-000000000001', 4, 1.20::numeric),
  ('ad000000-0000-0000-0000-000000000001', 5, 1.50::numeric),
  ('ad000000-0000-0000-0000-000000000001', 6, 1.00::numeric),
  -- Vår (ad…2) — slightly higher base, spring foot traffic
  ('ad000000-0000-0000-0000-000000000002', 0, 0.80::numeric),
  ('ad000000-0000-0000-0000-000000000002', 1, 0.82::numeric),
  ('ad000000-0000-0000-0000-000000000002', 2, 0.85::numeric),
  ('ad000000-0000-0000-0000-000000000002', 3, 0.88::numeric),
  ('ad000000-0000-0000-0000-000000000002', 4, 1.25::numeric),
  ('ad000000-0000-0000-0000-000000000002', 5, 1.55::numeric),
  ('ad000000-0000-0000-0000-000000000002', 6, 1.10::numeric),
  -- Sommer (ad…3) — flat/high: terrace busy all week, peak Fri-Sun
  ('ad000000-0000-0000-0000-000000000003', 0, 0.90::numeric),
  ('ad000000-0000-0000-0000-000000000003', 1, 0.92::numeric),
  ('ad000000-0000-0000-0000-000000000003', 2, 0.95::numeric),
  ('ad000000-0000-0000-0000-000000000003', 3, 1.00::numeric),
  ('ad000000-0000-0000-0000-000000000003', 4, 1.30::numeric),
  ('ad000000-0000-0000-0000-000000000003', 5, 1.60::numeric),
  ('ad000000-0000-0000-0000-000000000003', 6, 1.20::numeric),
  -- Høst/Jul (ad…4) — Christmas rush boosts Thu–Sat heavily
  ('ad000000-0000-0000-0000-000000000004', 0, 0.78::numeric),
  ('ad000000-0000-0000-0000-000000000004', 1, 0.80::numeric),
  ('ad000000-0000-0000-0000-000000000004', 2, 0.85::numeric),
  ('ad000000-0000-0000-0000-000000000004', 3, 1.05::numeric),
  ('ad000000-0000-0000-0000-000000000004', 4, 1.25::numeric),
  ('ad000000-0000-0000-0000-000000000004', 5, 1.55::numeric),
  ('ad000000-0000-0000-0000-000000000004', 6, 1.05::numeric)
) AS t(budget_id, weekday, factor);


-- ============================================================================
-- 5. HOUR FACTORS — 12 open hours (10–21) per budget = 48 total
--    Lunch peak 12–14, dinner peak 18–20, off-peak ~0.7
-- ============================================================================
INSERT INTO public.hour_factor (
  hour_factor_id, season_budget_id, workspace_id, hour, factor
)
SELECT
  gen_random_uuid(),
  budget_id::uuid,
  'b0000000-0000-0000-0000-000000000000'::uuid,
  hour,
  factor
FROM (VALUES
  -- Vinter (ad…1) — lunch peak 12–14, dinner peak 18–20
  ('ad000000-0000-0000-0000-000000000001', 10, 0.60::numeric),
  ('ad000000-0000-0000-0000-000000000001', 11, 0.75::numeric),
  ('ad000000-0000-0000-0000-000000000001', 12, 1.25::numeric),
  ('ad000000-0000-0000-0000-000000000001', 13, 1.35::numeric),
  ('ad000000-0000-0000-0000-000000000001', 14, 1.20::numeric),
  ('ad000000-0000-0000-0000-000000000001', 15, 0.70::numeric),
  ('ad000000-0000-0000-0000-000000000001', 16, 0.75::numeric),
  ('ad000000-0000-0000-0000-000000000001', 17, 0.90::numeric),
  ('ad000000-0000-0000-0000-000000000001', 18, 1.50::numeric),
  ('ad000000-0000-0000-0000-000000000001', 19, 1.65::numeric),
  ('ad000000-0000-0000-0000-000000000001', 20, 1.55::numeric),
  ('ad000000-0000-0000-0000-000000000001', 21, 0.80::numeric),
  -- Vår (ad…2)
  ('ad000000-0000-0000-0000-000000000002', 10, 0.65::numeric),
  ('ad000000-0000-0000-0000-000000000002', 11, 0.80::numeric),
  ('ad000000-0000-0000-0000-000000000002', 12, 1.30::numeric),
  ('ad000000-0000-0000-0000-000000000002', 13, 1.40::numeric),
  ('ad000000-0000-0000-0000-000000000002', 14, 1.25::numeric),
  ('ad000000-0000-0000-0000-000000000002', 15, 0.72::numeric),
  ('ad000000-0000-0000-0000-000000000002', 16, 0.78::numeric),
  ('ad000000-0000-0000-0000-000000000002', 17, 0.95::numeric),
  ('ad000000-0000-0000-0000-000000000002', 18, 1.55::numeric),
  ('ad000000-0000-0000-0000-000000000002', 19, 1.65::numeric),
  ('ad000000-0000-0000-0000-000000000002', 20, 1.55::numeric),
  ('ad000000-0000-0000-0000-000000000002', 21, 0.85::numeric),
  -- Sommer (ad…3) — higher all-day base (terrace), late evening busy
  ('ad000000-0000-0000-0000-000000000003', 10, 0.70::numeric),
  ('ad000000-0000-0000-0000-000000000003', 11, 0.85::numeric),
  ('ad000000-0000-0000-0000-000000000003', 12, 1.30::numeric),
  ('ad000000-0000-0000-0000-000000000003', 13, 1.40::numeric),
  ('ad000000-0000-0000-0000-000000000003', 14, 1.30::numeric),
  ('ad000000-0000-0000-0000-000000000003', 15, 0.90::numeric),
  ('ad000000-0000-0000-0000-000000000003', 16, 1.00::numeric),
  ('ad000000-0000-0000-0000-000000000003', 17, 1.10::numeric),
  ('ad000000-0000-0000-0000-000000000003', 18, 1.60::numeric),
  ('ad000000-0000-0000-0000-000000000003', 19, 1.70::numeric),
  ('ad000000-0000-0000-0000-000000000003', 20, 1.65::numeric),
  ('ad000000-0000-0000-0000-000000000003', 21, 1.00::numeric),
  -- Høst/Jul (ad…4) — Christmas lunch rush + standard dinner peak
  ('ad000000-0000-0000-0000-000000000004', 10, 0.62::numeric),
  ('ad000000-0000-0000-0000-000000000004', 11, 0.78::numeric),
  ('ad000000-0000-0000-0000-000000000004', 12, 1.35::numeric),
  ('ad000000-0000-0000-0000-000000000004', 13, 1.45::numeric),
  ('ad000000-0000-0000-0000-000000000004', 14, 1.30::numeric),
  ('ad000000-0000-0000-0000-000000000004', 15, 0.75::numeric),
  ('ad000000-0000-0000-0000-000000000004', 16, 0.80::numeric),
  ('ad000000-0000-0000-0000-000000000004', 17, 0.95::numeric),
  ('ad000000-0000-0000-0000-000000000004', 18, 1.55::numeric),
  ('ad000000-0000-0000-0000-000000000004', 19, 1.70::numeric),
  ('ad000000-0000-0000-0000-000000000004', 20, 1.60::numeric),
  ('ad000000-0000-0000-0000-000000000004', 21, 0.90::numeric)
) AS t(budget_id, hour, factor);


-- ============================================================================
-- 6. SEASON GOALS — 3 per season = 12 total
-- ============================================================================
INSERT INTO public.season_goal (
  season_goal_id, workspace_id, season_id,
  title, description, metric_key, target_value, target_unit,
  status, sort_order, created_by
) VALUES
  -- Vinter goals
  ('b5000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000001',
   'Omsetningsmål', 'Nå total omsetning for vintersesongen',
   'total_revenue', 3800000.00, 'NOK', 'active', 1,
   'f0000000-0000-0000-0000-000000000000'),
  ('b5000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000001',
   'Lønnskostnad', 'Hold lønnskostnad under 30% av omsetning',
   'labor_cost_pct', 30.00, '%', 'active', 2,
   'f0000000-0000-0000-0000-000000000000'),
  ('b5000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000001',
   'Gjestebesøk', 'Antall gjester gjennom vinteren',
   'guest_count', 5900.00, 'gjester', 'active', 3,
   'f0000000-0000-0000-0000-000000000000'),

  -- Vår goals (1 completed for variety)
  ('b5000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000002',
   'Omsetningsmål', 'Vårsesongens inntektsmål inkl. påskeuke',
   'total_revenue', 4200000.00, 'NOK', 'completed', 1,
   'f0000000-0000-0000-0000-000000000000'),
  ('b5000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000002',
   'Lønnskostnad', 'Effektiv bemanning i lavperioder',
   'labor_cost_pct', 29.00, '%', 'completed', 2,
   'f0000000-0000-0000-0000-000000000000'),
  ('b5000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000002',
   'Gjestebesøk', '17. mai og påskedager gir topptrafikk',
   'guest_count', 6500.00, 'gjester', 'completed', 3,
   'f0000000-0000-0000-0000-000000000000'),

  -- Sommer goals
  ('b5000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000003',
   'Omsetningsmål', 'Høysesong terrasse — mål for sommerhalvåret',
   'total_revenue', 5900000.00, 'NOK', 'active', 1,
   'f0000000-0000-0000-0000-000000000000'),
  ('b5000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000003',
   'Lønnskostnad', 'Ekstra sesongarbeidere — hold kostnad under 28%',
   'labor_cost_pct', 28.00, '%', 'active', 2,
   'f0000000-0000-0000-0000-000000000000'),
  ('b5000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000003',
   'Gjestebesøk', 'Terrassekapasitet + inne = 9000+ gjester',
   'guest_count', 9200.00, 'gjester', 'active', 3,
   'f0000000-0000-0000-0000-000000000000'),

  -- Høst/Jul goals
  ('b5000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000004',
   'Omsetningsmål', 'Julebord + adventsbuffet — årets nest beste sesong',
   'total_revenue', 5200000.00, 'NOK', 'active', 1,
   'f0000000-0000-0000-0000-000000000000'),
  ('b5000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000004',
   'Lønnskostnad', 'Ekstra julehjelp — target 31%',
   'labor_cost_pct', 31.00, '%', 'active', 2,
   'f0000000-0000-0000-0000-000000000000'),
  ('b5000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000004',
   'Gjestebesøk', 'Julebordperioden nov–des alene gir 3000+ gjester',
   'guest_count', 8000.00, 'gjester', 'active', 3,
   'f0000000-0000-0000-0000-000000000000');


-- ============================================================================
-- 7. SEASON POLICY BINDINGS — 3 new seasons × 2–3 policies each = 9 rows
--    Vinter's bindings (af000000-…-1 through -4) owned by 40-governance; leave them.
-- ============================================================================
INSERT INTO public.season_policy_binding (
  season_policy_binding_id, workspace_id, season_id, policy_id,
  is_active, notes, activated_by
) VALUES
  -- Vår: HACCP + Servicestandard + Bardrift
  ('af100000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000001',
   true, 'HACCP gjelder hele året', 'f0000000-0000-0000-0000-000000000000'),
  ('af100000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000002',
   true, 'Ekstra fokus på servicestandard i vårsesongen', 'f0000000-0000-0000-0000-000000000000'),
  ('af100000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000004',
   true, 'Bardrift spesielt aktuelt rundt nasjonaldagen', 'f0000000-0000-0000-0000-000000000000'),

  -- Sommer: HACCP + Servicestandard + HMS
  ('af100000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000001',
   true, 'HACCP kritisk i varme måneder', 'f0000000-0000-0000-0000-000000000000'),
  ('af100000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000002',
   true, 'Mange sesongansatte krever sterk servicestandard', 'f0000000-0000-0000-0000-000000000000'),
  ('af100000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000005',
   true, 'HMS ekstra viktig med terrasse + økt trafikk', 'f0000000-0000-0000-0000-000000000000'),

  -- Høst/Jul: HACCP + Opplæring + Bardrift
  ('af100000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000004',
   'c1000000-0000-0000-0000-000000000001',
   true, 'HACCP — julematproduksjon krever ekstra kontroll', 'f0000000-0000-0000-0000-000000000000'),
  ('af100000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000004',
   'c1000000-0000-0000-0000-000000000003',
   true, 'Julenyhires krever rask onboarding', 'f0000000-0000-0000-0000-000000000000'),
  ('af100000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000004',
   'c1000000-0000-0000-0000-000000000004',
   true, 'Julebord = høyt alkoholfokus, bardrift kritisk', 'f0000000-0000-0000-0000-000000000000');


-- ============================================================================
-- 8. DEPARTMENT OPERATING HOURS — season-scoped (all 4 seasons → 112 rows)
--    Vinter (ac…1):  4 depts × 7 days = 28 rows  — same 10:00–23:00 as default
--    Vår    (ac…2):  4 depts × 7 days = 28 rows  — mirrors default 10:00–23:00
--    Sommer (ac…3):  4 depts × 7 days = 28 rows  — extended: open 11:00, close 01:00
--    Høst   (ac…4):  4 depts × 7 days = 28 rows  — Christmas peak: Fri/Sat close 00:00
--    Total: 112 rows. Every season's Hours tab renders populated (not empty CTA).
--    unique: (department_id, location_id, season_id, day_of_week) NULLS NOT DISTINCT
--    Default hours use location_id = NULL — match that pattern for season rows too.
--    No ON CONFLICT needed: idempotency block clears all season_id IS NOT NULL rows.
-- ============================================================================

-- 8a. Vinter — 4 departments × 7 days (standard winter hours 10:00–23:00)
INSERT INTO public.department_operating_hours (
  id, workspace_id, department_id, location_id, season_id,
  day_of_week, open_time, close_time, is_closed,
  provenance, is_derived
)
SELECT
  gen_random_uuid(),
  'b0000000-0000-0000-0000-000000000000',
  dept_id,
  NULL,   -- match default-hours pattern (location_id = NULL)
  'ac000000-0000-0000-0000-000000000001',
  dow,
  '10:00'::time,
  '23:00'::time,
  false,
  '{}'::jsonb,
  false
FROM
  (VALUES
    ('d0000000-0000-0000-0000-000000000000'::uuid),
    ('d0000000-0000-0000-0000-000000000001'::uuid),
    ('d0000000-0000-0000-0000-000000000002'::uuid),
    ('d0000000-0000-0000-0000-000000000003'::uuid)
  ) AS depts(dept_id),
  generate_series(0, 6) AS dow;

-- 8b. Vår — mirrors default winter hours 10:00–23:00 (spring is steady, no extension)
INSERT INTO public.department_operating_hours (
  id, workspace_id, department_id, location_id, season_id,
  day_of_week, open_time, close_time, is_closed,
  provenance, is_derived
)
SELECT
  gen_random_uuid(),
  'b0000000-0000-0000-0000-000000000000',
  dept_id,
  NULL,
  'ac000000-0000-0000-0000-000000000002',
  dow,
  '10:00'::time,
  '23:00'::time,
  false,
  '{}'::jsonb,
  false
FROM
  (VALUES
    ('d0000000-0000-0000-0000-000000000000'::uuid),
    ('d0000000-0000-0000-0000-000000000001'::uuid),
    ('d0000000-0000-0000-0000-000000000002'::uuid),
    ('d0000000-0000-0000-0000-000000000003'::uuid)
  ) AS depts(dept_id),
  generate_series(0, 6) AS dow;

-- 8c. Sommer — extended hours: open 11:00, close 01:00 (next day)
INSERT INTO public.department_operating_hours (
  id, workspace_id, department_id, location_id, season_id,
  day_of_week, open_time, close_time, is_closed,
  provenance, is_derived
)
SELECT
  gen_random_uuid(),
  'b0000000-0000-0000-0000-000000000000',
  dept_id,
  NULL,
  'ac000000-0000-0000-0000-000000000003',
  dow,
  '11:00'::time,
  '01:00'::time,  -- midnight-past-midnight extended
  false,
  '{}'::jsonb,
  false
FROM
  (VALUES
    ('d0000000-0000-0000-0000-000000000000'::uuid),
    ('d0000000-0000-0000-0000-000000000001'::uuid),
    ('d0000000-0000-0000-0000-000000000002'::uuid),
    ('d0000000-0000-0000-0000-000000000003'::uuid)
  ) AS depts(dept_id),
  generate_series(0, 6) AS dow;

-- 8d. Høst/Jul — Christmas peak: open 10:00; Fri (4) + Sat (5) close 00:00, else 23:00
INSERT INTO public.department_operating_hours (
  id, workspace_id, department_id, location_id, season_id,
  day_of_week, open_time, close_time, is_closed,
  provenance, is_derived
)
SELECT
  gen_random_uuid(),
  'b0000000-0000-0000-0000-000000000000',
  dept_id,
  NULL,
  'ac000000-0000-0000-0000-000000000004',
  dow,
  '10:00'::time,
  CASE WHEN dow IN (4, 5) THEN '00:00'::time ELSE '23:00'::time END,
  false,
  '{}'::jsonb,
  false
FROM
  (VALUES
    ('d0000000-0000-0000-0000-000000000000'::uuid),
    ('d0000000-0000-0000-0000-000000000001'::uuid),
    ('d0000000-0000-0000-0000-000000000002'::uuid),
    ('d0000000-0000-0000-0000-000000000003'::uuid)
  ) AS depts(dept_id),
  generate_series(0, 6) AS dow;


-- ============================================================================
-- 9. PLANNING EVENTS — 14 rows covering all 5 categories ≥ 2× each
--    Categories: cultural_commercial, external_scraped, internal, weather, recurring
--    Sources: manual, scraped_municipality, scraped_cultural, weather_api,
--             booking_integration, historical_import
-- ============================================================================
INSERT INTO public.planning_event (
  planning_event_id, workspace_id, planning_cycle_id,
  name, description, category, source,
  event_date, end_date,
  demand_multiplier, expected_covers, confidence,
  is_recurring, recurrence_rule,
  external_source_url, provenance, created_by
) VALUES
  -- ── cultural_commercial ──────────────────────────────────────────────────
  (
    gen_random_uuid(), 'b0000000-0000-0000-0000-000000000000',
    'ae000000-0000-0000-0000-000000000001',
    '17. mai nasjonaldag', 'Grunnlovsdagen — ekstrem etterspørsel hele dagen',
    'cultural_commercial', 'manual',
    make_date(extract(year from CURRENT_DATE)::int, 5, 17), NULL,
    1.80, 310, 0.95,
    false, NULL, NULL, '{}'::jsonb, 'f0000000-0000-0000-0000-000000000000'
  ),
  (
    gen_random_uuid(), 'b0000000-0000-0000-0000-000000000000',
    'ae000000-0000-0000-0000-000000000001',
    'Oslo Pride', 'Pride-uka i Oslo — høy trafikk i sentrum',
    'cultural_commercial', 'manual',
    make_date(extract(year from CURRENT_DATE)::int, 6, 28),
    make_date(extract(year from CURRENT_DATE)::int, 7, 5),
    1.40, 240, 0.85,
    false, NULL, NULL, '{}'::jsonb, 'f0000000-0000-0000-0000-000000000000'
  ),
  (
    gen_random_uuid(), 'b0000000-0000-0000-0000-000000000000',
    'ae000000-0000-0000-0000-000000000001',
    'Julemarked Karl Johan', 'Julemarked trekker turister — bookings stiger',
    'cultural_commercial', 'historical_import',
    make_date(extract(year from CURRENT_DATE)::int, 12, 1),
    make_date(extract(year from CURRENT_DATE)::int, 12, 23),
    1.35, 210, 0.80,
    false, NULL, NULL, '{}'::jsonb, 'f0000000-0000-0000-0000-000000000000'
  ),

  -- ── external_scraped ─────────────────────────────────────────────────────
  (
    gen_random_uuid(), 'b0000000-0000-0000-0000-000000000000',
    'ae000000-0000-0000-0000-000000000001',
    'Konsert Oslo Spektrum', 'Stor konsert — 8000+ tilskuere, sen kveld',
    'external_scraped', 'scraped_cultural',
    make_date(extract(year from CURRENT_DATE)::int, 9, 12), NULL,
    1.60, 280, 0.75,
    false, NULL, 'https://oslosspektrum.no', '{}'::jsonb,
    'f0000000-0000-0000-0000-000000000000'
  ),
  (
    gen_random_uuid(), 'b0000000-0000-0000-0000-000000000000',
    'ae000000-0000-0000-0000-000000000001',
    'Matfestival Aker Brygge', 'Lokal matfestival — spisested-konkurranse øker synlighet',
    'external_scraped', 'scraped_municipality',
    make_date(extract(year from CURRENT_DATE)::int, 8, 15),
    make_date(extract(year from CURRENT_DATE)::int, 8, 17),
    1.20, 180, 0.70,
    false, NULL, NULL, '{}'::jsonb, 'f0000000-0000-0000-0000-000000000000'
  ),
  (
    gen_random_uuid(), 'b0000000-0000-0000-0000-000000000000',
    'ae000000-0000-0000-0000-000000000001',
    'Halvmaraton Oslo', 'Løpsevent — mange sultne løpere + familier etterpå',
    'external_scraped', 'scraped_municipality',
    make_date(extract(year from CURRENT_DATE)::int, 5, 9), NULL,
    1.25, 200, 0.65,
    false, NULL, NULL, '{}'::jsonb, 'f0000000-0000-0000-0000-000000000000'
  ),

  -- ── internal ─────────────────────────────────────────────────────────────
  (
    gen_random_uuid(), 'b0000000-0000-0000-0000-000000000000',
    'ae000000-0000-0000-0000-000000000001',
    'Personalfest', 'Ansattfest etter sommersesong — kjøkkenet stenger tidlig',
    'internal', 'manual',
    make_date(extract(year from CURRENT_DATE)::int, 9, 5), NULL,
    0.70, 0, 0.90,
    false, NULL, NULL, '{}'::jsonb, 'f0000000-0000-0000-0000-000000000000'
  ),
  (
    gen_random_uuid(), 'b0000000-0000-0000-0000-000000000000',
    'ae000000-0000-0000-0000-000000000001',
    'Inventartelling', 'Halvårlig inventar — redusert drift, tidlig stenging',
    'internal', 'manual',
    make_date(extract(year from CURRENT_DATE)::int, 6, 30), NULL,
    0.75, 0, 0.95,
    false, NULL, NULL, '{}'::jsonb, 'f0000000-0000-0000-0000-000000000000'
  ),
  (
    gen_random_uuid(), 'b0000000-0000-0000-0000-000000000000',
    'ae000000-0000-0000-0000-000000000001',
    'Vintermeny-lansering', 'Ny vintermeny — PR-event med presse og influencere',
    'internal', 'manual',
    make_date(extract(year from CURRENT_DATE)::int, 10, 14), NULL,
    1.30, 120, 0.85,
    false, NULL, NULL, '{}'::jsonb, 'f0000000-0000-0000-0000-000000000000'
  ),

  -- ── weather ──────────────────────────────────────────────────────────────
  (
    gen_random_uuid(), 'b0000000-0000-0000-0000-000000000000',
    'ae000000-0000-0000-0000-000000000001',
    'Varmebølge helg', 'Forventet 28°C+ lørdag–søndag — terrasse fullt booket',
    'weather', 'weather_api',
    make_date(extract(year from CURRENT_DATE)::int, 7, 19),
    make_date(extract(year from CURRENT_DATE)::int, 7, 20),
    1.55, 260, 0.60,
    false, NULL, NULL, '{}'::jsonb, 'f0000000-0000-0000-0000-000000000000'
  ),
  (
    gen_random_uuid(), 'b0000000-0000-0000-0000-000000000000',
    'ae000000-0000-0000-0000-000000000001',
    'Regnvarsel uke 43', 'Vedvarende regn — lavere terrasse, økt inne-trafikk',
    'weather', 'weather_api',
    make_date(extract(year from CURRENT_DATE)::int, 10, 21),
    make_date(extract(year from CURRENT_DATE)::int, 10, 25),
    0.88, 130, 0.55,
    false, NULL, NULL, '{}'::jsonb, 'f0000000-0000-0000-0000-000000000000'
  ),

  -- ── recurring ────────────────────────────────────────────────────────────
  (
    gen_random_uuid(), 'b0000000-0000-0000-0000-000000000000',
    'ae000000-0000-0000-0000-000000000001',
    'Quiz-kveld', 'Ukentlig quiz onsdager — lokal merkevarebygging, jevn ekstratrafikk',
    'recurring', 'manual',
    make_date(extract(year from CURRENT_DATE)::int, 1, 7),   -- first Wednesday
    make_date(extract(year from CURRENT_DATE)::int, 12, 31),
    1.20, 85, 0.80,
    true, 'FREQ=WEEKLY;BYDAY=WE', NULL, '{}'::jsonb,
    'f0000000-0000-0000-0000-000000000000'
  ),
  (
    gen_random_uuid(), 'b0000000-0000-0000-0000-000000000000',
    'ae000000-0000-0000-0000-000000000001',
    'Søndagsbrunsj', 'Populær søndagsbrunsj — tidlig tilstrømning 11–14',
    'recurring', 'booking_integration',
    make_date(extract(year from CURRENT_DATE)::int, 1, 4),   -- first Sunday
    make_date(extract(year from CURRENT_DATE)::int, 12, 31),
    1.30, 110, 0.85,
    true, 'FREQ=WEEKLY;BYDAY=SU', NULL, '{}'::jsonb,
    'f0000000-0000-0000-0000-000000000000'
  );


-- ============================================================================
-- 10. HOLIDAY CALENDAR + HOLIDAY ENTRIES (payroll schema)
-- ============================================================================
INSERT INTO payroll.holiday_calendar (id, workspace_id, name, is_default)
VALUES (
  'af200000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000000',
  'Norske helligdager',
  true
);

-- Populate from public.public_holiday (platform seed) for current year
INSERT INTO payroll.holiday_entry (
  id, workspace_id, calendar_id,
  holiday_date, name, name_no, hours, is_full_day
)
SELECT
  gen_random_uuid(),
  'b0000000-0000-0000-0000-000000000000',
  'af200000-0000-0000-0000-000000000001',
  ph.holiday_date,
  ph.name,
  ph.name_no,
  8,
  ph.is_full_day
FROM public.public_holiday ph
WHERE ph.country_code = 'NO'
  AND extract(year from ph.holiday_date) = extract(year from CURRENT_DATE)
ON CONFLICT (calendar_id, holiday_date) DO NOTHING;


COMMIT;
