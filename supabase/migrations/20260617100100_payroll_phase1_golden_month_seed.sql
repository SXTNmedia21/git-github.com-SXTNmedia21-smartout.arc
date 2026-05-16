-- 20260616120000_payroll_phase1_golden_month_seed.sql
--
-- PURPOSE: Seed 14 fixture rows for golden-month F2 integration testing.
--          Fixtures are authored from Riksavtalen 2025-satser (effective 2025-04-01)
--          as used in the golden-month April 2026 worksheet.
--          These rows carry stable deterministic UUIDs so the F6 DB-integration
--          test can JOIN against them. The UUID ↔ fixture_id mapping is stored in
--          provenance->>'fixture_id' on each row.
--
-- TIMESTAMP: 20260616120000 (local tip: 20260616100300; dev tip: 20260616110100)
--            Strictly greater than both. L-0042 compliant.
--
-- FIXTURE IDs (from packages/payroll-calculate/__tests__/golden-month/input/):
--   tariff.json  — 8 rows (trt-supp-001..006, trt-min-001..002)
--   rules.json   — 6 rows (rule-kveldstiilegg-001, rule-natt-nattvakt-001,
--                           rule-natt-manuelt-001, rule-natt-ordinaer-001,
--                           rule-helgetillegg-001, rule-helligdag-001)
--
-- UUID DERIVATION: uuid5(NS='12345678-1234-5678-1234-567812345678', fixture_id)
--   Each UUID is deterministic and reproducible from the fixture short-ID string.
--   Namespace: '12345678-1234-5678-1234-567812345678' (Smartout golden-month NS)
--
-- RATE_TYPE NAMESPACING: Fixture supplement rates use rate_type='gm_*' prefix to
--   avoid EXCLUDE constraint collision with the live 2025 Riksavtalen rows
--   (kveldstillegg=16.01/30.42 from §4.3-3.x). Fixture rates reflect §6 totals
--   used in the golden-month worksheet (42.41/56.02/etc.). The 'gm_' prefix is
--   fixture-scope only; live engine uses the non-prefixed rows.
--   Source: Riksavtalen 2025 §6 (kveldstillegg 42.41 kr/t, nattillegg 42.41/56.02/24.01,
--           helgetillegg 56.02, helligdagstillegg 100.00) — effective 2025-04-01.
--   Minstelonn: Riksavtalen §3 (voksen ufaglært begynner 195.00, etter 2 år 205.00).
--
-- E4 RESOLUTION (ADR-0341 v1.1 §E4): gm_ prefix is ENGINE-TRANSPARENT.
--   evaluate-supplements.ts resolves rates via UUID FK:
--     rates.find((r) => r.id === rule.tariff_rate_table_id)
--   The rate_type string is never compared by the engine at resolve-time.
--   gm_ prefix prevents EXCLUDE constraint collision at INSERT time only.
--   No fixture or engine change needed. E4 is a verified NO-OP.
--
-- WORKSPACE_ID: NULL for all rows (platform-level K1a per cascade cascade-developer guide).
--   supplement_rule.workspace_id IS nullable in public.supplement_rule (created by
--   20260527100600_payroll_phase1_dynamic_supplements.sql). NULL = platform template.
--
-- ADR COMPLIANCE:
--   ADR-0252: law_version='2025', effective_from='2025-04-01', effective_until=NULL.
--   ADR-0341 v1.1: fixture_id stored in provenance for F6 UUID resolution.
--   Payroll skill non-negotiable 1 (Versjonering): all rows include law_version.
--   Payroll skill non-negotiable 4 (Golden cases): these rows unblock F2 acceptance.
--
-- DO NOT regenerate database.types.ts — this is a seed INSERT, no schema change.
-- DO NOT touch fixture JSONs — they are canonical IDs per ADR-0341 v1.1 §B4.

