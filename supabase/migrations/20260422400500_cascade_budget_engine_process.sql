-- Cascade Budget Propagation — Engine process + triggers
-- Propagates season budget into daily workspace_budget targets on budget or factor changes

-- Process definition
INSERT INTO engine_process (id, name, description, is_active)
VALUES (
  'cascade_budget_propagation',
  'Cascade Budget Propagation',
  'Propagates season budget into daily workspace_budget targets on budget or factor changes',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Single step: execute the budget propagation action
INSERT INTO engine_step (process_id, step_order, action_type, action_payload)
VALUES (
  'cascade_budget_propagation', 1, 'cascade_budget_propagation',
  '{"description": "Compute and upsert daily budget targets from season budget + day factors"}'::jsonb
)
ON CONFLICT ON CONSTRAINT uq_process_step_order DO NOTHING;

-- Trigger: season_budget.updated -> cascade_budget_propagation
INSERT INTO engine_trigger (event_type, process_id, is_active, condition)
SELECT 'season_budget.updated', 'cascade_budget_propagation', true, null
WHERE NOT EXISTS (
  SELECT 1 FROM engine_trigger
  WHERE event_type = 'season_budget.updated' AND process_id = 'cascade_budget_propagation'
);

-- Trigger: day_factors.updated -> cascade_budget_propagation
INSERT INTO engine_trigger (event_type, process_id, is_active, condition)
SELECT 'day_factors.updated', 'cascade_budget_propagation', true, null
WHERE NOT EXISTS (
  SELECT 1 FROM engine_trigger
  WHERE event_type = 'day_factors.updated' AND process_id = 'cascade_budget_propagation'
);
