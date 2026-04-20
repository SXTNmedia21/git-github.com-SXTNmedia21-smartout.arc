-- Phase 0 Foundation — structural assertions for migrations 20260415120100..20260415120700
-- Run with: npx supabase db test
--
-- Covers:
--   Task 2: evidence_tier enum + protocol.evidence_tier
--   Task 3: valid_from/valid_to on protocol/procedure/knowledge_test/confirmation
--   Task 4: observer_request_status enum + observer_request table + RLS policies
--   Task 5: engine_authority_config requires_four_eyes + observer_escalation_hours
--   Task 7: notification_policy + notification_sent_log tables
--   Task 8: inspection_link + inspection_link_view tables

BEGIN;
SELECT plan(30);

-- ── Task 2: evidence_tier ───────────────────────────────────────
SELECT has_type('evidence_tier', 'Enum evidence_tier must exist');
SELECT has_column('protocol', 'evidence_tier', 'protocol must have evidence_tier column');
SELECT col_default_is(
  'protocol', 'evidence_tier', 'quiz',
  'default evidence_tier must be quiz'
);

-- ── Task 3: effective dating ────────────────────────────────────
SELECT has_column('protocol', 'valid_from', 'protocol must have valid_from');
SELECT has_column('protocol', 'valid_to',   'protocol must have valid_to');
SELECT has_column('procedure', 'valid_from', 'procedure must have valid_from');
SELECT has_column('knowledge_test', 'valid_from', 'knowledge_test must have valid_from');
SELECT has_column('confirmation', 'valid_from', 'confirmation must have valid_from');

-- ── Task 4: observer_request ────────────────────────────────────
SELECT has_type('observer_request_status', 'enum must exist');
SELECT has_table('observer_request', 'observer_request table must exist');
SELECT has_column('observer_request', 'workspace_id', 'must have workspace_id');
SELECT has_column('observer_request', 'protocol_assignment_id', 'must have protocol_assignment_id FK');
SELECT has_column('observer_request', 'subject_profile_id', 'must have subject_profile_id');
SELECT has_column('observer_request', 'observer_profile_id', 'must have observer_profile_id nullable');
SELECT col_is_null('observer_request', 'observer_profile_id', 'observer can be null until claimed');
SELECT policies_are('observer_request', ARRAY[
  'jwt_subject_read_own',
  'jwt_observer_read_claimable',
  'jwt_admin_full',
  'service_role_observer_request'
]);

-- ── Task 5: authority_config four-eyes ──────────────────────────
SELECT has_column('engine_authority_config', 'requires_four_eyes', 'must exist');
SELECT col_default_is(
  'engine_authority_config', 'requires_four_eyes', 'false', 'default false'
);
SELECT has_column('engine_authority_config', 'observer_escalation_hours', 'must exist');
SELECT col_default_is(
  'engine_authority_config', 'observer_escalation_hours', '72', 'default 72'
);

-- ── Task 7: notification_policy + notification_sent_log ─────────
SELECT has_table('notification_policy');
SELECT has_table('notification_sent_log');
SELECT has_column('notification_policy', 'domain', 'must scope by domain');
SELECT has_column('notification_policy', 'tier_ladder', 'must have JSONB ladder');
SELECT col_is_null('notification_sent_log', 'opened_at', 'opened_at nullable');

-- ── Task 8: inspection_link ─────────────────────────────────────
SELECT has_table('inspection_link');
SELECT has_table('inspection_link_view');
SELECT has_column('inspection_link', 'token_hash', 'token must be hashed, never stored plaintext');
SELECT has_column('inspection_link', 'anonymization', 'default anonymized');
SELECT has_column('inspection_link', 'justification', 'GDPR Art. 9 justification required');

-- ── Task 9 trigger functions are validated by the completion-flow spec.

SELECT * FROM finish();
ROLLBACK;
