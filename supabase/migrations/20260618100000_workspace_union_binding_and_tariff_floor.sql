-- ============================================================
-- 20260618100000_workspace_union_binding_and_tariff_floor.sql
-- Phase 7d-followup · Sortie 2 · feat/payroll-phase-7d-followup-migration
--
-- WHY THIS EXISTS
-- ---------------
-- ADR-0353 §A (original) proposed a table named workspace_framework_binding
-- that collided with the existing cascade D3 dimension table of the same name
-- (20260421200100_cascade_a2_framework_tables.sql:135-177, 8 consumers).
-- Council 2026-05-17 Phase 3 code-trace identified the collision; chair
-- self-reversal (L-0147, 7th precedent) reversed §A and split the concept:
--
--   workspace_framework_binding   → UNTOUCHED. Cascade D3 dimension binding.
--   workspace_union_binding       → THIS FILE. Payroll lovsen tariff binding.
--
-- This migration ships all contracts ratified by the councils and recorded in:
--   ADR-0355 (table + cache-trigger contract)
--   ADR-0353 §A amended (rename + FK-bug fix)
--   ADR-0353 §D amended (tariff_binding_id column, nullable, ADR-0251 safe)
--   ADR-0351 amended (TRIGGER not CHECK per PostgreSQL subquery limitation)
--   ADR-0356 (delegation pattern — Sortie 3 ships tools; schema here only)
--
-- DESIGN MIRRORS
-- --------------
-- seed_default_framework_binding trigger pattern
-- (20260525120000_workspace_framework_binding_auto_seed.sql:74-122, L-0172).
-- All trigger functions: SECURITY DEFINER + SET search_path = public, payroll,
-- extensions. Every ON CONFLICT DO NOTHING per L-0037 idempotency principle.
--
-- COEXISTENCE
-- -----------
-- workspace_framework_binding is UNTOUCHED by this migration.
-- packages/utils/src/resolve-composition.ts:230-241 continues to read it.
-- packages/payroll-calculate/src/evaluate-supplements.ts:328 reads
-- is_tariff_bound boolean from payroll.workspace_settings — unchanged.
-- workspace_union_binding is a parallel, independent lifecycle table for the
-- payroll lovsen tariff binding concept only.
--
-- L-0172 COMPLIANCE
-- -----------------
-- All trigger functions use SECURITY DEFINER + explicit SET search_path to
-- prevent schema-shadowing attacks. Same pattern as seed_default_framework_binding
-- and workspace_seed_authority_defaults_trg.
--
-- Refs:
--   ADR-0355  — workspace_union_binding lifecycle + cache-trigger contract
--   ADR-0353  — §A + §D amendments (table rename, nullable FK column)
--   ADR-0351  — tariff-floor enforcement (TRIGGER, not CHECK)
--   ADR-0356  — delegation pattern (cascade.bind_workspace_union — Sortie 3)
--   ADR-0076  — snapshot-and-forward; APPEND-ONLY invariant
--   ADR-0173  — frozen-4 capability boundaries
--   ADR-0192  — bootstrap-trigger pattern
--   ADR-0251  — shift_pay_calculation_event append-only invariant
--   ADR-0252  — Riksavtalen versjonering; amendment-classifier
--   ADR-0341  — golden-case determinism (principle 4 — no calc engine change)
--   L-0037    — ON CONFLICT DO NOTHING idempotency
--   L-0042    — migration timestamp dependencies
--   L-0172    — SECURITY DEFINER + locked search_path (triggers)
-- ============================================================

SET search_path TO public, payroll, extensions;

-- ════════════════════════════════════════════════════════════════
-- Part A — CREATE TABLE public.workspace_union_binding
--          APPEND-ONLY lifecycle table for lovsen tariff binding.
--          One active row per workspace (effective_to IS NULL).
-- ════════════════════════════════════════════════════════════════

-- NOTE: created_by is NULLABLE by design (bootstrap exception per ADR-0355 §F):
-- At workspace INSERT moment, no profile exists yet. The auto-seed trigger
-- (Part F) inserts with created_by = NULL. Phase 7f setup_workspace_tariff
-- will insert the real BOOTSTRAP row with a valid profile. The BOOTSTRAP-BACKFILL
-- rows (Part H) also set created_by = NULL when no profile owner can be resolved.
-- All user-initiated inserts (capability tools) MUST supply created_by.

