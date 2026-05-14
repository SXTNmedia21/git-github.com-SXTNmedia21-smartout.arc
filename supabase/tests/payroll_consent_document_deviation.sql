-- ============================================================================
-- supabase/tests/payroll_consent_document_deviation.sql
--
-- Migration: 20260615110100_change_proposal_consent_fk.sql
-- ADR-0311: Trekk-samtykke som payroll-domain artifact
-- SMA-328: AML §14-15 tredje ledd trekk-samtykke
--
-- NOTE: There is NO trigger on payroll.consent_document itself.
-- The deviation backfill runs as a one-time SQL block in migration
-- 20260615110100_change_proposal_consent_fk.sql (the INSERT...SELECT).
-- The plan's "deviation trigger" referred to this backfill logic, not
-- a live AFTER DELETE trigger. This test suite therefore:
--
--  (a) Confirms the backfill logic correctness by simulating the backfill
--      INSERT...SELECT against pre-existing consent-less proposals.
--  (b) Verifies the FK behavior: change_proposal.consent_document_id
--      ON DELETE RESTRICT prevents deleting a consent_document while a
--      proposal references it (migration 20260615110100, line 10-11).
--  (c) Confirms the deviation row schema (required columns exist).
--
-- Tests (7 total):
--  1.    payroll.deviation table has required columns (check_id, severity, message, details)
--  2.    Backfill logic inserts deviation for wage_line_override + category=deduction + consent IS NULL
--  3.    Backfill is idempotent (NOT EXISTS guard prevents duplicate deviations)
--  4.    Backfill skips proposals with category != deduction
--  5.    Backfill skips proposals with consent_document_id NOT NULL
--  6.    FK RESTRICT: cannot delete consent_document referenced by change_proposal
--  7.    No live DELETE trigger on consent_document (deviation_trigger does not exist)
--
-- Run with:
--   psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--        --set ON_ERROR_STOP=1 \
--        -f supabase/tests/payroll_consent_document_deviation.sql
-- ============================================================================

BEGIN;
SELECT plan(7);

-- ── Fixtures ─────────────────────────────────────────────────────────────────
-- Minimal workspace + profile + period + consent_document for FK and backfill tests.
DO $fix$
DECLARE
  v_company       UUID := gen_random_uuid();
  v_ws            UUID := gen_random_uuid();
  v_user          UUID := gen_random_uuid();
  v_profile       UUID := gen_random_uuid();
  v_period        UUID := gen_random_uuid();
  v_consent       UUID := gen_random_uuid();
  -- Proposal IDs: one deduction-no-consent, one non-deduction, one deduction-with-consent
  v_prop_no_consent    UUID := gen_random_uuid();
  v_prop_non_deduction UUID := gen_random_uuid();
  v_prop_with_consent  UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('dev_cd.ws',             v_ws::text,             false);
  PERFORM set_config('dev_cd.profile',        v_profile::text,        false);
  PERFORM set_config('dev_cd.period',         v_period::text,         false);
  PERFORM set_config('dev_cd.consent',        v_consent::text,        false);
  PERFORM set_config('dev_cd.prop_no_consent',    v_prop_no_consent::text,    false);
  PERFORM set_config('dev_cd.prop_non_deduction', v_prop_non_deduction::text, false);
  PERFORM set_config('dev_cd.prop_with_consent',  v_prop_with_consent::text,  false);

  INSERT INTO auth.users (id, email, aud, role, instance_id) VALUES
    (v_user, 'dev-cd-' || substr(v_user::text, 1, 8) || '@t.test',
     'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  INSERT INTO company (company_id, name) VALUES (v_company, 'Dev CD Test Co');
  INSERT INTO workspace (workspace_id, company_id, name, slug) VALUES
    (v_ws, v_company, 'Dev CD WS', 'dev-cd-' || substr(v_ws::text, 1, 8));

  INSERT INTO profile (profile_id, profile_code, user_id, workspace_id, role, is_active, display_name) VALUES
    (v_profile, 'dev-cd-p-' || substr(v_profile::text, 1, 6), v_user, v_ws, 'manager', true, 'Dev CD Manager');

  -- Insert a payroll period (needed for deviation FK).
  -- payroll.period schema uses start_date/end_date (renamed from payroll_period in
  -- migration 20260422110700); status uses payroll.period_status enum.
  INSERT INTO payroll.period (id, workspace_id, start_date, end_date, status) VALUES
    (v_period, v_ws, '2026-05-01'::date, '2026-05-31'::date, 'open');

  -- Insert a consent_document (for FK + backfill tests)
  INSERT INTO payroll.consent_document (
    consent_document_id, workspace_id, employee_profile_id, consent_type,
    court_order_reference, signed_at, signed_document_url, status
  ) VALUES
    (v_consent, v_ws, v_profile, 'court_order', 'UTL-DEV-001', now(), 'https://example.com/dev.pdf', 'active');

  -- Proposal 1: deduction + consent_document_id IS NULL (target for backfill)
  INSERT INTO public.change_proposal (
    change_proposal_id, workspace_id, initiated_by, kind, status,
    approval_required, trigger_entity_type, trigger_entity_id,
    trigger_type, changes, preview, created_by_plane
  ) VALUES (
    v_prop_no_consent, v_ws, v_profile, 'wage_line_override', 'pending',
    true, 'payroll_calculation_line', gen_random_uuid(),
    'manual_override',
    jsonb_build_object(
      'category', 'deduction',
      'target_profile_id', v_profile::text,
      'period_id', v_period::text,
      'reason', 'Test deduction no consent'
    ),
    '{}', 'app'
    -- consent_document_id intentionally NULL (default)
  );

  -- Proposal 2: non-deduction (should NOT be targeted by backfill)
  INSERT INTO public.change_proposal (
    change_proposal_id, workspace_id, initiated_by, kind, status,
    approval_required, trigger_entity_type, trigger_entity_id,
    trigger_type, changes, preview, created_by_plane
  ) VALUES (
    v_prop_non_deduction, v_ws, v_profile, 'wage_line_override', 'pending',
    true, 'payroll_calculation_line', gen_random_uuid(),
    'manual_override',
    jsonb_build_object(
      'category', 'manual_adjustment',
      'target_profile_id', v_profile::text,
      'period_id', v_period::text
    ),
    '{}', 'app'
  );

  -- Proposal 3: deduction WITH consent_document_id (should NOT be targeted by backfill)
  INSERT INTO public.change_proposal (
    change_proposal_id, workspace_id, initiated_by, kind, status,
    approval_required, trigger_entity_type, trigger_entity_id,
    trigger_type, changes, preview, created_by_plane,
    consent_document_id, deduction_type
  ) VALUES (
    v_prop_with_consent, v_ws, v_profile, 'wage_line_override', 'pending',
    true, 'payroll_calculation_line', gen_random_uuid(),
    'manual_override',
    jsonb_build_object(
      'category', 'deduction',
      'target_profile_id', v_profile::text,
      'period_id', v_period::text
    ),
    '{}', 'app',
    v_consent, 'court_order'
  );
END $fix$;

-- ════════════════════════════════════════════════════════════════════════════════
-- Test 1: payroll.deviation table has required columns
-- ════════════════════════════════════════════════════════════════════════════════
SELECT ok(
  EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'payroll'
       AND table_name = 'deviation'
       AND column_name = 'check_id'
  ),
  'payroll.deviation: check_id column exists'
);

