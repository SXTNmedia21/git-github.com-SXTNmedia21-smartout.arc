-- ============ DEMO RESTAURANT CANONICAL ID MAP (do not edit per-file) ============
-- COMPANY        a0000000-0000-0000-0000-000000000000  Smartout AS
-- WORKSPACE      b0000000-0000-0000-0000-000000000000  "Demo Restaurant"
-- LOCATION       c0000000-0000-0000-0000-000000000000  Oslo Downtown Hub
-- ZONE Hovedsal  d1000000-0000-0000-0000-000000000001  | Terrasse d1…2 | Bar d1…3 | Privat d1…4
-- DEPT Operations d0000000-0000-0000-0000-000000000000 | Kitchen d0…1 | Service d0…2 | Bar d0…3
-- PROFILES f0000000-…-{0..9} + new {a..d}; AUTH e0000000-…-{0..9} + new {a..d}
-- LOCAL ONLY — never prod. Idempotent (upsert). password = password123
-- =================================================================================
--
-- ASSET IDs (stable, for future FK references):
--   af100000-0000-0000-0000-000000000001  Rational Combi-steamer (kitchen)
--   af100000-0000-0000-0000-000000000002  La Marzocco espressomaskin (bar)
--   af100000-0000-0000-0000-000000000003  Walk-in kjølerom (kitchen)
--   af100000-0000-0000-0000-000000000004  Walk-in fryser (kitchen)
--   af100000-0000-0000-0000-000000000005  POS-terminal hovedsal (service)
--   af100000-0000-0000-0000-000000000006  POS-terminal bar (bar)
--   af100000-0000-0000-0000-000000000007  Oppvaskmaskin hette (kitchen)
--   af100000-0000-0000-0000-000000000008  Sous-vide sirkulator (kitchen)
-- ============================================================================

BEGIN;

-- Remove any pre-existing demo assets (legacy seed.sql seeded d2000000-… variants).
-- Dependent tables (asset_downtime, asset_maintenance, haccp_log) have ON DELETE CASCADE
-- or no FK constraint into asset; either way safe to delete workspace-scoped rows first.
DELETE FROM public.asset_downtime
  WHERE asset_id IN (
    SELECT asset_id FROM public.asset
    WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
  );

DELETE FROM public.asset_maintenance
  WHERE asset_id IN (
    SELECT asset_id FROM public.asset
    WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
  );

-- haccp_log has NO ON DELETE CASCADE — delete child rows first.
DELETE FROM public.haccp_log
  WHERE equipment_id IN (
    SELECT asset_id FROM public.asset
    WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
  );

DELETE FROM public.asset
  WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- ============================================================================
-- ASSETS — 8 realistic restaurant assets
-- asset_type enum: {equipment, safety, storage, station, other}
-- ============================================================================
INSERT INTO public.asset
  ( asset_id
  , workspace_id
  , location_id
  , department_id
  , name
  , description
  , asset_type
  , manufacturer
  , model
  , requires_training
  , requires_routine
  , is_active
  , sort_order
  )
