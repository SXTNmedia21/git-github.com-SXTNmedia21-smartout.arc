-- ════════════════════════════════════════════════════════════════════════════
-- 20260603000000_overtime_cap_policy.sql
-- ----------------------------------------------------------------------------
-- ADR-0254: Overtime cap policy table — three-layer hybrid model
-- (K1a framework rule ceiling, workspace policy defaults, per-contract override)
--
-- Linear: SMA-352
-- Audit:  docs/audits/2026-05-12-adr-contract-validation/06-contracts-payroll-lovsen.md C-02
--
-- This migration implements §4.A (table), §4.B (FK column on employment_contract),
-- §4.C (CHECK constraints enforcing Aml. §10-6 ceilings), §4.D (workspace bootstrap
-- seed trigger), §4.E (RLS policies). Phase 5 cron evaluation (§4.F), ADR-0245 push
-- event registration (§4.H), and the inline cap-check capability (§4.G) are
-- separate follow-up tickets — this migration only lands the schema + seed.
--
-- Aml. §10-6 absolute ceilings (DB-enforced via CHECK):
--   legal_default          → max 10/week, 25/4-week, 200/year
--   local_tariff_agreement → max 20/week, 50/4-week, 300/year
--   arbeidstilsynet_vedtak → non-null caps required (specific approval letter)
--   unntak_10_12           → all caps NULL (§10-12 særlig uavhengig)
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── Part A — extend overtime_agreement_type enum with unntak_10_12 ─────────
-- ADR-0254 §4.A explicitly adds a fourth tier for Aml. §10-12 særlig uavhengig
-- roles. Adding enum value in its own migration step keeps subsequent
-- ALTER TABLE atomic with the new column type.

ALTER TYPE public.overtime_agreement_type ADD VALUE IF NOT EXISTS 'unntak_10_12';

COMMIT;
BEGIN;

-- ─── Part B — create public.overtime_cap_policy ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.overtime_cap_policy (
  id                     uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           uuid          NOT NULL
                                       REFERENCES public.workspace(workspace_id)
                                       ON DELETE CASCADE,
  name                   text          NOT NULL,
  agreement_type         public.overtime_agreement_type NOT NULL,

  -- Caps. NULL permitted only when agreement_type = 'unntak_10_12' (Aml. §10-12).
  max_weekly_hours       numeric(5,2),
  max_per_4_week_period  numeric(6,2),
  max_yearly_hours       numeric(7,2),

  -- Fraction of max_*_hours at which engine_event fires (ADR-0254 §4.F).
  -- Default 0.80 = PLAN Phase 5 "80% månedlig overtid-tak" trigger.
  warn_threshold_pct     numeric(4,3)  NOT NULL DEFAULT 0.80,

  -- Exactly one per workspace must be flagged is_default = true.
  -- Enforced by partial unique index below.
  is_default             boolean       NOT NULL DEFAULT false,

  created_at             timestamptz   NOT NULL DEFAULT now(),
  updated_at             timestamptz   NOT NULL DEFAULT now(),

  UNIQUE (workspace_id, name)
);

-- Partial unique index enforces "at most one default per workspace".
CREATE UNIQUE INDEX IF NOT EXISTS idx_overtime_cap_policy_one_default_per_workspace
  ON public.overtime_cap_policy (workspace_id)
  WHERE is_default = true;

-- ─── Part C — CHECK constraints (Aml. §10-6 ceilings, DB-enforced) ──────────
-- These are not application-level validation. They live at the DB so future
-- build agents writing to overtime_cap_policy receive 23514 check_violation
-- on any policy that exceeds the national law ceiling for its tier.

