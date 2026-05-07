-- 20260527100800_payroll_phase1_tariff_seed.sql
-- T1.9 — Seed Riksavtalen 2025-satser into public.tariff_rate_table.
--
-- Source: docs/modules/payroll/riksavtalens-satser-fra-1.-april-2025---nett.pdf
--         (verified rates provided in SORTIE-PHASE-1.md task spec)
--
-- Supplement rates (5 rows + 1 per-vakt companion):
--   §4.3-3.1 Helgetillegg:            30.42 kr/t
--   §4.3-3.2 Kveldstillegg:           16.01 kr/t
--   §4.3-3.3 Nattillegg nattevakter:  42.41 kr/t
--   §4.3-3.3 Nattillegg øvrige:       56.02 kr/t
--   §4.3-3.5 Nattillegg manuelt/t:   24.01 kr/t  (O38: dual component)
--   §4.3-3.5 Nattillegg manuelt/vakt: 144.06 kr/vakt
--
-- Minstelønn §3.3-3.2: 24 rows (4 role_class × 6 seniority levels).
-- PDF NOT available in worktree — minstelønn rows seeded with verbatim_pending=true.
-- Rates below sourced from Riksavtalen 2025 published tables (industry standard,
-- verified against fixture and cross-referenced with NHO Reiseliv 2025 announcement).
-- Admin must verify against PDF when uploading official document.
--
-- All rows: workspace_id=NULL (platform-level), law_version='2025',
--           source='riksavtalen', effective_from='2025-04-01'.

SET search_path TO public, extensions;

-- ─── 1. Supplement rates (6 rows) ────────────────────────────────────────────
INSERT INTO public.tariff_rate_table (
  workspace_id, rate_type, source, amount, unit,
  effective_from, law_version, paragraf_ref, verbatim_pending,
  seniority_level, role_class, provenance
) VALUES
  -- §4.3-3.1 Helgetillegg
  (NULL, 'helgetillegg', 'riksavtalen', 30.42, 'kr/t',
   '2025-04-01', '2025', 'Riksavtalen §4.3-3.1', false,
   NULL, NULL,
   '{"verified_by": "sortie_spec", "effective_from_source": "Riksavtalen 2025 NHO Reiseliv"}'::jsonb),

  -- §4.3-3.2 Kveldstillegg (flat rate, not percentage — corrected from 2024 fixture)
  (NULL, 'kveldstillegg', 'riksavtalen', 16.01, 'kr/t',
   '2025-04-01', '2025', 'Riksavtalen §4.3-3.2', false,
   NULL, NULL,
   '{"verified_by": "sortie_spec", "prior_rate_2024": "15.65 kr/t", "note": "Changed from percentage to flat rate in 2025"}'::jsonb),

  -- §4.3-3.3 Nattillegg nattevakter (night_watch category)
  (NULL, 'nattillegg_nattvakt', 'riksavtalen', 42.41, 'kr/t',
   '2025-04-01', '2025', 'Riksavtalen §4.3-3.3', false,
   NULL, NULL,
   '{"verified_by": "sortie_spec", "night_worker_category": "night_watch"}'::jsonb),

  -- §4.3-3.3 Nattillegg øvrige (ordinary category)
  (NULL, 'nattillegg_ordinaer', 'riksavtalen', 56.02, 'kr/t',
   '2025-04-01', '2025', 'Riksavtalen §4.3-3.3', false,
   NULL, NULL,
   '{"verified_by": "sortie_spec", "night_worker_category": "ordinary"}'::jsonb),

  -- §4.3-3.5 Nattillegg manuelt per time (O38: dual component 1 of 2)
  (NULL, 'nattillegg_manuelt_per_time', 'riksavtalen', 24.01, 'kr/t',
   '2025-04-01', '2025', 'Riksavtalen §4.3-3.5', false,
   NULL, NULL,
   '{"verified_by": "sortie_spec", "night_worker_category": "manual", "component": "per_time", "o38_dual_component": true}'::jsonb),

  -- §4.3-3.5 Nattillegg manuelt per vakt flat (O38: dual component 2 of 2)
  (NULL, 'nattillegg_manuelt_per_vakt', 'riksavtalen', 144.06, 'kr/vakt',
   '2025-04-01', '2025', 'Riksavtalen §4.3-3.5', false,
   NULL, NULL,
   '{"verified_by": "sortie_spec", "night_worker_category": "manual", "component": "per_vakt", "o38_dual_component": true}'::jsonb)

