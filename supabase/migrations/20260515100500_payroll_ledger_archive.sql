-- 20260515100500_payroll_ledger_archive.sql
-- M5: read-only archive for Bubble ⏱️salary_transaction rows (17 607 for Wrightegaarden).
-- Per ADR-0110 Clause A (archive-only role), Clause B (RLS USING(false) UPDATE/DELETE),
-- Clause C (lean typed columns + raw_json), Clause D (no partitioning Phase 1),
-- Clause E (orphan-tolerant FKs).
-- NOT a live cascade table. v3 operational payroll ledger is a future table (ADR-0110 Clause F).

CREATE TABLE IF NOT EXISTS public.payroll_ledger_archive (
  payroll_ledger_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Workspace anchor (NOT NULL — archive row without tenant has no meaning)
  workspace_id            uuid NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,

  -- Profile anchor (NOT NULL — archive row without employee has no meaning)
  profile_id              uuid NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,

  -- Contextual FKs — nullable per ADR-0110 Clause E (Bubble may have orphans)
  schedule_shift_id       uuid REFERENCES public.schedule_shift(schedule_shift_id) ON DELETE SET NULL,
  department_id           uuid REFERENCES public.department(department_id) ON DELETE SET NULL,
  team_id                 uuid REFERENCES public.team(team_id) ON DELETE SET NULL,

  -- Tripletex-sync + query-path typed columns
  transaction_date        date NOT NULL,
  hours                   numeric(8,2),
  base_salary             numeric(12,2),
  total_salary            numeric(12,2),
  a_melding_code          text,
  accounting_account_code text,

  -- Provenance
  bubble_record_id        text NOT NULL,
  source                  text NOT NULL DEFAULT 'bubble_migration'
                          CHECK (source IN ('operational','bubble_migration','v3_engine')),
  archived_at             timestamptz NOT NULL DEFAULT now(),

  -- Fidelity column — complete original Bubble row (ADR-0110 Clause C)
  raw_json                jsonb NOT NULL,

  CONSTRAINT ux_payroll_archive_bubble_record UNIQUE (workspace_id, bubble_record_id)
);

COMMENT ON TABLE public.payroll_ledger_archive IS
  'Read-only archive of Bubble salary_transaction rows. Per ADR-0110: archive-only semantics, RLS USING(false) UPDATE/DELETE, lean typed columns + raw_json for fidelity. NOT a live cascade table — v3 operational payroll ledger is a separate future table.';

COMMENT ON COLUMN public.payroll_ledger_archive.raw_json IS
  'Complete original Bubble row. Use for unforeseen queries or re-derivation. Typed columns cover Tripletex sync + indexed query paths only.';

COMMENT ON COLUMN public.payroll_ledger_archive.schedule_shift_id IS
  'Nullable — Bubble may have orphan payroll rows (shift deleted but payroll preserved). Strike-mcp reports orphan counts per ADR-0110 Clause E.';

-- ── Indexes ─────────────────────────────────────────────────────
-- Primary query path: Tripletex sync per profile per period
CREATE INDEX IF NOT EXISTS idx_payroll_archive_profile_date
  ON public.payroll_ledger_archive (profile_id, transaction_date);

-- Workspace queries (reporting, audit)
CREATE INDEX IF NOT EXISTS idx_payroll_archive_workspace_date
  ON public.payroll_ledger_archive (workspace_id, transaction_date);

-- Partial indexes on nullable FKs (skip orphan rows)
CREATE INDEX IF NOT EXISTS idx_payroll_archive_shift
  ON public.payroll_ledger_archive (schedule_shift_id) WHERE schedule_shift_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payroll_archive_department
  ON public.payroll_ledger_archive (department_id) WHERE department_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payroll_archive_team
  ON public.payroll_ledger_archive (team_id) WHERE team_id IS NOT NULL;

-- A-melding code query path (regulatory reporting)
CREATE INDEX IF NOT EXISTS idx_payroll_archive_a_melding
  ON public.payroll_ledger_archive (a_melding_code) WHERE a_melding_code IS NOT NULL;

-- ── RLS (per ADR-0110 Clause B) ─────────────────────────────────
ALTER TABLE public.payroll_ledger_archive ENABLE ROW LEVEL SECURITY;

-- Workspace-scoped read for admins
CREATE POLICY "select_payroll_archive"
  ON public.payroll_ledger_archive FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- Service role only for INSERT (strike-mcp path)
CREATE POLICY "insert_payroll_archive_service_role"
  ON public.payroll_ledger_archive FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Immutable — nobody UPDATEs or DELETEs archive rows
CREATE POLICY "no_update_payroll_archive"
  ON public.payroll_ledger_archive FOR UPDATE USING (false);

CREATE POLICY "no_delete_payroll_archive"
  ON public.payroll_ledger_archive FOR DELETE USING (false);
