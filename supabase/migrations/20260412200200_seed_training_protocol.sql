SET search_path TO public, extensions;

-- ============================================
-- 20260412200200_seed_training_protocol.sql
-- Seeds the training_protocol process.
-- When a protocol is assigned, dynamically generates
-- engine_state_step rows from the protocol's procedures,
-- knowledge tests, and confirmations.
-- ============================================

-- ── Process ────────────────────────────────────────────────

INSERT INTO engine_process (id, name, description) VALUES
('training_protocol', 'Training Protocol',
 'Dynamically generates steps from a protocol assignment: present_content for each procedure step, administer_test for each knowledge test, collect_signature for each confirmation, then check_readiness.')
ON CONFLICT (id) DO NOTHING;

-- ── Steps ──────────────────────────────────────────────────
-- Single meta-step that reads the protocol structure and creates
-- dynamic engine_state_step rows via the generate_steps handler.

INSERT INTO engine_step (process_id, step_order, step_group, action_type, action_payload, assignee_rule) VALUES
('training_protocol', 1, NULL, 'generate_steps', '{
  "source": "protocol_assignment",
  "description": "Read protocol structure (procedures + steps, knowledge tests, confirmations) and create engine_state_step rows for each"
}', 'self')

ON CONFLICT (process_id, step_order) DO NOTHING;

-- ── Trigger ───────────────────────────────────────────────

INSERT INTO engine_trigger (event_type, process_id, condition, is_active)
SELECT 'protocol.assigned', 'training_protocol', null, true
WHERE NOT EXISTS (
  SELECT 1 FROM engine_trigger
  WHERE event_type = 'protocol.assigned' AND process_id = 'training_protocol'
);