SET search_path TO public, extensions;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 1: tariff_rate_table rows (8 fixture rows, workspace_id=NULL)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Rate_type prefix 'gm_' (golden-month) prevents EXCLUDE constraint collisions
-- with live §4.3-3.x rows. The fixture uses §6 combined rates, which differ
-- from the per-subparagraph rates in the production seed.
-- §6 reference: Riksavtalen for Hotell og restaurant 2025, §6 Tillegg.
--
-- UUID derivation log:
--   trt-supp-001 → 27817b9f-bd79-57bb-be2f-5ab5ac330cca
--   trt-supp-002 → 2b59ce1e-bc3c-5e8d-9eb0-86a76b7a9910
--   trt-supp-003 → 7efc928f-7917-51d6-9e11-c7f781e642bb
--   trt-supp-004 → e0b606a3-2d0d-5a15-b4b6-2cca6839236d
--   trt-supp-005 → da0f4a80-3991-500f-9ac3-c7a17cff8c2c
--   trt-supp-006 → 5c24f0b6-351b-5b1b-84e2-226e1072c323
--   trt-min-001  → d2c4e4b4-4209-5301-8780-667e8adbd056
--   trt-min-002  → 965bc0de-1a7b-5013-9edf-57244c275947

INSERT INTO public.tariff_rate_table (
  id,
  workspace_id,
  rate_type,
  source,
  amount,
  unit,
  effective_from,
  effective_until,
  law_version,
  verbatim_pending,
  paragraf_ref,
  seniority_level,
  role_class,
  provenance
)
VALUES

  -- trt-supp-001: kveldstillegg 42.41 kr/t
  -- Riksavtalen 2025 §6 — Tillegg for kveldstillegg (arbeid mellom 21:00–23:59)
  -- Rate: 42.41 NOK/t. Source: Riksavtalen 2025, §6 Tillegg, effective 2025-04-01.
  (
    '27817b9f-bd79-57bb-be2f-5ab5ac330cca'::uuid,
    NULL,
    'gm_kveldstillegg',        -- gm_ prefix: avoids EXCLUDE collision with live kveldstillegg row
    'riksavtalen',
    42.41,
    'kr/t',
    '2025-04-01',
    NULL,
    '2025',
    false,
    'Riksavtalen §6',
    NULL,
    NULL,
    '{"fixture_id": "trt-supp-001", "fixture_rate_type": "kveldstillegg", "golden_month": true, "note": "§6 combined rate used in golden-month April 2026 worksheet; differs from §4.3-3.2 per-sub-paragraph rate (16.01) in live seed"}'::jsonb
  ),

  -- trt-supp-002: nattillegg_nattvakt 42.41 kr/t
  -- Riksavtalen 2025 §6 — Nattillegg for nattvakter (00:00–06:00, night_watch category)
  -- Rate: 42.41 NOK/t. Source: Riksavtalen 2025, §6 Tillegg, effective 2025-04-01.
  (
    '2b59ce1e-bc3c-5e8d-9eb0-86a76b7a9910'::uuid,
    NULL,
    'gm_nattillegg_nattvakt',
    'riksavtalen',
    42.41,
    'kr/t',
    '2025-04-01',
    NULL,
    '2025',
    false,
    'Riksavtalen §6',
    NULL,
    NULL,
    '{"fixture_id": "trt-supp-002", "fixture_rate_type": "nattillegg_nattvakt", "golden_month": true, "night_worker_category": "night_watch"}'::jsonb
  ),

  -- trt-supp-003: nattillegg_manuelt 24.01 kr/t
  -- Riksavtalen 2025 §6 — Nattillegg for manuelt nattarbeid (00:00–06:00, manual category)
  -- Rate: 24.01 NOK/t. Source: Riksavtalen 2025, §6 Tillegg, effective 2025-04-01.
  (
    '7efc928f-7917-51d6-9e11-c7f781e642bb'::uuid,
    NULL,
    'gm_nattillegg_manuelt',
    'riksavtalen',
    24.01,
    'kr/t',
    '2025-04-01',
    NULL,
    '2025',
    false,
    'Riksavtalen §6',
    NULL,
    NULL,
    '{"fixture_id": "trt-supp-003", "fixture_rate_type": "nattillegg_manuelt", "golden_month": true, "night_worker_category": "manual"}'::jsonb
  ),

  -- trt-supp-004: nattillegg_ordinaer 56.02 kr/t
  -- Riksavtalen 2025 §6 — Nattillegg for øvrige/ordinære (00:00–06:00, ordinary category)
  -- Rate: 56.02 NOK/t. Source: Riksavtalen 2025, §6 Tillegg, effective 2025-04-01.
  (
    'e0b606a3-2d0d-5a15-b4b6-2cca6839236d'::uuid,
    NULL,
    'gm_nattillegg_ordinaer',
    'riksavtalen',
    56.02,
    'kr/t',
    '2025-04-01',
    NULL,
    '2025',
    false,
    'Riksavtalen §6',
    NULL,
    NULL,
    '{"fixture_id": "trt-supp-004", "fixture_rate_type": "nattillegg_ordinaer", "golden_month": true, "night_worker_category": "ordinary"}'::jsonb
  ),

  -- trt-supp-005: helgetillegg 56.02 kr/t
  -- Riksavtalen 2025 §6 — Helgetillegg (lørdag og søndag, weekdays=[6,7])
  -- Rate: 56.02 NOK/t. Source: Riksavtalen 2025, §6 Tillegg, effective 2025-04-01.
  (
    'da0f4a80-3991-500f-9ac3-c7a17cff8c2c'::uuid,
    NULL,
    'gm_helgetillegg',
    'riksavtalen',
    56.02,
    'kr/t',
    '2025-04-01',
    NULL,
    '2025',
    false,
    'Riksavtalen §6',
    NULL,
    NULL,
    '{"fixture_id": "trt-supp-005", "fixture_rate_type": "helgetillegg", "golden_month": true, "note": "§6 combined rate 56.02; differs from §4.3-3.1 rate (30.42) in live seed"}'::jsonb
  ),

  -- trt-supp-006: helligdagstillegg 100.00 kr/t
  -- Riksavtalen 2025 §6 — Helligdagstillegg (offentlige helligdager, ingen tidsvindu)
  -- Rate: 100.00 NOK/t. Source: Riksavtalen 2025, §6 Tillegg, effective 2025-04-01.
  (
    '5c24f0b6-351b-5b1b-84e2-226e1072c323'::uuid,
    NULL,
    'gm_helligdagstillegg',
    'riksavtalen',
    100.00,
    'kr/t',
    '2025-04-01',
    NULL,
    '2025',
    false,
    'Riksavtalen §6',
    NULL,
    NULL,
    '{"fixture_id": "trt-supp-006", "fixture_rate_type": "helligdagstillegg", "golden_month": true}'::jsonb
  ),

  -- trt-min-001: minstelonn_begynner 195.00 kr/t (voksen ufaglært, begynner)
  -- Riksavtalen 2025 §3 — Minstelønn for voksen ufaglært arbeidstaker, begynner
  -- Rate: 195.00 NOK/t. Source: Riksavtalen 2025, §3 Minstelønn, effective 2025-04-01.
  -- role_class: NULL (voksen_ufaglart does not match CHECK constraint values;
  --   stored in provenance. Closest canonical mapping: øvrig_u_fagbrev.)
  -- seniority_level: 'begynner' (fixture value; distinct from existing 'Begynner' rows
  --   with different role_class — no EXCLUDE conflict.)
  (
    'd2c4e4b4-4209-5301-8780-667e8adbd056'::uuid,
    NULL,
    'gm_minstelonn_begynner',
    'riksavtalen',
    195.00,
    'kr/t',
    '2025-04-01',
    NULL,
    '2025',
    false,
    'Riksavtalen §3',
    'begynner',
    NULL,
    '{"fixture_id": "trt-min-001", "fixture_rate_type": "minstelonn_begynner", "fixture_seniority_level": "begynner", "fixture_role_class": "voksen_ufaglart", "golden_month": true, "note": "voksen_ufaglart not in role_class CHECK constraint; stored here for traceability. Canonical closest: oevrig_u_fagbrev."}'::jsonb
  ),

  -- trt-min-002: minstelonn_2_aar 205.00 kr/t (voksen ufaglært, etter 2 år)
  -- Riksavtalen 2025 §3 — Minstelønn for voksen ufaglært arbeidstaker, etter 2 år
  -- Rate: 205.00 NOK/t. Source: Riksavtalen 2025, §3 Minstelønn, effective 2025-04-01.
  (
    '965bc0de-1a7b-5013-9edf-57244c275947'::uuid,
    NULL,
    'gm_minstelonn_2_aar',
    'riksavtalen',
    205.00,
    'kr/t',
    '2025-04-01',
    NULL,
    '2025',
    false,
    'Riksavtalen §3',
    '2_aar',
    NULL,
    '{"fixture_id": "trt-min-002", "fixture_rate_type": "minstelonn_2_aar", "fixture_seniority_level": "2_aar", "fixture_role_class": "voksen_ufaglart", "golden_month": true}'::jsonb
  )

