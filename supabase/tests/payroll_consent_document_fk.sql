-- ============================================================================
-- supabase/tests/payroll_consent_document_fk.sql
--
-- Migration: 20260615110000_create_payroll_consent_document.sql
--            20260615110100_change_proposal_consent_fk.sql
-- ADR-0311: Trekk-samtykke som payroll-domain artifact
-- SMA-328: AML §14-15 tredje ledd trekk-samtykke
--
-- Tests (10 total):
--  1.    INSERT succeeds when workspace_id + employee_profile_id are valid
--  2.    INSERT fails when workspace_id references non-existent workspace (FK violation)
--  3.    INSERT fails when employee_profile_id references non-existent profile (FK RESTRICT)
--  4.    consent_type CHECK rejects values outside allowed set
--  5.    consent_type CHECK accepts all 5 valid values
--  6.    status CHECK rejects values outside allowed set
--  7.    status CHECK accepts all 4 valid status values
--  8.    court_order constraint: INSERT with consent_type='court_order' + NULL court_order_reference fails
--  9.    court_order constraint: INSERT with non-court_order + NULL court_order_reference succeeds
--  10.   ON DELETE RESTRICT: cannot delete profile while consent_document references it
--
-- Run with:
--   psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--        --set ON_ERROR_STOP=1 \
--        -f supabase/tests/payroll_consent_document_fk.sql
-- ============================================================================

BEGIN;
SELECT plan(10);

