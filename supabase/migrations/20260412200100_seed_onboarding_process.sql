SET search_path TO public, extensions;

-- ============================================
-- 20260412200100_seed_onboarding_process.sql
-- Seeds the onboarding_journey process.
-- When an invitation is accepted, assigns default protocols
-- and tracks the employee through to readiness.
-- ============================================

-- ── Process ────────────────────────────────────────────────

INSERT INTO engine_process (id, name, description) VALUES
('onboarding_journey', 'Onboarding Journey',
 'Assigns default workspace protocols to new employee on invite acceptance. Tracks through content learning, testing, and confirmation signing until fully ready.')
ON CONFLICT (id) DO NOTHING;

-- ── Steps ──────────────────────────────────────────────────

INSERT INTO engine_step (process_id, step_order, step_group, action_type, action_payload, assignee_rule) VALUES

-- Step 1: Assign default protocols from workspace config
('onboarding_journey', 1, NULL, 'start_process', '{
  "process_id": "training_protocol",
  "description": "Trigger training_protocol sub-process for each assigned protocol"
}', null),

-- Step 2: Present welcome content / handbook overview
('onboarding_journey', 2, NULL, 'send_notification', '{
  "template": "onboarding_welcome",
  "channel": "push",
  "description": "Send welcome notification to the new employee with training instructions"
}', null),

-- Step 3: Wait for all protocols to be completed
('onboarding_journey', 3, NULL, 'wait_for_event', '{
  "event": "protocol.all_completed",
  "timeout": "336h",
  "on_timeout": "escalate",
  "description": "Wait for employee to complete all assigned protocols (14-day window)"
}', null),

-- Step 4: Check readiness — are all protocols done?
('onboarding_journey', 4, NULL, 'check_readiness', '{
  "description": "Verify all protocol assignments are completed for this profile"
}', null),

-- Step 5: Update profile status from trainee to active
('onboarding_journey', 5, NULL, 'update_entity', '{
  "entity": "profile",
  "set": {"status": "active"},
  "description": "Promote employee from trainee to active status"
}', null),

-- Step 6: Notify manager of completion
('onboarding_journey', 6, NULL, 'send_notification', '{
  "template": "onboarding_complete",
  "channel": "push",
  "description": "Notify manager that the new employee has completed onboarding"
}', 'manager')

ON CONFLICT (process_id, step_order) DO NOTHING;

-- ── Trigger ───────────────────────────────────────────────

INSERT INTO engine_trigger (event_type, process_id, condition, is_active)
SELECT 'invitation.accepted', 'onboarding_journey', null, true
WHERE NOT EXISTS (
  SELECT 1 FROM engine_trigger
  WHERE event_type = 'invitation.accepted' AND process_id = 'onboarding_journey'
);