ON CONFLICT (id) DO NOTHING;


-- ════════════════════════════════════════════════════════════════════════════
-- PART 2: supplement_rule rows (6 fixture rows, workspace_id=NULL)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Table: public.supplement_rule (created by 20260527100600_payroll_phase1_dynamic_supplements.sql)
-- workspace_id IS NULL = platform-level template rule (allowed by schema).
--
-- UUID derivation log:
--   rule-kveldstiilegg-001 → 35ae076e-b27d-5677-a5a0-449542ba6a52
--   rule-natt-nattvakt-001 → d5c20ac9-57f9-5d17-bbf0-031ff162752c
--   rule-natt-manuelt-001  → b8089307-816c-589e-ba3a-84a159d4497a
--   rule-natt-ordinaer-001 → 18277f5b-dcc2-5a17-a420-e8f467f41b87
--   rule-helgetillegg-001  → 6a318105-fa1e-57ce-82f2-49710506f1ae
--   rule-helligdag-001     → a8ddca53-6ee7-5fd8-a369-602318a4ff2b
--
-- NOTE: rule-kveldstiilegg-001 has double-i typo ("kveldstiilegg").
--   This is INTENTIONAL — the fixture JSON uses this ID exactly.
--   Per F2-prep B4: typo is preserved so fixture stays valid.
--   A separate council decision is in flight on typo policy.
--   If council mandates rename, a follow-up migration updates this row's
--   provenance->>'fixture_id' and the fixture JSON simultaneously.
--
-- tariff_rate_table_id FK points to the 8 gm_* rows seeded in PART 1 above.

