-- Cascade Cost Snapshot — Engine process + triggers
-- Generates shift_cost_snapshot rows on publish (planned) and completion (actual)

-- Process definition
INSERT INTO engine_process (id, name, description, is_active)
VALUES (
  'cascade_cost_snapshot',
  'Cascade Cost Snapshot',
  'Generates shift cost snapshots on publish (planned) and completion (actual)',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Single step: execute the cost snapshot action
INSERT INTO engine_step (process_id, step_order, action_type, action_payload)
VALUES (
  'cascade_cost_snapshot', 1, 'cascade_cost_snapshot',
  '{"description": "Compute and store cost snapshot for published/completed shifts"}'::jsonb
)
ON CONFLICT ON CONSTRAINT uq_process_step_order DO NOTHING;

-- Trigger: shift.published -> cascade_cost_snapshot (planned basis)
INSERT INTO engine_trigger (event_type, process_id, is_active, condition)
SELECT 'shift.published', 'cascade_cost_snapshot', true,
       '{"pass_context": {"basis": "planned", "source_event": "shift.published"}}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM engine_trigger
  WHERE event_type = 'shift.published' AND process_id = 'cascade_cost_snapshot'
);

-- Trigger: shift.completed -> cascade_cost_snapshot (actual basis)
INSERT INTO engine_trigger (event_type, process_id, is_active, condition)
SELECT 'shift.completed', 'cascade_cost_snapshot', true,
       '{"pass_context": {"basis": "actual", "source_event": "shift.completed"}}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM engine_trigger
  WHERE event_type = 'shift.completed' AND process_id = 'cascade_cost_snapshot'
);
