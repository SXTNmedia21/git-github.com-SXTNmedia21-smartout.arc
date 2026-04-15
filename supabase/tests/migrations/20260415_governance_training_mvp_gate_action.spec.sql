-- Phase 0 Foundation — Task 6: gate_action four-eyes path
-- Verifies that the extended public.gate_action returns a four_eyes_required
-- reason when authority config requests it and approvers are missing.

BEGIN;
SELECT plan(2);

-- Function shape: 8-arg signature returning JSONB with four_eyes_required key.
SELECT has_function(
  'public', 'gate_action',
  ARRAY['uuid','text','text','uuid','text','text','uuid','uuid[]'],
  'gate_action(8-arg) extended signature must exist'
);

-- Minimal fixtures: workspace + admin profile, one authority config row with
-- requires_four_eyes=true. Call gate_action with 0 approvers → expect denial
-- with reason='four_eyes_required'.
SET session_replication_role = 'replica';

INSERT INTO company (company_id, name)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '4Eye Co');

INSERT INTO workspace (workspace_id, company_id, name, slug)
VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '4Eye WS', '4eye-ws'
);

INSERT INTO profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  display_name, role, status
) VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '4EYEADMIN',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Admin', 'admin', 'active'
);

INSERT INTO engine_authority_config (
  workspace_id, capability, level, min_role, requires_four_eyes, updated_by
) VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'protocol.delete',
  'confirm',
  'admin',
  true,
  'dddddddd-dddd-dddd-dddd-dddddddddddd'
);

SELECT is(
  (
    SELECT public.gate_action(
      p_workspace_id      := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      p_capability        := 'protocol.delete',
      p_channel           := 'system',
      p_actor_profile_id  := 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      p_action_type       := 'delete_protocol',
      p_engine_process_id := NULL,
      p_engine_state_id   := NULL,
      p_approvers_present := ARRAY[]::UUID[]
    )->>'reason'
  ),
  'four_eyes_required',
  'gate_action returns four_eyes_required when requires_four_eyes=true and 0 approvers'
);

SELECT * FROM finish();
ROLLBACK;
