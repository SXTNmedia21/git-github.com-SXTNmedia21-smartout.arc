-- ============================================================================
-- supabase/tests/pgtap/billing_settlement/schema_objects.spec.sql
--
-- Verifies settlement schema objects exist with correct properties.
-- Catalog-only checks — no live data inserts.
--
-- Tests (36 total):
--   1.    billing.settlement_status enum exists
--   2-4.  Enum values: open, locked, closed
--   5.    billing.settlement_run_status enum exists
--   6-9.  Enum values: running, succeeded, failed, cancelled
--   10.   billing.settlement_artifact_type enum exists
--   11-14. Enum values: summary_pdf, detail_csv, invoice_bundle_pdf, discrepancy_pdf
--   15.   billing.settlement_scope enum exists
--   16-17. Enum values: single_workspace, all_workspaces
--   18.   billing.settlement_period table exists
--   19.   settlement_period PK on period_id
--   20.   settlement_period UNIQUE(workspace_id, period_start, period_end)
--   21.   settlement_period.status column not null
--   22.   settlement_period.created_at column not null
--   23.   settlement_period.updated_at column not null
--   24.   billing.settlement_run table exists
--   25.   settlement_run PK on run_id
--   26.   settlement_run.workspace_ids column exists
--   27.   settlement_run.summary column exists (jsonb)
--   28.   settlement_run.created_at column not null
--   29.   billing.settlement_artifact table exists
--   30.   settlement_artifact PK on artifact_id
--   31.   settlement_artifact UNIQUE(run_id, artifact_type)
--   32.   idx_settlement_period_workspace_status index exists
--   33.   idx_settlement_period_period_range index exists
--   34.   idx_settlement_run_status_started index exists
--   35.   idx_settlement_run_period index exists
--   36.   idx_settlement_artifact_run index exists
--   37.   updated_at trigger on settlement_period
--
-- ============================================================================

BEGIN;
SELECT plan(37);

-- ── 1. billing.settlement_status enum exists ─────────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_type pt
      JOIN pg_namespace n ON n.oid = pt.typnamespace
     WHERE pt.typname = 'settlement_status'
       AND n.nspname  = 'billing'
  ),
  'billing.settlement_status enum exists'
);

-- ── 2-4. settlement_status values ────────────────────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_enum pe
      JOIN pg_type pt ON pt.oid = pe.enumtypid
      JOIN pg_namespace n ON n.oid = pt.typnamespace
     WHERE pt.typname   = 'settlement_status'
       AND n.nspname    = 'billing'
       AND pe.enumlabel = 'open'
  ),
  'billing.settlement_status has value ''open'''
);

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_enum pe
      JOIN pg_type pt ON pt.oid = pe.enumtypid
      JOIN pg_namespace n ON n.oid = pt.typnamespace
     WHERE pt.typname   = 'settlement_status'
       AND n.nspname    = 'billing'
       AND pe.enumlabel = 'locked'
  ),
  'billing.settlement_status has value ''locked'''
);

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_enum pe
      JOIN pg_type pt ON pt.oid = pe.enumtypid
      JOIN pg_namespace n ON n.oid = pt.typnamespace
     WHERE pt.typname   = 'settlement_status'
       AND n.nspname    = 'billing'
       AND pe.enumlabel = 'closed'
  ),
  'billing.settlement_status has value ''closed'''
);

-- ── 5. billing.settlement_run_status enum exists ─────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_type pt
      JOIN pg_namespace n ON n.oid = pt.typnamespace
     WHERE pt.typname = 'settlement_run_status'
       AND n.nspname  = 'billing'
  ),
  'billing.settlement_run_status enum exists'
);

-- ── 6-9. settlement_run_status values ────────────────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_enum pe
      JOIN pg_type pt ON pt.oid = pe.enumtypid
      JOIN pg_namespace n ON n.oid = pt.typnamespace
     WHERE pt.typname   = 'settlement_run_status'
       AND n.nspname    = 'billing'
       AND pe.enumlabel = 'running'
  ),
  'billing.settlement_run_status has value ''running'''
);

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_enum pe
      JOIN pg_type pt ON pt.oid = pe.enumtypid
      JOIN pg_namespace n ON n.oid = pt.typnamespace
     WHERE pt.typname   = 'settlement_run_status'
       AND n.nspname    = 'billing'
       AND pe.enumlabel = 'succeeded'
  ),
  'billing.settlement_run_status has value ''succeeded'''
);

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_enum pe
      JOIN pg_type pt ON pt.oid = pe.enumtypid
      JOIN pg_namespace n ON n.oid = pt.typnamespace
     WHERE pt.typname   = 'settlement_run_status'
       AND n.nspname    = 'billing'
       AND pe.enumlabel = 'failed'
  ),
  'billing.settlement_run_status has value ''failed'''
);

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_enum pe
      JOIN pg_type pt ON pt.oid = pe.enumtypid
      JOIN pg_namespace n ON n.oid = pt.typnamespace
     WHERE pt.typname   = 'settlement_run_status'
       AND n.nspname    = 'billing'
       AND pe.enumlabel = 'cancelled'
  ),
  'billing.settlement_run_status has value ''cancelled'''
);

