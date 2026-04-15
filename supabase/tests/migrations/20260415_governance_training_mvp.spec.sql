-- Governance + training MVP — migration tests
-- Run with: npx supabase db test
--
-- Phase 0.5: validates that auto_assign_protocols_to_new_employee populates
-- the full column set on protocol_assignment after the regression fix in
-- 20260415120000_fix_auto_assign_regression.sql.

BEGIN;
SELECT plan(3);

-- Use replica role so FK checks + unrelated triggers are skipped during
-- setup. We flip back to 'origin' before the act step so the trigger under
-- test fires as it would in production.
SET session_replication_role = 'replica';

INSERT INTO workspace (workspace_id, company_id, name, slug)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '99999999-9999-9999-9999-999999999999',
  'Test WS',
  'test-ws'
);

INSERT INTO profile (
  profile_id, profile_code, user_id, workspace_id, company_id, display_name, status
) VALUES (
  '55555555-5555-5555-5555-555555555555',
  'CREATOR',
  '66666666-6666-6666-6666-666666666666',
  '11111111-1111-1111-1111-111111111111',
  '99999999-9999-9999-9999-999999999999',
  'Creator',
  'active'
);

INSERT INTO policy (
  policy_id, workspace_id, name, policy_type, policy_scope, statement,
  is_active, created_by
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'HACCP',
  'operational',
  'workspace',
  'Follow HACCP procedures.',
  true,
  '55555555-5555-5555-5555-555555555555'
);

INSERT INTO protocol (
  protocol_id, policy_id, workspace_id, name, status, version,
  owner_profile_id, created_by
) VALUES (
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'HACCP v1',
  'active',
  '1.0.0',
  '55555555-5555-5555-5555-555555555555',
  '55555555-5555-5555-5555-555555555555'
);

-- Act: insert a trainee profile under origin role so the trigger fires.
-- Drop the user_id / company FK constraints for this test-only profile insert
-- so we do not need to stand up auth.users + user_identity + company rows.
-- The transaction rolls back, so this is local to the test.
ALTER TABLE profile DROP CONSTRAINT IF EXISTS fk_profile_user;
ALTER TABLE profile DROP CONSTRAINT IF EXISTS fk_profile_company;

SET session_replication_role = 'origin';

INSERT INTO profile (
  profile_id, profile_code, user_id, workspace_id, company_id, display_name, status
) VALUES (
  '44444444-4444-4444-4444-444444444444',
  'TRAINEE',
  '77777777-7777-7777-7777-777777777777',
  '11111111-1111-1111-1111-111111111111',
  '99999999-9999-9999-9999-999999999999',
  'Trainee',
  'trainee'
);

-- Assertions: protocol_assignment row created with rich column set.
SELECT isnt(
  (SELECT workspace_id FROM protocol_assignment
   WHERE profile_id = '44444444-4444-4444-4444-444444444444'),
  NULL,
  'workspace_id must be populated on auto-assigned row'
);

SELECT is(
  (SELECT assigned_via::TEXT FROM protocol_assignment
   WHERE profile_id = '44444444-4444-4444-4444-444444444444'),
  'workspace',
  'assigned_via must be workspace for workspace-scoped policy'
);

SELECT is(
  (SELECT status::TEXT FROM protocol_assignment
   WHERE profile_id = '44444444-4444-4444-4444-444444444444'),
  'not_started',
  'status must be not_started, not pending'
);

SELECT * FROM finish();
ROLLBACK;
