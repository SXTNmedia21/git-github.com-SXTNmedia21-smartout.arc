-- announcement_notification_priority_test.sql
--
-- pgTAP assertions for the announcement notification priority bump migration.
-- Verifies that trigger_channel_message_notification() routes announcement
-- messages to priority=1/mode='work' and other types to priority=0/mode='community'.
--
-- Plan: 4 assertions
-- Run with: npx supabase test db supabase/tests/announcement_notification_priority_test.sql

BEGIN;
SELECT plan(4);

-- ── Setup: minimal fixtures ───────────────────────────────────────────────────
DO $$
DECLARE
  v_user_id      UUID := '00000000-0000-0000-0000-000000000001';
  v_company_id   UUID := '00000000-0000-0000-0000-000000000002';
  v_workspace_id UUID := '00000000-0000-0000-0000-000000000003';
  v_sender_id    UUID := '00000000-0000-0000-0000-000000000004';
  v_receiver_id  UUID := '00000000-0000-0000-0000-000000000005';
  v_channel_id   UUID := '00000000-0000-0000-0000-000000000010';
BEGIN
  -- auth.users row triggers on_auth_user_created → creates user_identity
  INSERT INTO auth.users (id, email, aud, role, instance_id)
    VALUES (v_user_id, 'nyheter-prio-test@example.test',
            'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')
    ON CONFLICT (id) DO NOTHING;

  -- user_identity created by trigger; patch names
  UPDATE user_identity SET first_name = 'Test', last_name = 'User'
   WHERE user_id = v_user_id;

  INSERT INTO company (company_id, name)
    VALUES (v_company_id, 'Nyheter Test Co')
    ON CONFLICT (company_id) DO NOTHING;

  INSERT INTO workspace (workspace_id, company_id, name, slug, status)
    VALUES (v_workspace_id, v_company_id, 'Test WS', 'nyheter-prio-test-ws', 'active')
    ON CONFLICT (workspace_id) DO NOTHING;

  INSERT INTO profile (profile_id, profile_code, user_id, workspace_id, display_name, role, status)
    VALUES
      (v_sender_id,   'nyheter-prio-sender',   v_user_id, v_workspace_id, 'Sender',   'manager',  'active'),
      (v_receiver_id, 'nyheter-prio-receiver', v_user_id, v_workspace_id, 'Receiver', 'employee', 'active')
    ON CONFLICT (profile_id) DO NOTHING;

  INSERT INTO channel (id, workspace_id, channel_type, name, created_by)
    VALUES (v_channel_id, v_workspace_id, 'news', 'Nyheter', v_sender_id)
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO channel_member (channel_id, workspace_id, profile_id)
    VALUES
      (v_channel_id, v_workspace_id, v_sender_id),
      (v_channel_id, v_workspace_id, v_receiver_id)
    ON CONFLICT DO NOTHING;
END $$;

-- ── Test 1+2: announcement → priority=1, mode='work' ─────────────────────────
INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, message_type)
VALUES (
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  'Test announcement',
  'announcement'
);

-- Assertion 1: announcement → priority=1
SELECT is(
  (SELECT priority FROM notification_outbox
    WHERE recipient_id = '00000000-0000-0000-0000-000000000005'
    ORDER BY id DESC LIMIT 1),
  1::smallint,
  'announcement message inserts notification with priority=1'
);

-- Assertion 2: announcement → mode='work'
SELECT is(
  (SELECT mode::text FROM notification_outbox
    WHERE recipient_id = '00000000-0000-0000-0000-000000000005'
    ORDER BY id DESC LIMIT 1),
  'work',
  'announcement message inserts notification with mode=work'
);

-- Clear announcement notification so text-message assertions get the right row
DELETE FROM notification_outbox
 WHERE recipient_id = '00000000-0000-0000-0000-000000000005';

-- ── Test 3+4: text message → priority=0, mode='community' ────────────────────
INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, message_type)
VALUES (
  '00000000-0000-0000-0000-000000000021',
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  'Plain text',
  'text'
);

-- Assertion 3: text → priority=0
SELECT is(
  (SELECT priority FROM notification_outbox
    WHERE recipient_id = '00000000-0000-0000-0000-000000000005'
    ORDER BY id DESC LIMIT 1),
  0::smallint,
  'text message inserts notification with priority=0'
);

-- Assertion 4: text → mode='community'
SELECT is(
  (SELECT mode::text FROM notification_outbox
    WHERE recipient_id = '00000000-0000-0000-0000-000000000005'
    ORDER BY id DESC LIMIT 1),
  'community',
  'text message inserts notification with mode=community'
);

SELECT * FROM finish();
ROLLBACK;