CREATE TABLE IF NOT EXISTS public.workspace_union_binding (
  workspace_union_binding_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                UUID        NOT NULL
                                          REFERENCES public.workspace(workspace_id)
                                          ON DELETE CASCADE,
  union_id                    TEXT        NOT NULL,
  -- 'taro-79' (Fellesforbundet) | 'taro-226' (Parat) | 'non-bound'
  law_version                 TEXT        NOT NULL,
  -- e.g. '2024-2026', '2025-mellomoppgjor', 'n/a' for non-bound
  official_effective_date     DATE        NOT NULL,
  -- from NHO lønnsoppgjør cirkulær per ADR-0258
  bound_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_from              DATE        NOT NULL,
  effective_to                DATE        NULL,
  -- NULL = currently active; set when superseded by new binding
  created_by                  UUID        REFERENCES public.profile(profile_id),
  -- NULLABLE: NULL allowed only for BOOTSTRAP/BOOTSTRAP-BACKFILL auto-seed rows
  -- (no profile exists at workspace INSERT time; see ADR-0355 §F + §G).
  -- Phase 7f setup_workspace_tariff MUST supply a valid created_by.
  amendment_classifier        TEXT        NOT NULL
                                          CHECK (amendment_classifier IN (
                                            'BOOTSTRAP',
                                            'UP',
                                            'MATERIAL',
                                            'ENDRINGSOPPSIGELSE',
                                            'BOOTSTRAP-BACKFILL'
                                          )),
  derivation_snapshot_id      UUID        NULL,
  -- FK to payroll.tariff_snapshot(id) — added AFTER Part B creates that table.
  -- NULL for non-bound workspaces (no snapshot derived).
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workspace_union_binding IS
  'ADR-0355: Payroll lovsen tariff binding lifecycle for each workspace. '
  'APPEND-ONLY: only effective_to may be updated after INSERT. '
  'One active row per workspace (effective_to IS NULL). '
  'Parallel to workspace_framework_binding (cascade D3) — DO NOT CONFUSE. '
  'Cache maintained on payroll.workspace_settings via trg_sync_workspace_settings_union_cache.';

COMMENT ON COLUMN public.workspace_union_binding.created_by IS
  'Profile who initiated this binding. NULL for BOOTSTRAP/BOOTSTRAP-BACKFILL auto-seed '
  'rows inserted at workspace creation time before any profile exists. '
  'All user-initiated bindings (Phase 7f capability tools) MUST supply a value. ADR-0355 §F.';

COMMENT ON COLUMN public.workspace_union_binding.effective_to IS
  'NULL = currently active binding. Set to (new_effective_from - 1 day) when superseded. '
  'The only mutable column after INSERT per APPEND-ONLY invariant (ADR-0076 + ADR-0355 §B).';

COMMENT ON COLUMN public.workspace_union_binding.derivation_snapshot_id IS
  'FK to payroll.tariff_snapshot(id). NULL for non-bound workspaces. '
  'Set when Phase 7f setup_workspace_tariff derives supplement set via Lovsen bridge.';

-- Partial unique index: one active binding per workspace.
-- Mirrors uq_workspace_active_framework on workspace_framework_binding
-- (20260421200100_cascade_a2_framework_tables.sql:147-149).
CREATE UNIQUE INDEX IF NOT EXISTS uq_workspace_active_union_binding
  ON public.workspace_union_binding (workspace_id)
  WHERE effective_to IS NULL;

-- updated_at trigger (standard pattern — set_updated_at must exist).
CREATE TRIGGER set_workspace_union_binding_updated_at
  BEFORE UPDATE ON public.workspace_union_binding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Part A.1 — APPEND-ONLY enforcement trigger ──────────────────────────────
-- Defense-in-depth: survives service_role RLS bypass. Only effective_to may
-- change. All other fields are immutable after INSERT. Per ADR-0355 §B +
-- ADR-0076 snapshot-and-forward invariant.
-- Note: updated_at is system-managed (set by set_updated_at trigger before this
-- fires in the same BEFORE UPDATE chain) — allowed to change.

CREATE OR REPLACE FUNCTION public.enforce_workspace_union_binding_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF OLD.workspace_id IS DISTINCT FROM NEW.workspace_id
     OR OLD.union_id IS DISTINCT FROM NEW.union_id
     OR OLD.law_version IS DISTINCT FROM NEW.law_version
     OR OLD.official_effective_date IS DISTINCT FROM NEW.official_effective_date
     OR OLD.bound_at IS DISTINCT FROM NEW.bound_at
     OR OLD.effective_from IS DISTINCT FROM NEW.effective_from
     OR OLD.created_by IS DISTINCT FROM NEW.created_by
     OR OLD.amendment_classifier IS DISTINCT FROM NEW.amendment_classifier
     OR OLD.derivation_snapshot_id IS DISTINCT FROM NEW.derivation_snapshot_id
     OR OLD.created_at IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION
      'workspace_union_binding is APPEND-ONLY per ADR-0355 §B. '
      'Only effective_to may change after INSERT. '
      'Attempted mutation of immutable field(s) on binding_id=%. '
      'To change union binding: INSERT a new row + close old via effective_to.',
      OLD.workspace_union_binding_id;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_workspace_union_binding_append_only IS
  'BEFORE UPDATE trigger on workspace_union_binding. Enforces APPEND-ONLY '
  'invariant (ADR-0355 §B + ADR-0076): only effective_to may change. '
  'SECURITY DEFINER survives service_role RLS bypass. L-0172 compliant.';

DROP TRIGGER IF EXISTS trg_workspace_union_binding_append_only
  ON public.workspace_union_binding;

CREATE TRIGGER trg_workspace_union_binding_append_only
  BEFORE UPDATE ON public.workspace_union_binding
  FOR EACH ROW EXECUTE FUNCTION public.enforce_workspace_union_binding_append_only();

COMMENT ON TRIGGER trg_workspace_union_binding_append_only
  ON public.workspace_union_binding IS
  'ADR-0355 §B APPEND-ONLY enforcement. Runs BEFORE set_workspace_union_binding_updated_at '
  'in alphabetical trigger name order. Blocks all mutations except effective_to.';

-- ─── Part A.2 — RLS ──────────────────────────────────────────────────────────
-- 5-policy pattern matching workspace_framework_binding
-- (20260421200100_cascade_a2_framework_tables.sql:151-171).
-- jwt_update is allowed: the APPEND-ONLY trigger (Part A.1) enforces the
-- immutability constraint at DB level, surviving RLS bypass.

ALTER TABLE public.workspace_union_binding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_workspace_union_binding"
  ON public.workspace_union_binding;
CREATE POLICY "jwt_select_workspace_union_binding"
  ON public.workspace_union_binding
  FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_insert_workspace_union_binding"
  ON public.workspace_union_binding;
CREATE POLICY "jwt_insert_workspace_union_binding"
  ON public.workspace_union_binding
  FOR INSERT
  WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- UPDATE allowed (APPEND-ONLY trigger restricts to effective_to only).
DROP POLICY IF EXISTS "jwt_update_workspace_union_binding"
  ON public.workspace_union_binding;
CREATE POLICY "jwt_update_workspace_union_binding"
  ON public.workspace_union_binding
  FOR UPDATE
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_workspace_union_binding"
  ON public.workspace_union_binding;
CREATE POLICY "api_key_read_workspace_union_binding"
  ON public.workspace_union_binding
  FOR SELECT
  USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_workspace_union_binding"
  ON public.workspace_union_binding;
CREATE POLICY "service_role_workspace_union_binding"
  ON public.workspace_union_binding
  FOR ALL
  USING (auth.role() = 'service_role');

-- ════════════════════════════════════════════════════════════════
-- Part B — CREATE TABLE payroll.tariff_snapshot
--          Immutable provenance record of the derived supplement +
--          rate state at binding time. Schema = payroll per ADR-0353
--          §A Phase 5 self-reversal (payroll-tracer namespace-ownership).
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payroll.tariff_snapshot (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID        NOT NULL
                                      REFERENCES public.workspace(workspace_id)
                                      ON DELETE CASCADE,
  derived_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  derivation_version      TEXT        NOT NULL,
  -- e.g. 'lovdata-mcp@v1+taro-79@2025-mellomoppgjor'
  source_paragraph_refs   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- ADR-0256 citation envelopes per supplement
  rules_persisted_count   INTEGER     NOT NULL DEFAULT 0,
  rates_persisted_count   INTEGER     NOT NULL DEFAULT 0,
  incomplete_supplements  JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- Supplement types where Lovsen derivation yielded no rate (advisory list)
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
  -- NO updated_at — snapshots are immutable (ADR-0076 snapshot-and-forward).
);

COMMENT ON TABLE payroll.tariff_snapshot IS
  'ADR-0355 + ADR-0353 amended §A: Immutable provenance record of the derived '
  'supplement + rate state at workspace tariff binding time. Written by Phase 7f '
  'setup_workspace_tariff via Lovsen bridge (ADR-0350). No updates — append-only. '
  'Referenced by workspace_union_binding.derivation_snapshot_id.';

CREATE INDEX IF NOT EXISTS idx_tariff_snapshot_workspace
  ON payroll.tariff_snapshot (workspace_id);

-- RLS
ALTER TABLE payroll.tariff_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_select_tariff_snapshot" ON payroll.tariff_snapshot;
CREATE POLICY "jwt_select_tariff_snapshot" ON payroll.tariff_snapshot
  FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- Snapshots are written by capability tools via service_role delegation only.
-- No JWT INSERT: direct user-facing inserts are forbidden (ADR-0173 frozen-4 +
-- ADR-0356 delegation). service_role policy covers capability tool writes.
DROP POLICY IF EXISTS "api_key_read_tariff_snapshot" ON payroll.tariff_snapshot;
CREATE POLICY "api_key_read_tariff_snapshot" ON payroll.tariff_snapshot
  FOR SELECT
  USING (workspace_id = get_api_workspace_id());

DROP POLICY IF EXISTS "service_role_tariff_snapshot" ON payroll.tariff_snapshot;
CREATE POLICY "service_role_tariff_snapshot" ON payroll.tariff_snapshot
  FOR ALL
  USING (auth.role() = 'service_role');

-- ─── Part B.1 — Add FK from workspace_union_binding to tariff_snapshot ───────
-- Deferred until here because the referenced table (payroll.tariff_snapshot)
-- did not exist when workspace_union_binding was created in Part A.

ALTER TABLE public.workspace_union_binding
  ADD CONSTRAINT fk_workspace_union_binding_snapshot
  FOREIGN KEY (derivation_snapshot_id)
  REFERENCES payroll.tariff_snapshot(id);

-- ════════════════════════════════════════════════════════════════
-- Part C — ALTER payroll.workspace_settings
--          Add active_union_id + active_binding_id cache columns.
--          These are trigger-maintained denormalized reads (Part E).
--          is_tariff_bound column ALREADY EXISTS from
--          20260527100200_payroll_phase1_workspace_policies.sql:74-83.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE payroll.workspace_settings
  ADD COLUMN IF NOT EXISTS active_union_id   TEXT NULL,
  ADD COLUMN IF NOT EXISTS active_binding_id UUID NULL
    REFERENCES public.workspace_union_binding(workspace_union_binding_id);

COMMENT ON COLUMN payroll.workspace_settings.active_union_id IS
  'Trigger-maintained cache of workspace_union_binding.union_id WHERE effective_to IS NULL. '
  'NULL until backfill complete or until workspace completes tariff setup. '
  'Read by: calc engine hot-path (prefer this over querying workspace_union_binding). '
  'Written by: trg_sync_workspace_settings_union_cache only. ADR-0355 §D.';

COMMENT ON COLUMN payroll.workspace_settings.active_binding_id IS
  'Trigger-maintained FK to the currently active workspace_union_binding row. '
  'NULL until backfill complete. Written by trg_sync_workspace_settings_union_cache. '
  'ADR-0355 §D. ADR-0353 amended §A.';

-- ════════════════════════════════════════════════════════════════
-- Part D — ALTER public.shift_pay_calculation_event
--          Add tariff_binding_id (nullable).
--          Per ADR-0353 §D amendment 2026-05-17: column is NULLABLE
--          because historical rows (pre-ADR-0355) cannot be backfilled
--          (ADR-0251 append-only audit invariant).
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public.shift_pay_calculation_event
  ADD COLUMN IF NOT EXISTS tariff_binding_id UUID NULL
    REFERENCES public.workspace_union_binding(workspace_union_binding_id);

COMMENT ON COLUMN public.shift_pay_calculation_event.tariff_binding_id IS
  'FK to workspace_union_binding active at calc-time. '
  'NULL for pre-ADR-0355 historical rows (append-only audit; cannot be backfilled). '
  'Per ADR-0353 §D amendment 2026-05-17 + ADR-0251 append-only invariant. '
  'Set by calc engine at calculation time via provenance chain (ADR-0076).';

-- ════════════════════════════════════════════════════════════════
-- Part E — Cache sync trigger
--          Fires AFTER INSERT OR UPDATE on workspace_union_binding.
--          When a row with effective_to IS NULL is written (active binding),
--          syncs is_tariff_bound + active_union_id + active_binding_id on
--          payroll.workspace_settings. Per ADR-0355 §E.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_workspace_settings_union_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, payroll, extensions
AS $$
BEGIN
  -- Only sync when this row is/becomes the ACTIVE binding (effective_to IS NULL).
  -- When effective_to is set (binding closed), the companion INSERT of the new
  -- binding (delegation tool two-step: close-old → insert-new) will re-sync.
  -- The UPDATE path here is defensive: catches admin tooling that closes a binding
  -- without immediately inserting a successor (should not occur in normal flow).
  IF NEW.effective_to IS NULL THEN
    UPDATE payroll.workspace_settings
       SET is_tariff_bound   = (NEW.union_id != 'non-bound'),
           active_union_id   = NEW.union_id,
           active_binding_id = NEW.workspace_union_binding_id
     WHERE workspace_id = NEW.workspace_id;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_workspace_settings_union_cache IS
  'AFTER INSERT/UPDATE trigger on workspace_union_binding. '
  'Syncs payroll.workspace_settings cache columns when active binding row changes. '
  'SECURITY DEFINER + locked search_path per L-0172. '
  'Only fires when effective_to IS NULL (row is/becomes active). ADR-0355 §E.';

DROP TRIGGER IF EXISTS trg_sync_workspace_settings_union_cache
  ON public.workspace_union_binding;

CREATE TRIGGER trg_sync_workspace_settings_union_cache
  AFTER INSERT OR UPDATE OF effective_to ON public.workspace_union_binding
  FOR EACH ROW EXECUTE FUNCTION public.sync_workspace_settings_union_cache();

COMMENT ON TRIGGER trg_sync_workspace_settings_union_cache
  ON public.workspace_union_binding IS
  'ADR-0355 §E: Cache sync trigger. AFTER INSERT or UPDATE OF effective_to. '
  'Maintains payroll.workspace_settings.{is_tariff_bound, active_union_id, active_binding_id} '
  'as denormalized hot-path cache for calc engine reads.';

-- ════════════════════════════════════════════════════════════════
-- Part F — Auto-seed trigger on workspace INSERT
--          Parallel to trg_workspace_seed_default_binding (cascade).
--          Inserts a skeleton non-bound row on every workspace INSERT.
--          Ensures ADR-0252 §B fan-out query always returns a defined
--          result. Real binding created by Phase 7f setup_workspace_tariff.
--
--          IMPORTANT: This trigger is a DEFERRED STUB. The real seeding
--          flow is: Phase 7f setup_workspace_tariff capability tool →
--          cascade.bind_workspace_union (ADR-0356) → workspace_union_binding
--          INSERT. The trigger here mirrors the parallel-trigger pattern
--          from seed_default_framework_binding so the hook point exists
--          for future bootstrap-cascade-EF integration. The trigger body
--          performs a RAISE NOTICE only (see design note below).
--
--          DESIGN NOTE on created_by NULL:
--          At workspace INSERT time, no profile row exists yet (profiles
--          are inserted later in the bootstrap-cascade chain per the comment
--          in 20260525120000_workspace_framework_binding_auto_seed.sql:69-72).
--          created_by is nullable (see Part A column definition). The skeleton
--          row uses NULL. Phase 7f setup_workspace_tariff will close this
--          skeleton row (effective_to = now()) and INSERT a real BOOTSTRAP
--          row with a valid created_by. ADR-0355 §F.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.seed_default_workspace_union_binding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, payroll, extensions
AS $$
BEGIN
  -- Insert skeleton non-bound binding. ON CONFLICT DO NOTHING (L-0037 idempotent).
  -- created_by = NULL: no profile exists at workspace INSERT moment.
  -- amendment_classifier = 'BOOTSTRAP': marks this as the initial system-seeded row.
  -- derivation_snapshot_id = NULL: no tariff derived for non-bound skeleton.
  -- The cache trigger (trg_sync_workspace_settings_union_cache) fires after this
  -- INSERT and sets workspace_settings.is_tariff_bound=false, active_union_id='non-bound'.
  INSERT INTO public.workspace_union_binding (
    workspace_id,
    union_id,
    law_version,
    official_effective_date,
    effective_from,
    created_by,
    amendment_classifier,
    derivation_snapshot_id
  )
  VALUES (
    NEW.workspace_id,
    'non-bound',
    'n/a',
    CURRENT_DATE,
    CURRENT_DATE,
    NULL,  -- no profile exists at workspace INSERT; see column comment
    'BOOTSTRAP',
    NULL
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE
    'seed_default_workspace_union_binding: skeleton non-bound binding seeded for '
    'workspace_id=%. Phase 7f setup_workspace_tariff will replace via BOOTSTRAP row. '
    'ADR-0355 §F.',
    NEW.workspace_id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.seed_default_workspace_union_binding IS
  'AFTER INSERT trigger on workspace. Seeds skeleton non-bound workspace_union_binding '
  'row so ADR-0252 §B fan-out query always returns a defined result. '
  'Mirrors seed_default_framework_binding pattern (ADR-0192). '
  'created_by=NULL: no profile exists at workspace INSERT time. '
  'Phase 7f setup_workspace_tariff replaces this row with a real BOOTSTRAP row. '
  'SECURITY DEFINER + locked search_path per L-0172. ON CONFLICT DO NOTHING per L-0037.';

DROP TRIGGER IF EXISTS trg_seed_default_workspace_union_binding ON public.workspace;

CREATE TRIGGER trg_seed_default_workspace_union_binding
  AFTER INSERT ON public.workspace
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_workspace_union_binding();

COMMENT ON TRIGGER trg_seed_default_workspace_union_binding ON public.workspace IS
  'ADR-0355 §F: Auto-seed skeleton workspace_union_binding on workspace INSERT. '
  'Coexists with workspace_seed_authority_defaults_trg + trg_botsson_channel_on_workspace '
  '+ trg_workspace_seed_default_binding — independent AFTER INSERT FOR EACH ROW triggers. '
  'PostgreSQL executes in alphabetical name order; no ordering dependency. ADR-0192 pattern.';

-- ════════════════════════════════════════════════════════════════
-- Part G — Tariff-floor enforcement trigger on public.supplement_rule
--          Per ADR-0351 amended Decision Outcome 2026-05-17:
--          TRIGGER (not CHECK) is the primary enforcement mechanism because
--          PostgreSQL CHECK constraints cannot contain subqueries referencing
--          other tables. Target is public.supplement_rule (not payroll.
--          supplement_rule — code-trace authority per ADR-0351 amendment:
--          packages/payroll-calculate/src/types.ts:99-121 defines
--          SupplementRuleInput with workspace_id: string | null, matching
--          public.supplement_rule shape).
--          L-0172 compliant. SECURITY DEFINER + locked search_path.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.enforce_supplement_tariff_floor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, payroll, extensions
AS $$
DECLARE
  v_is_bound      BOOLEAN;
  v_active_union  TEXT;
  v_floor         NUMERIC;
BEGIN
  -- Platform-template rules (workspace_id IS NULL) are themselves the floor —
  -- skip enforcement. These rows ARE the Riksavtalen minima.
  IF NEW.workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Lookup cache from workspace_settings (populated by Part E cache trigger).
  -- Prefer cache over joining workspace_union_binding (hot-path per ADR-0355 §D).
  SELECT is_tariff_bound, active_union_id
    INTO v_is_bound, v_active_union
    FROM payroll.workspace_settings
   WHERE workspace_id = NEW.workspace_id;

  -- Workspace not found in workspace_settings → no floor (workspace may not yet
  -- have settings row if called before bootstrap completes).
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Non-tariff-bound workspace → no floor restriction.
  -- Aml. §14-15 lønnstrekk-forbud only applies to tariff-bound workspaces.
  IF v_is_bound IS NULL OR v_is_bound = false THEN
    RETURN NEW;
  END IF;

  -- Tariff-bound but no active union → invalid cache state.
  -- Should be impossible after ADR-0355 cache trigger lands (Part E) and
  -- Part J CHECK constraint is applied.
  IF v_active_union IS NULL OR v_active_union = 'non-bound' THEN
    RAISE EXCEPTION
      'workspace_settings.is_tariff_bound=true requires active_union_id != non-bound. '
      'Invalid cache state detected. workspace_id=%. '
      'Run trg_sync_workspace_settings_union_cache manually or check backfill.',
      NEW.workspace_id;
  END IF;

  -- Lookup minimum tariff rate for this supplement type + current period.
  -- tariff_rate_table.rate_type matches supplement_rule.supplement_type codes.
  -- Includes both platform rows (workspace_id IS NULL) and workspace-specific rows.
  -- No union_id filter on tariff_rate_table: the active rates for this workspace
  -- are already scoped by the binding (workspace-specific rows shadow platform rows
  -- per the eval order in evaluateSupplements). MIN across both layers gives floor.
  SELECT MIN(amount)
    INTO v_floor
    FROM public.tariff_rate_table
   WHERE rate_type = NEW.supplement_type
     AND (workspace_id IS NULL OR workspace_id = NEW.workspace_id)
     AND effective_from <= CURRENT_DATE
     AND (effective_until IS NULL OR effective_until > CURRENT_DATE);

  -- No tariff row found for this supplement type → no floor to enforce.
  -- Lovsen-pending coverage: tariff_rate_table may not yet have rows for all
  -- supplement types (derivation in Phase 7c/7e). Allow write.
  IF v_floor IS NULL THEN
    RETURN NEW;
  END IF;

  -- Floor enforcement: reject write below tariff minimum.
  -- Aml. §14-15 lønnstrekk-forbud: employer cannot structurally reduce wages
  -- below collectively agreed floor, regardless of individual agreement.
  IF NEW.rate_value < v_floor THEN
    RAISE EXCEPTION
      'supplement_rate_below_tariff_floor: rate_value=%, tariff_floor=%, '
      'aml_ref=§14-15, workspace_id=%, supplement_type=%. '
      'For tariff-bound workspaces, supplement rates cannot be set below '
      'the Riksavtalen minimum. Increase the rate or set to >= %.',
      NEW.rate_value, v_floor, NEW.workspace_id, NEW.supplement_type, v_floor;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_supplement_tariff_floor IS
  'BEFORE INSERT/UPDATE trigger on public.supplement_rule. '
  'Enforces Aml. §14-15 lønnstrekk-forbud for tariff-bound workspaces: '
  'supplement rates cannot be set below the active tariff floor. '
  'Per ADR-0351 amended 2026-05-17 (TRIGGER not CHECK — PostgreSQL subquery limit). '
  'Target: public.supplement_rule (workspace_id nullable, platform + workspace rows). '
  'SECURITY DEFINER + locked search_path per L-0172.';

DROP TRIGGER IF EXISTS trg_enforce_supplement_tariff_floor ON public.supplement_rule;

CREATE TRIGGER trg_enforce_supplement_tariff_floor
  BEFORE INSERT OR UPDATE OF rate_value, supplement_type, workspace_id
  ON public.supplement_rule
  FOR EACH ROW EXECUTE FUNCTION public.enforce_supplement_tariff_floor();

COMMENT ON TRIGGER trg_enforce_supplement_tariff_floor ON public.supplement_rule IS
  'ADR-0351 amended: BEFORE INSERT/UPDATE trigger enforcing tariff-floor policy. '
  'Defense-in-depth layer (capability tool add_supplement_override validates client-side '
  'first; this trigger fires at DB level regardless of write path). '
  'Only fires for workspace-scoped rows (workspace_id IS NOT NULL). ';

-- ════════════════════════════════════════════════════════════════
-- Part H — BOOTSTRAP-BACKFILL for existing workspaces
--          One active workspace_union_binding row per existing workspace.
--          ON CONFLICT DO NOTHING (L-0037 idempotent — safe to re-run).
--          Cache trigger fires for each inserted row →
--          workspace_settings.active_union_id = 'non-bound',
--          is_tariff_bound = false.
--          Per ADR-0355 §G.
-- ════════════════════════════════════════════════════════════════

-- NOTE: created_by = NULL for BOOTSTRAP-BACKFILL rows. No admin actor is
-- available at migration time. This mirrors the backfill pattern in
-- 20260525120000_workspace_framework_binding_auto_seed.sql:158-175 where
-- activated_by = NULL is used for the same reason.

INSERT INTO public.workspace_union_binding (
  workspace_id,
  union_id,
  law_version,
  official_effective_date,
  effective_from,
  effective_to,
  created_by,
  amendment_classifier,
  derivation_snapshot_id
)
SELECT
  w.workspace_id,
  'non-bound',
  'n/a',
  CURRENT_DATE,
  CURRENT_DATE,
  NULL,   -- effective_to = NULL → currently active
  NULL,   -- BOOTSTRAP-BACKFILL: no admin actor; system-initiated
  'BOOTSTRAP-BACKFILL',
  NULL    -- no tariff derived for non-bound
FROM public.workspace w
WHERE NOT EXISTS (
  SELECT 1
    FROM public.workspace_union_binding b
   WHERE b.workspace_id = w.workspace_id
     AND b.effective_to IS NULL
)
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════════════════════════════
-- Part I — Pre-migration audit DO-block
--          Verify zero existing public.supplement_rule rows would
--          violate the tariff floor under the new trigger (Part G).
--          Informational only: trigger fires only on FUTURE writes.
--          Existing rows are immutable per ADR-0251 append-only.
-- ════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_violations INT;
BEGIN
  -- Count workspace-scoped supplement_rule rows that are below the tariff floor
  -- for workspaces already marked is_tariff_bound = true.
  SELECT COUNT(*)
    INTO v_violations
    FROM public.supplement_rule sr
   WHERE sr.workspace_id IS NOT NULL
     AND EXISTS (
       SELECT 1
         FROM payroll.workspace_settings ws
        WHERE ws.workspace_id = sr.workspace_id
          AND ws.is_tariff_bound = true
     )
     AND sr.rate_value < COALESCE(
       (
         SELECT MIN(amount)
           FROM public.tariff_rate_table trt
          WHERE trt.rate_type = sr.supplement_type
            AND (trt.workspace_id IS NULL OR trt.workspace_id = sr.workspace_id)
            AND trt.effective_from <= CURRENT_DATE
            AND (trt.effective_until IS NULL OR trt.effective_until > CURRENT_DATE)
       ),
       0  -- no floor row = floor is 0 = no violation possible
     );

  IF v_violations > 0 THEN
    RAISE NOTICE
      'Part I audit: % existing public.supplement_rule row(s) are below tariff floor '
      'for tariff-bound workspaces. These rows are INFORMATIONAL ONLY — the trigger '
      'fires on FUTURE writes only (ADR-0251 append-only; historical rows immutable). '
      'Consider reviewing these rows in the Phase 7f supplement override flow.',
      v_violations;
  ELSE
    RAISE NOTICE
      'Part I audit: zero existing public.supplement_rule rows below tariff floor. '
      'Clean baseline for Part G trigger activation.';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════
-- Part J — Post-backfill CHECK constraint + self-test DO-block
--          Apply CHECK constraint on workspace_settings after the
--          backfill (Part H) has fired the cache trigger and populated
--          active_union_id. Then verify all assertions pass.
-- ════════════════════════════════════════════════════════════════

-- Coherence constraint: is_tariff_bound must agree with active_union_id.
-- Applied AFTER backfill so existing rows that the cache trigger just
-- populated are included in the constraint validation.
-- Per ADR-0355 §D "Eventual CHECK constraint".

ALTER TABLE payroll.workspace_settings
  DROP CONSTRAINT IF EXISTS chk_tariff_bound_union_id_coherence;

ALTER TABLE payroll.workspace_settings
  ADD CONSTRAINT chk_tariff_bound_union_id_coherence
  CHECK (
    (is_tariff_bound = true
     AND active_union_id IS NOT NULL
     AND active_union_id != 'non-bound')
    OR
    (is_tariff_bound = false
     AND (active_union_id IS NULL OR active_union_id = 'non-bound'))
  );

COMMENT ON CONSTRAINT chk_tariff_bound_union_id_coherence
  ON payroll.workspace_settings IS
  'ADR-0355 §D: coherence between is_tariff_bound boolean and active_union_id cache. '
  'is_tariff_bound=true requires active_union_id IN (non-null, non-"non-bound"). '
  'Applied after backfill (Part H) so constraint validates against populated cache rows.';

-- Self-test: verify the cache trigger is correctly wired and any workspaces
-- that DO have payroll.workspace_settings rows are correctly synced.
--
-- NOTE: payroll.workspace_settings rows are created at workspace bootstrap time
-- (not by workspace INSERT directly). In local dev and migration-only runs,
-- workspace_settings may be empty (workspaces created but not yet bootstrapped).
-- The self-test scopes assertions to workspaces WHERE workspace_settings EXISTS.

DO $$
DECLARE
  v_cache_mismatch    INT;
  v_workspaces_total  INT;
  v_workspaces_bound  INT;
  v_settings_count    INT;
BEGIN
  -- Count workspace_settings rows (may be 0 in local dev before bootstrap).
  SELECT COUNT(*) INTO v_settings_count FROM payroll.workspace_settings;

  IF v_settings_count = 0 THEN
    -- No workspace_settings rows: cache trigger is wired but had no rows to sync.
    -- This is expected in local dev environments where workspaces were created
    -- without going through the full bootstrap wizard that populates workspace_settings.
    -- The trigger is correctly registered and will sync on the next INSERT into
    -- workspace_union_binding when a settings row exists.
    RAISE NOTICE
      '20260618100000 self-test INFO: payroll.workspace_settings has 0 rows. '
      'Cache trigger is registered and will sync on next workspace bootstrap. '
      'Backfill INSERTs fired cache trigger; found no settings rows to UPDATE '
      '(expected in migration-only local dev runs without full bootstrap). '
      'workspace_union_binding has % active binding row(s).',
      (SELECT COUNT(*) FROM public.workspace_union_binding WHERE effective_to IS NULL);

  ELSE
    -- Test: For workspaces that DO have settings rows, cache must be populated.
    SELECT COUNT(*)
      INTO v_cache_mismatch
      FROM public.workspace_union_binding wub
      JOIN payroll.workspace_settings ws ON ws.workspace_id = wub.workspace_id
     WHERE wub.effective_to IS NULL
       AND (
         ws.active_union_id IS DISTINCT FROM wub.union_id
         OR ws.active_binding_id IS DISTINCT FROM wub.workspace_union_binding_id
       );

    IF v_cache_mismatch > 0 THEN
      RAISE EXCEPTION
        '20260618100000 self-test FAILED: % active workspace_union_binding row(s) '
        'have a workspace_settings row but the cache is missing or mismatched. '
        'Check trg_sync_workspace_settings_union_cache. '
        'workspace_settings count=%, binding rows examined.',
        v_cache_mismatch, v_settings_count;
    END IF;

    RAISE NOTICE
      '20260618100000 self-test PASSED: cache_mismatch=0 (scoped to % workspace(s) '
      'with workspace_settings rows). ADR-0355 cache trigger verified.',
      v_settings_count;
  END IF;

  -- Diagnostic counts (informational — not assertions)
  SELECT COUNT(*) INTO v_workspaces_total FROM public.workspace;
  SELECT COUNT(*) INTO v_workspaces_bound
    FROM public.workspace_union_binding
   WHERE effective_to IS NULL;

  RAISE NOTICE
    '20260618100000 migration complete: '
    'workspaces_total=%, workspaces_with_active_binding=%, '
    'workspace_settings_rows=%. '
    'ADR-0355 contracts: workspace_union_binding + tariff_snapshot created. '
    'ADR-0353 §A+§D applied. ADR-0351 tariff-floor trigger on supplement_rule.',
    v_workspaces_total, v_workspaces_bound, v_settings_count;
END $$;
