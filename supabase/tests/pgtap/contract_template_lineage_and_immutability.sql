-- ============================================
-- supabase/tests/pgtap/contract_template_lineage_and_immutability.sql
--
-- Council 2026-04-22, Gates G3 + G5.
--
-- Locks in the Phase 1 schema for contract_template:
--   1. Five lineage/lifecycle columns exist with correct type + nullability
--   2. source_implies_forked CHECK rejects the partial-derivation trap
--   3. source_template_id FK → contract_template(template_id) is ON DELETE SET NULL
--   4. BEFORE UPDATE trigger on is_system exists and raises on flip
--   5. Workspace admin CANNOT UPDATE a system template under RLS
--   6. Platform godmode CAN UPDATE a system template under RLS
--   7. Workspace admin CAN UPDATE their own is_system=false template
--
-- Run with:
--   psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--        --set ON_ERROR_STOP=1 \
--        -f supabase/tests/pgtap/contract_template_lineage_and_immutability.sql
-- ============================================

BEGIN;
SELECT plan(18);

-- ─────────────────────────────────────────────
-- Section 1: column shape (5 new columns × 2 assertions each = 10)
-- ─────────────────────────────────────────────

SELECT has_column(
  'public', 'contract_template', 'source_template_id',
  'contract_template.source_template_id exists'
);
SELECT col_type_is(
  'public', 'contract_template', 'source_template_id', 'uuid',
  'source_template_id is uuid'
);

SELECT has_column(
  'public', 'contract_template', 'source_template_version',
  'contract_template.source_template_version exists'
);
SELECT col_type_is(
  'public', 'contract_template', 'source_template_version', 'text',
  'source_template_version is text'
);

SELECT has_column(
  'public', 'contract_template', 'forked_at',
  'contract_template.forked_at exists'
);
SELECT col_type_is(
  'public', 'contract_template', 'forked_at', 'timestamp with time zone',
  'forked_at is timestamptz'
);

SELECT has_column(
  'public', 'contract_template', 'published_at',
  'contract_template.published_at exists'
);
SELECT col_type_is(
  'public', 'contract_template', 'published_at', 'timestamp with time zone',
  'published_at is timestamptz'
);

SELECT has_column(
  'public', 'contract_template', 'deprecated_at',
  'contract_template.deprecated_at exists'
);
SELECT col_type_is(
  'public', 'contract_template', 'deprecated_at', 'timestamp with time zone',
  'deprecated_at is timestamptz'
);

-- ─────────────────────────────────────────────
-- Section 2: CHECK constraint + FK + trigger (3)
-- ─────────────────────────────────────────────

-- CHECK: source_implies_forked exists on the table
SELECT ok(
  (SELECT count(*)::int
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'contract_template'
      AND c.conname = 'contract_template_source_implies_forked'
      AND c.contype = 'c') = 1,
  'CHECK constraint contract_template_source_implies_forked exists'
);

-- FK: source_template_id → contract_template(template_id), ON DELETE SET NULL
SELECT ok(
  (SELECT count(*)::int
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'contract_template'
      AND c.conname = 'contract_template_source_fk'
      AND c.contype = 'f'
      AND c.confdeltype = 'n') = 1,
  'FK contract_template_source_fk exists with ON DELETE SET NULL'
);

-- Trigger: BEFORE UPDATE on is_system
SELECT ok(
  (SELECT count(*)::int
     FROM pg_trigger tg
     JOIN pg_class t ON t.oid = tg.tgrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'contract_template'
      AND tg.tgname = 'contract_template_is_system_immutable'
      AND NOT tg.tgisinternal) = 1,
  'BEFORE UPDATE trigger contract_template_is_system_immutable exists'
);

-- ─────────────────────────────────────────────
-- Section 3: behavioural — CHECK enforcement + is_system immutability (2)
-- ─────────────────────────────────────────────

-- CHECK rejects source_template_id IS NOT NULL AND forked_at IS NULL.
-- We use a DO block so we can catch the exception cleanly.
SELECT throws_ok(
  $sql$
    INSERT INTO public.contract_template
      (name, contract_type, language, placeholders, is_system,
       source_template_id, forked_at)
    VALUES
      ('bad-fork', 'employee', 'no', '[]'::jsonb, false,
       gen_random_uuid(), NULL)
  $sql$,
  '23514',
  NULL,
  'CHECK rejects source_template_id without forked_at'
);

-- Trigger blocks is_system flip.
DO $setup$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.contract_template (name, contract_type, language, placeholders, is_system)
  VALUES ('immutability-fixture', 'employee', 'no', '[]'::jsonb, false)
  RETURNING template_id INTO v_id;
  PERFORM set_config('test.imm_id', v_id::text, false);
END $setup$;

SELECT throws_ok(
  format(
    $sql$UPDATE public.contract_template SET is_system = true WHERE template_id = %L$sql$,
    current_setting('test.imm_id')
  ),
  'P0001',
  NULL,
  'is_system flip false→true is blocked by trigger'
);

-- ─────────────────────────────────────────────
-- Section 4: RLS — workspace admin vs platform godmode (3)
-- ─────────────────────────────────────────────

-- Build fixtures: a godmode user, a workspace admin, a workspace, a system
-- template, and a workspace template in that workspace.
DO $rls_setup$
DECLARE
  v_company_id   UUID := gen_random_uuid();
  v_ws_id        UUID := gen_random_uuid();
  v_godmode_user UUID := gen_random_uuid();
  v_admin_user   UUID := gen_random_uuid();
  v_admin_prof   UUID := gen_random_uuid();
  v_sys_tpl      UUID;
  v_ws_tpl       UUID;
