-- 20260508110000_payroll_phase3_export_audit_tables.sql
--
-- T2.1 — Phase 3 CSV export: extend payroll.export_event + payroll.export_line
--        with audit-trail columns required by Bokføringsloven §13.
--
-- Context:
--   payroll.export_event was created in 20260422110200_payroll_calculation_tables.sql
--   (and moved to the payroll schema in 20260422110700_payroll_schema.sql) with columns
--   for generic export tracking (export_format, status, started_at, completed_at).
--
--   Phase 3 introduces CSV-specific audit requirements:
--     - variant: 'aggregate' | 'audit' (which CSV variant was downloaded)
--     - masked: whether PII was masked (default true; false = unmasked → triggers
--       the payroll.csv_export_unmasked telemetry event)
--     - file_hash: SHA-256 hex of generated CSV bytes (for audit-replay verification)
--     - idempotency_key: prevents double-export (UNIQUE per workspace — client sets this
--       to a hash of period_id + variant + timestamp bucket; re-submission is a no-op)
--     - row_count: how many rows were written to the CSV
--
--   payroll.export_line already has per-row columns (salary_code, hours, rate, amount).
--   Phase 3 adds line_payload JSONB so the full AuditRow / AggregateRow snapshot is
--   preserved for Bokføringsloven §13 replay without re-running the calculation.
--
-- Why ALTER not CREATE TABLE:
--   The tables already exist and are referenced by application code (Phase 1 export
--   history tracking). DROP + RECREATE would break FK constraints and existing RLS
--   policies. ADD COLUMN IF NOT EXISTS is safe to re-run.
--
-- Compliance:
--   ADR-0151 — workspace_id isolation preserved (existing column, not changed).
--   Bokføringsloven §13 — export_event + export_line are append-only.
--     RLS blocks UPDATE/DELETE for JWT users. Service role only via capability tool
--     gateway (Wave B, T3.1). No DELETE policy is created.
--   L-0177 — idempotency_key UNIQUE constraint provides fail-fast on double-export
--     rather than silent overwrite.
--
-- Rollback plan:
--   ALTER TABLE payroll.export_event DROP COLUMN IF EXISTS variant;
--   ALTER TABLE payroll.export_event DROP COLUMN IF EXISTS masked;
--   ALTER TABLE payroll.export_event DROP COLUMN IF EXISTS file_hash;
--   ALTER TABLE payroll.export_event DROP COLUMN IF EXISTS idempotency_key;
--   ALTER TABLE payroll.export_event DROP COLUMN IF EXISTS row_count;
--   ALTER TABLE payroll.export_line  DROP COLUMN IF EXISTS line_payload;
--   DROP INDEX IF EXISTS payroll.idx_export_event_idempotency;
--   DROP INDEX IF EXISTS payroll.idx_export_event_period_workspace;
--   DROP INDEX IF EXISTS payroll.idx_export_event_exported_at;
--   DROP INDEX IF EXISTS payroll.idx_export_line_export_event;

SET search_path TO payroll, public, extensions;

-- ─── Part A: Extend payroll.export_event ──────────────────────────────────────

-- variant: which CSV template was used ('aggregate' = 1 row/profile; 'audit' = 1 row/calc-line)
ALTER TABLE payroll.export_event
  ADD COLUMN IF NOT EXISTS variant TEXT
    CHECK (variant IN ('aggregate', 'audit'));

-- masked: was PII (personnummer, bankkonto) masked in this export?
-- Default TRUE — Phase 3 spec: masked by default, opt-in unmasked.
ALTER TABLE payroll.export_event
  ADD COLUMN IF NOT EXISTS masked BOOLEAN DEFAULT TRUE;

-- file_hash: SHA-256 hex of the generated CSV bytes.
-- Used for audit-replay verification (Bokføringsloven §13).
ALTER TABLE payroll.export_event
  ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- idempotency_key: client-provided deduplication key.
-- Uniqueness per workspace prevents double-export for the same logical export operation.
-- Format (recommended): sha256(workspace_id + period_id + variant + timestamp-bucket).
ALTER TABLE payroll.export_event
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- row_count: number of data rows in the exported CSV.
ALTER TABLE payroll.export_event
  ADD COLUMN IF NOT EXISTS row_count INTEGER;