ALTER TABLE public.overtime_cap_policy
  ADD CONSTRAINT chk_overtime_cap_legal_default_weekly
    CHECK (
      agreement_type <> 'legal_default'
      OR (max_weekly_hours IS NOT NULL AND max_weekly_hours <= 10)
    ),
  ADD CONSTRAINT chk_overtime_cap_legal_default_4week
    CHECK (
      agreement_type <> 'legal_default'
      OR (max_per_4_week_period IS NOT NULL AND max_per_4_week_period <= 25)
    ),
  ADD CONSTRAINT chk_overtime_cap_legal_default_yearly
    CHECK (
      agreement_type <> 'legal_default'
      OR (max_yearly_hours IS NOT NULL AND max_yearly_hours <= 200)
    ),
  ADD CONSTRAINT chk_overtime_cap_tariff_weekly
    CHECK (
      agreement_type <> 'local_tariff_agreement'
      OR (max_weekly_hours IS NOT NULL AND max_weekly_hours <= 20)
    ),
  ADD CONSTRAINT chk_overtime_cap_tariff_4week
    CHECK (
      agreement_type <> 'local_tariff_agreement'
      OR (max_per_4_week_period IS NOT NULL AND max_per_4_week_period <= 50)
    ),
  ADD CONSTRAINT chk_overtime_cap_tariff_yearly
    CHECK (
      agreement_type <> 'local_tariff_agreement'
      OR (max_yearly_hours IS NOT NULL AND max_yearly_hours <= 300)
    ),
  ADD CONSTRAINT chk_overtime_cap_arbeidstilsynet_non_null
    CHECK (
      agreement_type <> 'arbeidstilsynet_vedtak'
      OR (max_weekly_hours IS NOT NULL
          AND max_per_4_week_period IS NOT NULL
          AND max_yearly_hours IS NOT NULL)
    ),
  ADD CONSTRAINT chk_overtime_cap_unntak_null
    CHECK (
      agreement_type <> 'unntak_10_12'
      OR (max_weekly_hours IS NULL
          AND max_per_4_week_period IS NULL
          AND max_yearly_hours IS NULL)
    ),
  ADD CONSTRAINT chk_overtime_cap_warn_threshold_range
    CHECK (warn_threshold_pct > 0 AND warn_threshold_pct < 1);

-- ─── Part D — updated_at trigger ────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_overtime_cap_policy_updated_at ON public.overtime_cap_policy;
CREATE TRIGGER set_overtime_cap_policy_updated_at
  BEFORE UPDATE ON public.overtime_cap_policy
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ─── Part E — FK column on employment_contract ──────────────────────────────
-- ADR-0001-contract-service D3 §Konsekvenser line 220 declared this column;
-- ADR-0254 §4.B specifies the FK target. NULL = "use workspace default policy".

ALTER TABLE public.employment_contract
  ADD COLUMN IF NOT EXISTS overtime_cap_policy_id uuid
    REFERENCES public.overtime_cap_policy(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employment_contract_overtime_cap_policy_id
  ON public.employment_contract (overtime_cap_policy_id)
  WHERE overtime_cap_policy_id IS NOT NULL;

-- ─── Part F — RLS policies (workspace-scoped, dual JWT + API key path) ──────

ALTER TABLE public.overtime_cap_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_cap_policy FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS overtime_cap_policy_select_jwt ON public.overtime_cap_policy;
CREATE POLICY overtime_cap_policy_select_jwt
  ON public.overtime_cap_policy FOR SELECT
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user((select auth.uid())))
  );

DROP POLICY IF EXISTS overtime_cap_policy_insert_jwt ON public.overtime_cap_policy;
CREATE POLICY overtime_cap_policy_insert_jwt
  ON public.overtime_cap_policy FOR INSERT
  WITH CHECK (
    public.is_admin_in_workspace((select auth.uid()), workspace_id)
  );

DROP POLICY IF EXISTS overtime_cap_policy_update_jwt ON public.overtime_cap_policy;
CREATE POLICY overtime_cap_policy_update_jwt
  ON public.overtime_cap_policy FOR UPDATE
  USING (public.is_admin_in_workspace((select auth.uid()), workspace_id))
  WITH CHECK (public.is_admin_in_workspace((select auth.uid()), workspace_id));

