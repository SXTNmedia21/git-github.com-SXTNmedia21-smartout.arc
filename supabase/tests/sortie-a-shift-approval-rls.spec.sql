-- pgTAP regression: shift_approval UPDATE RLS invariants (Sortie A / ADR-0299)
--
-- Tests the new jwt_update_shift_approval policy from
-- 20260605120000_shift_approval_rls_with_check.sql.  The previous
-- jwt_manage_shift_approval FOR ALL policy had no WITH CHECK clause —
-- this spec locks the replacement behaviour.
--
-- R1 NOTE (spec §8): approve_shift tool uses ctx.supabaseAdmin (service_role)
-- and therefore bypasses RLS entirely.  Positive cases P1/P2/P3 are simulated
-- via direct JWT-authenticated PostgREST-style SET LOCAL ROLE authenticated,
-- NOT by exercising the tool code path.
--
-- Positive cases (must PASS RLS — rows are updated):
--   P1: admin in workspace updates pending → approved
--   P2: manager in workspace updates pending → approved (R1: JWT simulation)
--   P3: shift owner (employee) updates own pending row (forward-compat branch)
--
-- Negative cases (must fail RLS — no rows affected or exception):
--   N1: non-workspace-member user updates row → reject (USING fails)
--   N2: workspace member with role=employee AND not shift owner → reject
--   N3: caller tries to flip workspace_id to foreign workspace → reject (WITH CHECK)
--   N4: caller tries to UPDATE row owned by another workspace → reject (USING)
--
-- Run with:
--   psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--        -f supabase/tests/sortie-a-shift-approval-rls.spec.sql

BEGIN;

-- ── Fixtures ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_company_a        UUID := gen_random_uuid();
  v_company_b        UUID := gen_random_uuid();
  v_ws_a             UUID := gen_random_uuid();
  v_ws_b             UUID := gen_random_uuid();
  v_dept_a           UUID := gen_random_uuid();

  v_admin_user       UUID := gen_random_uuid();
  v_manager_user     UUID := gen_random_uuid();
  v_employee_user    UUID := gen_random_uuid();  -- shift owner
  v_bystander_user   UUID := gen_random_uuid();  -- employee in ws_a but NOT owner of v_shift
  v_outsider_user    UUID := gen_random_uuid();  -- not a member of ws_a at all

  v_admin_prof       UUID := gen_random_uuid();
  v_manager_prof     UUID := gen_random_uuid();
  v_employee_prof    UUID := gen_random_uuid();
  v_bystander_prof   UUID := gen_random_uuid();

  v_recon_a          UUID := gen_random_uuid();
  v_shift_a          UUID := gen_random_uuid();
  v_approval_a       UUID := gen_random_uuid();

  -- A row owned by ws_b — used for cross-workspace attack tests
  v_recon_b          UUID := gen_random_uuid();
  v_shift_b          UUID := gen_random_uuid();
  v_dept_b           UUID := gen_random_uuid();
  v_approval_b       UUID := gen_random_uuid();
