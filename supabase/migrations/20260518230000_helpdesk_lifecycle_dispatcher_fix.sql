-- ============================================
-- 20260518230000_helpdesk_lifecycle_dispatcher_fix.sql
-- Fix dispatcher contract for helpdesk_query_lifecycle (ADR-0161)
-- ============================================
-- Three bugs in 20260515130200_helpdesk_query_process_seed.sql:
--
--   1. Step 1 action_payload uses key `event_type`. Dispatcher
--      (supabase/functions/engine-dispatch/index.ts:419) matches on
--      `action_payload.event === event_type`. Wrong key = state never
--      resumes from waiting → ticket never advances out of step 1.
--
--   2. Step 2 action_payload uses `event_type_any_of` ARRAY. The
--      dispatcher matcher does not implement set-membership; only the
--      single `event` key is honored. Step 2 never matches anything →
--      tickets never reach 'complete'.
--
--   3. Missing `engine_trigger` row mapping `helpdesk.query.opened` →
--      `helpdesk_query_lifecycle`. ADR-0161 §"Process blueprint" makes
--      the trigger the canonical spawn path. Without it, the dispatcher
--      cannot spawn a ticket from an event source other than the
--      capability tool.
--
-- Verified against:
--   - engine-dispatch/index.ts:419 — `(action_payload as Record).event === event_type`
--   - engine-dispatch/index.ts:246 — engine_trigger.event_type match
--   - packages/telemetry/src/registry.ts:6951 — `"helpdesk.query.opened"`
--     destinations include `engine_event` (provider routes via dispatcher)
--
-- Reassigned-event handling (intentional simplification):
--   `helpdesk.query.reassigned` is NOT in the lifecycle wait — per
--   ADR-0161 §"Process blueprint" reassign mutates engine_state.context
--   (assignee_id) without advancing step. Phase 1 keeps lifecycle linear:
--   opened → resolved. Reassign tool updates the row directly.
--
-- ⚠️ Known follow-up (not in this migration):
--   The `open_query` capability tool currently DIRECT-INSERTS
--   engine_state at step 1, status='waiting', then emits the event.
--   Adding the engine_trigger row makes the dispatcher ALSO spawn a
--   second engine_state on the same emit → 2 tickets per call. The
--   trigger is required by ADR-0161 and should land first; the tool
--   refactor (drop direct-insert, let the dispatcher own spawn) is a
--   follow-up sub-sortie. Track with the helpdesk capability owner
--   before this migration ships to a workspace where double-tickets
--   are user-visible.
-- ============================================

SET search_path TO public, extensions;

-- 1 + 2. Re-seed steps with the dispatcher-compatible `event` key.
DELETE FROM engine_step WHERE process_id = 'helpdesk_query_lifecycle';

INSERT INTO engine_step (process_id, step_order, action_type, action_payload, assignee_rule) VALUES
  (
    'helpdesk_query_lifecycle',
    1,
    'wait_for_event',
    jsonb_build_object(
      'event', 'helpdesk.query.opened',
      'timeout_seconds', null,
      'note', 'Spawn anchor — capability open_query emits this; dispatcher resumes step 1.'
    ),
    NULL
  ),
  (
    'helpdesk_query_lifecycle',
    2,
    'wait_for_event',
    jsonb_build_object(
      'event', 'helpdesk.query.resolved',
      'timeout_seconds', null,
      'note', 'Resolution anchor — capability resolve_ticket emits this; reassign mutates context without advancing.'
    ),
    NULL
  )
ON CONFLICT (process_id, step_order) DO UPDATE SET
  action_type = EXCLUDED.action_type,
  action_payload = EXCLUDED.action_payload,
  assignee_rule = EXCLUDED.assignee_rule;

-- 3. Canonical spawn trigger (ADR-0161). Global (workspace_id NULL).
INSERT INTO engine_trigger (event_type, process_id, condition, is_active)
SELECT 'helpdesk.query.opened', 'helpdesk_query_lifecycle', NULL, true
WHERE NOT EXISTS (
  SELECT 1 FROM engine_trigger
  WHERE event_type = 'helpdesk.query.opened'
    AND process_id = 'helpdesk_query_lifecycle'
);

COMMENT ON COLUMN engine_step.action_payload IS
  'Standardized JSON payload per action_type. wait_for_event uses key `event` (single string). Phase 2 may add `event_any_of` if dispatcher gains set-membership; until then split into separate step_order rows.';
