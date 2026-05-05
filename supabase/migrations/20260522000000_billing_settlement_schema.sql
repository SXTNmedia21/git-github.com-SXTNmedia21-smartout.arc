-- ============================================================================
-- 20260522000000_billing_settlement_schema.sql
--
-- Settlement reconciliation schema — 4 enums + 3 tables + indexes + GRANTs.
-- All objects live in the `billing` schema (created in 20260521000000).
--
-- Tables:
--   billing.settlement_period   — one row per (workspace, month): open→locked→closed
--   billing.settlement_run      — one row per "Kjør avstemming" click (immutable)
--   billing.settlement_artifact — generated files (PDF/CSV) attached to a run
--
-- Immutability rule (ADR-E, 2026-05-02):
--   settlement_run rows are NEVER updated or deleted — new click = new run.
--   closed period cannot be unlocked without an ADR-supersession.
--
-- ============================================================================

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE billing.settlement_status AS ENUM (
  'open',    -- orders can be freely edited
  'locked',  -- snapshot taken; changes allowed but logged as deviations
  'closed'   -- final; no changes without audit-supersession
);

CREATE TYPE billing.settlement_run_status AS ENUM (
  'running',
  'succeeded',
  'failed',
  'cancelled'
);

CREATE TYPE billing.settlement_artifact_type AS ENUM (
  'summary_pdf',         -- 1-page overview per workspace + totals
  'detail_csv',          -- Tripletex/Fiken/Visma import-ready lines
  'invoice_bundle_pdf',  -- all base invoices in period merged to one PDF
  'discrepancy_pdf'      -- only items Erik must act on
);

CREATE TYPE billing.settlement_scope AS ENUM (
  'single_workspace',  -- run scoped to one workspace only
  'all_workspaces'     -- cross-company run covering all granted workspaces
);

-- ─── settlement_period ───────────────────────────────────────────────────────
--
-- One row per (workspace, billing period). Lifecycle: open → locked → closed.
-- Downstream settlement_run references (workspace_id, period_start, period_end)
-- but does NOT FK to this table — runs are intentionally decoupled so a run
-- can be kicked off before the period row is explicitly created.
-- ADR-E (2026-05-02): settlement as immutable snapshot.

