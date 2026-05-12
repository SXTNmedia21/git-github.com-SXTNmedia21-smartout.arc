-- 20260527101000_payroll_phase1_tariff_excl_fix.sql
-- Fix: excl_tariff_no_overlap exclusion constraint does not include seniority_level
-- or role_class, so platform minstelonn rows (24 rows: 4 role_class × 6 seniority)
-- all collide on (rate_type='minstelonn', workspace_id=NULL, daterange overlap).
-- Only the first INSERT survives; all others are silently eaten by ON CONFLICT.
--
-- Resolution: Drop + recreate constraint to include seniority_level + role_class
-- as equality operators. COALESCE('') sentinel for rows without seniority (supplement rates).
--
-- Source: SORTIE-PHASE-1.md T1.9, excl_tariff_no_overlap discovered blocking 23/24 minstelonn rows.

SET search_path TO public, extensions;

-- Step 1: Drop existing exclusion constraint
ALTER TABLE public.tariff_rate_table
  DROP CONSTRAINT excl_tariff_no_overlap;

-- Step 2: Recreate with seniority_level + role_class included
-- Using gist_text_ops (btree_gist extension) for TEXT equality in exclusion constraints.
-- COALESCE sentinels: '' for NULL seniority_level/role_class (supplement rows have NULL).
ALTER TABLE public.tariff_rate_table
  ADD CONSTRAINT excl_tariff_no_overlap EXCLUDE USING gist (
    rate_type                                              WITH =,
    COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =,
    COALESCE(seniority_level, '')                          WITH =,
    COALESCE(role_class, '')                               WITH =,
    daterange(effective_from, COALESCE(effective_until, '9999-12-31'::date), '[]'::text) WITH &&
  );

-- Step 3: Re-insert the 23 minstelonn rows that were blocked by the old constraint.
-- The 1 row that survived (Begynner/kokk_m_fagbrev) is still there — ON CONFLICT DO NOTHING skips it.
INSERT INTO public.tariff_rate_table (
  workspace_id, rate_type, source, amount, unit,
  effective_from, law_version, paragraf_ref, verbatim_pending,
  seniority_level, role_class, seniority_years, provenance
) VALUES
  -- kokk_m_fagbrev (Kokk med fagbrev) — Begynner already present, skip
  -- (NULL, 'minstelonn', 'riksavtalen', 228.34, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, 'Begynner', 'kokk_m_fagbrev', 0, '{"verbatim_pending": true}'::jsonb),
  (NULL, 'minstelonn', 'riksavtalen', 233.80, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, '2år',      'kokk_m_fagbrev', 2,   '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb),
  (NULL, 'minstelonn', 'riksavtalen', 239.40, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, '4år',      'kokk_m_fagbrev', 4,   '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb),
  (NULL, 'minstelonn', 'riksavtalen', 245.20, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, '6år',      'kokk_m_fagbrev', 6,   '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb),
  (NULL, 'minstelonn', 'riksavtalen', 251.10, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, '8år',      'kokk_m_fagbrev', 8,   '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb),
  (NULL, 'minstelonn', 'riksavtalen', 257.20, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, '10år',     'kokk_m_fagbrev', 10,  '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb),

  -- kokk_u_fagbrev (Kokk uten fagbrev)
  (NULL, 'minstelonn', 'riksavtalen', 210.50, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, 'Begynner', 'kokk_u_fagbrev', 0,   '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb),
  (NULL, 'minstelonn', 'riksavtalen', 215.60, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, '2år',      'kokk_u_fagbrev', 2,   '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb),
  (NULL, 'minstelonn', 'riksavtalen', 220.80, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, '4år',      'kokk_u_fagbrev', 4,   '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb),
  (NULL, 'minstelonn', 'riksavtalen', 226.10, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, '6år',      'kokk_u_fagbrev', 6,   '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb),
  (NULL, 'minstelonn', 'riksavtalen', 231.60, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, '8år',      'kokk_u_fagbrev', 8,   '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb),
  (NULL, 'minstelonn', 'riksavtalen', 237.20, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, '10år',     'kokk_u_fagbrev', 10,  '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb),

  -- øvrig_m_fagbrev (Øvrig personale med fagbrev)
  (NULL, 'minstelonn', 'riksavtalen', 218.90, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, 'Begynner', 'øvrig_m_fagbrev', 0,  '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb),
  (NULL, 'minstelonn', 'riksavtalen', 224.10, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, '2år',      'øvrig_m_fagbrev', 2,  '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb),
  (NULL, 'minstelonn', 'riksavtalen', 229.50, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, '4år',      'øvrig_m_fagbrev', 4,  '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb),
  (NULL, 'minstelonn', 'riksavtalen', 235.00, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, '6år',      'øvrig_m_fagbrev', 6,  '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb),
  (NULL, 'minstelonn', 'riksavtalen', 240.60, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, '8år',      'øvrig_m_fagbrev', 8,  '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb),
  (NULL, 'minstelonn', 'riksavtalen', 246.40, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, '10år',     'øvrig_m_fagbrev', 10, '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb),

  -- øvrig_u_fagbrev (Øvrig personale uten fagbrev)
  (NULL, 'minstelonn', 'riksavtalen', 198.50, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, 'Begynner', 'øvrig_u_fagbrev', 0,  '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb),
  (NULL, 'minstelonn', 'riksavtalen', 203.40, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, '2år',      'øvrig_u_fagbrev', 2,  '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb),
  (NULL, 'minstelonn', 'riksavtalen', 208.40, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, '4år',      'øvrig_u_fagbrev', 4,  '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb),
  (NULL, 'minstelonn', 'riksavtalen', 213.60, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, '6år',      'øvrig_u_fagbrev', 6,  '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb),
  (NULL, 'minstelonn', 'riksavtalen', 218.90, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, '8år',      'øvrig_u_fagbrev', 8,  '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb),
  (NULL, 'minstelonn', 'riksavtalen', 224.30, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, '10år',     'øvrig_u_fagbrev', 10, '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb)

ON CONFLICT DO NOTHING;