INSERT INTO public.supplement_rule (
  id,
  workspace_id,
  name,
  supplement_type,
  is_active,
  rate_type,
  rate_value,
  tariff_rate_table_id,
  match_predicate,
  paragraf_ref,
  valid_from,
  valid_until
)
VALUES

  -- rule-kveldstiilegg-001 (NOTE: double-i typo preserved — B4 council pending)
  -- Match: weekdays 1-7, time 21:00-23:59. supplement_type=normal.
  -- Rate: fixed_per_hour 42.41 kr/t → tariff FK trt-supp-001.
  -- Source: Riksavtalen 2025 §6, effective 2025-04-01.
  (
    '35ae076e-b27d-5677-a5a0-449542ba6a52'::uuid,
    NULL,
    'Kveldstillegg (golden-month)',
    'normal',
    true,
    'fixed_per_hour',
    42.41,
    '27817b9f-bd79-57bb-be2f-5ab5ac330cca'::uuid,   -- trt-supp-001
    '{"windows": [{"weekdays": [1, 2, 3, 4, 5, 6, 7], "time_from": "21:00", "time_to": "23:59"}]}'::jsonb,
    'Riksavtalen §6',
    '2025-04-01',
    NULL
  ),

  -- rule-natt-nattvakt-001
  -- Match: weekdays 1-7, time 00:00-06:00, night_worker_category=night_watch.
  -- Rate: fixed_per_hour 42.41 kr/t → tariff FK trt-supp-002.
  -- Source: Riksavtalen 2025 §6, effective 2025-04-01.
  (
    'd5c20ac9-57f9-5d17-bbf0-031ff162752c'::uuid,
    NULL,
    'Nattillegg nattvakt (golden-month)',
    'normal',
    true,
    'fixed_per_hour',
    42.41,
    '2b59ce1e-bc3c-5e8d-9eb0-86a76b7a9910'::uuid,   -- trt-supp-002
    '{"windows": [{"weekdays": [1, 2, 3, 4, 5, 6, 7], "time_from": "00:00", "time_to": "06:00"}], "night_worker_category": "night_watch"}'::jsonb,
    'Riksavtalen §6',
    '2025-04-01',
    NULL
  ),

  -- rule-natt-manuelt-001
  -- Match: weekdays 1-7, time 00:00-06:00, night_worker_category=manual.
  -- Rate: fixed_per_hour 24.01 kr/t → tariff FK trt-supp-003.
  -- Source: Riksavtalen 2025 §6, effective 2025-04-01.
  (
    'b8089307-816c-589e-ba3a-84a159d4497a'::uuid,
    NULL,
    'Nattillegg manuelt arbeid (golden-month)',
    'normal',
    true,
    'fixed_per_hour',
    24.01,
    '7efc928f-7917-51d6-9e11-c7f781e642bb'::uuid,   -- trt-supp-003
    '{"windows": [{"weekdays": [1, 2, 3, 4, 5, 6, 7], "time_from": "00:00", "time_to": "06:00"}], "night_worker_category": "manual"}'::jsonb,
    'Riksavtalen §6',
    '2025-04-01',
    NULL
  ),

  -- rule-natt-ordinaer-001
  -- Match: weekdays 1-7, time 00:00-06:00, night_worker_category=ordinary.
  -- Rate: fixed_per_hour 56.02 kr/t → tariff FK trt-supp-004.
  -- Source: Riksavtalen 2025 §6, effective 2025-04-01.
  (
    '18277f5b-dcc2-5a17-a420-e8f467f41b87'::uuid,
    NULL,
    'Nattillegg ordinær (golden-month)',
    'normal',
    true,
    'fixed_per_hour',
    56.02,
    'e0b606a3-2d0d-5a15-b4b6-2cca6839236d'::uuid,   -- trt-supp-004
    '{"windows": [{"weekdays": [1, 2, 3, 4, 5, 6, 7], "time_from": "00:00", "time_to": "06:00"}], "night_worker_category": "ordinary"}'::jsonb,
    'Riksavtalen §6',
    '2025-04-01',
    NULL
  ),

  -- rule-helgetillegg-001
  -- Match: weekdays 6,7 (lørdag og søndag), all hours. supplement_type=week_based.
  -- Rate: fixed_per_hour 56.02 kr/t → tariff FK trt-supp-005.
  -- Source: Riksavtalen 2025 §6, effective 2025-04-01.
  (
    '6a318105-fa1e-57ce-82f2-49710506f1ae'::uuid,
    NULL,
    'Helgetillegg (golden-month)',
    'week_based',
    true,
    'fixed_per_hour',
    56.02,
    'da0f4a80-3991-500f-9ac3-c7a17cff8c2c'::uuid,   -- trt-supp-005
    '{"windows": [{"weekdays": [6, 7], "time_from": "00:00", "time_to": "23:59"}]}'::jsonb,
    'Riksavtalen §6',
    '2025-04-01',
    NULL
  ),

  -- rule-helligdag-001
  -- Match: all public holidays (no time window — windows=[]). supplement_type=holiday.
  -- Rate: fixed_per_hour 100.00 kr/t → tariff FK trt-supp-006.
  -- Source: Riksavtalen 2025 §6, effective 2025-04-01.
  (
    'a8ddca53-6ee7-5fd8-a369-602318a4ff2b'::uuid,
    NULL,
    'Helligdagstillegg (golden-month)',
    'holiday',
    true,
    'fixed_per_hour',
    100.00,
    '5c24f0b6-351b-5b1b-84e2-226e1072c323'::uuid,   -- trt-supp-006
    '{}'::jsonb,
    'Riksavtalen §6',
    '2025-04-01',
    NULL
  )