-- ── Fixtures ─────────────────────────────────────────────────────────────────
-- Minimal workspace + profile for FK validation tests.
DO $fix$
DECLARE
  v_company  UUID := gen_random_uuid();
  v_ws       UUID := gen_random_uuid();
  v_user     UUID := gen_random_uuid();
  v_profile  UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('fk_cd.ws',      v_ws::text,      false);
  PERFORM set_config('fk_cd.profile', v_profile::text, false);

  INSERT INTO auth.users (id, email, aud, role, instance_id) VALUES
    (v_user, 'fk-cd-' || substr(v_user::text, 1, 8) || '@t.test',
     'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  INSERT INTO company (company_id, name) VALUES (v_company, 'FK CD Test Co');
  INSERT INTO workspace (workspace_id, company_id, name, slug) VALUES
    (v_ws, v_company, 'FK CD WS', 'fk-cd-' || substr(v_ws::text, 1, 8));

  INSERT INTO profile (profile_id, profile_code, user_id, workspace_id, role, is_active, display_name) VALUES
    (v_profile, 'fk-cd-p-' || substr(v_profile::text, 1, 6), v_user, v_ws, 'employee', true, 'FK CD Employee');
END $fix$;

-- ════════════════════════════════════════════════════════════════════════════════
-- Test 1: INSERT succeeds with valid workspace_id + employee_profile_id
-- ════════════════════════════════════════════════════════════════════════════════
SELECT lives_ok(
  format(
    $$INSERT INTO payroll.consent_document (
        workspace_id, employee_profile_id, consent_type,
        court_order_reference, signed_at, signed_document_url
      ) VALUES (
        %L::uuid, %L::uuid, 'court_order',
        'UTL-FK-001', now(), 'https://example.com/valid.pdf'
      )$$,
    current_setting('fk_cd.ws'),
    current_setting('fk_cd.profile')
  ),
  'FK: INSERT succeeds with valid workspace_id + employee_profile_id'
);

-- ════════════════════════════════════════════════════════════════════════════════
-- Test 2: INSERT fails when workspace_id does not exist (FK violation)
-- ════════════════════════════════════════════════════════════════════════════════
-- 23503 = foreign_key_violation
SELECT throws_ok(
  format(
    $$INSERT INTO payroll.consent_document (
        workspace_id, employee_profile_id, consent_type,
        court_order_reference, signed_at, signed_document_url
      ) VALUES (
        '00000000-dead-beef-0000-000000000099'::uuid, %L::uuid, 'court_order',
        'UTL-FK-BAD-WS', now(), 'https://example.com/bad-ws.pdf'
      )$$,
    current_setting('fk_cd.profile')
  ),
  '23503',
  NULL,
  'FK: INSERT with non-existent workspace_id fails with FK violation (23503)'
);

-- ════════════════════════════════════════════════════════════════════════════════
-- Test 3: INSERT fails when employee_profile_id does not exist (FK RESTRICT)
-- ════════════════════════════════════════════════════════════════════════════════
SELECT throws_ok(
  format(
    $$INSERT INTO payroll.consent_document (
        workspace_id, employee_profile_id, consent_type,
        court_order_reference, signed_at, signed_document_url
      ) VALUES (
        %L::uuid, '00000000-dead-beef-0000-000000000098'::uuid, 'court_order',
        'UTL-FK-BAD-PROF', now(), 'https://example.com/bad-prof.pdf'
      )$$,
    current_setting('fk_cd.ws')
  ),
  '23503',
  NULL,
  'FK: INSERT with non-existent employee_profile_id fails with FK violation (23503)'
);

-- ════════════════════════════════════════════════════════════════════════════════
-- Test 4: consent_type CHECK rejects invalid value
-- ════════════════════════════════════════════════════════════════════════════════
-- 23514 = check_violation
SELECT throws_ok(
  format(
    $$INSERT INTO payroll.consent_document (
        workspace_id, employee_profile_id, consent_type,
        signed_at, signed_document_url
      ) VALUES (
        %L::uuid, %L::uuid, 'invalid_type',
        now(), 'https://example.com/invalid.pdf'
      )$$,
    current_setting('fk_cd.ws'),
    current_setting('fk_cd.profile')
  ),
  '23514',
  NULL,
  'consent_type CHECK: INSERT with invalid consent_type value fails (23514)'
);

-- ════════════════════════════════════════════════════════════════════════════════
-- Test 5: consent_type CHECK accepts all 5 valid values
-- ════════════════════════════════════════════════════════════════════════════════
-- We only check that the non-court_order variants pass the CHECK constraint
-- (they don't trigger the court_order_reference NOT NULL constraint).
DO $$
DECLARE
  v_ws      UUID := current_setting('fk_cd.ws')::uuid;
  v_profile UUID := current_setting('fk_cd.profile')::uuid;
  v_types   TEXT[] := ARRAY['loan_agreement', 'uniform_policy', 'union_dues', 'other_voluntary'];
  v_type    TEXT;
BEGIN
  FOREACH v_type IN ARRAY v_types LOOP
    INSERT INTO payroll.consent_document (
      workspace_id, employee_profile_id, consent_type,
      signed_at, signed_document_url
    ) VALUES (
      v_ws, v_profile, v_type,
      now(), 'https://example.com/' || v_type || '.pdf'
    );
  END LOOP;
END $$;

SELECT ok(
  (SELECT COUNT(*) FROM payroll.consent_document
    WHERE workspace_id = current_setting('fk_cd.ws')::uuid
      AND consent_type IN ('loan_agreement', 'uniform_policy', 'union_dues', 'other_voluntary')) = 4,
  'consent_type CHECK: all 4 non-court_order consent_types accepted'
);

-- ════════════════════════════════════════════════════════════════════════════════
-- Test 6: status CHECK rejects invalid value
-- ════════════════════════════════════════════════════════════════════════════════
SELECT throws_ok(
  format(
    $$INSERT INTO payroll.consent_document (
        workspace_id, employee_profile_id, consent_type,
        court_order_reference, signed_at, signed_document_url,
        status
      ) VALUES (
        %L::uuid, %L::uuid, 'court_order',
        'UTL-STATUS-BAD', now(), 'https://example.com/status-bad.pdf',
        'invalid_status'
      )$$,
    current_setting('fk_cd.ws'),
    current_setting('fk_cd.profile')
  ),
  '23514',
  NULL,
  'status CHECK: INSERT with invalid status value fails (23514)'
);

-- ════════════════════════════════════════════════════════════════════════════════
-- Test 7: status CHECK accepts all 4 valid values
-- ════════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_ws       UUID := current_setting('fk_cd.ws')::uuid;
  v_profile  UUID := current_setting('fk_cd.profile')::uuid;
  v_statuses TEXT[] := ARRAY['expired', 'revoked', 'superseded'];
  -- 'active' is the DEFAULT — already tested via test 1
  v_status   TEXT;
  v_ref      INT := 200;
BEGIN
  FOREACH v_status IN ARRAY v_statuses LOOP
    INSERT INTO payroll.consent_document (
      workspace_id, employee_profile_id, consent_type,
      court_order_reference, signed_at, signed_document_url,
      status
    ) VALUES (
      v_ws, v_profile, 'court_order',
      'UTL-STATUS-' || v_ref, now(), 'https://example.com/status-' || v_status || '.pdf',
      v_status
    );
    v_ref := v_ref + 1;
  END LOOP;
END $$;

SELECT ok(
  (SELECT COUNT(*) FROM payroll.consent_document
    WHERE workspace_id = current_setting('fk_cd.ws')::uuid
      AND status IN ('expired', 'revoked', 'superseded')) = 3,
  'status CHECK: expired, revoked, superseded all accepted as valid status values'
);

-- ════════════════════════════════════════════════════════════════════════════════
-- Test 8: court_order constraint — consent_type='court_order' + NULL court_order_reference fails
-- ════════════════════════════════════════════════════════════════════════════════
-- Migration CHECK: consent_type != 'court_order' OR court_order_reference IS NOT NULL
SELECT throws_ok(
  format(
    $$INSERT INTO payroll.consent_document (
        workspace_id, employee_profile_id, consent_type,
        signed_at, signed_document_url
      ) VALUES (
        %L::uuid, %L::uuid, 'court_order',
        now(), 'https://example.com/no-ref.pdf'
        -- court_order_reference deliberately NULL
      )$$,
    current_setting('fk_cd.ws'),
    current_setting('fk_cd.profile')
  ),
  '23514',
  NULL,
  'court_order constraint: INSERT with consent_type=court_order + NULL court_order_reference fails'
);

-- ════════════════════════════════════════════════════════════════════════════════
-- Test 9: court_order constraint — non-court_order + NULL court_order_reference is OK
-- ════════════════════════════════════════════════════════════════════════════════
SELECT lives_ok(
  format(
    $$INSERT INTO payroll.consent_document (
        workspace_id, employee_profile_id, consent_type,
        signed_at, signed_document_url
        -- court_order_reference intentionally NULL (allowed for non-court_order types)
      ) VALUES (
        %L::uuid, %L::uuid, 'loan_agreement',
        now(), 'https://example.com/loan-no-ref.pdf'
      )$$,
    current_setting('fk_cd.ws'),
    current_setting('fk_cd.profile')
  ),
  'court_order constraint: non-court_order type with NULL court_order_reference is accepted'
);

-- ════════════════════════════════════════════════════════════════════════════════
-- Test 10: ON DELETE RESTRICT — cannot delete profile referenced by consent_document
-- ════════════════════════════════════════════════════════════════════════════════
-- At this point v_profile has several consent_document rows from tests above.
-- Attempting DELETE on profile must fail with 23503 (FK RESTRICT).
SELECT throws_ok(
  format(
    $$DELETE FROM profile WHERE profile_id = %L::uuid$$,
    current_setting('fk_cd.profile')
  ),
  '23503',
  NULL,
  'ON DELETE RESTRICT: cannot delete profile while consent_document.employee_profile_id references it'
);

SELECT * FROM finish();
ROLLBACK;
