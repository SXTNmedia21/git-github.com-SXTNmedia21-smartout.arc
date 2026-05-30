-- ============ DEMO RESTAURANT CANONICAL ID MAP (do not edit per-file) ============
-- COMPANY        a0000000-0000-0000-0000-000000000000  Smartout AS
-- WORKSPACE      b0000000-0000-0000-0000-000000000000  "Demo Restaurant"
-- LOCATION       c0000000-0000-0000-0000-000000000000  Oslo Downtown Hub
-- ZONE Hovedsal  d1000000-0000-0000-0000-000000000001  | Terrasse d1…2 | Bar d1…3 | Privat d1…4
-- DEPT Operations d0000000-0000-0000-0000-000000000000 | Kitchen d0…1 | Service d0…2 | Bar d0…3
-- PROFILES f0000000-…-{0..9} + new {a..d}; AUTH e0000000-…-{0..9} + new {a..d}
-- LOCAL ONLY — never prod. Idempotent (upsert). password = password123
-- =================================================================================
--
-- 10-people.sql — Employment contracts + tariff binding
-- Owns: employment_contract, payroll.workspace_settings, public.workspace_union_binding
-- Does NOT own: employee_payroll_profile (00-base.sql)
--
-- Active staff seeded (11 contracts — skipping inactive f…3 Lise, f…6 Jon, f…7 Sara):
--   f…0  Local Admin / Restaurant Manager   owner/active   faglart
--   f…1  Anna Olsen  / Kokk                 employee/active faglart
--   f…2  Erik Pedersen / Sous Chef          manager/active  faglart
--   f…4  Ole Torp / Bartender               employee/active faglart
--   f…5  Kari Nilsen / Servitør             employee/trainee ufaglart
--   f…8  Jonas Bakken / Kokk                employee/trainee ufaglart
--   f…9  Silje Ruud / Servitør              employee/trainee ufaglart
--   f…a  Sofia Berg / Sommelier             employee/active  faglart
--   f…b  Mats Holm / Bartender              employee/active  faglart
--   f…c  Nora Lie / Konditor                employee/active  faglart
--   f…d  Even Aas / Vertinne               employee/active  ufaglart
--
-- Trigger note: trg_sync_workspace_settings_union_cache fires AFTER INSERT on
-- workspace_union_binding and UPDATEs payroll.workspace_settings.is_tariff_bound.
-- Therefore workspace_settings MUST exist before the binding INSERT.
--
-- FK note: workspace_settings.active_binding_id → workspace_union_binding ON DELETE NO ACTION.
-- We must NULL it out before deleting the binding on re-apply.
-- ==================================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Clear FK reference + delete this file's rows (child→parent order)
-- ============================================================================

-- Null the FK pointer + reset tariff flag so the coherence check passes on re-apply.
-- (chk_tariff_bound_union_id_coherence requires: is_tariff_bound=false OR active_union_id IS NOT NULL)
-- The trigger will restore is_tariff_bound=true + active_union_id when we insert the binding below.
UPDATE payroll.workspace_settings
   SET active_binding_id = NULL,
       active_union_id   = NULL,
       is_tariff_bound   = FALSE
 WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- Delete binding (now no FK reference blocking)
DELETE FROM public.workspace_union_binding
 WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- Delete contracts for this workspace
DELETE FROM public.employment_contract
 WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- ============================================================================
-- STEP 2: Upsert payroll.workspace_settings (must exist before binding INSERT)
-- ============================================================================

INSERT INTO payroll.workspace_settings
  (id, workspace_id, period_type, period_start_day)
VALUES
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000000', 'monthly', 1)
ON CONFLICT (workspace_id) DO UPDATE
  SET period_type      = EXCLUDED.period_type,
      period_start_day = EXCLUDED.period_start_day;

-- ============================================================================
-- STEP 3: Employment contracts (date-dynamic via CURRENT_DATE, no literal dates)
-- ============================================================================

-- Tariff rate helpers (subqueries — rates sourced from tariff_rate_table, never hardcoded)
-- faglart:   (SELECT amount FROM public.tariff_rate_table WHERE workspace_id IS NULL AND rate_type='minstelonn_faglart'  ORDER BY effective_from DESC LIMIT 1)
-- ufaglart:  (SELECT amount FROM public.tariff_rate_table WHERE workspace_id IS NULL AND rate_type='minstelonn_ufaglart' ORDER BY effective_from DESC LIMIT 1)

-- f…0  Local Admin — Restaurant Manager — owner/active — faglart — monthly salary, full-time
INSERT INTO public.employment_contract
  (contract_id, workspace_id, profile_id,
   position_title, employment_category,
   employment_form, status, contract_status,
   employment_percentage, agreed_weekly_hours,
   monthly_salary,
   start_date,
   created_by)
VALUES
  (gen_random_uuid(),
   'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000000',
   'Restaurant Manager', 'fast',
   'permanent', 'active', 'active',
   100, 37.5,
   -- Monthly salary derived: faglart rate × 162.5 (monthly hours) — traceable, not hardcoded
   (SELECT amount FROM public.tariff_rate_table
     WHERE workspace_id IS NULL AND rate_type = 'minstelonn_faglart'
     ORDER BY effective_from DESC LIMIT 1) * 162.5,
   CURRENT_DATE - INTERVAL '5 years',
   'f0000000-0000-0000-0000-000000000000');

