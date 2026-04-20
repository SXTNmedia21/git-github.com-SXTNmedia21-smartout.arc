SET search_path TO public, extensions;

-- ============================================================
-- 20260507100100_seed_department_session_lifecycle.sql
--
-- Seeds the `department_session_lifecycle` engine_process.
-- Referenced since 20260427100000_seed_shifts_published_trigger.sql
-- but never seeded — this migration closes that gap.
--
-- Per ADR-0096 (1 session : N shifts): one engine_state per
-- department_session. Lifespan bounded by session_date (hours to
-- ~24h). Acceptable under ADR-0098's long-running aggregate rule
-- (~hundreds of rows steady-state).
--
-- Aggregate scope: department-session. Never emits shift-level
-- events. Session-closed handoff is via pending_signoff → picked
-- up by `daily_close` (already wired).
--
-- Channel policy: allowed_channels = ['system'].
-- ============================================================

INSERT INTO engine_process (id, name, description, is_active, max_steps) VALUES
  (
    'department_session_lifecycle',
    'Department Session Lifecycle',
    'Per-session orchestrator (ADR-0096). Opens on shift publish, advances through active and closing, hands off to daily_close on pending_signoff.',
    true,
    20
  )
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      is_active = EXCLUDED.is_active,
      max_steps = EXCLUDED.max_steps,
      updated_at = now();

UPDATE engine_process
   SET allowed_channels = ARRAY['system']::TEXT[],
       updated_at = now()
 WHERE id = 'department_session_lifecycle';

-- ── Steps ─────────────────────────────────────────────────────

INSERT INTO engine_step (process_id, step_order, step_group, action_type, action_payload, condition, assignee_rule) VALUES

-- 1. Upsert the department_session for (workspace, department, date).
--    Handled by the dispatcher's upsert_session action (pre-existing).
(
  'department_session_lifecycle',
  1,
  NULL,
  'upsert_session',
  jsonb_build_object(
    'description', 'Create or fetch department_session for (workspace_id, department_id, session_date)'
  ),
  NULL,
  NULL
),

-- 2. Advance session to active once the publish event has been
--    processed and the session row exists.
(
  'department_session_lifecycle',
  2,
  NULL,
  'update_entity',
  jsonb_build_object(
    'entity', 'department_session',
    'set', jsonb_build_object('status', 'active'),
    'description', 'Execution-layer: session becomes active'
  ),
  NULL,
  NULL
),

-- 3. Wait for the first punch-in of the day for any shift in this session.
(
  'department_session_lifecycle',
  3,
  NULL,
  'wait_for_event',
  jsonb_build_object(
    'event', 'shift.punched_in',
    'description', 'Await first punch-in in session'
  ),
  NULL,
  NULL
),

-- 4. Wait for shift settlement. When the last shift of the day has
--    settled, the dispatcher-side resume path will advance from here.
--    The condition matches on state.entity_id / payload.session_date
--    via match_state (state already carries session context).
(
  'department_session_lifecycle',
  4,
  NULL,
  'wait_for_event',
  jsonb_build_object(
    'event', 'shift.settled',
    'description', 'Await settled events for shifts in this session'
  ),
  jsonb_build_object(
    'match_state', jsonb_build_object(
      'department_id', 'department_id',
      'session_date', 'session_date'
    )
  ),
  NULL
),

-- 5. Mark session as pending_signoff — triggers daily_close (per
--    migration 20260304300000_seed_daily_close_process.sql).
(
  'department_session_lifecycle',
  5,
  NULL,
  'update_entity',
  jsonb_build_object(
    'entity', 'department_session',
    'set', jsonb_build_object('status', 'pending_signoff'),
    'description', 'Execution-layer: session → pending_signoff (daily_close consumer)'
  ),
  NULL,
  NULL
),

-- 6. Emit department_session.pending_signoff for daily_close.
--    (daily_close also has its own trigger on this event; this
--    emission is the canonical path.)
(
  'department_session_lifecycle',
  6,
  NULL,
  'emit_event',
  jsonb_build_object(
    'event_type', 'department_session.pending_signoff',
    'payload_from_context', jsonb_build_array('department_id', 'session_date'),
    'include_entity', true,
    'description', 'Hand off to daily_close'
  ),
  NULL,
  NULL
)

ON CONFLICT (process_id, step_order) DO UPDATE
  SET action_type = EXCLUDED.action_type,
      action_payload = EXCLUDED.action_payload,
      condition = EXCLUDED.condition,
      assignee_rule = EXCLUDED.assignee_rule;

-- ── Triggers ──────────────────────────────────────────────────
-- Canonical start event: `shift.published` (singular, per ADR-0095
-- supporting notes — the plural alias is unwound in the next
-- migration).

INSERT INTO engine_trigger (event_type, process_id, condition, is_active)
SELECT 'shift.published', 'department_session_lifecycle', NULL, true
WHERE NOT EXISTS (
  SELECT 1 FROM engine_trigger
  WHERE event_type = 'shift.published' AND process_id = 'department_session_lifecycle'
);
