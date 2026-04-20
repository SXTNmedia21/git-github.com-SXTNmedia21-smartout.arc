-- Phase 4 integration test: shift_lifecycle_v1 + department_session_lifecycle.
-- Run with: psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--             -f supabase/tests/lifecycle-processes.sql
--
-- Covers (per ADR-0095, ADR-0096, ADR-0098, ADR-0100 + Phase 4 plan):
--   1. `shift_lifecycle_v1` engine_process row exists with expected steps.
--   2. `department_session_lifecycle` engine_process row exists with expected steps.
--   3. Trigger for `shift.punched_out` routes to shift_lifecycle_v1.
--   4. Plural `shifts.published` alias is unwound (no routing remains).
--   5. Singular `shift.published` still routes to department_session_lifecycle.
--   6. `shift_published_notify_v1` process + trigger exist (push migration).
--   7. The schedule_shift push trigger body no longer calls pg_net (grep for
--      dispatch_push_notification within trigger_push_shift_published function).
--   8. `allowed_channels` on lifecycle processes is ['system'] (channel law).

BEGIN;

-- ── 1. shift_lifecycle_v1 process exists with the expected steps ──
DO $$
DECLARE
  v_proc_exists BOOLEAN;
  v_step_count  INT;
  v_step3       TEXT;
  v_step4       TEXT;
  v_step7       TEXT;
BEGIN
  SELECT EXISTS (SELECT 1 FROM engine_process WHERE id = 'shift_lifecycle_v1')
    INTO v_proc_exists;
  IF NOT v_proc_exists THEN
    RAISE EXCEPTION 'FAIL 1: engine_process shift_lifecycle_v1 missing';
  END IF;

  SELECT count(*) INTO v_step_count
    FROM engine_step
   WHERE process_id = 'shift_lifecycle_v1';
  IF v_step_count < 7 THEN
    RAISE EXCEPTION 'FAIL 1: shift_lifecycle_v1 expected >=7 steps, got %', v_step_count;
  END IF;

  SELECT action_type INTO v_step3
    FROM engine_step WHERE process_id = 'shift_lifecycle_v1' AND step_order = 3;
  IF v_step3 <> 'call_rpc' THEN
    RAISE EXCEPTION 'FAIL 1: step 3 expected call_rpc, got %', v_step3;
  END IF;

  SELECT action_type INTO v_step4
    FROM engine_step WHERE process_id = 'shift_lifecycle_v1' AND step_order = 4;
  IF v_step4 <> 'call_rpc' THEN
    RAISE EXCEPTION 'FAIL 1: step 4 expected call_rpc, got %', v_step4;
  END IF;

  SELECT action_type INTO v_step7
    FROM engine_step WHERE process_id = 'shift_lifecycle_v1' AND step_order = 7;
  IF v_step7 <> 'emit_event' THEN
    RAISE EXCEPTION 'FAIL 1: step 7 expected emit_event, got %', v_step7;
  END IF;

  RAISE NOTICE 'PASS 1: shift_lifecycle_v1 process + steps shape OK';
END $$;

-- ── 2. department_session_lifecycle process exists with expected steps ──
DO $$
DECLARE
  v_proc_exists BOOLEAN;
  v_step_count  INT;
BEGIN
  SELECT EXISTS (SELECT 1 FROM engine_process WHERE id = 'department_session_lifecycle')
    INTO v_proc_exists;
  IF NOT v_proc_exists THEN
    RAISE EXCEPTION 'FAIL 2: engine_process department_session_lifecycle missing';
  END IF;

  SELECT count(*) INTO v_step_count
    FROM engine_step
   WHERE process_id = 'department_session_lifecycle';
  IF v_step_count < 6 THEN
    RAISE EXCEPTION 'FAIL 2: department_session_lifecycle expected >=6 steps, got %', v_step_count;
  END IF;

  RAISE NOTICE 'PASS 2: department_session_lifecycle process + steps OK';
END $$;