CREATE TABLE billing.settlement_period (
  period_id    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE RESTRICT,
  period_start date        NOT NULL,  -- e.g. 2026-09-01
  period_end   date        NOT NULL,  -- e.g. 2026-09-30
  status       billing.settlement_status NOT NULL DEFAULT 'open',
  locked_at    timestamptz,
  locked_by    uuid        REFERENCES public.user_identity(user_id),
  closed_at    timestamptz,
  closed_by    uuid        REFERENCES public.user_identity(user_id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settlement_period_workspace_range_unique
    UNIQUE (workspace_id, period_start, period_end),
  CONSTRAINT settlement_period_dates_check
    CHECK (period_end >= period_start),
  CONSTRAINT settlement_period_locked_fields_check
    CHECK (
      (status = 'open' AND locked_at IS NULL AND locked_by IS NULL)
      OR (status IN ('locked', 'closed') AND locked_at IS NOT NULL AND locked_by IS NOT NULL)
    ),
  CONSTRAINT settlement_period_closed_fields_check
    CHECK (
      (status != 'closed')
      OR (status = 'closed' AND closed_at IS NOT NULL AND closed_by IS NOT NULL)
    )
);

COMMENT ON TABLE billing.settlement_period IS
  'One row per (workspace, billing period). Lifecycle open→locked→closed. '
  'Locked = snapshot taken; closed = final, no changes without ADR-supersession. '
  'ADR-E (2026-05-02): settlement as immutable snapshot.';

COMMENT ON COLUMN billing.settlement_period.period_start IS 'Inclusive start of billing period (first day of month).';
COMMENT ON COLUMN billing.settlement_period.period_end   IS 'Inclusive end of billing period (last day of month).';
COMMENT ON COLUMN billing.settlement_period.locked_at    IS 'Set when status transitions open→locked. NULL while status=open.';
COMMENT ON COLUMN billing.settlement_period.closed_at    IS 'Set when status transitions locked→closed via service_role only.';

-- ─── settlement_run ──────────────────────────────────────────────────────────
--
-- One row per "Kjør avstemming" click by Erik. Rows are IMMUTABLE — a retry
-- or preview creates a new run, never overwrites an existing one.
-- summary JSONB stores compute_period_aggregates() output once run succeeds.

CREATE TABLE billing.settlement_run (
  run_id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  scope          billing.settlement_scope NOT NULL,
  initiated_by   uuid        NOT NULL REFERENCES public.user_identity(user_id),
  period_start   date        NOT NULL,
  period_end     date        NOT NULL,
  workspace_ids  uuid[]      NOT NULL,  -- workspaces included in this run
  started_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz,
  status         billing.settlement_run_status NOT NULL DEFAULT 'running',
  summary        jsonb       NOT NULL DEFAULT '{}',
  -- JSONB shape: { by_workspace, totals, discrepancies } — see compute_period_aggregates()
  error_message  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settlement_run_dates_check
    CHECK (period_end >= period_start),
  CONSTRAINT settlement_run_workspace_ids_nonempty
    CHECK (array_length(workspace_ids, 1) >= 1),
  CONSTRAINT settlement_run_completed_at_check
    CHECK (
      (status = 'running' AND completed_at IS NULL)
      OR (status IN ('succeeded', 'failed', 'cancelled') AND completed_at IS NOT NULL)
    )
);

COMMENT ON TABLE billing.settlement_run IS
  'One row per "Kjør avstemming" click. IMMUTABLE — new click = new run row, never overwrite. '
  'summary JSONB populated by compute_period_aggregates() on success. '
  'ADR-E (2026-05-02): settlement as immutable snapshot.';

COMMENT ON COLUMN billing.settlement_run.workspace_ids IS
  'Array of workspace UUIDs included in this run. '
  'For scope=single_workspace this is a 1-element array.';

COMMENT ON COLUMN billing.settlement_run.summary IS
  'Aggregate JSONB populated when status→succeeded. '
  'Shape: { by_workspace: { <uuid>: { company_name, workspace_name, count_orders, '
  'amount_excl_vat, amount_incl_vat, amount_paid, amount_outstanding, status_summary } }, '
  'totals: { amount_excl_vat, vat_breakdown, amount_incl_vat, amount_paid, amount_outstanding }, '
  'discrepancies: [ { type, invoice_id?, company_id?, company_name, days_overdue?, severity } ] }. '
  'No PII beyond org_nr + amounts (GDPR).';

-- ─── settlement_artifact ─────────────────────────────────────────────────────
--
-- Files generated by a settlement run. Stored in Supabase Storage bucket
-- `settlement-artifacts`. Deleted by CASCADE when run row is removed
-- (service_role only — runs are immutable in normal operation).

CREATE TABLE billing.settlement_artifact (
  artifact_id      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id           uuid        NOT NULL REFERENCES billing.settlement_run(run_id) ON DELETE CASCADE,
  artifact_type    billing.settlement_artifact_type NOT NULL,
  storage_path     text        NOT NULL,  -- Supabase Storage bucket path
  file_size_bytes  integer,
  generated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settlement_artifact_run_type_unique
    UNIQUE (run_id, artifact_type)
);

COMMENT ON TABLE billing.settlement_artifact IS
  'PDF/CSV files generated by a settlement_run. One row per (run, type). '
  'storage_path points into Supabase Storage bucket settlement-artifacts. '
  'Deleted by CASCADE if a run is removed (service_role maintenance only). '
  'ADR-E (2026-05-02).';

COMMENT ON COLUMN billing.settlement_artifact.storage_path IS
  'Bucket-relative path, e.g. runs/<run_id>/summary.pdf. '
  'Full URL = <SUPABASE_URL>/storage/v1/object/settlement-artifacts/<storage_path>.';

-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- settlement_period lookups

CREATE INDEX idx_settlement_period_workspace_status
  ON billing.settlement_period (workspace_id, status);

CREATE INDEX idx_settlement_period_period_range
  ON billing.settlement_period (period_start, period_end);

-- settlement_run lookups

CREATE INDEX idx_settlement_run_status_started
  ON billing.settlement_run (status, started_at DESC);

CREATE INDEX idx_settlement_run_period
  ON billing.settlement_run (period_start, period_end);

-- settlement_artifact lookups

CREATE INDEX idx_settlement_artifact_run
  ON billing.settlement_artifact (run_id);

-- ─── updated_at trigger ──────────────────────────────────────────────────────

-- settlement_period is the only mutable table; runs + artifacts are append-only.
CREATE TRIGGER set_billing_settlement_period_updated_at
  BEFORE UPDATE ON billing.settlement_period
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Table-level GRANTs ───────────────────────────────────────────────────────
--
-- INSERT on settlement_run goes to authenticated (server action creates the run
-- row directly; service_role then updates status + summary on completion).
-- INSERT on settlement_artifact is service_role ONLY — populated by the server
-- action after file upload, never from the client.

GRANT SELECT, INSERT, UPDATE ON billing.settlement_period  TO authenticated;
GRANT SELECT, INSERT         ON billing.settlement_run     TO authenticated;
GRANT SELECT                 ON billing.settlement_artifact TO authenticated;

GRANT ALL ON billing.settlement_period  TO service_role;
GRANT ALL ON billing.settlement_run     TO service_role;
GRANT ALL ON billing.settlement_artifact TO service_role;
