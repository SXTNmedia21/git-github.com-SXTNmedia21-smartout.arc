-- cascade_gate_write RPC integration test (ADR-0091 WP2, Option B).
-- Run with: psql "postgresql://postgres:postgres@localhost:54322/postgres" -f supabase/tests/cascade-gate-write.sql
--
-- Covers:
--   1. No active framework → {allowed:true, outcome:'applied', reason:'no-active-framework'}.
--   2. Active framework, no matching trigger → {allowed:true, outcome:'applied', reason:'no-trigger-match'}.
--   3. Active framework + matching trigger → {allowed:false, outcome:'proposed', proposal_id:<UUID>},
--      change_proposal row exists with matching trigger_entity_type.
--   4. Disabled trigger override → treated as no-match, {allowed:true}.
--   5. Every call writes a gate_evaluation audit row (count before/after).

BEGIN;

-- ── Setup: minimal fixtures ───────────────────
DO $$
DECLARE
  v_user_id      UUID := gen_random_uuid();
  v_company_id   UUID := gen_random_uuid();
  v_workspace_id UUID := gen_random_uuid();
  v_actor_id     UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('test.workspace_id', v_workspace_id::text, false);
  PERFORM set_config('test.actor_id',     v_actor_id::text,     false);
  PERFORM set_config('test.user_id',      v_user_id::text,      false);

  INSERT INTO auth.users (id, email, aud, role, instance_id)
    VALUES (v_user_id, 'cgw+' || v_user_id || '@example.test',
            'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  -- user_identity row is created automatically by on_auth_user_created trigger.

  INSERT INTO company (company_id, name)
    VALUES (v_company_id, 'CGW Test Co');

  INSERT INTO workspace (workspace_id, company_id, name, slug)
    VALUES (v_workspace_id, v_company_id, 'CGW Test WS',
            'cgw-' || substr(v_workspace_id::text, 1, 8));

  INSERT INTO profile (profile_id, profile_code, user_id, workspace_id, role, is_active, display_name)
    VALUES (v_actor_id,
            'cgw-actor-' || substr(v_actor_id::text, 1, 8),
            v_user_id, v_workspace_id, 'admin', true, 'CGW Actor');
END $$;

-- ── 1. No active framework → applied ──
DO $$
DECLARE
  v_result       JSONB;
  v_workspace_id UUID := current_setting('test.workspace_id')::uuid;
  v_actor_id     UUID := current_setting('test.actor_id')::uuid;
BEGIN
  v_result := public.cascade_gate_write(
    p_entity_type      => 'schedule_shift',
    p_entity_id        => gen_random_uuid(),
    p_action           => 'create',
    p_workspace_id     => v_workspace_id,
    p_proposed_data    => jsonb_build_object('start_time','09:00'),
    p_current_data     => '{}'::jsonb,
    p_actor_profile_id => v_actor_id,
    p_capability       => 'scheduling'
  );

  IF NOT (v_result->>'allowed')::boolean THEN
    RAISE EXCEPTION 'FAIL (1): expected allowed=true, got %', v_result;
  END IF;
  IF v_result->>'outcome' != 'applied' THEN
    RAISE EXCEPTION 'FAIL (1): expected outcome=applied, got %', v_result->>'outcome';
  END IF;
  IF v_result->>'reason' != 'no-active-framework' THEN
    RAISE EXCEPTION 'FAIL (1): expected reason=no-active-framework, got %', v_result->>'reason';
  END IF;
  IF v_result->>'proposal_id' IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL (1): expected proposal_id=NULL, got %', v_result->>'proposal_id';
  END IF;
  RAISE NOTICE 'PASS (1): no active framework → applied';
END $$;

-- ── 2. Active framework, no matching trigger → applied ──
DO $$
DECLARE
  v_result        JSONB;
  v_workspace_id  UUID := current_setting('test.workspace_id')::uuid;
  v_actor_id      UUID := current_setting('test.actor_id')::uuid;
  v_framework_id  UUID := gen_random_uuid();
  v_trigger_id    UUID := gen_random_uuid();
BEGIN
  -- Create a workspace-local framework (code must be unique globally)
  INSERT INTO regulatory_framework (framework_id, code, name, industry, is_active)
    VALUES (v_framework_id,
            'cgw.test.' || substr(v_framework_id::text, 1, 8),
            'CGW Test Framework', 'hospitality', true);

  -- One trigger that fires on 'schedule_shift' writes
  INSERT INTO framework_trigger (
    trigger_id, framework_id, code, description, trigger_mode,
    source_entity_type, is_enabled
  ) VALUES (
    v_trigger_id, v_framework_id,
    'shift_created_cgw', 'test trigger', 'state_change',
    'schedule_shift', true
  );

  -- Bind framework to workspace
  INSERT INTO workspace_framework_binding (workspace_id, framework_id, is_active)
    VALUES (v_workspace_id, v_framework_id, true);

  PERFORM set_config('test.framework_id', v_framework_id::text, false);
  PERFORM set_config('test.trigger_id',   v_trigger_id::text,   false);

  -- Call for an entity_type that has NO matching trigger
  v_result := public.cascade_gate_write(
    p_entity_type      => 'protocol',  -- not matched by any trigger
    p_entity_id        => gen_random_uuid(),
    p_action           => 'create',
    p_workspace_id     => v_workspace_id,
    p_proposed_data    => '{}'::jsonb,
    p_current_data     => '{}'::jsonb,
    p_actor_profile_id => v_actor_id,
    p_capability       => 'governance'
  );

  IF NOT (v_result->>'allowed')::boolean THEN
    RAISE EXCEPTION 'FAIL (2): expected allowed=true (no matching trigger), got %', v_result;
  END IF;
  IF v_result->>'outcome' != 'applied' THEN
    RAISE EXCEPTION 'FAIL (2): expected outcome=applied, got %', v_result->>'outcome';
  END IF;
  IF v_result->>'reason' != 'no-trigger-match' THEN
    RAISE EXCEPTION 'FAIL (2): expected reason=no-trigger-match, got %', v_result->>'reason';
  END IF;
  RAISE NOTICE 'PASS (2): active framework, no matching trigger → applied';
END $$;

-- ── 3. Active framework + matching trigger → proposed, change_proposal created ──
DO $$
DECLARE
  v_result        JSONB;
  v_workspace_id  UUID := current_setting('test.workspace_id')::uuid;
  v_actor_id      UUID := current_setting('test.actor_id')::uuid;
  v_entity_id     UUID := gen_random_uuid();
  v_proposal_id   UUID;
  v_cp_row        RECORD;
BEGIN
  v_result := public.cascade_gate_write(
    p_entity_type      => 'schedule_shift',  -- matched by our trigger
    p_entity_id        => v_entity_id,
    p_action           => 'create',
    p_workspace_id     => v_workspace_id,
    p_proposed_data    => jsonb_build_object('start_time','17:00','end_time','23:00'),
    p_current_data     => '{}'::jsonb,
    p_actor_profile_id => v_actor_id,
    p_capability       => 'scheduling'
  );

  IF (v_result->>'allowed')::boolean THEN
    RAISE EXCEPTION 'FAIL (3): expected allowed=false, got %', v_result;
  END IF;
  IF v_result->>'outcome' != 'proposed' THEN
    RAISE EXCEPTION 'FAIL (3): expected outcome=proposed, got %', v_result->>'outcome';
  END IF;
  IF v_result->>'reason' != 'framework-trigger-matched' THEN
    RAISE EXCEPTION 'FAIL (3): expected reason=framework-trigger-matched, got %', v_result->>'reason';
  END IF;
  IF v_result->>'proposal_id' IS NULL THEN
    RAISE EXCEPTION 'FAIL (3): expected proposal_id to be set, got %', v_result;
  END IF;

  v_proposal_id := (v_result->>'proposal_id')::uuid;

  SELECT * INTO v_cp_row
    FROM change_proposal
   WHERE change_proposal_id = v_proposal_id;

  IF v_cp_row IS NULL THEN
    RAISE EXCEPTION 'FAIL (3): change_proposal row not persisted for id %', v_proposal_id;
  END IF;
  IF v_cp_row.workspace_id != v_workspace_id THEN
    RAISE EXCEPTION 'FAIL (3): proposal workspace mismatch';
  END IF;
  IF v_cp_row.trigger_entity_type != 'schedule_shift' THEN
    RAISE EXCEPTION 'FAIL (3): expected trigger_entity_type=schedule_shift, got %', v_cp_row.trigger_entity_type;
  END IF;
  IF v_cp_row.trigger_entity_id != v_entity_id THEN
    RAISE EXCEPTION 'FAIL (3): trigger_entity_id mismatch';
  END IF;
  IF v_cp_row.initiated_by != v_actor_id THEN
    RAISE EXCEPTION 'FAIL (3): initiated_by mismatch';
  END IF;
  IF v_cp_row.status::text != 'pending' THEN
    RAISE EXCEPTION 'FAIL (3): expected status=pending, got %', v_cp_row.status;
  END IF;
  IF v_cp_row.policy_decision::text != 'review_required' THEN
    RAISE EXCEPTION 'FAIL (3): expected policy_decision=review_required, got %', v_cp_row.policy_decision;
  END IF;
  IF v_cp_row.framework_trigger_id IS NULL THEN
    RAISE EXCEPTION 'FAIL (3): framework_trigger_id should be populated';
  END IF;
  IF v_cp_row.approval_required IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL (3): approval_required should be true';
  END IF;

  RAISE NOTICE 'PASS (3): matching trigger → proposed, change_proposal persisted';
END $$;

-- ── 4. Disabled trigger override → treated as no-match, allowed ──
DO $$
DECLARE
  v_result        JSONB;
  v_workspace_id  UUID := current_setting('test.workspace_id')::uuid;
  v_actor_id      UUID := current_setting('test.actor_id')::uuid;
  v_trigger_id    UUID := current_setting('test.trigger_id')::uuid;
BEGIN
  -- Disable the single trigger for this workspace
  INSERT INTO workspace_trigger_override (
    workspace_id, trigger_id, is_disabled, reason
  ) VALUES (
    v_workspace_id, v_trigger_id, true, 'test: disable trigger'
  );

  v_result := public.cascade_gate_write(
    p_entity_type      => 'schedule_shift',
    p_entity_id        => gen_random_uuid(),
    p_action           => 'create',
    p_workspace_id     => v_workspace_id,
    p_proposed_data    => '{}'::jsonb,
    p_current_data     => '{}'::jsonb,
    p_actor_profile_id => v_actor_id,
    p_capability       => 'scheduling'
  );

  IF NOT (v_result->>'allowed')::boolean THEN
    RAISE EXCEPTION 'FAIL (4): expected allowed=true when trigger disabled, got %', v_result;
  END IF;
  IF v_result->>'outcome' != 'applied' THEN
    RAISE EXCEPTION 'FAIL (4): expected outcome=applied, got %', v_result->>'outcome';
  END IF;
  IF v_result->>'reason' != 'no-trigger-match' THEN
    RAISE EXCEPTION 'FAIL (4): expected reason=no-trigger-match, got %', v_result->>'reason';
  END IF;
  RAISE NOTICE 'PASS (4): disabled trigger override → no-match, applied';
END $$;

-- ── 5. Every call writes a gate_evaluation row ──
DO $$
DECLARE
  v_count        INT;
  v_workspace_id UUID := current_setting('test.workspace_id')::uuid;
BEGIN
  SELECT count(*) INTO v_count
    FROM public.gate_evaluation
   WHERE workspace_id = v_workspace_id;

  -- 4 calls above (tests 1, 2, 3, 4) should have produced 4 audit rows.
  IF v_count < 4 THEN
    RAISE EXCEPTION 'FAIL (5): expected >=4 gate_evaluation rows, got %', v_count;
  END IF;
  RAISE NOTICE 'PASS (5): gate_evaluation audit rows persisted (% rows)', v_count;
END $$;

ROLLBACK;
