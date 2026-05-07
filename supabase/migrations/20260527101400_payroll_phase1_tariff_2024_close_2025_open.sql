-- Migration: 20260527101400_payroll_phase1_tariff_2024_close_2025_open.sql
--
-- Purpose: Fix ISSUE A — 2025 Riksavtalen supplement rates silently blocked.
--
-- Root cause: 2024 supplement rows (kveldstillegg, helgetillegg) had
-- effective_until=NULL, producing daterange [2024-04-01, 9999-12-31].
-- The 2025 insert in migration 20260527100800 tried to insert overlapping
-- [2025-04-01, 9999-12-31] on the same rate_type + workspace_id=NULL combination.
-- excl_tariff_no_overlap rejected all 6 inserts. ON CONFLICT DO NOTHING
-- silently swallowed them. supplement_rule.tariff_rate_table_id was left
-- pointing to 2024 rows for kveldstillegg and helgetillegg.
--
-- Fix:
--   Step 1: Cap the 6 pre-existing 2024 rows at effective_until='2025-03-31'.
--   Step 2: Insert the correct 2025 rows (now non-overlapping).
--   Step 3: Update supplement_rule FKs to point at the 2025 rows.
--   Step 4: Guard — raise if any 2025 row is still missing after insert.
--
-- Rate source: Riksavtalen mellomoppgjør, effective 2025-04-01.
-- ADR: ADR-0252 (Riksavtalen versjonering migration-policy).

SET search_path TO public, extensions;

-- ── Step 1: Cap 2024 platform supplement rows at 2025-03-31 ──────────────────
-- Only touches: kveldstillegg, helgetillegg (the two that were open-ended).
-- nattillegg_* rows were already inserted with effective_from='2025-04-01'
-- in 20260527100800 (they did not conflict because they used a different
-- effective_from start date and no prior row existed for those rate_types).

UPDATE public.tariff_rate_table
SET effective_until = '2025-03-31'
WHERE workspace_id IS NULL
  AND effective_until IS NULL
  AND effective_from < '2025-04-01'
  AND rate_type IN ('kveldstillegg', 'helgetillegg');

-- ── Step 2: Insert 2025 kveldstillegg and helgetillegg rows ─────────────────
-- These two were the only ones blocked by excl_tariff_no_overlap.
-- The four nattillegg rows are already present from 20260527100800 and
-- are NOT re-inserted here.

INSERT INTO public.tariff_rate_table (
  workspace_id, rate_type, source, amount, unit, effective_from,
  paragraf_ref, law_version, verbatim_pending
) VALUES
  (NULL, 'kveldstillegg', 'riksavtalen', 16.01, 'kr/t', '2025-04-01', '§4.3-3.2', '2025', false),
  (NULL, 'helgetillegg',  'riksavtalen', 30.42, 'kr/t', '2025-04-01', '§4.3-3.1', '2025', false)
ON CONFLICT DO NOTHING;

-- ── Step 3 + Step 4: FK backfill with guard ──────────────────────────────────
DO $$
DECLARE
  v_kveld UUID;
  v_helg  UUID;
BEGIN
  SELECT id INTO v_kveld
    FROM public.tariff_rate_table
   WHERE workspace_id IS NULL
     AND rate_type = 'kveldstillegg'
     AND law_version = '2025'
     AND effective_from = '2025-04-01';

  SELECT id INTO v_helg
    FROM public.tariff_rate_table
   WHERE workspace_id IS NULL
     AND rate_type = 'helgetillegg'
     AND law_version = '2025'
     AND effective_from = '2025-04-01';

  -- Guard: fail loudly rather than silently leave NULL FKs
  IF v_kveld IS NULL THEN
    RAISE EXCEPTION
      'Tariff 2025 seed verification failed — kveldstillegg 2025-04-01 row missing. '
      'Check excl_tariff_no_overlap conflicts or prior effective_until cap.';
  END IF;
  IF v_helg IS NULL THEN
    RAISE EXCEPTION
      'Tariff 2025 seed verification failed — helgetillegg 2025-04-01 row missing. '
      'Check excl_tariff_no_overlap conflicts or prior effective_until cap.';
  END IF;

  -- Update supplement_rule FKs to point at 2025 rows
  UPDATE public.supplement_rule
     SET tariff_rate_table_id = v_kveld
   WHERE workspace_id IS NULL
     AND name = 'Kveldstillegg';

  UPDATE public.supplement_rule
     SET tariff_rate_table_id = v_helg
   WHERE workspace_id IS NULL
     AND name = 'Helgetillegg';

  -- Verify at least 1 row was updated per supplement name
  IF NOT FOUND THEN
    RAISE EXCEPTION
      'supplement_rule FK backfill failed — no row matched name=''Helgetillegg'' with workspace_id IS NULL.';
  END IF;
END $$;
