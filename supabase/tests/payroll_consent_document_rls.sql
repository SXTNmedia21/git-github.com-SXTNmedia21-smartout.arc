-- ============================================================================
-- supabase/tests/payroll_consent_document_rls.sql
--
-- Migration: 20260615110000_create_payroll_consent_document.sql
-- ADR-0311: Trekk-samtykke som payroll-domain artifact
-- SMA-328: AML §14-15 tredje ledd trekk-samtykke
--
-- Tests (12 total):
--  1.    policies_are: 3 expected policies on payroll.consent_document
--  2-4.  jwt_select_consent_doc: employee sees own row only; manager sees all in workspace
--  5-6.  jwt_select_consent_doc: cross-workspace isolation (employee from ws_b cannot see ws_a rows)
--  7-8.  service_role_consent_doc: INSERT allowed via service_role (the only insert path)
--  9-10. jwt_insert: authenticated role INSERT denied (RLS only grants to service_role)
--  11.   api_key_select_consent_doc: workspace_id = get_api_workspace_id() scoping
--  12.   api_key: cross-workspace isolation (wrong workspace GUC → 0 rows)
--
-- Run with:
--   psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--        --set ON_ERROR_STOP=1 \
--        -f supabase/tests/payroll_consent_document_rls.sql
-- ============================================================================

BEGIN;
SELECT plan(12);

-- ── act_as helper ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.act_as(p_user_id uuid)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', p_user_id::text)::text, true);
END $$;

-- ── Fixtures ──────────────────────────────────────────────────────────────────
-- Two workspaces: ws_a, ws_b
-- ws_a: employee (emp_user), manager (mgr_user)
-- ws_b: employee (emp_b_user) — cross-workspace isolation target
-- 4 consent_document rows: 2 per workspace
DO $fix$
DECLARE
  v_company_a    UUID := gen_random_uuid();
  v_company_b    UUID := gen_random_uuid();
  v_ws_a         UUID := gen_random_uuid();
  v_ws_b         UUID := gen_random_uuid();

  -- ws_a actors
  v_emp_user     UUID := gen_random_uuid();
  v_emp_a        UUID := gen_random_uuid();  -- profile_id
  v_mgr_user     UUID := gen_random_uuid();
  v_mgr_a        UUID := gen_random_uuid();  -- profile_id

  -- ws_b actor (isolation target)
  v_emp_b_user   UUID := gen_random_uuid();
  v_emp_b        UUID := gen_random_uuid();  -- profile_id

  -- consent_document IDs (2 per workspace)
  v_doc_a1       UUID := gen_random_uuid();
  v_doc_a2       UUID := gen_random_uuid();
  v_doc_b1       UUID := gen_random_uuid();
  v_doc_b2       UUID := gen_random_uuid();