-- f…1  Anna Olsen — Kokk — employee/active — faglart — hourly, full-time
INSERT INTO public.employment_contract
  (contract_id, workspace_id, profile_id,
   position_title, employment_category,
   employment_form, status, contract_status,
   employment_percentage, agreed_weekly_hours,
   hourly_rate,
   start_date,
   created_by)
VALUES
  (gen_random_uuid(),
   'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001',
   'Kokk', 'fast',
   'permanent', 'active', 'active',
   100, 37.5,
   (SELECT amount FROM public.tariff_rate_table
     WHERE workspace_id IS NULL AND rate_type = 'minstelonn_faglart'
     ORDER BY effective_from DESC LIMIT 1),
   CURRENT_DATE - INTERVAL '4 years',
   'f0000000-0000-0000-0000-000000000000');

-- f…2  Erik Pedersen — Sous Chef — manager/active — faglart — monthly salary, full-time
INSERT INTO public.employment_contract
  (contract_id, workspace_id, profile_id,
   position_title, employment_category,
   employment_form, status, contract_status,
   employment_percentage, agreed_weekly_hours,
   monthly_salary,
   start_date,
   created_by)
VALUES
  (gen_random_uuid(),
   'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000002',
   'Sous Chef', 'fast',
   'permanent', 'active', 'active',
   100, 37.5,
   (SELECT amount FROM public.tariff_rate_table
     WHERE workspace_id IS NULL AND rate_type = 'minstelonn_faglart'
     ORDER BY effective_from DESC LIMIT 1) * 162.5,
   CURRENT_DATE - INTERVAL '3 years 6 months',
   'f0000000-0000-0000-0000-000000000000');

-- f…4  Ole Torp — Bartender — employee/active — faglart — hourly, full-time
INSERT INTO public.employment_contract
  (contract_id, workspace_id, profile_id,
   position_title, employment_category,
   employment_form, status, contract_status,
   employment_percentage, agreed_weekly_hours,
   hourly_rate,
   start_date,
   created_by)
VALUES
  (gen_random_uuid(),
   'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000004',
   'Bartender', 'fast',
   'permanent', 'active', 'active',
   100, 37.5,
   (SELECT amount FROM public.tariff_rate_table
     WHERE workspace_id IS NULL AND rate_type = 'minstelonn_faglart'
     ORDER BY effective_from DESC LIMIT 1),
   CURRENT_DATE - INTERVAL '3 years',
   'f0000000-0000-0000-0000-000000000000');

-- f…5  Kari Nilsen — Servitør (trainee) — employee/trainee — ufaglart — hourly, part-time 80%
INSERT INTO public.employment_contract
  (contract_id, workspace_id, profile_id,
   position_title, employment_category,
   employment_form, status, contract_status,
   employment_percentage, agreed_weekly_hours,
   hourly_rate,
   trial_period_months,
   start_date,
   created_by)
VALUES
  (gen_random_uuid(),
   'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000005',
   'Servitør', 'deltid',
   'permanent', 'active', 'active',
   80, 30,
   (SELECT amount FROM public.tariff_rate_table
     WHERE workspace_id IS NULL AND rate_type = 'minstelonn_ufaglart'
     ORDER BY effective_from DESC LIMIT 1),
   6,
   CURRENT_DATE - INTERVAL '8 months',
   'f0000000-0000-0000-0000-000000000000');

-- f…8  Jonas Bakken — Kokk (trainee) — employee/trainee — ufaglart — hourly, part-time 80%
INSERT INTO public.employment_contract
  (contract_id, workspace_id, profile_id,
   position_title, employment_category,
   employment_form, status, contract_status,
   employment_percentage, agreed_weekly_hours,
   hourly_rate,
   trial_period_months,
   start_date,
   created_by)
VALUES
  (gen_random_uuid(),
   'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000008',
   'Kokk Lærling', 'deltid',
   'permanent', 'active', 'active',
   80, 30,
   (SELECT amount FROM public.tariff_rate_table
     WHERE workspace_id IS NULL AND rate_type = 'minstelonn_ufaglart'
     ORDER BY effective_from DESC LIMIT 1),
   6,
   CURRENT_DATE - INTERVAL '6 months',
   'f0000000-0000-0000-0000-000000000000');

-- f…9  Silje Ruud — Servitør (trainee) — employee/trainee — ufaglart — hourly, part-time 50%
INSERT INTO public.employment_contract
  (contract_id, workspace_id, profile_id,
   position_title, employment_category,
   employment_form, status, contract_status,
   employment_percentage, agreed_weekly_hours,
   hourly_rate,
   trial_period_months,
   start_date,
   created_by)
