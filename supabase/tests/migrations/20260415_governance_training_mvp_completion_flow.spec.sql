-- Phase 0 Foundation — Task 9: trg_check_assignment_completion full flow
-- Inserts a passing knowledge_test_attempt and asserts that the trigger
-- flips protocol_assignment.status from not_started → completed and sets
-- completed_at.

BEGIN;
SELECT plan(2);

SET session_replication_role = 'replica';

INSERT INTO company (company_id, name)
VALUES ('99999999-9999-9999-9999-999999999991', 'Completion Test Co');

INSERT INTO workspace (workspace_id, company_id, name, slug)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  '99999999-9999-9999-9999-999999999991',
  'Completion Test WS', 'completion-test-ws'
);

INSERT INTO profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  display_name, role, status
) VALUES (
  '55555555-5555-5555-5555-555555555556',
  'CREATOR',
  '66666666-6666-6666-6666-666666666666',
  '55555555-5555-5555-5555-555555555555',
  '99999999-9999-9999-9999-999999999991',
  'Creator', 'admin', 'active'
);

INSERT INTO policy (
  policy_id, workspace_id, name, policy_type, policy_scope,
  statement, is_active, created_by
) VALUES (
  '66666666-6666-6666-6666-666666666666',
  '55555555-5555-5555-5555-555555555555',
  'P1', 'operational', 'workspace', 'P1', true,
  '55555555-5555-5555-5555-555555555556'
);

INSERT INTO protocol (
  protocol_id, policy_id, workspace_id, name, status, version,
  owner_profile_id, created_by, evidence_tier
) VALUES (
  '77777777-7777-7777-7777-777777777777',
  '66666666-6666-6666-6666-666666666666',
  '55555555-5555-5555-5555-555555555555',
  'Quiz-only', 'active', '1.0.0',
  '55555555-5555-5555-5555-555555555556',
  '55555555-5555-5555-5555-555555555556',
  'quiz'
);

INSERT INTO knowledge_test (
  knowledge_test_id, protocol_id, name, questions, pass_threshold, is_active
) VALUES (
  '88888888-8888-8888-8888-888888888888',
  '77777777-7777-7777-7777-777777777777',
  'T1', '[]'::jsonb, 80, true
);

-- Drop user/company FK so we don't need full identity setup.
ALTER TABLE profile DROP CONSTRAINT IF EXISTS fk_profile_user;
ALTER TABLE profile DROP CONSTRAINT IF EXISTS fk_profile_company;

SET session_replication_role = 'origin';

-- Trainee insert fires auto-assign trigger → creates protocol_assignment.
INSERT INTO profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  display_name, role, status
) VALUES (
  '99999999-9999-9999-9999-999999999999',
  'TRAINEE',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  '55555555-5555-5555-5555-555555555555',
  '99999999-9999-9999-9999-999999999991',
  'Trainee', 'employee', 'trainee'
);

-- Act: insert passing test attempt → fires completion trigger.
INSERT INTO knowledge_test_attempt (
  workspace_id, profile_id, knowledge_test_id, protocol_assignment_id,
  score, passed
)
SELECT
  '55555555-5555-5555-5555-555555555555',
  '99999999-9999-9999-9999-999999999999',
  '88888888-8888-8888-8888-888888888888',
  assignment_id,
  95.0,
  true
FROM protocol_assignment
WHERE profile_id = '99999999-9999-9999-9999-999999999999';

-- Assert: status flipped to completed.
SELECT is(
  (SELECT status::TEXT FROM protocol_assignment
    WHERE profile_id = '99999999-9999-9999-9999-999999999999'),
  'completed',
  'after passing test, status flipped to completed'
);

SELECT isnt(
  (SELECT completed_at FROM protocol_assignment
    WHERE profile_id = '99999999-9999-9999-9999-999999999999'),
  NULL,
  'completed_at set'
);

SELECT * FROM finish();
ROLLBACK;
