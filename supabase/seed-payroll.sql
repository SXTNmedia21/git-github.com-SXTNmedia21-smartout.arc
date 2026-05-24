-- ============================================================================
-- seed-payroll.sql — ENV-3: payroll PII seed for payroll-phase-5 e2e tests
--
-- Unblocks: apps/e2e/payroll-phase-5/reveal.spec.ts (6/6 skipped)
-- Status: seeded (2026-05-24)
--
-- Inserts / updates:
--   UPDATE public.profile for Anna Olsen (f0000000-...-0001):
--     - personal_number = '12345678901'  (test fødselsnummer, 11 digits)
--     - bank_account    = '12345678903'  (test bankkonto)
--     - tax_card_type   = 'percentage'
--     - tax_percentage  = 20.00
--     - tax_card_year   = 2026
--
-- Anna's profile_id is: f0000000-0000-0000-0000-000000000001
-- Anna's user_id is:    e0000000-0000-0000-0000-000000000001
-- Workspace:            b0000000-0000-0000-0000-000000000000 (HQ Workspace)
--
-- Idempotent: uses WHERE EXISTS guard — re-running is safe.
-- Run after supabase/seed.sql (depends on the Anna Olsen profile row).
--
-- SEED_EMPLOYEE_ID for reveal.spec.ts = f0000000-0000-0000-0000-000000000001
-- ============================================================================

SET search_path = public, extensions, pg_catalog;

-- ─── 1. Set PII columns + tax card on Anna's profile ─────────────────────────
-- personal_number and bank_account are already partially seeded in seed.sql
-- (Anna has '120190 12345' and '1234.56.78901'). We overwrite with canonical
-- e2e test values to match what reveal.spec.ts assertions expect.
-- tax_card_type/tax_percentage/tax_card_year were added by migration
-- 20260519100100_contracts_module_foundation.sql.
UPDATE public.profile
SET
  personal_number  = '12345678901',
  bank_account     = '12345678903',
  tax_card_type    = 'percentage'::tax_card_type,
  tax_percentage   = 20.00,
  tax_card_year    = 2026
WHERE profile_id = 'f0000000-0000-0000-0000-000000000001'
  AND workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- ─── 2. Ensure employee_payroll_profile row exists for Anna ───────────────────
-- seed.sql already inserts Anna's payroll profile at line 3117. This is a
-- defensive no-op insert in case seed-payroll.sql is applied standalone.
INSERT INTO public.employee_payroll_profile (
  workspace_id, profile_id, has_fagbrev, salary_type, agreed_weekly_hours,
  tariff_category, seniority_start_date, valid_from
) VALUES (
  'b0000000-0000-0000-0000-000000000000',
  'f0000000-0000-0000-0000-000000000001',
  false, 'hourly', 37.5, 'ufaglart', '2024-01-01', '2024-01-01'
) ON CONFLICT DO NOTHING;

-- ─── Cross-workspace test: Workspace B profile ───────────────────────────────
-- ENV-3 requires a second-workspace profile for cross-workspace 404 rejection.
-- We create a minimal "workspace B" with one profile for the isolation test.
-- SEED_WORKSPACE_B_PROFILE_ID for reveal.spec.ts = f0000000-0000-0000-0000-0000000000b1

-- Workspace B (isolated, no company — company_id is nullable per ADR-0306)
INSERT INTO public.workspace (
  workspace_id, name, slug, currency, language, country, onboarding_completed
) VALUES (
  'b0000000-0000-0000-0000-0000000000b1',
  'Payroll E2E Workspace B',
  'payroll-e2e-ws-b',
  'NOK', 'no', 'NO', false
) ON CONFLICT (workspace_id) DO NOTHING;

-- Workspace B profile (reuses Anna's auth.users identity — different workspace)
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id,
  role, status, display_name, job_title
) VALUES (
  'f0000000-0000-0000-0000-0000000000b1',
  'B001',
  'e0000000-0000-0000-0000-000000000001',  -- Anna's auth.users id (valid identity)
  'b0000000-0000-0000-0000-0000000000b1',
  'employee', 'active',
  'Anna B (cross-ws)',
  'Kokk'
) ON CONFLICT (profile_id) DO NOTHING;