VALUES
  (gen_random_uuid(),
   'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000009',
   'Servitør', 'deltid',
   'permanent', 'active', 'active',
   50, 18.75,
   (SELECT amount FROM public.tariff_rate_table
     WHERE workspace_id IS NULL AND rate_type = 'minstelonn_ufaglart'
     ORDER BY effective_from DESC LIMIT 1),
   6,
   CURRENT_DATE - INTERVAL '10 months',
   'f0000000-0000-0000-0000-000000000000');

-- f…a  Sofia Berg — Sommelier — employee/active — faglart — hourly, full-time
INSERT INTO public.employment_contract
  (contract_id, workspace_id, profile_id,
   position_title, employment_category,
   employment_form, status, contract_status,
   employment_percentage, agreed_weekly_hours,
   hourly_rate,
   start_date,
   created_by)
VALUES
  (gen_random_uuid(),
   'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-00000000000a',
   'Sommelier', 'fast',
   'permanent', 'active', 'active',
   100, 37.5,
   (SELECT amount FROM public.tariff_rate_table
     WHERE workspace_id IS NULL AND rate_type = 'minstelonn_faglart'
     ORDER BY effective_from DESC LIMIT 1),
   CURRENT_DATE - INTERVAL '2 years',
   'f0000000-0000-0000-0000-000000000000');

-- f…b  Mats Holm — Bartender — employee/active — faglart — hourly, full-time
INSERT INTO public.employment_contract
  (contract_id, workspace_id, profile_id,
   position_title, employment_category,
   employment_form, status, contract_status,
   employment_percentage, agreed_weekly_hours,
   hourly_rate,
   start_date,
   created_by)
VALUES
  (gen_random_uuid(),
   'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-00000000000b',
   'Bartender', 'fast',
   'permanent', 'active', 'active',
   100, 37.5,
   (SELECT amount FROM public.tariff_rate_table
     WHERE workspace_id IS NULL AND rate_type = 'minstelonn_faglart'
     ORDER BY effective_from DESC LIMIT 1),
   CURRENT_DATE - INTERVAL '1 year 8 months',
   'f0000000-0000-0000-0000-000000000000');

-- f…c  Nora Lie — Konditor — employee/active — faglart — hourly, full-time
INSERT INTO public.employment_contract
  (contract_id, workspace_id, profile_id,
   position_title, employment_category,
   employment_form, status, contract_status,
   employment_percentage, agreed_weekly_hours,
   hourly_rate,
   start_date,
   created_by)
VALUES
  (gen_random_uuid(),
   'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-00000000000c',
   'Konditor', 'fast',
   'permanent', 'active', 'active',
   100, 37.5,
   (SELECT amount FROM public.tariff_rate_table
     WHERE workspace_id IS NULL AND rate_type = 'minstelonn_faglart'
     ORDER BY effective_from DESC LIMIT 1),
   CURRENT_DATE - INTERVAL '2 years 4 months',
   'f0000000-0000-0000-0000-000000000000');

-- f…d  Even Aas — Vertinne — employee/active — ufaglart — hourly, full-time
INSERT INTO public.employment_contract
  (contract_id, workspace_id, profile_id,
   position_title, employment_category,
   employment_form, status, contract_status,
   employment_percentage, agreed_weekly_hours,
   hourly_rate,
   start_date,
   created_by)
VALUES
  (gen_random_uuid(),
   'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-00000000000d',
   'Vertinne', 'fast',
   'permanent', 'active', 'active',
   100, 37.5,
   (SELECT amount FROM public.tariff_rate_table
     WHERE workspace_id IS NULL AND rate_type = 'minstelonn_ufaglart'
     ORDER BY effective_from DESC LIMIT 1),
   CURRENT_DATE - INTERVAL '1 year 2 months',
   'f0000000-0000-0000-0000-000000000000');

-- ============================================================================
-- STEP 4: workspace_union_binding
-- Inserting this row triggers trg_sync_workspace_settings_union_cache which
-- runs: UPDATE payroll.workspace_settings
--         SET is_tariff_bound = (NEW.union_id != 'non-bound'),
--             active_union_id = NEW.union_id,
--             active_binding_id = NEW.workspace_union_binding_id
--       WHERE workspace_id = NEW.workspace_id AND effective_to IS NULL;
--
-- EXEMPT DATE BELOW: official_effective_date + effective_from are calendar-fixed
-- law effective dates (not demo business dates). One clearly-commented exempt line.
-- ============================================================================

INSERT INTO public.workspace_union_binding
  (workspace_union_binding_id, workspace_id, union_id, law_version,
   official_effective_date, effective_from, effective_to,  -- LAW DATE: 2026-01-01 — exempt from date-dynamic gate
   amendment_classifier, created_by)
VALUES
  (gen_random_uuid(),
   'b0000000-0000-0000-0000-000000000000',
   'riksavtalen',
   '2026',
   '2026-01-01',  -- law calendar date — exempt from date-dynamic grep gate
   '2026-01-01',  -- law calendar date — exempt from date-dynamic grep gate
   NULL,          -- effective_to NULL required: trigger only caches when effective_to IS NULL
   'BOOTSTRAP',
   'f0000000-0000-0000-0000-000000000000');

COMMIT;