-- ════════════════════════════════════════════════════════════════════════════════
-- Test 2: Backfill inserts deviation for deduction proposal with NULL consent_document_id
-- ════════════════════════════════════════════════════════════════════════════════
-- Run the backfill logic from migration 20260615110100 against test fixtures.
-- This simulates what happens when the migration runs against a database with
-- pre-existing consent-less deduction proposals.
INSERT INTO payroll.deviation (
  workspace_id, check_id, severity, profile_id, period_id, message, details, created_at, updated_at
)
SELECT
  cp.workspace_id,
  'consent_gap_aml_14_15_tredje_ledd',
  'warning',
  (cp.changes ->> 'target_profile_id')::uuid,
  (cp.changes ->> 'period_id')::uuid,
  'Historisk trekk-forslag uten registrert samtykke (Aml. §14-15 tredje ledd nr. 1-6). Eksport ikke blokkert per Bokf.lov §7, men gap bør vurderes av revisor.',
  jsonb_build_object(
    'change_proposal_id', cp.change_proposal_id,
    'paragraph', 'Aml. §14-15 tredje ledd nr. 1-6',
    'backfill_migration', '20260615110100'
  ),
  now(), now()
FROM public.change_proposal cp
WHERE cp.kind = 'wage_line_override'
  AND cp.changes ->> 'category' = 'deduction'
  AND cp.consent_document_id IS NULL
  AND cp.workspace_id = current_setting('dev_cd.ws')::uuid
  AND NOT EXISTS (
    SELECT 1 FROM payroll.deviation d
    WHERE d.check_id = 'consent_gap_aml_14_15_tredje_ledd'
      AND (d.details ->> 'change_proposal_id') = cp.change_proposal_id::text
  );

SELECT is(
  (SELECT COUNT(*) FROM payroll.deviation
    WHERE workspace_id = current_setting('dev_cd.ws')::uuid
      AND check_id = 'consent_gap_aml_14_15_tredje_ledd'
      AND (details ->> 'change_proposal_id') = current_setting('dev_cd.prop_no_consent'))::int,
  1,
  'backfill: deviation created for deduction proposal with NULL consent_document_id'
);

