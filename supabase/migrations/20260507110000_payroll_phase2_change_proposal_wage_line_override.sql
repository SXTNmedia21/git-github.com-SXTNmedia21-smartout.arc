-- 20260507110000_payroll_phase2_change_proposal_wage_line_override.sql
--
-- T1.1 — Extend change_proposal for wage_line_override kind (Payroll Phase 2).
--
-- Purpose:
--   The override_calculation_line capability tool (T2.1) inserts change_proposal rows
--   with kind='wage_line_override'. This kind is distinct from the existing cascade-engine
--   trigger_type usage. We add a separate `kind` TEXT column rather than overloading
--   trigger_type (which is now a typed enum in A2: framework_trigger_type). This keeps
--   the cascade domain (trigger_type) and payroll/app domains (kind) cleanly separated.
--
-- Q3 resolution (per PLAN-payroll-phase-2.md):
--   kind stays TEXT (not enum). Adding enum would require DDL across helpdesk, billing,
--   and daily-operation campaigns that also use change_proposal. Zod-validation in the
--   capability tool body enforces payload structure at the app layer. This file documents
--   accepted kind values via a table COMMENT.
--
-- ADR references: ADR-0292 (override-applier semantics), ADR-0204 (gatedMutation).
--
-- Rollback plan:
--   ALTER TABLE public.change_proposal DROP COLUMN IF EXISTS kind;
--   ALTER TABLE public.change_proposal DROP COLUMN IF EXISTS resolved_by;
--   ALTER TABLE public.change_proposal DROP COLUMN IF EXISTS resolved_at;
--   DROP INDEX IF EXISTS idx_change_proposal_kind_pending;

SET search_path TO public, extensions;

-- ─── Add kind column ──────────────────────────────────────────────────────────
-- TEXT, nullable (existing rows pre-date this column; they have no kind).
-- Payroll Phase 2 writes kind='wage_line_override'. Future capabilities may add
-- their own kind values via migration comments (not enum to avoid DDL cross-campaign
-- coordination overhead — Q3 resolution).
ALTER TABLE public.change_proposal
  ADD COLUMN IF NOT EXISTS kind TEXT;

COMMENT ON COLUMN public.change_proposal.kind IS
  'Application-domain classifier for the proposal type. '
  'Accepted values: '
  '  ''wage_line_override'' — payroll line override (Phase 2, ADR-0292). '
  '  NULL — pre-Phase-2 cascade proposals created before this column existed. '
  'DO NOT add new values here without a migration comment + Zod schema in the capability tool. '
  'DO NOT convert to enum without coordinating across helpdesk, billing, and daily-operation '
  'campaigns (all use change_proposal with different kind domains).';

-- ─── Add resolved_by / resolved_at for payroll approval flow ──────────────────
-- The journey JOURNEY-payroll-phase-2-admin-approves-line-override.md requires
-- tracking which admin resolved (approved/rejected) the proposal and when.
-- The existing change_proposal schema has approved_by/approved_at and rejected_at
-- but no unified "resolved by" column. We add resolved_by + resolved_at for the
-- capability tool applier (T2.1/T2.2) to write.
ALTER TABLE public.change_proposal
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.profile(profile_id);

ALTER TABLE public.change_proposal
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

COMMENT ON COLUMN public.change_proposal.resolved_by IS
  'Profile that approved or rejected this proposal. Set by approve/reject flow. '
  'Mirrors approved_by but unified for kind=''wage_line_override'' resolution (ADR-0292).';

COMMENT ON COLUMN public.change_proposal.resolved_at IS
  'Timestamp when proposal was resolved (approved or rejected). '
  'Unified companion to resolved_by for kind=''wage_line_override'' (ADR-0292).';

-- ─── Index for pending wage_line_override proposals ───────────────────────────
-- Inbox view filters: kind='wage_line_override' AND status='pending'.
-- Partial index on the hot path used by the proposals inbox UI.
CREATE INDEX IF NOT EXISTS idx_change_proposal_kind_pending
  ON public.change_proposal (workspace_id, kind, status)
  WHERE status = 'pending' AND kind IS NOT NULL;

-- ─── Table COMMENT: document wage_line_override payload shape ─────────────────
-- The wage_line_override payload is validated by Zod in the capability tool body
-- (not by a DB CHECK constraint, per Q3 resolution). The expected shape is
-- documented here for DB-level transparency and future auditors.
--
-- Expected payload shape for kind='wage_line_override' (stored in changes JSONB):
-- {
--   "calculation_id":        uuid,         -- payroll_calculation.id being overridden
--   "original_amount_cents": integer,      -- amount_nok × 100 (immutable, from payroll_calculation)
--   "proposed_amount_cents": integer,      -- manager's proposed replacement amount in øre
--   "reason":               string (≥10),  -- required; shown in admin inbox
--   "category":             string,        -- "manual_adjustment" | "tariff_interpretation"
--                                          -- | "shift_data_error" | "other"
--   "period_id":             uuid          -- payroll.period.id scoping the override
-- }
--
-- When approved (status→'applied'): the DB trigger payroll_proposal_applied_trg
-- (installed in 20260507110100_payroll_phase2_recalc_triggers.sql) emits an
-- engine_event row with event_kind='payroll.line_override_applied' so the
-- override-applier function (T2.2) can run the supersession chain (ADR-0292).
COMMENT ON TABLE public.change_proposal IS
  'Cascade: A proposed change awaiting review/approval. '
  'kind column (Phase 2) classifies app-domain proposals. '
  'kind=''wage_line_override'' payload shape (in changes JSONB): '
  '{ calculation_id: uuid, original_amount_cents: int, proposed_amount_cents: int, '
  'reason: text (min 10 chars), category: manual_adjustment|tariff_interpretation|'
  'shift_data_error|other, period_id: uuid }. '
  'Zod-validated at capability tool level (Q3: no DB CHECK to avoid cross-campaign DDL churn). '
  'ADR-0292 (payroll override-applier semantics).';
