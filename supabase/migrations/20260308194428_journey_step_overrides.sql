SET search_path TO public, extensions;

-- Slug for condition matching — compile reads this directly, never generates from title
ALTER TABLE journey_step ADD COLUMN IF NOT EXISTS slug TEXT;

-- Allow journey_step to override default wait_for_event behavior
-- Used for non-standard steps like send_notification, update_entity
ALTER TABLE journey_step ADD COLUMN IF NOT EXISTS action_type_override TEXT;
ALTER TABLE journey_step ADD COLUMN IF NOT EXISTS action_payload_override JSONB;

COMMENT ON COLUMN journey_step.slug IS 'Machine-readable step ID used in engine condition matching. Must match what emit() sends as step_id.';
COMMENT ON COLUMN journey_step.action_type_override IS 'If set, compile uses this instead of default wait_for_event.';
COMMENT ON COLUMN journey_step.action_payload_override IS 'If set, compile uses this as action_payload instead of generating one.';
