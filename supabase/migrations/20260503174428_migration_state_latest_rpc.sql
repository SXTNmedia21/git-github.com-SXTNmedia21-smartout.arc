-- ============================================
-- migration_state_latest — RPC for CI migration drift detection
--
-- Returns the timestamp prefix of the last applied migration in the
-- supabase_migrations.schema_migrations table. Used by the
-- `Migration State` CI job (ADR-0265) on main push to detect
-- MIGRATIONS_FAILED states early.
--
-- Returns empty string if no migrations applied yet.
-- ============================================

CREATE OR REPLACE FUNCTION public.migration_state_latest()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, supabase_migrations
AS $$
  SELECT COALESCE(MAX(version)::text, '')
  FROM supabase_migrations.schema_migrations;
$$;

REVOKE ALL ON FUNCTION public.migration_state_latest() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.migration_state_latest() TO service_role;

COMMENT ON FUNCTION public.migration_state_latest() IS
  'Returns last applied migration timestamp (YYYYMMDDHHMMSS). Used by CI Migration State gate (ADR-0265). service_role only.';
