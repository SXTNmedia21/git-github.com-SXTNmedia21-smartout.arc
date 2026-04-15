SET search_path TO public, extensions;

-- ============================================================
-- 20260507100000_seed_shift_lifecycle_v1.sql
--
-- Seeds the `shift_lifecycle_v1` engine_process.
--
-- Role (per ADR-0095, ADR-0096, ADR-0098, ADR-0100):
--   Short-lived, per-shift-transition orchestrator that runs from
--   punch-out through settlement. NOT one engine_state per shift
--   for its whole life — per ADR-0098 engine_state is coordination
--   only. A steady-state "published, awaiting punch-in" shift
--   holds NO engine_state row. The process spins up when the
--   employee punches out, completes Interpretation → Derivation →
--   Decision queueing → emits `shift.settled`, and terminates.
--
-- Output event (per ADR-0100):
--   `shift.settled` — consumed by `daily_close` at the department
--   aggregate layer. No process call. Event boundary only.
--
-- Channel policy (per ADR-0077, ADR-0078, ADR-0099):
--   allowed_channels = ['system']. This process is triggered by
--   punch-out events, not by chat/voice. Agents must not invoke
--   its steps via conversational surfaces.
-- ============================================================

-- ── Process ───────────────────────────────────────────────────

INSERT INTO engine_process (id, name, description, is_active, max_steps) VALUES
  (
    'shift_lifecycle_v1',
    'Shift Lifecycle (per-shift transition)',
    'Short-lived orchestrator per ADR-0095. Starts on shift.punched_out, derives hours (D6 interpretation), snapshots cost (C3), queues approval (C1), emits shift.settled for daily_close.',
    true,
    20
  )
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      is_active = EXCLUDED.is_active,
      max_steps = EXCLUDED.max_steps,
      updated_at = now();

-- Channel restriction: system-only. Punch-out triggers produce
-- payload.originating_channel = 'system'; chat/voice paths must
-- not drive this process.
UPDATE engine_process
   SET allowed_channels = ARRAY['system']::TEXT[],
       updated_at = now()
 WHERE id = 'shift_lifecycle_v1';

-- ── Steps ─────────────────────────────────────────────────────
-- Idempotency notes:
--   - derive_shift_hours bumps derivation_version on re-run
--     (new row, never an UPDATE).
--   - snapshot_shift_cost is keyed by interpretation_id and is
--     safe to re-call.
--   - update_entity on schedule_shift.status='completed' is a
--     harmless no-op if already completed.

INSERT INTO engine_step (process_id, step_order, step_group, action_type, action_payload, condition, assignee_rule) VALUES

-- 1. Wait for the punch-out event for this specific shift.
(
  'shift_lifecycle_v1',
  1,
  NULL,
  'wait_for_event',
  jsonb_build_object(
    'event', 'shift.punched_out',
    'description', 'Awaiting employee punch-out for this shift'
  ),
  NULL,
  NULL
),

-- 2. Mark the Execution-layer commitment as completed. Idempotent:
--    if status is already 'completed' the UPDATE is a no-op.
(
  'shift_lifecycle_v1',
  2,
  NULL,
  'update_entity',
  jsonb_build_object(
    'entity', 'schedule_shift',
    'set', jsonb_build_object('status', 'completed'),
    'description', 'Execution-layer: schedule_shift.status = completed'
  ),
  NULL,
  NULL
),

-- 3. Interpretation (D6-derived): apply D3 framework rules to the
--    reality time_entry rows. New row per derivation_version; never
--    an UPDATE. RPC returns the new interpretation_id, which we
--    stash in engine_state.context.interpretation_id.
(
  'shift_lifecycle_v1',
  3,
  NULL,
  'call_rpc',
  jsonb_build_object(
    'rpc_name', 'derive_shift_hours',
    'args_from_context', jsonb_build_array('entity_id'),
    'args_param_names', jsonb_build_array('p_shift_id'),
    'output_key', 'interpretation_id',
    'description', 'Apply D3 framework rules to reality punches → shift_hour_interpretation row'
  ),
  NULL,
  NULL
),

-- 4. Derivation (C3): snapshot cost from the interpretation × tariff.
--    Consumes interpretation_id produced by step 3.
(
  'shift_lifecycle_v1',
  4,
  NULL,
  'call_rpc',
  jsonb_build_object(
    'rpc_name', 'snapshot_shift_cost',
    'args_from_context', jsonb_build_array('interpretation_id'),
    'args_param_names', jsonb_build_array('p_interpretation_id'),
    'output_key', 'cost_snapshot_id',
    'description', 'Snapshot cost from interpretation × tariff_rate_table → shift_cost_snapshot row'
  ),
  NULL,
  NULL
),

-- 5. Create a deviation if the interpretation produced overtime
--    above a sane default threshold. The condition is evaluated on
--    engine_state.context; condition writer sets
--    context.overtime_exceeds_threshold = true in step 4's RPC
--    handler when snapshot indicates overtime > threshold.
--    For now, auto-create is gated by the condition only.
(
  'shift_lifecycle_v1',
  5,
  NULL,
  'create_deviation',
  jsonb_build_object(
    'condition', 'overtime_exceeds_threshold',
    'domain', 'scheduling',
    'subcategory', 'excessive_overtime',
    'severity', 'medium',
    'auto_create', true,
    'description', 'Auto-created when shift interpretation shows overtime above policy threshold'
  ),
  NULL,
  NULL
),

-- 6. Decision-layer handoff: ensure there is a pending
--    `shift_approval` row linked to the day's reconciliation.
--    Implemented by engine-dispatch's `queue_shift_approval`
--    action (added in dispatcher patch alongside this migration).
(
  'shift_lifecycle_v1',
  6,
  NULL,
  'queue_shift_approval',
  jsonb_build_object(
    'description', 'Decision-layer: ensure a pending shift_approval row exists for this shift'
  ),
  NULL,
  NULL
),

-- 7. Emit shift.settled (per ADR-0100). Carries interpretation_id,
--    cost_snapshot_id, workspace_id, department_id, session_date
--    so daily_close can aggregate without further lookups.
(
  'shift_lifecycle_v1',
  7,
  NULL,
  'emit_event',
  jsonb_build_object(
    'event_type', 'shift.settled',
    'payload_from_context', jsonb_build_array(
      'interpretation_id',
      'cost_snapshot_id',
      'session_date',
      'department_id'
    ),
    'include_entity', true,
    'description', 'Emit shift.settled for daily_close consumer (ADR-0100)'
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
-- Start the process on shift.punched_out. Matching on entity_id
-- happens inside the process (step 1 wait_for_event also accepts
-- the punched_out event as the starting input for the first tick).

INSERT INTO engine_trigger (event_type, process_id, condition, is_active)
SELECT 'shift.punched_out', 'shift_lifecycle_v1', NULL, true
WHERE NOT EXISTS (
  SELECT 1 FROM engine_trigger
  WHERE event_type = 'shift.punched_out' AND process_id = 'shift_lifecycle_v1'
);