VALUES
  -- 1. Rational Combi-steamer — kitchen workhorse, mandatory training + daily routine
  ( 'af100000-0000-0000-0000-000000000001'
  , 'b0000000-0000-0000-0000-000000000000'
  , 'c0000000-0000-0000-0000-000000000000'
  , 'd0000000-0000-0000-0000-000000000001'   -- Kitchen
  , 'Rational Combi-steamer'
  , 'Kombidamper for steking, damping og kombimodus. Krever daglig rengjøring og ukentlig service-sjekk.'
  , 'equipment'
  , 'Rational'
  , 'iCombi Pro 10-1/1'
  , true
  , true
  , true
  , 10
  ),

  -- 2. La Marzocco espressomaskin — bar, requires training, daily routine
  ( 'af100000-0000-0000-0000-000000000002'
  , 'b0000000-0000-0000-0000-000000000000'
  , 'c0000000-0000-0000-0000-000000000000'
  , 'd0000000-0000-0000-0000-000000000003'   -- Bar
  , 'La Marzocco espressomaskin'
  , 'Profesjonell espressomaskin for bar og kaffeservering. Krever opplæring i trekk, melkeskumming og daglig spyling.'
  , 'equipment'
  , 'La Marzocco'
  , 'Linea Classic S 2-gruppe'
  , true
  , true
  , true
  , 20
  ),

  -- 3. Walk-in kjølerom — storage, requires routine (temp log), no special training
  ( 'af100000-0000-0000-0000-000000000003'
  , 'b0000000-0000-0000-0000-000000000000'
  , 'c0000000-0000-0000-0000-000000000000'
  , 'd0000000-0000-0000-0000-000000000001'   -- Kitchen
  , 'Walk-in kjølerom'
  , 'Inngangsparti kjølerom 2–4 °C. Daglig temperaturlogg og ukentlig rengjøring av hyller og tetting.'
  , 'storage'
  , NULL
  , NULL
  , false
  , true
  , true
  , 30
  ),

  -- 4. Walk-in fryser — storage, requires routine (temp log), no special training
  ( 'af100000-0000-0000-0000-000000000004'
  , 'b0000000-0000-0000-0000-000000000000'
  , 'c0000000-0000-0000-0000-000000000000'
  , 'd0000000-0000-0000-0000-000000000001'   -- Kitchen
  , 'Walk-in fryser'
  , 'Fryserom -18 °C. Daglig temperaturlogg, ukentlig rydding og månedlig avriming.'
  , 'storage'
  , NULL
  , NULL
  , false
  , true
  , true
  , 40
  ),

  -- 5. POS-terminal hovedsal — station, no training required beyond onboarding, no routine
  ( 'af100000-0000-0000-0000-000000000005'
  , 'b0000000-0000-0000-0000-000000000000'
  , 'c0000000-0000-0000-0000-000000000000'
  , 'd0000000-0000-0000-0000-000000000002'   -- Service
  , 'POS-terminal Hovedsal'
  , 'Kasseterminal for bestilling og betaling i hovedsalen. Inkluderer kvitteringsskriver og kortleser.'
  , 'station'
  , 'Toast'
  , 'Toast POS Go 2'
  , false
  , false
  , true
  , 50
  ),

  -- 6. POS-terminal bar — station, no training required, no routine
  ( 'af100000-0000-0000-0000-000000000006'
  , 'b0000000-0000-0000-0000-000000000000'
  , 'c0000000-0000-0000-0000-000000000000'
  , 'd0000000-0000-0000-0000-000000000003'   -- Bar
  , 'POS-terminal Bar'
  , 'Kasseterminal for bartending — øl, cocktail og kaffe. Synkronisert med hoveddatabase.'
  , 'station'
  , 'Toast'
  , 'Toast POS Go 2'
  , false
  , false
  , true
  , 60
  ),

  -- 7. Oppvaskmaskin hette — equipment, requires training, daily routine
  ( 'af100000-0000-0000-0000-000000000007'
  , 'b0000000-0000-0000-0000-000000000000'
  , 'c0000000-0000-0000-0000-000000000000'
  , 'd0000000-0000-0000-0000-000000000001'   -- Kitchen
  , 'Oppvaskmaskin (hette)'
  , 'Hette-oppvaskmaskin for tallerken, glass og bestikk. Daglig avkalking og månedlig filtrering.'
  , 'equipment'
  , 'Meiko'
  , 'M-iClean H'
  , true
  , true
  , true
  , 70
  ),

  -- 8. Sous-vide sirkulator — equipment, requires training, no routine
  ( 'af100000-0000-0000-0000-000000000008'
  , 'b0000000-0000-0000-0000-000000000000'
  , 'c0000000-0000-0000-0000-000000000000'
  , 'd0000000-0000-0000-0000-000000000001'   -- Kitchen
  , 'Sous-vide sirkulator'
  , 'Presisjonstermometer og sirkulator for sous-vide-tilberedning. Krever opplæring i temperatur og tid per proteinkategori.'
  , 'equipment'
  , 'PolyScience'
  , 'Chef Series 1.5'
  , true
  , false
  , true
  , 80
  );

COMMIT;
