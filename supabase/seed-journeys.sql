-- seed-journeys.sql
-- Module 1: Onboarding Journey Definitions + Checkpoints
--
-- Prerequisites: module_journey and module_journey_checkpoint tables must exist.
-- Run this AFTER the journey engine migration creates those tables.
--
-- These are the hardcoded journey definitions shipped with the onboarding module.
-- AI guidance is dynamic and adapts per person — checkpoints are the measurable gates.

BEGIN;

-- ============================================================================
-- MODULE JOURNEYS
-- ============================================================================

INSERT INTO module_journey (id, module_slug, is_core, version)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'core', true, '1.0'),
  ('a0000000-0000-0000-0000-000000000002', 'scheduling', false, '1.0'),
  ('a0000000-0000-0000-0000-000000000003', 'tasks', false, '1.0'),
  ('a0000000-0000-0000-0000-000000000004', 'haccp', false, '1.0'),
  ('a0000000-0000-0000-0000-000000000005', 'chat', false, '1.0')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- CORE JOURNEY CHECKPOINTS (learn Smartout basics)
-- ============================================================================

INSERT INTO module_journey_checkpoint (
  id, journey_id, name, description, checkpoint_type, sort_order,
  event_name, target_screen, is_sandbox, is_required,
  ai_context, ai_success_hint
)
VALUES
  -- 1. Profile setup
  (
    'b0000000-0000-0000-0001-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'Complete your profile',
    'Add your name, photo, and basic info to your Smartout profile.',
    'action', 1,
    'profile_updated', '/settings/profile', false, true,
    'Guide the user to their profile settings page. Help them upload a photo and fill in their name.',
    'Profile has name and photo set.'
  ),
  -- 2. Emergency contact
  (
    'b0000000-0000-0000-0001-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'Add emergency contact',
    'Required by Norwegian workplace safety regulations.',
    'action', 2,
    'emergency_contact_added', '/settings/profile', false, true,
    'Explain that emergency contact info is required by law (Norwegian arbeidsmiljøloven). Navigate to profile settings.',
    'Emergency contact name and phone are saved.'
  ),
  -- 3. Visit dashboard
  (
    'b0000000-0000-0000-0001-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'Explore the dashboard',
    'Get familiar with your Smartout home screen.',
    'screen_visit', 3,
    NULL, '/dashboard', false, true,
    'Walk through the dashboard layout: sidebar navigation, upcoming shifts widget, tasks widget, announcements.',
    'User has visited the dashboard page.'
  ),
  -- 4. Visit schedule
  (
    'b0000000-0000-0000-0001-000000000004',
    'a0000000-0000-0000-0000-000000000001',
    'Find your schedule',
    'Learn where to see your shifts and work calendar.',
    'screen_visit', 4,
    NULL, '/schedule', false, true,
    'Navigate to the schedule page. Explain the calendar view, how shifts appear, and how to identify your own shifts.',
    'User has visited the schedule page.'
  ),
  -- 5. Visit team page
  (
    'b0000000-0000-0000-0001-000000000005',
    'a0000000-0000-0000-0000-000000000001',
    'Meet your team',
    'See who you work with in your department.',
    'screen_visit', 5,
    NULL, '/team', false, true,
    'Show the team page. Explain departments, teams, and how to find colleagues.',
    'User has visited the team page.'
  ),
  -- 6. Understand shifts
  (
    'b0000000-0000-0000-0001-000000000006',
    'a0000000-0000-0000-0000-000000000001',
    'Understand the shift concept',
    'Confirm you understand how shifts, punch-in, and scheduling work.',
    'ai_verified', 6,
    'ai_confirmed_understanding', NULL, false, true,
    'Ask the trainee a simple question about shifts: "If your shift starts at 10:00, what should you do when you arrive?" Confirm understanding.',
    'AI has confirmed the trainee understands the basic shift workflow.'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SCHEDULING MODULE CHECKPOINTS
-- ============================================================================

INSERT INTO module_journey_checkpoint (
  id, journey_id, name, description, checkpoint_type, sort_order,
  event_name, target_screen, is_sandbox, is_required,
  ai_context, ai_success_hint
)
VALUES
  (
    'b0000000-0000-0000-0002-000000000001',
    'a0000000-0000-0000-0000-000000000002',
    'View schedule page',
    'Navigate to the scheduling view.',
    'screen_visit', 1,
    NULL, '/schedule', false, true,
    'If not already visited in core journey, guide to the schedule page.',
    'User has visited /schedule.'
  ),
  (
    'b0000000-0000-0000-0002-000000000002',
    'a0000000-0000-0000-0000-000000000002',
    'Find your own shift',
    'Identify your assigned shift in the calendar.',
    'screen_visit', 2,
    NULL, '/schedule', false, true,
    'Highlight the user''s own shift in the grid. Explain the color coding.',
    'User has found and tapped their own shift.'
  ),
  (
    'b0000000-0000-0000-0002-000000000003',
    'a0000000-0000-0000-0000-000000000002',
    'Test punch-in',
    'Practice clocking in for a shift (sandbox mode).',
    'action', 3,
    'sandbox_punch_in_completed', '/schedule', true, true,
    'Navigate to punch-in. Explain this is a practice run — no real payroll impact. Guide through the punch-in flow.',
    'Sandbox punch-in event recorded.'
  ),
  (
    'b0000000-0000-0000-0002-000000000004',
    'a0000000-0000-0000-0000-000000000002',
    'Register availability',
    'Set your available days and times for scheduling (sandbox mode).',
    'action', 4,
    'sandbox_availability_set', '/schedule/availability', true, true,
    'Show the availability page. Guide through selecting available days. Explain this is practice.',
    'Availability preferences saved (sandbox).'
  ),
  (
    'b0000000-0000-0000-0002-000000000005',
    'a0000000-0000-0000-0000-000000000002',
    'Understand shift swap',
    'Learn how shift swapping works between colleagues.',
    'ai_verified', 5,
    'ai_confirmed_shift_swap', NULL, false, false,
    'Explain shift swap concept. Ask: "If you can''t make your shift, what can you do?" Confirm understanding.',
    'AI confirmed understanding of shift swap.'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- TASKS MODULE CHECKPOINTS
-- ============================================================================

INSERT INTO module_journey_checkpoint (
  id, journey_id, name, description, checkpoint_type, sort_order,
  event_name, target_screen, is_sandbox, is_required,
  ai_context, ai_success_hint
)
VALUES
  (
    'b0000000-0000-0000-0003-000000000001',
    'a0000000-0000-0000-0000-000000000003',
    'View tasks page',
    'Find where your daily tasks appear.',
    'screen_visit', 1,
    NULL, '/tasks', false, true,
    'Navigate to tasks page. Explain task types: opening routines, closing checklists, ad-hoc tasks.',
    'User has visited /tasks.'
  ),
  (
    'b0000000-0000-0000-0003-000000000002',
    'a0000000-0000-0000-0000-000000000003',
    'Complete a test task',
    'Practice completing a task item (sandbox mode).',
    'action', 2,
    'sandbox_task_completed', '/tasks', true, true,
    'Create a practice task or use a pre-loaded one. Walk through: open task → check steps → mark complete.',
    'Sandbox task marked as completed.'
  ),
  (
    'b0000000-0000-0000-0003-000000000003',
    'a0000000-0000-0000-0000-000000000003',
    'View task history',
    'See completed tasks and their timestamps.',
    'screen_visit', 3,
    NULL, '/tasks/history', false, false,
    'Show the task history view. Explain how managers see completion times.',
    'User has visited task history.'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- HACCP MODULE CHECKPOINTS
-- ============================================================================

INSERT INTO module_journey_checkpoint (
  id, journey_id, name, description, checkpoint_type, sort_order,
  event_name, target_screen, is_sandbox, is_required,
  ai_context, ai_success_hint
)
VALUES
  (
    'b0000000-0000-0000-0004-000000000001',
    'a0000000-0000-0000-0000-000000000004',
    'View HACCP page',
    'Find the food safety and temperature logging section.',
    'screen_visit', 1,
    NULL, '/haccp', false, true,
    'Navigate to HACCP page. Explain: HACCP is required by Norwegian Mattilsynet (food safety authority).',
    'User has visited /haccp.'
  ),
  (
    'b0000000-0000-0000-0004-000000000002',
    'a0000000-0000-0000-0000-000000000004',
    'Log a test temperature',
    'Practice logging a temperature reading (sandbox mode).',
    'action', 2,
    'sandbox_temperature_logged', '/haccp', true, true,
    'Guide through: select equipment → enter temperature → save. Explain acceptable ranges.',
    'Sandbox temperature log entry created.'
  ),
  (
    'b0000000-0000-0000-0004-000000000003',
    'a0000000-0000-0000-0000-000000000004',
    'View HACCP log history',
    'See previous temperature readings and compliance status.',
    'screen_visit', 3,
    NULL, '/haccp/log', false, false,
    'Show the log history. Explain green/red indicators and deviation handling.',
    'User has visited HACCP log history.'
  ),
  (
    'b0000000-0000-0000-0004-000000000004',
    'a0000000-0000-0000-0000-000000000004',
    'Understand deviation process',
    'Know what to do when temperature is out of range.',
    'ai_verified', 4,
    'ai_confirmed_haccp_deviation', NULL, false, true,
    'Ask: "If the fridge temperature is 12°C instead of the required 4°C, what should you do?" Confirm understanding of deviation reporting.',
    'AI confirmed understanding of HACCP deviation process.'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- CHAT MODULE CHECKPOINTS
-- ============================================================================

INSERT INTO module_journey_checkpoint (
  id, journey_id, name, description, checkpoint_type, sort_order,
  event_name, target_screen, is_sandbox, is_required,
  ai_context, ai_success_hint
)
VALUES
  (
    'b0000000-0000-0000-0005-000000000001',
    'a0000000-0000-0000-0000-000000000005',
    'Find team chat',
    'Navigate to the chat section and find your team channel.',
    'screen_visit', 1,
    NULL, '/chat', false, true,
    'Guide to chat page. Show team channels vs. direct messages. Highlight their department channel.',
    'User has visited /chat.'
  ),
  (
    'b0000000-0000-0000-0005-000000000002',
    'a0000000-0000-0000-0000-000000000005',
    'Send a message',
    'Send your first message in the team chat (real, not sandbox).',
    'action', 2,
    'chat_message_sent', '/chat', false, true,
    'Encourage the trainee to send a greeting in the team channel. This is real — social integration from day one.',
    'A real chat message has been sent by the trainee.'
  ),
  (
    'b0000000-0000-0000-0005-000000000003',
    'a0000000-0000-0000-0000-000000000005',
    'View announcements',
    'Check the announcements/bulletin board section.',
    'screen_visit', 3,
    NULL, '/chat/announcements', false, false,
    'Show where announcements from management appear. Explain notification settings.',
    'User has visited announcements.'
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;
