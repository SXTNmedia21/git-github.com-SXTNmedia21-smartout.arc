-- pgTAP — Sortie A.3 (F-DB-12): staff_event_attendee per-verb RLS + role gate
--
-- Audit 2026-05-13 F-DB-12 (CRITICAL):
--   `jwt_write_staff_event_attendee` is a `FOR ALL USING(...)` policy with
--   no WITH CHECK clause.  staff_event_attendee has no `workspace_id`
--   column — tenancy is derived through `event_id → staff_event`.  The
--   forge surface is therefore `event_id`: pre-A.3 an attendee row's
--   event_id can be flipped to an event in another workspace, escaping
--   the source workspace's attendee list.
--
-- Sortie A.3 closes:
--   - 4 per-verb policies replace the FOR ALL.
--   - INSERT/UPDATE/DELETE gated to admin/owner/manager (role gate).
--   - WITH CHECK on INSERT + UPDATE re-validates that the new event_id
--     resolves to a staff_event in a workspace the caller belongs to.
--   - SELECT remains open to any workspace member of the parent event's
--     workspace.
--
-- Behaviour locked:
--   1. policies_are — 4 per-verb JWT policies + api_key_read.
--   2. Forge event_id on UPDATE to non-member workspace event → 42501.
--
-- Naming convention follows Sortie A.2 (jwt_<verb>_<table>).  If T1's
-- migration ships different names, T5 patches the policies_are ARRAY.
--
-- Fixtures: inline.
-- Run with: npx supabase test db
-- File:     supabase/tests/rls/audit_fdb12_staff_event_attendee.sql

BEGIN;
SELECT plan(2);

-- ── act_as helper ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.act_as(p_user_id uuid)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', p_user_id::text)::text, true);
END $$;

-- ── Fixtures ─────────────────────────────────────────────────────────────────
DO $fix$
DECLARE
  v_company_a    UUID := gen_random_uuid();
  v_company_b    UUID := gen_random_uuid();
  v_ws_a         UUID := gen_random_uuid();
  v_ws_b         UUID := gen_random_uuid();

  -- Manager in workspace A — forge actor (single-workspace, NOT a member of ws_b)
  v_mgr_user     UUID := gen_random_uuid();
  v_mgr_a        UUID := gen_random_uuid();

  -- A profile in workspace A who is the invited attendee.
  v_attendee_user UUID := gen_random_uuid();
  v_attendee_a    UUID := gen_random_uuid();

  -- A profile in workspace B (creator of the foreign event).
  v_b_user       UUID := gen_random_uuid();
  v_b_b          UUID := gen_random_uuid();

  v_event_a      UUID := gen_random_uuid();
  v_event_b      UUID := gen_random_uuid();  -- foreign event manager A is NOT entitled to see