-- ── 10. billing.settlement_artifact_type enum exists ─────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_type pt
      JOIN pg_namespace n ON n.oid = pt.typnamespace
     WHERE pt.typname = 'settlement_artifact_type'
       AND n.nspname  = 'billing'
  ),
  'billing.settlement_artifact_type enum exists'
);

-- ── 11-14. settlement_artifact_type values ────────────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_enum pe
      JOIN pg_type pt ON pt.oid = pe.enumtypid
      JOIN pg_namespace n ON n.oid = pt.typnamespace
     WHERE pt.typname   = 'settlement_artifact_type'
       AND n.nspname    = 'billing'
       AND pe.enumlabel = 'summary_pdf'
  ),
  'billing.settlement_artifact_type has value ''summary_pdf'''
);

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_enum pe
      JOIN pg_type pt ON pt.oid = pe.enumtypid
      JOIN pg_namespace n ON n.oid = pt.typnamespace
     WHERE pt.typname   = 'settlement_artifact_type'
       AND n.nspname    = 'billing'
       AND pe.enumlabel = 'detail_csv'
  ),
  'billing.settlement_artifact_type has value ''detail_csv'''
);

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_enum pe
      JOIN pg_type pt ON pt.oid = pe.enumtypid
      JOIN pg_namespace n ON n.oid = pt.typnamespace
     WHERE pt.typname   = 'settlement_artifact_type'
       AND n.nspname    = 'billing'
       AND pe.enumlabel = 'invoice_bundle_pdf'
  ),
  'billing.settlement_artifact_type has value ''invoice_bundle_pdf'''
);

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_enum pe
      JOIN pg_type pt ON pt.oid = pe.enumtypid
      JOIN pg_namespace n ON n.oid = pt.typnamespace
     WHERE pt.typname   = 'settlement_artifact_type'
       AND n.nspname    = 'billing'
       AND pe.enumlabel = 'discrepancy_pdf'
  ),
  'billing.settlement_artifact_type has value ''discrepancy_pdf'''
);

-- ── 15. billing.settlement_scope enum exists ─────────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_type pt
      JOIN pg_namespace n ON n.oid = pt.typnamespace
     WHERE pt.typname = 'settlement_scope'
       AND n.nspname  = 'billing'
  ),
  'billing.settlement_scope enum exists'
);

-- ── 16-17. settlement_scope values ────────────────────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_enum pe
      JOIN pg_type pt ON pt.oid = pe.enumtypid
      JOIN pg_namespace n ON n.oid = pt.typnamespace
     WHERE pt.typname   = 'settlement_scope'
       AND n.nspname    = 'billing'
       AND pe.enumlabel = 'single_workspace'
  ),
  'billing.settlement_scope has value ''single_workspace'''
);

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_enum pe
      JOIN pg_type pt ON pt.oid = pe.enumtypid
      JOIN pg_namespace n ON n.oid = pt.typnamespace
     WHERE pt.typname   = 'settlement_scope'
       AND n.nspname    = 'billing'
       AND pe.enumlabel = 'all_workspaces'
  ),
  'billing.settlement_scope has value ''all_workspaces'''
);

-- ── 18. billing.settlement_period table exists ───────────────────────────────
SELECT has_table(
  'billing', 'settlement_period',
  'billing.settlement_period table exists'
);

-- ── 19. settlement_period PK on period_id ────────────────────────────────────
SELECT col_is_pk(
  'billing', 'settlement_period', 'period_id',
  'billing.settlement_period.period_id is PRIMARY KEY'
);

-- ── 20. settlement_period UNIQUE(workspace_id, period_start, period_end) ─────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_class t     ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'billing'
       AND t.relname = 'settlement_period'
       AND c.contype = 'u'
       AND c.conname = 'settlement_period_workspace_range_unique'
  ),
  'UNIQUE(workspace_id, period_start, period_end) constraint exists on billing.settlement_period'
);