-- UNIQUE constraint for idempotency — fail-fast on double-export (L-0177).
-- Conditional: only enforce uniqueness when idempotency_key is set (NULL is excluded
-- from UNIQUE by SQL standard, so legacy rows with NULL key are unaffected).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_export_event_workspace_idempotency'
      AND conrelid = 'payroll.export_event'::regclass
  ) THEN
    ALTER TABLE payroll.export_event
      ADD CONSTRAINT uq_export_event_workspace_idempotency
        UNIQUE (workspace_id, idempotency_key);
  END IF;
END
$$;

COMMENT ON COLUMN payroll.export_event.variant IS
  'CSV export variant: ''aggregate'' (1 row per profile, totals) or '
  '''audit'' (1 row per calculation line with rule provenance). '
  'Added Phase 3 (20260508110000). NULL for pre-Phase-3 Tripletex/PDF exports.';

COMMENT ON COLUMN payroll.export_event.masked IS
  'Whether PII (personnummer, bankkonto) was masked in this export. '
  'TRUE = last 4 digits visible, FALSE = raw PII (triggers payroll.csv_export_unmasked audit event). '
  'NULL for pre-Phase-3 exports. Default TRUE.';

COMMENT ON COLUMN payroll.export_event.file_hash IS
  'SHA-256 hex digest of the generated CSV bytes. '
  'Used for Bokføringsloven §13 audit-replay verification. '
  'NULL for pre-Phase-3 exports.';

COMMENT ON COLUMN payroll.export_event.idempotency_key IS
  'Client-provided deduplication key. UNIQUE per workspace_id (NULLs excluded). '
  'Recommended format: sha256(workspace_id + period_id + variant + timestamp-bucket). '
  'Wave B capability tool sets this before INSERT.';

COMMENT ON COLUMN payroll.export_event.row_count IS
  'Number of data rows (excluding header) in the exported CSV. '
  'NULL for pre-Phase-3 exports.';

-- ─── Part B: Extend payroll.export_line ───────────────────────────────────────

-- line_payload: full AuditRow / AggregateRow JSON snapshot for Bokføringsloven §13 replay.
-- Stores the complete typed row as exported (post-masking snapshot or pre-masking snapshot
-- for audit exports — capability tool decides; default: masked snapshot).
ALTER TABLE payroll.export_line
  ADD COLUMN IF NOT EXISTS line_payload JSONB;

COMMENT ON COLUMN payroll.export_line.line_payload IS
  'Full AggregateRow or AuditRow JSON snapshot as exported. '
  'Enables Bokføringsloven §13 audit-replay without re-running the calculation engine. '
  'PII masking state matches the export_event.masked flag. '
  'NULL for pre-Phase-3 Tripletex export lines.';

-- ─── Part C: Indexes ──────────────────────────────────────────────────────────

-- Composite lookup for "all exports for this period in this workspace" (ExportTab recent list)
CREATE INDEX IF NOT EXISTS idx_export_event_period_workspace
  ON payroll.export_event (workspace_id, period_id);

-- Descending time sort for the recent-exports list (newest first)
CREATE INDEX IF NOT EXISTS idx_export_event_exported_at
  ON payroll.export_event (workspace_id, started_at DESC);

-- Fast lookup from export_line → export_event (used in audit-replay JOIN)
CREATE INDEX IF NOT EXISTS idx_export_line_export_event
  ON payroll.export_line (export_event_id);

-- ─── Part D: RLS tightening for Phase 3 audit-append semantics ────────────────
--
-- Phase 1 created INSERT + SELECT + UPDATE policies for JWT users.
-- Phase 3 requirements (Bokføringsloven §13): no UPDATE or DELETE for admins.
-- The Phase 1 UPDATE policy is dropped and not replaced — only service_role may
-- update (which it already can via the existing service_role ALL policy).
--
-- WHY: An admin downloading a CSV must not be able to overwrite the audit record
-- after the fact. UPDATE is dropped for JWT users. Phase 1 UPDATE policy is the
-- only one being removed; all other Phase 1 policies are preserved as-is.

DROP POLICY IF EXISTS "jwt_update_payroll_export_event" ON payroll.export_event;

-- No replacement UPDATE policy for export_event — service_role only.
-- export_line: Phase 1 did not create an UPDATE policy, so nothing to drop there.

COMMENT ON TABLE payroll.export_event IS
  'Payroll: export history. One row per export attempt. '
  'Phase 1: Tripletex API, CSV, PDF, Excel status tracking. '
  'Phase 3: +variant, +masked, +file_hash, +idempotency_key, +row_count for CSV audit trail. '
  'Append-only for JWT users (Bokføringsloven §13) — UPDATE removed Phase 3 '
  '(20260508110000). Service role retains full access for capability tool gateway.';