BEGIN
  -- auth.users
  INSERT INTO auth.users (id, email, aud, role, instance_id) VALUES
    (v_godmode_user, 'god+' || v_godmode_user || '@t.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (v_admin_user,   'adm+' || v_admin_user   || '@t.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  -- user_identity — godmode flag (email/first_name/last_name are NOT NULL)
  INSERT INTO public.user_identity (user_id, email, first_name, last_name, is_godmode)
    VALUES (v_godmode_user, 'god+' || v_godmode_user || '@t.test', 'God', 'Mode', true)
    ON CONFLICT (user_id) DO UPDATE SET is_godmode = true;
  INSERT INTO public.user_identity (user_id, email, first_name, last_name, is_godmode)
    VALUES (v_admin_user, 'adm+' || v_admin_user || '@t.test', 'Admin', 'User', false)
    ON CONFLICT (user_id) DO UPDATE SET is_godmode = false;

  -- company + workspace
  INSERT INTO public.company (company_id, name) VALUES
    (v_company_id, 'Lineage Test Co ' || substr(v_company_id::text, 1, 6));

  INSERT INTO public.workspace (workspace_id, company_id, name, slug) VALUES
    (v_ws_id, v_company_id, 'Lineage WS', 'lineage-' || substr(v_ws_id::text, 1, 8));

  -- profile — admin in that workspace (role='admin' so is_admin_in_workspace holds)
  INSERT INTO public.profile (profile_id, profile_code, user_id, workspace_id, role, is_active, display_name)
  VALUES (v_admin_prof, 'lin-adm-' || substr(v_admin_prof::text, 1, 6),
          v_admin_user, v_ws_id, 'admin', true, 'Lineage Admin');

  -- system template (K1a)
  INSERT INTO public.contract_template (name, contract_type, language, placeholders, is_system, workspace_id)
  VALUES ('rls-system-tpl', 'employee', 'no', '[]'::jsonb, true, NULL)
  RETURNING template_id INTO v_sys_tpl;

  -- workspace template (K1b) — insert BEFORE we lower to `authenticated` role.
  INSERT INTO public.contract_template (name, contract_type, language, placeholders, is_system, workspace_id)
  VALUES ('rls-ws-tpl', 'employee', 'no', '[]'::jsonb, false, v_ws_id)
  RETURNING template_id INTO v_ws_tpl;

  PERFORM set_config('test.godmode_user', v_godmode_user::text, false);
  PERFORM set_config('test.admin_user',   v_admin_user::text,   false);
  PERFORM set_config('test.sys_tpl',      v_sys_tpl::text,      false);
  PERFORM set_config('test.ws_tpl',       v_ws_tpl::text,       false);
END $rls_setup$;

-- Helper: act as a given user via JWT claim + `authenticated` role.
CREATE OR REPLACE FUNCTION pg_temp.act_as(p_user_id uuid)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', p_user_id::text)::text, true);
END $$;

-- ── Test 5: workspace admin CANNOT update a system template ──
-- UPDATE returning 0 rows (RLS silently filters) is the expected outcome.
DO $$
DECLARE
  v_admin_user UUID := current_setting('test.admin_user')::uuid;
  v_sys_tpl    UUID := current_setting('test.sys_tpl')::uuid;
  v_affected   INT;
BEGIN
  PERFORM pg_temp.act_as(v_admin_user);
  SET LOCAL ROLE authenticated;

  WITH upd AS (
    UPDATE public.contract_template
       SET description = 'workspace-admin-tried'
     WHERE template_id = v_sys_tpl
     RETURNING 1
  )
  SELECT count(*)::int INTO v_affected FROM upd;

  RESET ROLE;
  PERFORM set_config('test.t5_affected', v_affected::text, false);
END $$;

SELECT is(
  current_setting('test.t5_affected')::int,
  0,
  'workspace admin cannot UPDATE a system template (RLS filters 0 rows)'
);

-- ── Test 6: platform godmode CAN update a system template ──
DO $$
DECLARE
  v_godmode_user UUID := current_setting('test.godmode_user')::uuid;
  v_sys_tpl      UUID := current_setting('test.sys_tpl')::uuid;
  v_affected     INT;
BEGIN
  PERFORM pg_temp.act_as(v_godmode_user);
  SET LOCAL ROLE authenticated;

  WITH upd AS (
    UPDATE public.contract_template
       SET description = 'godmode-updated'
     WHERE template_id = v_sys_tpl
     RETURNING 1
  )
  SELECT count(*)::int INTO v_affected FROM upd;

  RESET ROLE;
  PERFORM set_config('test.t6_affected', v_affected::text, false);
END $$;

SELECT is(
  current_setting('test.t6_affected')::int,
  1,
  'platform godmode can UPDATE a system template'
);

-- ── Test 7: workspace admin CAN update their own is_system=false template ──
DO $$
DECLARE
  v_admin_user UUID := current_setting('test.admin_user')::uuid;
  v_ws_tpl     UUID := current_setting('test.ws_tpl')::uuid;
  v_affected   INT;
BEGIN
  PERFORM pg_temp.act_as(v_admin_user);
  SET LOCAL ROLE authenticated;

  WITH upd AS (
    UPDATE public.contract_template
       SET description = 'workspace-admin-own-update'
     WHERE template_id = v_ws_tpl
     RETURNING 1
  )
  SELECT count(*)::int INTO v_affected FROM upd;

  RESET ROLE;
  PERFORM set_config('test.t7_affected', v_affected::text, false);
END $$;

SELECT is(
  current_setting('test.t7_affected')::int,
  1,
  'workspace admin can UPDATE their own is_system=false workspace template'
);

SELECT * FROM finish();
ROLLBACK;
