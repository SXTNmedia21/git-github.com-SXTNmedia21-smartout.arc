-- ============================================================
-- 20260428120000_helpdesk_sla_blueprint.sql
-- Helpdesk Phase 2 — SLA breach steps for helpdesk_query_lifecycle (ADR-0227)
-- ============================================================
--
-- WHAT THIS MIGRATION DOES
-- ────────────────────────
-- Extends the `helpdesk_query_lifecycle` engine_process blueprint (seeded in
-- 20260515130200, corrected in 20260518230000) with two new steps:
--
--   Step 3 — wait_for_event('helpdesk.query.sla_breached')
--     Name: await_sla_breach
--     Waits for the SLA breach event emitted by fire-delayed-triggers when
--     the pre-canned engine_delayed_trigger row fires.
--
--   Step 4 — update_context + send_notification (two actions, split into
--             step_order 4 and 5 because engine_step is one action per row)
--     Step 4: update_context — patches engine_state.context.sla_breached_at
--             for the current state with NOW(). Reads context.sla_breached_at
--             IS NOT NULL as idempotency guard on repeated fire.
--     Step 5: send_notification — emits a chat-only notification. recipient_id
--             is read from context.observer_profile_id (written at ticket spawn
--             time by T6: resolve_observer()). Inherits allowed_channels=['chat']
--             from the process definition (ADR-0163).
--
-- ADR REFERENCES
-- ──────────────
-- ADR-0227: Approach A — pre-canned engine_event + engine_trigger reuse.
--           Snapshot semantics: observer_escalation_hours baked into fire_at.
-- ADR-0226: Observer resolution uses proxy chain (team leader → broadcast).
--           Missing observer emits helpdesk.sla.no_observer_resolved.
-- ADR-0161: Ticket = engine_state. No direct-insert from tools for new states.
-- ADR-0163: allowed_channels=['chat']. SLA notifications must NOT reach voice.
--
-- DEPENDENCIES
-- ────────────
-- T4 (dispatcher update_context action_type): Step 4 references action_type
--   'update_context', which the dispatcher does NOT yet handle. The migration
--   applies cleanly (Postgres stores the string; no enum constraint), but step 4
--   will no-op at runtime until engine-dispatch/index.ts adds the handler. T4
--   must land before Phase 2 acceptance criteria pass.
--
-- T6 (observer resolver): Step 5 reads context.observer_profile_id. This field
--   is written by resolve_observer() in the openTicket tool (T6 deliverable).
--   Until T6 lands, step 5 send_notification will find recipient_id=null and
--   skip silently (dispatcher already handles null recipient_id gracefully at
--   line 752: `if (targetRecipient && targetWorkspace)`).
--
-- DISPATCHER CONSTRAINT — PARALLEL BRANCH LIMITATION
-- ────────────────────────────────────────────────────
-- ⚠️  PLAN GAP: The engine-dispatch resume loop (index.ts:440-441) matches the
-- CURRENT step's action_payload.event against the incoming event_type. This is
-- purely sequential: the state at step 2 (wait_for_event 'helpdesk.query.resolved')
-- will NOT resume when 'helpdesk.query.sla_breached' fires — step 2 is waiting
-- for 'resolved', not 'sla_breached'.
--
-- Steps 3-5 are therefore unreachable by the resume-loop path for any ticket
-- state that is currently at step 2. The plan's T3 migration seeds an
-- engine_trigger(event_type='helpdesk.query.sla_breached', process_id=
-- 'helpdesk_query_lifecycle') — but the trigger path SPAWNS a NEW engine_state
-- starting at step 1, which enters waiting at step 1 (wait_for_event 'opened')
-- and never advances to steps 3-5.
--
-- SAFEST WORKAROUND (to be decided by T4/T3 owners):
--   Option A: T3 seeds the trigger pointing to a SEPARATE process
--             (e.g., 'helpdesk_sla_breach_handler') whose steps 1-2 are
--             update_context + send_notification. Blueprint in T3 migration.
--             This migration's steps 3-5 would then be dead weight and should
--             be removed in a follow-up.
--   Option B: T4 adds dispatcher support for a 'context_patch' hook that fires
--             immediately when any event matches the engine_state's entity_id,
--             bypassing the step-sequential model for cross-cutting concerns.
--   Option C: Steps 2 and 3 are made to share the same step_order using
--             step_group (schema column exists, dispatcher does not yet read it).
--             This requires a dispatcher change to handle parallel wait steps.
--
-- Until one of these options lands, steps 3-5 are blueprint-correct but
-- runtime-inert. The pre-canned event + engine_delayed_trigger mechanism
-- (T5: openTicket) and cancellation (T6: resolveTicket) still work correctly
-- regardless of whether steps 3-5 are ever reached via the dispatcher.
--
-- IDEMPOTENCY
-- ───────────
-- Uses ON CONFLICT (process_id, step_order) DO UPDATE so repeated resets apply
-- cleanly. Follows the style of 20260518230000_helpdesk_lifecycle_dispatcher_fix.sql.
-- Does NOT touch engine_authority_config, engine_trigger, or any other table —
-- those are T3's scope.
-- ============================================================

