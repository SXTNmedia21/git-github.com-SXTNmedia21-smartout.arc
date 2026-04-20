-- ============================================
-- 20260515130200_helpdesk_query_process_seed.sql
-- Helpdesk Phase 1 — engine_process blueprint (ADR-0161)
-- ============================================
-- ADR-0161: a helpdesk ticket is an engine_state running the
-- 'helpdesk_query_lifecycle' process — NOT a new status column or
-- parallel workflow system (L-0070). This migration seeds the canonical
-- blueprint.
--
-- Design note (updated 2026-04-20 per supervisor code-trace):
--   Phase 1 uses engine_process for state-machine anchoring ONLY —
--   wait_for_event steps define the ticket lifecycle gates, but the
--   mutations (assign, notify, set-resolved) are driven by the
--   `helpdesk_query` capability's application-layer tools. This matches
--   the current dispatcher's action_type vocabulary without requiring
--   dispatcher extensions. Steps that would need new dispatcher handlers
--   (assign_task for engine_state entities, update_entity for engine_state
--   status) are deferred to Phase 2 when the dispatcher gains those
--   capabilities.
--
--   Phase 2 will add engine_delayed_trigger competing with step 2
--   wait_for_event for SLA timeout escalation.
--
-- Flow (Phase 1 MVP):
--   1. wait_for_event('helpdesk.query.opened')
--        — spawn anchor; engine_state transitions 'pending' → 'waiting'.
--   2. wait_for_event('helpdesk.query.resolved' OR 'helpdesk.query.reassigned')
--        — resolution anchor; capability's resolve_ticket tool emits
--          the event which advances the state machine to complete.
--
-- allowed_channels = ['chat'] per ADR-0163 — helpdesk queries may carry
-- PII (personnummer, lønn, bank details). Voice is NEVER allowed.
-- ============================================

SET search_path TO public, extensions;

-- Blueprint (platform-level — workspace_id NULL so every workspace can spawn it)
INSERT INTO engine_process (id, name, description, workspace_id, allowed_channels, is_active, max_steps)
VALUES (
  'helpdesk_query_lifecycle',
  'Helpdesk Query Lifecycle',
  'ADR-0161: ticket = engine_state running this process. Manual assign/resolve in Phase 1 MVP; SLA timeout via engine_delayed_trigger in Phase 2.',
  NULL,
  ARRAY['chat'],
  true,
  10
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  allowed_channels = EXCLUDED.allowed_channels,
  is_active = EXCLUDED.is_active,
  max_steps = EXCLUDED.max_steps,
  updated_at = now();

-- Clean up any prior attempt (supervisor flagged incompatible action_types)
DELETE FROM engine_step WHERE process_id = 'helpdesk_query_lifecycle';

-- Steps (idempotent via uq_process_step_order).
-- Only wait_for_event is used in Phase 1 — dispatcher-compatible
-- (supabase/functions/engine-dispatch/index.ts handles wait_for_event
-- by marking engine_state.status='waiting'). Application-layer tools in
-- the helpdesk_query capability drive the mutations between waits.
INSERT INTO engine_step (process_id, step_order, action_type, action_payload, assignee_rule) VALUES
  (
    'helpdesk_query_lifecycle',
    1,
    'wait_for_event',
    jsonb_build_object(
      'event_type', 'helpdesk.query.opened',
      'timeout_seconds', null,
      'note', 'Spawn anchor — resolved when capability open_ticket emits the event'
    ),
    NULL
  ),
  (
    'helpdesk_query_lifecycle',
    2,
    'wait_for_event',
    jsonb_build_object(
      'event_type_any_of', ARRAY['helpdesk.query.resolved', 'helpdesk.query.reassigned'],
      'timeout_seconds', null,
      'note', 'Resolution anchor — capability resolve_ticket or reassign_ticket emits'
    ),
    NULL
  )
ON CONFLICT (process_id, step_order) DO UPDATE SET
  action_type = EXCLUDED.action_type,
  action_payload = EXCLUDED.action_payload,
  assignee_rule = EXCLUDED.assignee_rule;

COMMENT ON COLUMN engine_step.action_payload IS
  'Standardized JSON payload per action_type. See dispatcher for schema per type. Phase 2 adds helpdesk.query.timeout via engine_delayed_trigger competing with resolved/reassigned at step 2.';