-- ── 21. settlement_period.status NOT NULL ────────────────────────────────────
SELECT col_not_null(
  'billing', 'settlement_period', 'status',
  'billing.settlement_period.status is NOT NULL'
);

-- ── 22. settlement_period.created_at NOT NULL ────────────────────────────────
SELECT col_not_null(
  'billing', 'settlement_period', 'created_at',
  'billing.settlement_period.created_at is NOT NULL'
);

-- ── 23. settlement_period.updated_at NOT NULL ────────────────────────────────
SELECT col_not_null(
  'billing', 'settlement_period', 'updated_at',
  'billing.settlement_period.updated_at is NOT NULL'
);

-- ── 24. billing.settlement_run table exists ──────────────────────────────────
SELECT has_table(
  'billing', 'settlement_run',
  'billing.settlement_run table exists'
);

-- ── 25. settlement_run PK on run_id ──────────────────────────────────────────
SELECT col_is_pk(
  'billing', 'settlement_run', 'run_id',
  'billing.settlement_run.run_id is PRIMARY KEY'
);

-- ── 26. settlement_run.workspace_ids column exists ───────────────────────────
SELECT has_column(
  'billing', 'settlement_run', 'workspace_ids',
  'billing.settlement_run.workspace_ids column exists'
);

-- ── 27. settlement_run.summary column exists ─────────────────────────────────
SELECT has_column(
  'billing', 'settlement_run', 'summary',
  'billing.settlement_run.summary column exists'
);

-- ── 28. settlement_run.created_at NOT NULL ───────────────────────────────────
SELECT col_not_null(
  'billing', 'settlement_run', 'created_at',
  'billing.settlement_run.created_at is NOT NULL'
);

-- ── 29. billing.settlement_artifact table exists ─────────────────────────────
SELECT has_table(
  'billing', 'settlement_artifact',
  'billing.settlement_artifact table exists'
);

-- ── 30. settlement_artifact PK on artifact_id ────────────────────────────────
SELECT col_is_pk(
  'billing', 'settlement_artifact', 'artifact_id',
  'billing.settlement_artifact.artifact_id is PRIMARY KEY'
);

-- ── 31. settlement_artifact UNIQUE(run_id, artifact_type) ────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_constraint c
      JOIN pg_class t     ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'billing'
       AND t.relname = 'settlement_artifact'
       AND c.contype = 'u'
       AND c.conname = 'settlement_artifact_run_type_unique'
  ),
  'UNIQUE(run_id, artifact_type) constraint exists on billing.settlement_artifact'
);

-- ── 32. idx_settlement_period_workspace_status index ─────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_indexes
     WHERE schemaname = 'billing'
       AND tablename  = 'settlement_period'
       AND indexname  = 'idx_settlement_period_workspace_status'
  ),
  'idx_settlement_period_workspace_status index exists'
);

-- ── 33. idx_settlement_period_period_range index ─────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_indexes
     WHERE schemaname = 'billing'
       AND tablename  = 'settlement_period'
       AND indexname  = 'idx_settlement_period_period_range'
  ),
  'idx_settlement_period_period_range index exists'
);

-- ── 34. idx_settlement_run_status_started index ──────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_indexes
     WHERE schemaname = 'billing'
       AND tablename  = 'settlement_run'
       AND indexname  = 'idx_settlement_run_status_started'
  ),
  'idx_settlement_run_status_started index exists'
);

-- ── 35. idx_settlement_run_period index ──────────────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_indexes
     WHERE schemaname = 'billing'
       AND tablename  = 'settlement_run'
       AND indexname  = 'idx_settlement_run_period'
  ),
  'idx_settlement_run_period index exists'
);

-- ── 36. idx_settlement_artifact_run index ────────────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_indexes
     WHERE schemaname = 'billing'
       AND tablename  = 'settlement_artifact'
       AND indexname  = 'idx_settlement_artifact_run'
  ),
  'idx_settlement_artifact_run index exists'
);

-- ── 37. updated_at trigger on settlement_period ──────────────────────────────
SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_trigger t
      JOIN pg_class c   ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relname = 'settlement_period'
       AND n.nspname = 'billing'
       AND t.tgname  = 'set_billing_settlement_period_updated_at'
  ),
  'updated_at trigger exists on billing.settlement_period'
);

SELECT * FROM finish();
ROLLBACK;
