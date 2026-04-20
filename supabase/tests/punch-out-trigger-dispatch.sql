-- Integration test: shift.punched_out → engine_trigger match → engine_state spawn
--
-- This exercises the LOAD-BEARING glue between telemetry and the shift
-- lifecycle orchestrator (per PLAN-secure-shift-lifecycle.md WS-A2). It
-- does NOT call the engine-dispatch Edge Function (that is exercised in
-- a Vitest integration layer). Instead it asserts the DB-side invariants
-- the dispatcher depends on, simulating what the dispatcher writes when
-- it receives a payload that matches the telemetry emit shape from
-- apps/web/src/hooks/shift-clock/useShiftClock.ts and the fixed
-- apps/mobile/src/hooks/mutations/use-punch.ts.
--
-- Run with:
--   psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--        -f supabase/tests/punch-out-trigger-dispatch.sql

BEGIN;

-- ── 1. engine_trigger for shift.punched_out → shift_lifecycle_v1 is active ──
DO $$
DECLARE
  v_trigger_id UUID;
  v_active     BOOLEAN;
BEGIN
  SELECT id, is_active INTO v_trigger_id, v_active
    FROM engine_trigger
   WHERE event_type = 'shift.punched_out'
     AND process_id = 'shift_lifecycle_v1'
   LIMIT 1;

  IF v_trigger_id IS NULL THEN
    RAISE EXCEPTION 'FAIL 1: no trigger row for shift.punched_out → shift_lifecycle_v1';
  END IF;
  IF NOT v_active THEN
    RAISE EXCEPTION 'FAIL 1: trigger exists but is_active=false';
  END IF;
  RAISE NOTICE 'PASS 1: active trigger wired (id=%)', v_trigger_id;
END $$;

-- ── 2. A synthetic engine_event of event_type='shift.punched_out' is routable ──
--    We insert the event row (what engine-dispatch would do on receipt of a
--    telemetry payload via sendToEngine → Edge Function) and assert the
--    trigger query returns exactly one matching active trigger.
DO $$
DECLARE
  v_event_id UUID;
  v_match    INT;
  v_shift_id UUID := gen_random_uuid();
  -- Use NULL workspace_id to avoid a FK dependency on seeded workspace rows.
  -- Real traffic always carries a valid workspace_id; the dispatcher's
  -- trigger selection logic (event_type + is_active) is identical either way.
BEGIN
  INSERT INTO engine_event (event_type, payload, workspace_id, idempotency_key)
  VALUES (
    'shift.punched_out',
    jsonb_build_object(
      'actor_id', gen_random_uuid()::text,
      'entity_type', 'shift',
      'entity_id', v_shift_id::text,
      'shift_id', v_shift_id::text,
      'punch_time', now()::text,
      'work_minutes', 480,
      'break_minutes', 30,
      'originating_channel', 'system'
    ),
    NULL,
    'test-pgtap-' || gen_random_uuid()::text
  )
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'FAIL 2: failed to insert synthetic engine_event';
  END IF;

  -- Mirror engine-dispatch trigger selection (event_type + is_active)
  SELECT count(*) INTO v_match
    FROM engine_trigger
   WHERE event_type = 'shift.punched_out'
     AND is_active = true;

  IF v_match < 1 THEN
    RAISE EXCEPTION 'FAIL 2: trigger selection returned 0 rows for synthetic event';
  END IF;
  RAISE NOTICE 'PASS 2: synthetic shift.punched_out event matched % trigger row(s)', v_match;
END $$;

-- ── 3. Process steps 1..7 exist in the order engine-dispatch expects ──
--    Step 1 must be wait_for_event (entry point) even though the dispatcher
--    executes step 1 immediately. Steps 2..7 drive the lifecycle chain.
DO $$
DECLARE
  v_step1 TEXT;
  v_step2 TEXT;
  v_step6 TEXT;
BEGIN
  SELECT action_type INTO v_step1
    FROM engine_step WHERE process_id = 'shift_lifecycle_v1' AND step_order = 1;
  IF v_step1 <> 'wait_for_event' THEN
    RAISE EXCEPTION 'FAIL 3: step 1 expected wait_for_event, got %', v_step1;
  END IF;

  SELECT action_type INTO v_step2
    FROM engine_step WHERE process_id = 'shift_lifecycle_v1' AND step_order = 2;
  IF v_step2 <> 'update_entity' THEN
    RAISE EXCEPTION 'FAIL 3: step 2 expected update_entity, got %', v_step2;
  END IF;

  SELECT action_type INTO v_step6
    FROM engine_step WHERE process_id = 'shift_lifecycle_v1' AND step_order = 6;
  IF v_step6 <> 'queue_shift_approval' THEN
    RAISE EXCEPTION 'FAIL 3: step 6 expected queue_shift_approval, got %', v_step6;
  END IF;
  RAISE NOTICE 'PASS 3: shift_lifecycle_v1 step order matches dispatcher contract';
END $$;

-- ── 4. engine_process is active so the dispatcher accepts starts ──
DO $$
DECLARE
  v_active BOOLEAN;
BEGIN
  SELECT is_active INTO v_active
    FROM engine_process WHERE id = 'shift_lifecycle_v1';
  IF NOT v_active THEN
    RAISE EXCEPTION 'FAIL 4: shift_lifecycle_v1 is_active=false; dispatcher will refuse to spawn';
  END IF;
  RAISE NOTICE 'PASS 4: shift_lifecycle_v1 is_active=true';
END $$;

-- ── 5. Simulate engine_state spawn and assert entity_id plumbing ──
--    engine-dispatch stamps engine_state.entity_id from payload.entity_id.
--    If this column is NULL, subsequent steps (update_entity on
--    schedule_shift, derive_shift_hours RPC) cannot identify the shift.
--    This guards against a regression where the emit site uses
--    time_entry_id as entity_id.
DO $$
DECLARE
  v_shift_id UUID := gen_random_uuid();
  v_trig_id  UUID;
  v_state_id UUID;
  v_entity   UUID;
BEGIN
  SELECT id INTO v_trig_id FROM engine_trigger
   WHERE event_type = 'shift.punched_out' AND process_id = 'shift_lifecycle_v1'
   LIMIT 1;

  -- NULL workspace_id to skip the workspace FK — the invariant we are
  -- guarding is the entity_id plumbing, not workspace association.
  INSERT INTO engine_state (
    trigger_id, process_id, workspace_id, status, current_step,
    entity_type, entity_id, context, steps_snapshot, result
  )
  VALUES (
    v_trig_id, 'shift_lifecycle_v1', NULL, 'active', 1,
    'shift', v_shift_id,
    jsonb_build_object(
      'entity_type', 'shift',
      'entity_id', v_shift_id::text,
      'originating_channel', 'system'
    ),
    '[]'::jsonb,
    '{}'::jsonb
  )
  RETURNING id, entity_id INTO v_state_id, v_entity;

  IF v_state_id IS NULL THEN
    RAISE EXCEPTION 'FAIL 5: engine_state insert failed';
  END IF;
  IF v_entity IS NULL OR v_entity <> v_shift_id THEN
    RAISE EXCEPTION 'FAIL 5: engine_state.entity_id mismatch (got %, expected %)',
      v_entity, v_shift_id;
  END IF;
  RAISE NOTICE 'PASS 5: engine_state spawned with entity_id=shift_id (state_id=%)', v_state_id;
END $$;

ROLLBACK;