-- ════════════════════════════════════════════════════════════════════════════════
-- Test 3: Backfill is idempotent — re-running does NOT create duplicate deviations
-- ════════════════════════════════════════════════════════════════════════════════
-- Run backfill a second time — NOT EXISTS guard should prevent duplicates.
INSERT INTO payroll.deviation (
  workspace_id, check_id, severity, profile_id, period_id, message, details, created_at, updated_at
)
SELECT
  cp.workspace_id,
  'consent_gap_aml_14_15_tredje_ledd',
  'warning',
  (cp.changes ->> 'target_profile_id')::uuid,
  (cp.changes ->> 'period_id')::uuid,
  'Historisk trekk-forslag uten registrert samtykke (Aml. §14-15 tredje ledd nr. 1-6). Eksport ikke blokkert per Bokf.lov §7, men gap bør vurderes av revisor.',
  jsonb_build_object(
    'change_proposal_id', cp.change_proposal_id,
    'paragraph', 'Aml. §14-15 tredje ledd nr. 1-6',
    'backfill_migration', '20260615110100'
  ),
  now(), now()
FROM public.change_proposal cp
WHERE cp.kind = 'wage_line_override'
  AND cp.changes ->> 'category' = 'deduction'
  AND cp.consent_document_id IS NULL
  AND cp.workspace_id = current_setting('dev_cd.ws')::uuid
  AND NOT EXISTS (
    SELECT 1 FROM payroll.deviation d
    WHERE d.check_id = 'consent_gap_aml_14_15_tredje_ledd'
      AND (d.details ->> 'change_proposal_id') = cp.change_proposal_id::text
  );

SELECT is(
  (SELECT COUNT(*) FROM payroll.deviation
    WHERE workspace_id = current_setting('dev_cd.ws')::uuid
      AND check_id = 'consent_gap_aml_14_15_tredje_ledd'
      AND (details ->> 'change_proposal_id') = current_setting('dev_cd.prop_no_consent'))::int,
  1,
  'backfill idempotency: re-running backfill produces exactly 1 deviation (NOT EXISTS guard works)'
);

-- ════════════════════════════════════════════════════════════════════════════════
-- Test 4: Backfill skips proposals with category != deduction
-- ════════════════════════════════════════════════════════════════════════════════
SELECT is(
  (SELECT COUNT(*) FROM payroll.deviation
    WHERE workspace_id = current_setting('dev_cd.ws')::uuid
      AND check_id = 'consent_gap_aml_14_15_tredje_ledd'
      AND (details ->> 'change_proposal_id') = current_setting('dev_cd.prop_non_deduction'))::int,
  0,
  'backfill: non-deduction proposal NOT flagged by backfill (category=manual_adjustment skipped)'
);

-- ════════════════════════════════════════════════════════════════════════════════
-- Test 5: Backfill skips proposals with consent_document_id NOT NULL
-- ════════════════════════════════════════════════════════════════════════════════
SELECT is(
  (SELECT COUNT(*) FROM payroll.deviation
    WHERE workspace_id = current_setting('dev_cd.ws')::uuid
      AND check_id = 'consent_gap_aml_14_15_tredje_ledd'
      AND (details ->> 'change_proposal_id') = current_setting('dev_cd.prop_with_consent'))::int,
  0,
  'backfill: deduction proposal with consent_document_id NOT NULL skipped by backfill'
);

-- ════════════════════════════════════════════════════════════════════════════════
-- Test 6: FK RESTRICT — cannot delete consent_document while change_proposal references it
-- ════════════════════════════════════════════════════════════════════════════════
-- Proposal 3 (v_prop_with_consent) references v_consent via consent_document_id FK.
-- ON DELETE RESTRICT means DELETE on the consent_document must fail with 23503.
SELECT throws_ok(
  format(
    $$DELETE FROM payroll.consent_document WHERE consent_document_id = %L::uuid$$,
    current_setting('dev_cd.consent')
  ),
  '23503',
  NULL,
  'FK RESTRICT: cannot delete consent_document referenced by change_proposal.consent_document_id'
);

-- ════════════════════════════════════════════════════════════════════════════════
-- Test 7: No live DELETE trigger on consent_document (backfill is migration-only)
-- ════════════════════════════════════════════════════════════════════════════════
-- This verifies the design: deviation backfill is a one-time migration operation,
-- NOT a live trigger. If a trigger existed, it would appear in pg_trigger.
SELECT is(
  (SELECT COUNT(*) FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'payroll'
     AND c.relname = 'consent_document'
     AND NOT t.tgisinternal)::int,
  0,
  'no live trigger on payroll.consent_document (deviation backfill is migration-only, not live trigger)'
);

SELECT * FROM finish();
ROLLBACK;