BEGIN
  -- Persist fixture IDs for use in tests below
  PERFORM set_config('rls_cd.ws_a',       v_ws_a::text,       false);
  PERFORM set_config('rls_cd.ws_b',       v_ws_b::text,       false);
  PERFORM set_config('rls_cd.emp_user',   v_emp_user::text,   false);
  PERFORM set_config('rls_cd.emp_a',      v_emp_a::text,      false);
  PERFORM set_config('rls_cd.mgr_user',   v_mgr_user::text,   false);
  PERFORM set_config('rls_cd.mgr_a',      v_mgr_a::text,      false);
  PERFORM set_config('rls_cd.emp_b_user', v_emp_b_user::text, false);
  PERFORM set_config('rls_cd.emp_b',      v_emp_b::text,      false);

  -- auth.users
  INSERT INTO auth.users (id, email, aud, role, instance_id) VALUES
    (v_emp_user,   'rls-cd-emp-a+'  || substr(v_emp_user::text,   1, 8) || '@t.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (v_mgr_user,   'rls-cd-mgr-a+'  || substr(v_mgr_user::text,   1, 8) || '@t.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (v_emp_b_user, 'rls-cd-emp-b+'  || substr(v_emp_b_user::text, 1, 8) || '@t.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  INSERT INTO company (company_id, name) VALUES
    (v_company_a, 'RLS CD Test Co A'),
    (v_company_b, 'RLS CD Test Co B');

  INSERT INTO workspace (workspace_id, company_id, name, slug) VALUES
    (v_ws_a, v_company_a, 'RLS CD WS A', 'rls-cd-a-' || substr(v_ws_a::text, 1, 8)),
    (v_ws_b, v_company_b, 'RLS CD WS B', 'rls-cd-b-' || substr(v_ws_b::text, 1, 8));

  INSERT INTO profile (profile_id, profile_code, user_id, workspace_id, role, is_active, display_name) VALUES
    (v_emp_a,   'rls-cd-ea-' || substr(v_emp_a::text,   1, 6), v_emp_user,   v_ws_a, 'employee', true, 'RLS CD Employee A'),
    (v_mgr_a,   'rls-cd-ma-' || substr(v_mgr_a::text,   1, 6), v_mgr_user,   v_ws_a, 'manager',  true, 'RLS CD Manager A'),
    (v_emp_b,   'rls-cd-eb-' || substr(v_emp_b::text,   1, 6), v_emp_b_user, v_ws_b, 'employee', true, 'RLS CD Employee B');

  -- Insert 4 consent_document rows (2 per workspace) bypassing RLS (postgres role).
  -- Both docs in ws_a belong to employee v_emp_a; docs in ws_b belong to v_emp_b.
  INSERT INTO payroll.consent_document (
    consent_document_id, workspace_id, employee_profile_id, consent_type,
    court_order_reference, signed_at, signed_document_url, status
  ) VALUES
    (v_doc_a1, v_ws_a, v_emp_a, 'court_order', 'UTL-A-001', now(), 'https://example.com/a1.pdf', 'active'),
    (v_doc_a2, v_ws_a, v_emp_a, 'court_order', 'UTL-A-002', now(), 'https://example.com/a2.pdf', 'active'),
    (v_doc_b1, v_ws_b, v_emp_b, 'court_order', 'UTL-B-001', now(), 'https://example.com/b1.pdf', 'active'),
    (v_doc_b2, v_ws_b, v_emp_b, 'court_order', 'UTL-B-002', now(), 'https://example.com/b2.pdf', 'active');
END $fix$;

-- ════════════════════════════════════════════════════════════════════════════════
-- Test 1: policies_are — exactly the 3 migration-defined policies
-- ════════════════════════════════════════════════════════════════════════════════
-- Migration defines:
--   jwt_select_consent_doc   (FOR SELECT, authenticated role)
--   service_role_consent_doc (FOR ALL, service_role)
--   api_key_select_consent_doc (FOR SELECT, no role restriction — GUC-based)
SELECT policies_are(
  'payroll',
  'consent_document',
  ARRAY[
    'jwt_select_consent_doc',
    'service_role_consent_doc',
    'api_key_select_consent_doc'
  ],
  'payroll.consent_document: exactly 3 RLS policies defined in migration 20260615110000'
);

-- ════════════════════════════════════════════════════════════════════════════════
-- Tests 2-3: jwt_select_consent_doc — employee sees only own workspace rows
-- ════════════════════════════════════════════════════════════════════════════════
-- Employee in ws_a authenticates → gets_workspace_ids_for_user returns [ws_a].
-- Expects: 2 rows visible (both v_doc_a1, v_doc_a2 belong to ws_a).
DO $set$
BEGIN
  PERFORM pg_temp.act_as(current_setting('rls_cd.emp_user')::uuid);
END $set$;

SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT COUNT(*) FROM payroll.consent_document
    WHERE workspace_id = current_setting('rls_cd.ws_a')::uuid)::int,
  2,
  'jwt_select: employee in ws_a sees both rows in ws_a'
);

-- Cross-workspace isolation: employee in ws_a cannot see ws_b rows
SELECT is(
  (SELECT COUNT(*) FROM payroll.consent_document
    WHERE workspace_id = current_setting('rls_cd.ws_b')::uuid)::int,
  0,
  'jwt_select: employee in ws_a sees 0 rows in ws_b (cross-workspace isolation)'
);

RESET ROLE;

-- ════════════════════════════════════════════════════════════════════════════════
-- Tests 4-5: manager sees all workspace rows (same policy, broader workspace membership)
-- ════════════════════════════════════════════════════════════════════════════════
DO $set$
BEGIN
  PERFORM pg_temp.act_as(current_setting('rls_cd.mgr_user')::uuid);
END $set$;

SET LOCAL ROLE authenticated;

-- Manager in ws_a: sees 2 rows in ws_a
SELECT is(
  (SELECT COUNT(*) FROM payroll.consent_document
    WHERE workspace_id = current_setting('rls_cd.ws_a')::uuid)::int,
  2,
  'jwt_select: manager in ws_a sees all 2 ws_a consent_documents'
);

-- Manager in ws_a: cannot see ws_b rows
SELECT is(
  (SELECT COUNT(*) FROM payroll.consent_document
    WHERE workspace_id = current_setting('rls_cd.ws_b')::uuid)::int,
  0,
  'jwt_select: manager in ws_a sees 0 rows in ws_b'
);

RESET ROLE;

-- ════════════════════════════════════════════════════════════════════════════════
-- Tests 6-7: jwt INSERT is DENIED for authenticated role
-- ════════════════════════════════════════════════════════════════════════════════
-- service_role_consent_doc policy grants ALL to service_role.
-- jwt_select_consent_doc grants only SELECT.
-- → authenticated role INSERT must be rejected (42501).
DO $set$
BEGIN
  PERFORM pg_temp.act_as(current_setting('rls_cd.mgr_user')::uuid);
