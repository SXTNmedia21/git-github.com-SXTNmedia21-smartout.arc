-- 20260616130000_payroll_phase1_golden_month_rename_kveldstillegg.sql
--
-- PURPOSE: Correct typo in fixture_id provenance for kveldstillegg supplement_rule row.
--          rule-kveldstiilegg-001 (double-i) → rule-kveldstillegg-001 (single-i, correct Bokmål).
--
-- SCOPE: provenance JSONB field only. The row UUID stays stable — FK refs are unaffected.
--        The fixture JSON (rules.json) and worksheet docs are updated atomically in the
--        same commit (B4 council verdict — fix the typo, keep UUID stable).
--
-- B4 COUNCIL VERDICT: Rename corrects Bokmål spelling. UUID-stability preserved.
--   provenance->>'fixture_id' is the only surface that carries the old slug.
--   Engine never matches by fixture_id — it uses tariff_rate_table_id FK by UUID.
--
-- L-0042 COMPLIANT: 20260616130000 > 20260616120000 (local tip at time of writing).
--
-- DO NOT regenerate database.types.ts — no schema change.

SET search_path TO public, extensions;

-- Correct fixture_id slug in provenance JSONB.
-- UUID 35ae076e-b27d-5677-a5a0-449542ba6a52 = rule-kveldstiilegg-001 (B1 seed).
UPDATE public.supplement_rule
SET provenance = jsonb_set(
  COALESCE(provenance, '{}'::jsonb),
  '{fixture_id}',
  '"rule-kveldstillegg-001"'::jsonb
)
WHERE id = '35ae076e-b27d-5677-a5a0-449542ba6a52'::uuid
  AND (provenance IS NULL OR provenance->>'fixture_id' = 'rule-kveldstiilegg-001');

-- Sanity check: verify zero rows still have old slug
-- (No-op if the row didn't exist yet — migration is idempotent)
DO $$
DECLARE
  bad_count INT;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM public.supplement_rule
  WHERE provenance->>'fixture_id' = 'rule-kveldstiilegg-001';

  IF bad_count > 0 THEN
    RAISE EXCEPTION 'B4 rename INCOMPLETE: % rows still carry old fixture_id slug', bad_count;
  END IF;
END;
$$;
