-- billing_settlement_bucket.test.sql
--
-- Asserts that the "settlement-artifacts" Storage bucket is declaratively
-- provisioned by migration 20260522010000 and that the mime_type column
-- exists on billing.settlement_artifact with the correct NOT NULL constraint.
--
-- Run with:
--   psql "postgresql://postgres:postgres@localhost:54322/postgres" \
--        -f supabase/tests/billing_settlement_bucket.test.sql

BEGIN;
SELECT plan(5);

-- 1. Bucket exists
SELECT ok(
  EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'settlement-artifacts'),
  'settlement-artifacts bucket exists'
);

-- 2. Bucket is private
SELECT is(
  (SELECT public FROM storage.buckets WHERE id = 'settlement-artifacts'),
  false,
  'settlement-artifacts bucket is private (downloads via signed URL only)'
);

-- 3. Allowed mime types include both PDF and CSV
SELECT ok(
  (SELECT 'application/pdf' = ANY(allowed_mime_types) AND 'text/csv' = ANY(allowed_mime_types)
   FROM storage.buckets WHERE id = 'settlement-artifacts'),
  'allowed_mime_types contains application/pdf + text/csv'
);

-- 4. mime_type column exists + NOT NULL
SELECT col_not_null(
  'billing'::name,
  'settlement_artifact'::name,
  'mime_type'::name,
  'settlement_artifact.mime_type is NOT NULL'
);

-- 5. RLS policy exists
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'settlement_artifacts_service_role_write'
  ),
  'settlement_artifacts_service_role_write policy exists'
);

SELECT * FROM finish();
ROLLBACK;