END $set$;

SET LOCAL ROLE authenticated;

SELECT throws_ok(
  format(
    $$INSERT INTO payroll.consent_document (
        workspace_id, employee_profile_id, consent_type,
        court_order_reference, signed_at, signed_document_url, status
      ) VALUES (
        %L::uuid, %L::uuid, 'court_order',
        'UTL-DENIED-001', now(), 'https://example.com/denied.pdf', 'active'
      )$$,
    current_setting('rls_cd.ws_a'),
    current_setting('rls_cd.emp_a')
  ),
  '42501',
  NULL,
  'jwt_insert: authenticated (manager) INSERT into payroll.consent_document is DENIED (service_role only)'
);

RESET ROLE;

-- Employee tier also denied
DO $set$
BEGIN
  PERFORM pg_temp.act_as(current_setting('rls_cd.emp_user')::uuid);
END $set$;

SET LOCAL ROLE authenticated;

SELECT throws_ok(
  format(
    $$INSERT INTO payroll.consent_document (
        workspace_id, employee_profile_id, consent_type,
        court_order_reference, signed_at, signed_document_url, status
      ) VALUES (
        %L::uuid, %L::uuid, 'court_order',
        'UTL-DENIED-002', now(), 'https://example.com/denied2.pdf', 'active'
      )$$,
    current_setting('rls_cd.ws_a'),
    current_setting('rls_cd.emp_a')
  ),
  '42501',
  NULL,
  'jwt_insert: authenticated (employee) INSERT into payroll.consent_document is DENIED'
);

RESET ROLE;

-- ════════════════════════════════════════════════════════════════════════════════
-- Tests 8-9: service_role INSERT is ALLOWED
-- ════════════════════════════════════════════════════════════════════════════════
-- postgres role = service_role path (bypasses RLS by default in Supabase local,
-- and service_role_consent_doc FOR ALL grants it explicitly).
-- Insert a new row and verify it persists. Run as postgres (service_role equivalent in test env).
SELECT lives_ok(
  format(
    $$INSERT INTO payroll.consent_document (
        workspace_id, employee_profile_id, consent_type,
        court_order_reference, signed_at, signed_document_url, status
      ) VALUES (
        %L::uuid, %L::uuid, 'court_order',
        'UTL-SVC-001', now(), 'https://example.com/svc.pdf', 'active'
      )$$,
    current_setting('rls_cd.ws_a'),
    current_setting('rls_cd.emp_a')
  ),
  'service_role: postgres can INSERT consent_document (webhook path)'
);

-- Verify the service_role insert is visible to the manager
DO $set$
BEGIN
  PERFORM pg_temp.act_as(current_setting('rls_cd.mgr_user')::uuid);
END $set$;

SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT COUNT(*) FROM payroll.consent_document
    WHERE workspace_id = current_setting('rls_cd.ws_a')::uuid
      AND court_order_reference = 'UTL-SVC-001')::int,
  1,
  'service_role insert: manager can see the newly inserted row from service_role path'
);

RESET ROLE;

-- ════════════════════════════════════════════════════════════════════════════════
-- Tests 10-11: api_key_select_consent_doc — workspace scoped via GUC
-- ════════════════════════════════════════════════════════════════════════════════
-- Simulate workspace-api Edge Function setting app.workspace_id GUC.
-- Test that:
--   (a) correct workspace GUC → sees ws_a rows
--   (b) wrong workspace GUC → sees 0 rows (cross-workspace isolation)

-- Set GUC to ws_a — should see ws_a rows
DO $set$
BEGIN
  PERFORM set_config('app.workspace_id', current_setting('rls_cd.ws_a'), true);
  -- Clear JWT sub so only API key path applies
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
END $set$;

SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT COUNT(*) FROM payroll.consent_document
    WHERE workspace_id = current_setting('rls_cd.ws_a')::uuid)::int,
  3, -- 2 original + 1 inserted by service_role test above
  'api_key_select: GUC set to ws_a → sees all ws_a consent_documents'
);

-- Set GUC to ws_b — should see ws_b rows only, NOT ws_a rows
DO $set$
BEGIN
  PERFORM set_config('app.workspace_id', current_setting('rls_cd.ws_b'), true);
END $set$;

SELECT is(
  (SELECT COUNT(*) FROM payroll.consent_document
    WHERE workspace_id = current_setting('rls_cd.ws_a')::uuid)::int,
  0,
  'api_key_select: GUC set to ws_b → sees 0 rows in ws_a (cross-workspace isolation)'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
