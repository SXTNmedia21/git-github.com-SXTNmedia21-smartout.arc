-- 20260515100600_source_discriminator_12_tables.sql
-- M7: source discriminator column on migration-targeted tables.
-- Per ADR-0108 Clause A (column spec) and Clause C (whitelist semantics).
-- Single migration file per council C2 verdict (atomic policy change).
--
-- 10 tables touched here. 2 excluded from the original 12-table list:
--   - employment_contract_detail (source already added in M3 / 20260515100300)
--   - employee_type (K1a platform table — excluded per council 2026-04-15 Q2 verdict)
--
-- Default 'operational' applied via ADD COLUMN DEFAULT — PG 11+ zero-rewrite
-- for existing rows. Strike-mcp writes use 'bubble_migration'. Future v3
-- cascade writes use 'v3_engine' per ADR-0108 Clause A.

-- ── public schema tables ────────────────────────────────────────

ALTER TABLE public.workspace
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'operational'
    CHECK (source IN ('operational','bubble_migration','v3_engine'));

ALTER TABLE public.company
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'operational'
    CHECK (source IN ('operational','bubble_migration','v3_engine'));

ALTER TABLE public.location
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'operational'
    CHECK (source IN ('operational','bubble_migration','v3_engine'));

ALTER TABLE public.department
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'operational'
    CHECK (source IN ('operational','bubble_migration','v3_engine'));

ALTER TABLE public.team
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'operational'
    CHECK (source IN ('operational','bubble_migration','v3_engine'));

ALTER TABLE public.profile
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'operational'
    CHECK (source IN ('operational','bubble_migration','v3_engine'));

ALTER TABLE public.employment_contract
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'operational'
    CHECK (source IN ('operational','bubble_migration','v3_engine'));

ALTER TABLE public.schedule_shift
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'operational'
    CHECK (source IN ('operational','bubble_migration','v3_engine'));

ALTER TABLE public.invitation
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'operational'
    CHECK (source IN ('operational','bubble_migration','v3_engine'));

-- ── timesheet schema (cross-schema per council 2026-04-15 Q4 verdict) ──

ALTER TABLE timesheet.time_entry
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'operational'
    CHECK (source IN ('operational','bubble_migration','v3_engine'));

-- ── Partial indexes for migration-audit queries ─────────────────
-- Index only non-operational rows (the minority — query path for
-- "show me migrated data" or "show me v3-derived data").

CREATE INDEX IF NOT EXISTS idx_workspace_source          ON public.workspace          (source) WHERE source <> 'operational';
CREATE INDEX IF NOT EXISTS idx_company_source            ON public.company            (source) WHERE source <> 'operational';
CREATE INDEX IF NOT EXISTS idx_location_source           ON public.location           (source) WHERE source <> 'operational';
CREATE INDEX IF NOT EXISTS idx_department_source         ON public.department         (source) WHERE source <> 'operational';
CREATE INDEX IF NOT EXISTS idx_team_source               ON public.team               (source) WHERE source <> 'operational';
CREATE INDEX IF NOT EXISTS idx_profile_source            ON public.profile            (source) WHERE source <> 'operational';
CREATE INDEX IF NOT EXISTS idx_employment_contract_source ON public.employment_contract (source) WHERE source <> 'operational';
CREATE INDEX IF NOT EXISTS idx_schedule_shift_source     ON public.schedule_shift     (source) WHERE source <> 'operational';
CREATE INDEX IF NOT EXISTS idx_invitation_source         ON public.invitation         (source) WHERE source <> 'operational';
CREATE INDEX IF NOT EXISTS idx_time_entry_source         ON timesheet.time_entry      (source) WHERE source <> 'operational';

-- ── Comments ────────────────────────────────────────────────────

COMMENT ON COLUMN public.workspace.source IS          'ADR-0108 provenance discriminator. See ADR-0107 for strike-mcp telemetry boundary.';
COMMENT ON COLUMN public.company.source IS            'ADR-0108 provenance discriminator.';
COMMENT ON COLUMN public.location.source IS           'ADR-0108 provenance discriminator.';
COMMENT ON COLUMN public.department.source IS         'ADR-0108 provenance discriminator.';
COMMENT ON COLUMN public.team.source IS               'ADR-0108 provenance discriminator.';
COMMENT ON COLUMN public.profile.source IS            'ADR-0108 provenance discriminator. trg_auto_assign_protocols filters on this (M8).';
COMMENT ON COLUMN public.employment_contract.source IS 'ADR-0108 provenance discriminator. bubble_migration rows are block-and-supersede per ADR-0109.';
COMMENT ON COLUMN public.schedule_shift.source IS     'ADR-0108 provenance discriminator. Multiple triggers filter on this (M8).';
COMMENT ON COLUMN public.invitation.source IS         'ADR-0108 provenance discriminator.';
COMMENT ON COLUMN timesheet.time_entry.source IS      'ADR-0108 provenance discriminator. Cross-schema per council 2026-04-15 Q4 verdict.';
