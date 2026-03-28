-- Seed cascade_reconciliation_close engine process + step + trigger
-- Fires on reconciliation.approved to aggregate shift costs into daily_reconciliation

INSERT INTO engine_process (id, workspace_id, name, description, is_active)
VALUES (
  'cascade_reconciliation_close',
  NULL,
  'cascade_reconciliation_close',
  'Aggregate shift costs into daily reconciliation on approval',
  true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO engine_step (process_id, step_order, action_type, action_payload)
VALUES (
  'cascade_reconciliation_close',
  1,
  'cascade_reconciliation_close',
  '{}'::jsonb
) ON CONFLICT ON CONSTRAINT uq_process_step_order DO NOTHING;

INSERT INTO engine_trigger (process_id, event_type, is_active)
SELECT
  'cascade_reconciliation_close',
  'reconciliation.approved',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM engine_trigger
  WHERE process_id = 'cascade_reconciliation_close'
    AND event_type = 'reconciliation.approved'
);
