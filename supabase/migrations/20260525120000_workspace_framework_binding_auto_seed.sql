-- ============================================
-- 20260525120000_workspace_framework_binding_auto_seed.sql
-- SMA-309 · Phase 1 · sortie feat/contract-binding-auto-seed
--
-- Closes the "fresh workspace = 400 on first contract" failure mode by
-- auto-seeding workspace_framework_binding (K1b) on every workspace INSERT,
-- pointing at the K1a hospitality.no.default.v1 framework.
--
-- WHY THIS EXISTS
-- ---------------
-- packages/utils/src/resolve-composition.ts:230-241 calls
-- .from("workspace_framework_binding").select(...).eq("is_active",true).single()
-- — fresh workspaces have no row → PGRST116 → 500 → first contract send fails.
-- Today bootstrap-cascade EF (functions/bootstrap-cascade/index.ts:412-462)
-- is the only auto-seed path; it's not always invoked from finalize-workspace
-- (separate Edge Function, called only via /onboarding wizard, not /join).
--
-- This trigger guarantees the row exists for EVERY workspace path:
--   (1) /join wizard → finalize-workspace EF → workspace INSERT → trigger
--   (2) /onboarding wizard → bootstrap-cascade EF → workspace INSERT → trigger
--   (3) Migration backfill (Bubble import, test seeds, supabase db reset)
--   (4) Any future workspace-creation path
--
-- DESIGN MIRRORS workspace_seed_authority_defaults_trg (ADR-0192)
-- ---------------------------------------------------------------
-- Same shape: AFTER INSERT FOR EACH ROW, SECURITY DEFINER + locked search_path,
-- ON CONFLICT DO NOTHING, RAISE NOTICE on missing prerequisite, DROP TRIGGER
-- IF EXISTS before recreate. Coexists with the 2 existing AFTER INSERT
-- triggers on workspace (workspace_seed_authority_defaults_trg,
-- trg_botsson_channel_on_workspace) — independent concerns, parallel order.
--
-- COEXISTENCE WITH bootstrap-cascade EDGE FUNCTION
-- ------------------------------------------------
-- bootstrap-cascade/index.ts:424 uses .upsert(..., { ignoreDuplicates: true })
-- → after this trigger lands, the EF sees the row, no-ops, then SELECTs the
-- existing id for downstream tariff-rate copy. Behaviour identical, idempotent.
--
-- WHY HARDCODE hospitality.no.default.v1
-- --------------------------------------
-- Current customer base = 100% hospitality. ADR-0076 derives composition off
-- this framework. When non-hospitality lands, niche-aware selection (lookup
-- via workspace.industry_code → matching framework.code) becomes a separate
-- sortie — not a SMA-309 blocker. Fail-closed semantics: if framework is
-- missing, trigger logs RAISE NOTICE + skips, workspace insert still succeeds,
-- first contract send still 400s with same error as today (no regression).
--
-- L-0172 COMPLIANCE
-- -----------------
-- SECURITY DEFINER without locked search_path = silent RLS bypass risk.
-- This function explicitly SET search_path = public, extensions before any
-- table reference, prevents schema-shadowing attacks.
--
-- Refs: SMA-309, ADR-0076 (composition cascade), ADR-0192 (bootstrap-trigger
-- pattern), ADR-0241 (contract schema migration foundation),
-- L-0107 (authority appearance ≠ presence), L-0172 (trigger SECURITY trap).
-- ============================================

SET search_path TO public, extensions;

-- ─────────────────────────────────────────────────────────────────────
-- Part A — Trigger function: seed_default_framework_binding
-- ─────────────────────────────────────────────────────────────────────
-- Looks up the active K1a hospitality framework by canonical code.
-- If found: INSERT a binding row pointing at it.
-- If missing: RAISE NOTICE + skip (do NOT fail workspace insert — fail-closed
-- on framework, fail-open on workspace creation; manager's first contract
-- send will surface the missing-framework state via existing 400 path).
--
-- activated_by is NULL by design: at workspace INSERT moment there is no
-- profile yet (profile rows are inserted by company_member promotion later
-- in the bootstrap-cascade chain). NULL on activated_by is allowed by the
-- column definition (REFERENCES profile(profile_id) — nullable FK).