SET search_path TO public, extensions;

-- Step 3: wait for SLA breach event.
-- Dispatcher resume loop will match this step when the engine_state is AT step 3
-- AND event_type='helpdesk.query.sla_breached' arrives. See constraint note above.
INSERT INTO engine_step (process_id, step_order, step_group, action_type, action_payload, assignee_rule)
VALUES (
  'helpdesk_query_lifecycle',
  3,
  NULL,
  'wait_for_event',
  jsonb_build_object(
    'event', 'helpdesk.query.sla_breached',
    'step_name', 'await_sla_breach',
    'note', 'ADR-0227: waits for fire-delayed-triggers to re-dispatch the pre-canned breach event. See migration header for dispatcher constraint on parallel-branch limitation.'
  ),
  NULL
)
ON CONFLICT (process_id, step_order) DO UPDATE SET
  step_group     = EXCLUDED.step_group,
  action_type    = EXCLUDED.action_type,
  action_payload = EXCLUDED.action_payload,
  assignee_rule  = EXCLUDED.assignee_rule;

-- Step 4: patch engine_state.context.sla_breached_at for the current state.
-- action_type='update_context' is a NEW dispatcher action (T4 deliverable).
-- Stores NOW() into context.sla_breached_at. The idempotency guard
-- (context.sla_breached_at IS NOT NULL → skip) must be implemented in the
-- dispatcher handler, not here. Until T4 lands, this step no-ops at runtime.
-- The field 'target' = 'current_state' signals to the dispatcher that it should
-- patch the CURRENT engine_state's context (not the entity the state points to).
INSERT INTO engine_step (process_id, step_order, step_group, action_type, action_payload, assignee_rule)
VALUES (
  'helpdesk_query_lifecycle',
  4,
  NULL,
  'update_context',
  jsonb_build_object(
    'target', 'current_state',
    'patch', jsonb_build_object(
      'sla_breached_at', '__now__'
    ),
    'idempotency_guard', 'context.sla_breached_at IS NOT NULL',
    'note', 'ADR-0227: patches engine_state.context.sla_breached_at = NOW(). T4 dispatcher handler required. __now__ is a sentinel resolved at execution time.'
  ),
  NULL
)
ON CONFLICT (process_id, step_order) DO UPDATE SET
  step_group     = EXCLUDED.step_group,
  action_type    = EXCLUDED.action_type,
  action_payload = EXCLUDED.action_payload,
  assignee_rule  = EXCLUDED.assignee_rule;

-- Step 5: notify the resolved observer.
-- action_type='send_notification' is already implemented in engine-dispatch.
-- recipient_id is read from context.observer_profile_id — written at ticket
-- spawn by resolve_observer() (T6 deliverable). If the field is absent (T6
-- not yet deployed), the dispatcher skips silently (line 752 null-guard).
-- allowed_channels=['chat'] is enforced at the process level (ADR-0163).
-- The template key is 'helpdesk.sla.breach_alert' — notification_outbox
-- consumer must render this template for push + in_app delivery.
INSERT INTO engine_step (process_id, step_order, step_group, action_type, action_payload, assignee_rule)
VALUES (
  'helpdesk_query_lifecycle',
  5,
  NULL,
  'send_notification',
  jsonb_build_object(
    'template', 'helpdesk.sla.breach_alert',
    'recipient_source', 'context.observer_profile_id',
    'note', 'ADR-0227 + ADR-0226: observer resolved at spawn by resolve_observer() (T6). recipient_id read from engine_state.context at execution time. Allowed channels enforced by process.allowed_channels=[chat].'
  ),
  NULL
)
ON CONFLICT (process_id, step_order) DO UPDATE SET
  step_group     = EXCLUDED.step_group,
  action_type    = EXCLUDED.action_type,
  action_payload = EXCLUDED.action_payload,
  assignee_rule  = EXCLUDED.assignee_rule;

-- Acceptance check (informational — not enforced by migration runner):
-- SELECT step_order, action_type, action_payload->>'step_name' AS step_name
-- FROM engine_step
-- WHERE process_id = 'helpdesk_query_lifecycle'
-- ORDER BY step_order;
--
-- Expected:
--   1 | wait_for_event | (null)             — spawn anchor
--   2 | wait_for_event | (null)             — resolution anchor
--   3 | wait_for_event | await_sla_breach   — SLA breach wait
--   4 | update_context | (null)             — patch context.sla_breached_at
--   5 | send_notification | (null)          — notify observer
