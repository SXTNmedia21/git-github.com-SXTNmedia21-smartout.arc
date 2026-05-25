-- ============================================================================
-- 20260716200100_employment_form_volunteer_recovery.sql
--
-- ADR-0428 Part 2 of 2 — Best-effort recovery of pre-Wave-3 bubble-migration
-- volunteer contracts + column comment update. Runs in a SEPARATE transaction
-- from 20260716200000 (which added the 'volunteer' enum value) because
-- PG 12+ forbids reading the new enum value in the transaction that added it.
--
-- HEURISTIC:
--   source = 'bubble_migration' AND remuneration_type IS NULL AND
--   employment_form = 'permanent' → 'volunteer'
--
--   Why NULL remuneration_type is the strong signal: 20260519150000 Step C
--   backfilled employment_form unconditionally but did NOT touch
--   remuneration_type. Bubble-migration contracts with both columns NULL
--   pre-backfill kept remuneration_type NULL post-backfill — that NULL
--   survives as the recovery anchor.
--
--   Composition contracts that happened to have NULL remuneration_type
--   pre-Wave-3 may be incorrectly flagged here. Tradeoff (per ADR-0428):
--   false positives on composition rows (rare, admin can correct) vs
--   leaving every bubble volunteer mis-typed as permanent (compliance
--   risk + Tripletex sync of unpaid labour).
--
-- IDEMPOTENCY: UPDATE targets only rows still at 'permanent'. Once
-- converted to 'volunteer', the WHERE clause excludes them. Safe to
-- replay on db reset (L-0042).
-- ============================================================================

SET search_path TO public, extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- Recovery UPDATE
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_recovered_count integer;
BEGIN
  UPDATE public.employment_contract
    SET employment_form = 'volunteer'::public.employment_form_enum
    WHERE source = 'bubble_migration'
      AND remuneration_type IS NULL
      AND employment_form = 'permanent'::public.employment_form_enum;

  GET DIAGNOSTICS v_recovered_count = ROW_COUNT;

  RAISE NOTICE 'ADR-0428 recovery: % bubble-migration contract(s) restored to volunteer.',
    v_recovered_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Column comment update
-- ─────────────────────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.employment_contract.employment_form IS
  'Employment form enum (permanent | temporary | apprentice | practice | '
  'freelance | volunteer). NOT NULL per ADR-0421 declared-contract-'
  'fulfillment-rule. ADR-0428: ''volunteer'' is the explicit signal for '
  'unpaid labour — Tripletex sync MUST exclude. ADR-0109 §Clause B '
  '(NULL = volunteer) is superseded; provenance on non-bubble-source '
  'rows that applied 20260519150000 was lost and is not recoverable. '
  'See ADR-0428 §Recovery limits.';

-- ============================================================================
-- DONE. The 'volunteer' enum value is now usable (added in 20260716200000).
-- Pre-Wave-3 bubble-migration volunteers with NULL remuneration_type are
-- restored. Tripletex sync EFs MUST be updated to filter
-- employment_form != 'volunteer' (filed separately — sync is currently
-- behind feature flag, no prod blast radius).
-- ============================================================================