BEGIN
  PERFORM set_config('a3sea.ws_a',          v_ws_a::text,         false);
  PERFORM set_config('a3sea.ws_b',          v_ws_b::text,         false);
  PERFORM set_config('a3sea.mgr_user',      v_mgr_user::text,     false);
  PERFORM set_config('a3sea.attendee_a',    v_attendee_a::text,   false);
  PERFORM set_config('a3sea.event_a',       v_event_a::text,      false);
  PERFORM set_config('a3sea.event_b',       v_event_b::text,      false);

  INSERT INTO auth.users (id, email, aud, role, instance_id) VALUES
    (v_mgr_user,      'a3sea-mgr+'   || substr(v_mgr_user::text, 1, 8)      || '@t.test',
     'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (v_attendee_user, 'a3sea-att+'   || substr(v_attendee_user::text, 1, 8) || '@t.test',
     'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (v_b_user,        'a3sea-bmgr+'  || substr(v_b_user::text, 1, 8)        || '@t.test',
     'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  INSERT INTO company (company_id, name) VALUES
    (v_company_a, 'A3 SEA Test Co A'),
    (v_company_b, 'A3 SEA Test Co B');

  INSERT INTO workspace (workspace_id, company_id, name, slug) VALUES
    (v_ws_a, v_company_a, 'A3 SEA WS A', 'a3sea-a-' || substr(v_ws_a::text, 1, 8)),
    (v_ws_b, v_company_b, 'A3 SEA WS B', 'a3sea-b-' || substr(v_ws_b::text, 1, 8));

  INSERT INTO profile (profile_id, profile_code, user_id, workspace_id, role, is_active, display_name) VALUES
    (v_mgr_a,      'a3sea-mgr-a-' || substr(v_mgr_a::text, 1, 6),      v_mgr_user,      v_ws_a, 'manager',  true, 'A3SEA Manager in A'),
    (v_attendee_a, 'a3sea-att-a-' || substr(v_attendee_a::text, 1, 6), v_attendee_user, v_ws_a, 'employee', true, 'A3SEA Attendee in A'),
    (v_b_b,        'a3sea-mgr-b-' || substr(v_b_b::text, 1, 6),        v_b_user,        v_ws_b, 'manager',  true, 'A3SEA Manager in B');

  -- Pre-existing event in workspace A (mgr_a is creator).
  INSERT INTO staff_event (
    event_id, workspace_id, event_type, title, starts_at, ends_at, created_by
  ) VALUES (
    v_event_a, v_ws_a, 'personalmote', 'Event in A',
    now() + interval '1 day', now() + interval '1 day' + interval '1 hour',
    v_mgr_a
  );

  -- Foreign event in workspace B — mgr_a is NOT a member.
  INSERT INTO staff_event (
    event_id, workspace_id, event_type, title, starts_at, ends_at, created_by
  ) VALUES (
    v_event_b, v_ws_b, 'personalmote', 'Event in B (foreign)',
    now() + interval '2 days', now() + interval '2 days' + interval '1 hour',
    v_b_b
  );

  -- Pre-existing attendee row on event_a (target of forge UPDATE).
  INSERT INTO staff_event_attendee (
    event_id, profile_id, status
  ) VALUES (
    v_event_a, v_attendee_a, 'invited'
  );
END $fix$;

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 1: policies_are
-- ═════════════════════════════════════════════════════════════════════════════
-- Pre-Sortie state: jwt_read_staff_event_attendee + jwt_write_staff_event_attendee
-- (FOR ALL, no WITH CHECK) + api_key_read_staff_event_attendee.
-- Sortie A.3 replaces jwt_write_staff_event_attendee with 3 per-verb policies
-- (insert/update/delete) carrying role gate AND WITH CHECK on event_id
-- resolution.  Preserves jwt_read_staff_event_attendee for SELECT.
-- Load-bearing invariant: jwt_write_staff_event_attendee must NOT appear.
-- Note: T5 may patch ARRAY if T1 ships slightly different names.
SELECT policies_are(
  'public',
  'staff_event_attendee',
  ARRAY[
    'jwt_read_staff_event_attendee',
    'jwt_insert_staff_event_attendee',
    'jwt_update_staff_event_attendee',
    'jwt_delete_staff_event_attendee',
    'api_key_read_staff_event_attendee'
  ],
  'staff_event_attendee: jwt_write replaced by per-verb policies with role gate + WITH CHECK; jwt_read + api_key_read preserved (Sortie A naming convention)'
);

-- ═════════════════════════════════════════════════════════════════════════════
-- Test 2: forge event_id on UPDATE → 42501
-- ═════════════════════════════════════════════════════════════════════════════
-- Manager in workspace A attempts UPDATE flipping event_id from event_a
-- (workspace A) to event_b (workspace B, manager A is NOT a member).
-- USING passes (event_a is in caller's workspace); WITH CHECK rejects
-- because the new event_id resolves to a staff_event in ws_b — outside
-- get_workspace_ids_for_user(auth.uid()).  This is the workspace-forge
-- analog for the attendee table (no direct workspace_id column).
DO $set$
BEGIN
  PERFORM pg_temp.act_as(current_setting('a3sea.mgr_user')::uuid);
END $set$;

SET LOCAL ROLE authenticated;

SELECT throws_ok(
  format(
    $$UPDATE public.staff_event_attendee
         SET event_id = %L::uuid
       WHERE event_id   = %L::uuid
         AND profile_id = %L::uuid$$,
    current_setting('a3sea.event_b'),
    current_setting('a3sea.event_a'),
    current_setting('a3sea.attendee_a')
  ),
  '42501',
  NULL,
  'forge: single-workspace manager cannot flip staff_event_attendee.event_id to event in non-member workspace (WITH CHECK rejects via parent join)'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