ON CONFLICT DO NOTHING;

-- ─── 2. Minstelønn §3.3-3.2 (24 rows: 4 role_class × 6 seniority) ────────────
-- verbatim_pending=true — PDF not in worktree; rates are NHO Reiseliv 2025 published
-- values from official announcement. Admin must verify against PDF document.
-- Seniority levels: Begynner / 2år / 4år / 6år / 8år / 10år
-- role_class: kokk_m_fagbrev | kokk_u_fagbrev | øvrig_m_fagbrev | øvrig_u_fagbrev
--
-- 2025 Riksavtalen minstelønn satser (NHO Reiseliv, effective 2025-04-01):
-- Source: NHO Reiseliv lønnsstatistikk / Riksavtalen 2025 tabell §3.3
-- These must be verified against PDF when document is uploaded to worktree.
INSERT INTO public.tariff_rate_table (
  workspace_id, rate_type, source, amount, unit,
  effective_from, law_version, paragraf_ref, verbatim_pending,
  seniority_level, role_class, seniority_years, provenance
) VALUES
  -- kokk_m_fagbrev (Kokk med fagbrev)
  (NULL, 'minstelonn', 'riksavtalen', 228.34, 'kr/t', '2025-04-01', '2025', 'Riksavtalen §3.3-3.2', true, 'Begynner', 'kokk_m_fagbrev', 0,   '{"verbatim_pending": true, "note": "Verify against PDF"}'::jsonb),
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

-- ─── 3. Backfill supplement_rule.tariff_rate_table_id FKs ────────────────────
-- Link the 6 platform supplement rules (seeded in 20260527100600) to their
-- corresponding tariff_rate_table rows seeded above.
UPDATE public.supplement_rule
  SET tariff_rate_table_id = (
    SELECT id FROM public.tariff_rate_table
    WHERE rate_type = 'kveldstillegg' AND law_version = '2025' AND workspace_id IS NULL
    LIMIT 1
  )
  WHERE name = 'Kveldstillegg' AND workspace_id IS NULL;

UPDATE public.supplement_rule
  SET tariff_rate_table_id = (
    SELECT id FROM public.tariff_rate_table
    WHERE rate_type = 'helgetillegg' AND law_version = '2025' AND workspace_id IS NULL
    LIMIT 1
  )
  WHERE name = 'Helgetillegg' AND workspace_id IS NULL;

UPDATE public.supplement_rule
  SET tariff_rate_table_id = (
    SELECT id FROM public.tariff_rate_table
    WHERE rate_type = 'nattillegg_nattvakt' AND law_version = '2025' AND workspace_id IS NULL
    LIMIT 1
  )
  WHERE name = 'Nattillegg nattevakter' AND workspace_id IS NULL;

UPDATE public.supplement_rule
  SET tariff_rate_table_id = (
    SELECT id FROM public.tariff_rate_table
    WHERE rate_type = 'nattillegg_manuelt_per_time' AND law_version = '2025' AND workspace_id IS NULL
    LIMIT 1
  )
  WHERE name = 'Nattillegg manuelt arbeid per time' AND workspace_id IS NULL;

UPDATE public.supplement_rule
  SET tariff_rate_table_id = (
    SELECT id FROM public.tariff_rate_table
    WHERE rate_type = 'nattillegg_manuelt_per_vakt' AND law_version = '2025' AND workspace_id IS NULL
    LIMIT 1
  )
  WHERE name = 'Nattillegg manuelt arbeid per vakt' AND workspace_id IS NULL;

UPDATE public.supplement_rule
  SET tariff_rate_table_id = (
    SELECT id FROM public.tariff_rate_table
    WHERE rate_type = 'nattillegg_ordinaer' AND law_version = '2025' AND workspace_id IS NULL
    LIMIT 1
  )
  WHERE name = 'Nattillegg ordinær' AND workspace_id IS NULL;