DROP POLICY IF EXISTS overtime_cap_policy_delete_jwt ON public.overtime_cap_policy;
CREATE POLICY overtime_cap_policy_delete_jwt
  ON public.overtime_cap_policy FOR DELETE
  USING (public.is_admin_in_workspace((select auth.uid()), workspace_id));

-- ─── Part G — workspace bootstrap seed (ADR-0254 §4.D) ──────────────────────
-- Mirrors the pattern from 20260525120000_workspace_framework_binding_auto_seed.sql:
-- AFTER INSERT ON workspace → seed two policy rows (legal_default = is_default,
-- local_tariff_agreement = not default). Workspaces operating under a tariff
-- agreement must explicitly flip the default to the tariff row via admin action.

CREATE OR REPLACE FUNCTION public.seed_default_overtime_cap_policy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.overtime_cap_policy (
    workspace_id, name, agreement_type,
    max_weekly_hours, max_per_4_week_period, max_yearly_hours,
    warn_threshold_pct, is_default
  ) VALUES (
    NEW.workspace_id, 'Standard (Aml. §10-6 second ledd)', 'legal_default',
    10, 25, 200, 0.80, true
  )
  ON CONFLICT (workspace_id, name) DO NOTHING;

  INSERT INTO public.overtime_cap_policy (
    workspace_id, name, agreement_type,
    max_weekly_hours, max_per_4_week_period, max_yearly_hours,
    warn_threshold_pct, is_default
  ) VALUES (
    NEW.workspace_id, 'Med tariffavtale (Aml. §10-6 fourth ledd)',
    'local_tariff_agreement',
    20, 50, 300, 0.80, false
  )
  ON CONFLICT (workspace_id, name) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_overtime_cap_policy ON public.workspace;
CREATE TRIGGER trg_seed_default_overtime_cap_policy
  AFTER INSERT ON public.workspace
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_overtime_cap_policy();

-- Backfill existing workspaces — every workspace currently in the DB gets the
-- two default policy rows. Idempotent via ON CONFLICT.
INSERT INTO public.overtime_cap_policy (
  workspace_id, name, agreement_type,
  max_weekly_hours, max_per_4_week_period, max_yearly_hours,
  warn_threshold_pct, is_default
)
SELECT
  w.workspace_id, 'Standard (Aml. §10-6 second ledd)', 'legal_default',
  10, 25, 200, 0.80, true
FROM public.workspace w
ON CONFLICT (workspace_id, name) DO NOTHING;

INSERT INTO public.overtime_cap_policy (
  workspace_id, name, agreement_type,
  max_weekly_hours, max_per_4_week_period, max_yearly_hours,
  warn_threshold_pct, is_default
)
SELECT
  w.workspace_id, 'Med tariffavtale (Aml. §10-6 fourth ledd)',
  'local_tariff_agreement',
  20, 50, 300, 0.80, false
FROM public.workspace w
ON CONFLICT (workspace_id, name) DO NOTHING;

-- ─── Part H — table + column comments ───────────────────────────────────────

COMMENT ON TABLE public.overtime_cap_policy IS
  'Per-workspace overtime caps (Aml. §10-6). ADR-0254 §4.A. CHECK constraints enforce K1a national-law ceiling per tier.';

COMMENT ON COLUMN public.overtime_cap_policy.warn_threshold_pct IS
  'Fraction of max_yearly_hours at which engine_event contract.overtime_cap_warning_threshold_crossed fires (ADR-0254 §4.F, default 0.80 = PLAN Phase 5).';

COMMENT ON COLUMN public.employment_contract.overtime_cap_policy_id IS
  'FK to overtime_cap_policy. NULL = use workspace default (is_default = true). ADR-0254 §4.B.';

COMMIT;