CREATE OR REPLACE FUNCTION public.seed_default_framework_binding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_framework_id UUID;
BEGIN
  -- Look up the canonical hospitality framework (K1a, platform-level).
  -- LIMIT 1 guards against a hypothetical duplicate-code state (the table
  -- has UNIQUE(code) so this is belt-and-braces).
  SELECT framework_id
    INTO v_framework_id
    FROM public.regulatory_framework
   WHERE code = 'hospitality.no.default.v1'
     AND is_active = true
   LIMIT 1;

  IF v_framework_id IS NULL THEN
    RAISE NOTICE
      'seed_default_framework_binding: K1a framework hospitality.no.default.v1 not found or inactive — workspace_id=% has NO active framework binding. First contract send will 400. Verify K1a seed migrations applied.',
      NEW.workspace_id;
    RETURN NEW;
  END IF;

  -- Idempotent insert. Partial unique uq_workspace_active_framework guarantees
  -- only one is_active=true binding per workspace. ON CONFLICT DO NOTHING
  -- (no target) covers any duplicate insert path including bootstrap-cascade
  -- EF and future seed migrations.
  INSERT INTO public.workspace_framework_binding (
    workspace_id,
    framework_id,
    is_active,
    activated_at,
    activated_by
  )
  VALUES (
    NEW.workspace_id,
    v_framework_id,
    true,
    now(),
    NULL  -- no profile exists yet at workspace INSERT moment
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.seed_default_framework_binding IS
  'AFTER INSERT trigger on workspace. Auto-seeds workspace_framework_binding pointing at K1a hospitality.no.default.v1 framework. Closes SMA-309 "fresh workspace = 400 on first contract". Fail-closed: skips if K1a row missing (RAISE NOTICE), workspace insert still succeeds. SECURITY DEFINER + locked search_path per L-0172. Idempotent with bootstrap-cascade EF via ON CONFLICT DO NOTHING.';

-- ─────────────────────────────────────────────────────────────────────
-- Part B — Trigger registration
-- ─────────────────────────────────────────────────────────────────────
-- Drop + recreate for replay-safety. Coexists peer-level with
-- workspace_seed_authority_defaults_trg + trg_botsson_channel_on_workspace.

DROP TRIGGER IF EXISTS trg_workspace_seed_default_binding ON public.workspace;

CREATE TRIGGER trg_workspace_seed_default_binding
  AFTER INSERT ON public.workspace
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_framework_binding();

COMMENT ON TRIGGER trg_workspace_seed_default_binding ON public.workspace IS
  'SMA-309: Auto-seed K1b workspace_framework_binding on workspace INSERT. Mirrors workspace_seed_authority_defaults_trg pattern (ADR-0192). Independent of trg_botsson_channel_on_workspace + workspace_seed_authority_defaults_trg — concurrent AFTER INSERT triggers.';

-- ─────────────────────────────────────────────────────────────────────
-- Part C — One-time backfill for existing workspaces missing a binding
-- ─────────────────────────────────────────────────────────────────────
-- Idempotent via NOT EXISTS subquery + ON CONFLICT DO NOTHING. Targets
-- ONLY workspaces with NO is_active=true binding — does not disturb
-- workspaces already bound (incl. bootstrap-cascade-seeded ones).
--
-- Skips silently if K1a framework missing (CROSS JOIN yields zero rows).

INSERT INTO public.workspace_framework_binding (
  workspace_id,
  framework_id,
  is_active,
  activated_at,
  activated_by
)
SELECT
  w.workspace_id,
  rf.framework_id,
  true,
  now(),
  NULL
FROM public.workspace w
CROSS JOIN public.regulatory_framework rf
WHERE rf.code = 'hospitality.no.default.v1'
  AND rf.is_active = true
  AND NOT EXISTS (
    SELECT 1
      FROM public.workspace_framework_binding b
     WHERE b.workspace_id = w.workspace_id
       AND b.is_active = true
  )
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- Part D — Falsifiable self-test (fail-fast on apply)
-- ─────────────────────────────────────────────────────────────────────
-- Mirrors the assertion pattern at end of 20260519100000 (botsson channel
-- bootstrap). If any workspace exists without an active binding AFTER this
-- migration runs (and the K1a framework exists), the migration FAILS rather
-- than committing a half-fixed state.

DO $$
DECLARE
  v_framework_exists BOOLEAN;
  v_orphan_workspaces INT;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.regulatory_framework
     WHERE code = 'hospitality.no.default.v1' AND is_active = true
  ) INTO v_framework_exists;

  IF NOT v_framework_exists THEN
    RAISE NOTICE
      'seed_default_framework_binding: K1a hospitality.no.default.v1 not seeded. Backfill skipped. Trigger registered for future workspaces but will no-op until K1a seed migration applied. NOT FAILING — K1a may be seeded by a later migration.';
    RETURN;
  END IF;

  SELECT COUNT(*)
    INTO v_orphan_workspaces
    FROM public.workspace w
   WHERE NOT EXISTS (
     SELECT 1 FROM public.workspace_framework_binding b
      WHERE b.workspace_id = w.workspace_id AND b.is_active = true
   );

  IF v_orphan_workspaces > 0 THEN
    RAISE EXCEPTION
      'seed_default_framework_binding migration FAILED self-test: % workspaces still lack active framework binding after backfill. Investigate workspace_framework_binding RLS or partial unique index state.',
      v_orphan_workspaces;
  END IF;

  RAISE NOTICE
    'seed_default_framework_binding: backfill + trigger verified. Zero orphan workspaces. SMA-309 Phase 1 complete.';
END $$;