-- ── 3. shift.punched_out trigger routes to shift_lifecycle_v1 ──
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count
    FROM engine_trigger
   WHERE event_type = 'shift.punched_out'
     AND process_id = 'shift_lifecycle_v1'
     AND is_active = true;
  IF v_count < 1 THEN
    RAISE EXCEPTION 'FAIL 3: no active trigger for shift.punched_out → shift_lifecycle_v1';
  END IF;
  RAISE NOTICE 'PASS 3: shift.punched_out trigger wired';
END $$;

-- ── 4. plural shifts.published alias has no routing ──
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count
    FROM engine_trigger
   WHERE event_type = 'shifts.published';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'FAIL 4: shifts.published still routed (% rows)', v_count;
  END IF;
  RAISE NOTICE 'PASS 4: shifts.published alias fully unwound';
END $$;

-- ── 5. singular shift.published routes to department_session_lifecycle ──
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count
    FROM engine_trigger
   WHERE event_type = 'shift.published'
     AND process_id = 'department_session_lifecycle'
     AND is_active = true;
  IF v_count < 1 THEN
    RAISE EXCEPTION 'FAIL 5: shift.published → department_session_lifecycle missing';
  END IF;
  RAISE NOTICE 'PASS 5: singular shift.published routes correctly';
END $$;

-- ── 6. shift_published_notify_v1 process + trigger exist ──
DO $$
DECLARE
  v_proc INT;
  v_trig INT;
BEGIN
  SELECT count(*) INTO v_proc
    FROM engine_process WHERE id = 'shift_published_notify_v1';
  IF v_proc < 1 THEN
    RAISE EXCEPTION 'FAIL 6: shift_published_notify_v1 process missing';
  END IF;

  SELECT count(*) INTO v_trig
    FROM engine_trigger
   WHERE event_type = 'shift.publish_notify'
     AND process_id = 'shift_published_notify_v1'
     AND is_active = true;
  IF v_trig < 1 THEN
    RAISE EXCEPTION 'FAIL 6: shift.publish_notify trigger missing';
  END IF;
  RAISE NOTICE 'PASS 6: notify process + trigger present';
END $$;

-- ── 7. trigger_push_shift_published no longer calls dispatch_push_notification ──
DO $$
DECLARE
  v_body TEXT;
BEGIN
  SELECT prosrc INTO v_body
    FROM pg_proc
   WHERE proname = 'trigger_push_shift_published'
   LIMIT 1;

  IF v_body IS NULL THEN
    RAISE EXCEPTION 'FAIL 7: trigger_push_shift_published function missing';
  END IF;

  IF v_body LIKE '%dispatch_push_notification%' THEN
    RAISE EXCEPTION
      'FAIL 7: trigger_push_shift_published still calls pg_net via dispatch_push_notification';
  END IF;

  IF v_body NOT LIKE '%engine_event%' THEN
    RAISE EXCEPTION
      'FAIL 7: trigger_push_shift_published does not insert into engine_event';
  END IF;

  RAISE NOTICE 'PASS 7: push-publish trigger migrated to engine_event';
END $$;

-- ── 8. allowed_channels = ['system'] on lifecycle processes ──
DO $$
DECLARE
  v_shift_ch   TEXT[];
  v_session_ch TEXT[];
BEGIN
  SELECT allowed_channels INTO v_shift_ch
    FROM engine_process WHERE id = 'shift_lifecycle_v1';
  IF v_shift_ch IS DISTINCT FROM ARRAY['system']::TEXT[] THEN
    RAISE EXCEPTION 'FAIL 8: shift_lifecycle_v1 allowed_channels = %, expected {system}', v_shift_ch;
  END IF;

  SELECT allowed_channels INTO v_session_ch
    FROM engine_process WHERE id = 'department_session_lifecycle';
  IF v_session_ch IS DISTINCT FROM ARRAY['system']::TEXT[] THEN
    RAISE EXCEPTION 'FAIL 8: department_session_lifecycle allowed_channels = %, expected {system}', v_session_ch;
  END IF;

  RAISE NOTICE 'PASS 8: allowed_channels=[system] on both lifecycle processes';
END $$;

ROLLBACK;