BEGIN
  -- Persist IDs in session config so DO blocks below can read them.
  PERFORM set_config('srt.ws_a',           v_ws_a::text,           false);
  PERFORM set_config('srt.ws_b',           v_ws_b::text,           false);
  PERFORM set_config('srt.admin_user',     v_admin_user::text,     false);
  PERFORM set_config('srt.manager_user',   v_manager_user::text,   false);
  PERFORM set_config('srt.employee_user',  v_employee_user::text,  false);
  PERFORM set_config('srt.bystander_user', v_bystander_user::text, false);
  PERFORM set_config('srt.outsider_user',  v_outsider_user::text,  false);
  PERFORM set_config('srt.employee_prof',  v_employee_prof::text,  false);
  PERFORM set_config('srt.approval_a',     v_approval_a::text,     false);
  PERFORM set_config('srt.approval_b',     v_approval_b::text,     false);

  -- auth.users
  INSERT INTO auth.users (id, email, aud, role, instance_id) VALUES
    (v_admin_user,     'srt-admin+'     || substr(v_admin_user::text,    1,8) || '@t.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (v_manager_user,   'srt-manager+'   || substr(v_manager_user::text,  1,8) || '@t.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (v_employee_user,  'srt-employee+'  || substr(v_employee_user::text, 1,8) || '@t.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (v_bystander_user, 'srt-bystander+' || substr(v_bystander_user::text,1,8) || '@t.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (v_outsider_user,  'srt-outsider+'  || substr(v_outsider_user::text, 1,8) || '@t.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  -- companies + workspaces
  INSERT INTO company (company_id, name) VALUES
    (v_company_a, 'Sortie A Test Co A'),
    (v_company_b, 'Sortie A Test Co B');

  INSERT INTO workspace (workspace_id, company_id, name, slug) VALUES
    (v_ws_a, v_company_a, 'SA WS A', 'sa-a-' || substr(v_ws_a::text, 1, 8)),
    (v_ws_b, v_company_b, 'SA WS B', 'sa-b-' || substr(v_ws_b::text, 1, 8));

  INSERT INTO department (department_id, workspace_id, name, slug) VALUES
    (v_dept_a, v_ws_a, 'Bar A', 'bar-sa-a-' || substr(v_dept_a::text, 1, 6)),
    (v_dept_b, v_ws_b, 'Bar B', 'bar-sa-b-' || substr(v_dept_b::text, 1, 6));

  -- profiles: admin + manager + employee (shift owner) + bystander — all in ws_a
  INSERT INTO profile (profile_id, profile_code, user_id, workspace_id, role, is_active, display_name) VALUES
    (v_admin_prof,     'sa-admin-'     || substr(v_admin_prof::text,     1,6), v_admin_user,     v_ws_a, 'admin',    true, 'SA Admin'),
    (v_manager_prof,   'sa-manager-'   || substr(v_manager_prof::text,   1,6), v_manager_user,   v_ws_a, 'manager',  true, 'SA Manager'),
    (v_employee_prof,  'sa-employee-'  || substr(v_employee_prof::text,  1,6), v_employee_user,  v_ws_a, 'employee', true, 'SA Employee (owner)'),
    (v_bystander_prof, 'sa-bystander-' || substr(v_bystander_prof::text, 1,6), v_bystander_user, v_ws_a, 'employee', true, 'SA Bystander');

  -- shifts: v_shift_a in ws_a (owned by v_employee_prof), v_shift_b in ws_b
  INSERT INTO schedule_shift (
    schedule_shift_id, workspace_id, department_id, employee_id,
    shift_date, role, start_time, end_time, work_hours, day_category, status
  ) VALUES
    (v_shift_a, v_ws_a, v_dept_a, v_employee_prof, DATE '2030-07-01',
     'bartender', TIME '16:00', TIME '23:00', 7.0, 'evening'::day_category, 'published'),
    (v_shift_b, v_ws_b, v_dept_b, NULL,             DATE '2030-07-01',
     'bartender', TIME '16:00', TIME '23:00', 7.0, 'evening'::day_category, 'published');

  -- reconciliations
  INSERT INTO daily_reconciliation (reconciliation_id, workspace_id, department_id, reconciliation_date, status) VALUES
    (v_recon_a, v_ws_a, v_dept_a, DATE '2030-07-01', 'open'),
    (v_recon_b, v_ws_b, v_dept_b, DATE '2030-07-01', 'open');

  -- shift_approval rows: one in ws_a (status=pending), one in ws_b
  INSERT INTO shift_approval (
    approval_id, reconciliation_id, shift_id, workspace_id,
    planned_hours, calculated_hours, approved_hours, status
  ) VALUES
    (v_approval_a, v_recon_a, v_shift_a, v_ws_a, 7.0, 7.0, NULL, 'pending'),
    (v_approval_b, v_recon_b, v_shift_b, v_ws_b, 7.0, 7.0, NULL, 'pending');
END $$;

-- ── Helper: simulate an authenticated JWT caller ───────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.act_as(p_user_id uuid)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', p_user_id::text)::text, true);
END $$;

-- ── Helper: reset a shift_approval row back to 'pending' so cases are independent ──
CREATE OR REPLACE FUNCTION pg_temp.reset_approval(p_approval_id uuid)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE shift_approval
     SET status          = 'pending',
         approved_hours  = NULL,
         approved_by     = NULL,
         updated_at      = now()
   WHERE approval_id = p_approval_id;
END $$;

-- ── P1: admin updates pending → approved ─────────────────────────────────────
DO $$
DECLARE
  v_admin_user UUID := current_setting('srt.admin_user')::uuid;
  v_approval_a UUID := current_setting('srt.approval_a')::uuid;
  v_rows       INT;
  v_status     TEXT;
BEGIN
  -- R1: simulate JWT path (tool uses service_role in prod — this tests the policy directly)
  PERFORM pg_temp.act_as(v_admin_user);
  SET LOCAL ROLE authenticated;

  UPDATE shift_approval
     SET status = 'approved', approved_hours = 7.0, updated_at = now()
   WHERE approval_id = v_approval_a;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RESET ROLE;

  IF v_rows != 1 THEN
    RAISE EXCEPTION 'FAIL P1: admin UPDATE expected 1 row affected, got % (RLS blocked unexpectedly)', v_rows;
  END IF;

  SELECT status::text INTO v_status FROM shift_approval WHERE approval_id = v_approval_a;
  IF v_status != 'approved' THEN
    RAISE EXCEPTION 'FAIL P1: expected status=approved after update, got %', v_status;
  END IF;

  PERFORM pg_temp.reset_approval(v_approval_a);
  RAISE NOTICE 'PASS P1: admin can UPDATE shift_approval in own workspace';
END $$;

-- ── P2: manager updates pending → approved (JWT simulation per R1) ────────────
DO $$
DECLARE
  v_manager_user UUID := current_setting('srt.manager_user')::uuid;
  v_approval_a   UUID := current_setting('srt.approval_a')::uuid;
  v_rows         INT;
BEGIN
  -- R1 RESHAPE: approve_shift tool uses ctx.supabaseAdmin (service_role), bypassing RLS.
  -- This positive case directly exercises the JWT-authenticated policy predicate,
  -- simulating a hypothetical future code path where a manager-tier JWT caller
  -- updates shift_approval directly via PostgREST (not through the agent tool).
  -- Verifies the manager-EXISTS branch of jwt_update_shift_approval USING + WITH CHECK.
  PERFORM pg_temp.act_as(v_manager_user);
  SET LOCAL ROLE authenticated;

  UPDATE shift_approval
     SET status = 'approved', approved_hours = 7.0, updated_at = now()
   WHERE approval_id = v_approval_a;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RESET ROLE;

  IF v_rows != 1 THEN
    RAISE EXCEPTION 'FAIL P2: manager UPDATE expected 1 row affected, got % (manager branch of RLS blocked)', v_rows;
  END IF;

  PERFORM pg_temp.reset_approval(v_approval_a);
  RAISE NOTICE 'PASS P2: manager JWT can UPDATE shift_approval (hypothetical direct-PostgREST path)';
END $$;

-- ── P3: shift owner (employee) updates own pending row (forward-compat branch) ──
DO $$
DECLARE
  v_employee_user UUID := current_setting('srt.employee_user')::uuid;
  v_approval_a    UUID := current_setting('srt.approval_a')::uuid;
  v_rows          INT;
BEGIN
  PERFORM pg_temp.act_as(v_employee_user);
  SET LOCAL ROLE authenticated;

  UPDATE shift_approval
     SET status = 'pending', updated_at = now()  -- employee only annotates, not approves
   WHERE approval_id = v_approval_a;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RESET ROLE;

  IF v_rows != 1 THEN
    RAISE EXCEPTION 'FAIL P3: shift owner UPDATE expected 1 row affected, got % (employee-owner branch blocked)', v_rows;
  END IF;

  RAISE NOTICE 'PASS P3: shift owner (employee) can UPDATE own shift_approval row (forward-compat)';
END $$;

-- ── N1: outsider (no workspace membership) → reject ──────────────────────────
DO $$
DECLARE
  v_outsider_user UUID := current_setting('srt.outsider_user')::uuid;
  v_approval_a    UUID := current_setting('srt.approval_a')::uuid;
  v_rows          INT;
BEGIN
  PERFORM pg_temp.act_as(v_outsider_user);
  SET LOCAL ROLE authenticated;

  UPDATE shift_approval
     SET status = 'approved', updated_at = now()
   WHERE approval_id = v_approval_a;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RESET ROLE;

  IF v_rows != 0 THEN
    RAISE EXCEPTION 'FAIL N1: outsider UPDATE expected 0 rows (USING reject), got %', v_rows;
  END IF;
  RAISE NOTICE 'PASS N1: outsider gets 0 rows — non-member blocked by USING predicate';
END $$;

-- ── N2: bystander (employee in workspace, NOT shift owner) → reject ───────────
DO $$
DECLARE
  v_bystander_user UUID := current_setting('srt.bystander_user')::uuid;
  v_approval_a     UUID := current_setting('srt.approval_a')::uuid;
  v_rows           INT;
BEGIN
  PERFORM pg_temp.act_as(v_bystander_user);
  SET LOCAL ROLE authenticated;

  UPDATE shift_approval
     SET status = 'approved', updated_at = now()
   WHERE approval_id = v_approval_a;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RESET ROLE;

  IF v_rows != 0 THEN
    RAISE EXCEPTION 'FAIL N2: bystander-employee UPDATE expected 0 rows (not shift owner), got %', v_rows;
  END IF;
  RAISE NOTICE 'PASS N2: non-owner employee blocked — neither manager branch nor owner branch passes';
END $$;

-- ── N3: caller tries to flip workspace_id to foreign workspace (WITH CHECK) ───
DO $$
DECLARE
  v_admin_user UUID := current_setting('srt.admin_user')::uuid;
  v_ws_b       UUID := current_setting('srt.ws_b')::uuid;
  v_approval_a UUID := current_setting('srt.approval_a')::uuid;
  v_rows       INT;
  v_ws_after   UUID;
BEGIN
  PERFORM pg_temp.act_as(v_admin_user);
  SET LOCAL ROLE authenticated;

  BEGIN
    UPDATE shift_approval
       SET workspace_id = v_ws_b, updated_at = now()
     WHERE approval_id = v_approval_a;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION
    WHEN others THEN
      -- RLS violation surfaces as exception in some Postgres versions
      v_rows := 0;
  END;

  RESET ROLE;

  -- Either rows=0 (no-rows-affected) or the workspace_id was not flipped.
  SELECT workspace_id INTO v_ws_after FROM shift_approval WHERE approval_id = v_approval_a;
  IF v_ws_after = v_ws_b THEN
    RAISE EXCEPTION 'FAIL N3: workspace_id was flipped to foreign workspace — WITH CHECK not enforced';
  END IF;
  RAISE NOTICE 'PASS N3: workspace_id flip to foreign workspace blocked (WITH CHECK holds), rows_affected=%', v_rows;
END $$;

-- ── N4: caller updates row from another workspace (USING) ─────────────────────
DO $$
DECLARE
  v_admin_user UUID := current_setting('srt.admin_user')::uuid;  -- member of ws_a only
  v_approval_b UUID := current_setting('srt.approval_b')::uuid;  -- row owned by ws_b
  v_rows       INT;
BEGIN
  PERFORM pg_temp.act_as(v_admin_user);
  SET LOCAL ROLE authenticated;

  UPDATE shift_approval
     SET status = 'approved', updated_at = now()
   WHERE approval_id = v_approval_b;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RESET ROLE;

  IF v_rows != 0 THEN
    RAISE EXCEPTION 'FAIL N4: cross-workspace UPDATE expected 0 rows (USING reject), got %', v_rows;
  END IF;
  RAISE NOTICE 'PASS N4: cross-workspace row update blocked by USING (tenant isolation)';
END $$;

ROLLBACK;
