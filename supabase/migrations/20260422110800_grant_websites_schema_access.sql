-- ============================================
-- 20260422110800_grant_websites_schema_access.sql
-- Grant Supabase roles access to the websites schema.
-- Why: local and server-role clients need schema/table privileges
-- in addition to RLS policies for website factory operations.
-- ============================================

GRANT USAGE ON SCHEMA websites TO authenticated;
GRANT USAGE ON SCHEMA websites TO anon;
GRANT USAGE ON SCHEMA websites TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA websites TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA websites TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA websites TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA websites
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA websites
  GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA websites
  GRANT ALL ON TABLES TO service_role;