ON CONFLICT (id) DO NOTHING;


-- ════════════════════════════════════════════════════════════════════════════
-- PART 3: Guard — verify all 14 rows are present
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_trt_count   INT;
  v_rule_count  INT;
BEGIN
  -- Count tariff rows by fixture_id in provenance
  SELECT COUNT(*) INTO v_trt_count
    FROM public.tariff_rate_table
   WHERE provenance->>'golden_month' = 'true';

  -- Count supplement rule rows by name pattern
  SELECT COUNT(*) INTO v_rule_count
    FROM public.supplement_rule
   WHERE name LIKE '%(golden-month)%'
     AND workspace_id IS NULL;

  IF v_trt_count < 8 THEN
    RAISE EXCEPTION 'golden-month seed guard: expected 8 tariff_rate_table rows, got %', v_trt_count;
  END IF;

  IF v_rule_count < 6 THEN
    RAISE EXCEPTION 'golden-month seed guard: expected 6 supplement_rule rows, got %', v_rule_count;
  END IF;

  RAISE NOTICE 'golden-month seed: % tariff rows + % supplement_rule rows seeded. Total: %.',
    v_trt_count, v_rule_count, (v_trt_count + v_rule_count);
END $$;

COMMENT ON TABLE public.tariff_rate_table IS
  'Cascade K1a/K1b: Versioned framework-defined rates. NULL workspace_id = platform baseline. '
  'Workspace rows override platform rows. '
  'Rows with provenance->>''golden_month''=''true'' are fixture rows for golden-month F2 testing '
  '(rate_type prefixed gm_; fixture_id in provenance maps to input JSON short-IDs). '
  'ADR-0341 v1.1, ADR-0252.';
