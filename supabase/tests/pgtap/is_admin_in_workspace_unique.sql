-- ============================================
-- supabase/tests/pgtap/is_admin_in_workspace_unique.sql
--
-- Invariant lock for the `is_admin_in_workspace` helper.
--
-- Why: council 2026-04-22 Gate G1 caught two RLS policies calling this
-- function with inverted arguments. Because both parameters are `uuid`,
-- Postgres implicit-resolution treated the inverted call as valid and the
-- bug only showed up as "admins silently denied" in contract flows.
--
-- This test locks in two invariants so future migrations cannot regress:
--   1. Exactly ONE function named `public.is_admin_in_workspace` exists.
--   2. Its identity signature is `uid uuid, wid uuid` — in that order.
--
-- Run with:
--   psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--        --set ON_ERROR_STOP=1 \
--        -f supabase/tests/pgtap/is_admin_in_workspace_unique.sql
-- ============================================

BEGIN;
SELECT plan(4);

-- ── 1. Function exists ──
SELECT has_function(
  'public', 'is_admin_in_workspace', ARRAY['uuid', 'uuid'],
  'public.is_admin_in_workspace(uuid, uuid) must exist'
);

-- ── 2. Return type is boolean ──
SELECT is(
  pg_catalog.pg_get_function_result(
    (SELECT p.oid
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'is_admin_in_workspace'
        AND n.nspname = 'public'
      LIMIT 1)
  ),
  'boolean',
  'is_admin_in_workspace returns boolean'
);

-- ── 3. Exactly one signature exists (no overloads) ──
SELECT is(
  (SELECT count(*)::int
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'is_admin_in_workspace'
      AND n.nspname = 'public'),
  1,
  'exactly one public.is_admin_in_workspace signature exists (no overloads)'
);

-- ── 4. Canonical argument order: (uid, wid) ──
-- Parameter names matter because the function body references them by
-- name: `WHERE user_id = uid AND workspace_id = wid`. An overload with
-- (wid, uid) would silently invert the predicate.
SELECT is(
  (SELECT pg_get_function_identity_arguments(p.oid)
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'is_admin_in_workspace'
      AND n.nspname = 'public'
    LIMIT 1),
  'uid uuid, wid uuid',
  'canonical signature is (uid uuid, wid uuid) — auth.uid() first, workspace_id second'
);

SELECT * FROM finish();
ROLLBACK;
