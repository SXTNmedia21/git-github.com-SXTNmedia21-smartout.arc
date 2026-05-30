-- ============ DEMO RESTAURANT CANONICAL ID MAP (do not edit per-file) ============
-- COMPANY        a0000000-0000-0000-0000-000000000000  Smartout AS
-- WORKSPACE      b0000000-0000-0000-0000-000000000000  "Demo Restaurant"
-- LOCATION       c0000000-0000-0000-0000-000000000000  Oslo Downtown Hub
-- ZONE Hovedsal  d1000000-0000-0000-0000-000000000001  | Terrasse d1…2 | Bar d1…3 | Privat d1…4
-- DEPT Operations d0000000-0000-0000-0000-000000000000 | Kitchen d0…1 | Service d0…2 | Bar d0…3
-- PROFILES f0000000-…-{0..9} + {a..d}; AUTH e0000000-…-{0..9} + {a..d}
-- LOCAL ONLY — never prod. Idempotent (upsert + delete/re-insert). password = password123
--
-- GOVERNANCE LAYER IDs:
-- POLICY   c1000000-…-{1..5}  (haccp/operational/hr/operational/safety)
--          f1000000-…-0       (kjøkkenrenhold — HACCP/department, from 00-base session_hook)
-- PROTOCOL c2000000-…-{1..5}  (per policy above)
--          f1100000-…-0       (daglig kjøkkenrenhold)
-- PROCEDURE c3000000-…-{1..9} | PROC STEPS c4000000-…-{1..13}
--          f1200000-…-0       (morgenrenhold kjøkken — linked from session_hook f1300000)
--          f1210000-…-{0..4}  (procedure steps for f1200000)
-- CONTROL_LIST c5000000-…-{1..3}
-- ROUTINE  c6000000-…-{1..2}
-- KNOWLEDGE_TEST c7000000-…-{1..2}
-- CONFIRMATION   c8000000-…-{1..2}
-- PROTOCOL_ASSIGNMENT c9000000-…-{1..10}
-- SEASON_POLICY_BINDING af000000-…-{1..4}
-- =================================================================================

-- Resolve gen_salt/crypt — Supabase installs pgcrypto in the `extensions` schema.
SET search_path = public, extensions, pg_catalog;

BEGIN;

-- ============================================================================
-- IDEMPOTENCY — delete child rows before parents (FK chains):
--   confirmation_signature  → confirmation
--   knowledge_test_attempt  → knowledge_test
--   routine_team            → routine   (CASCADE on delete, but explicit is safe)
--   routine                 → control_list + procedure  (NO ACTION — delete routine first)
--   protocol_assignment     → protocol  (NO ACTION — delete before protocol)
--   season_policy_binding   → policy    (CASCADE — auto, but explicit for clarity)
--   procedure_step          → procedure (NO ACTION — delete before procedure)
--   session_hook.linked_procedure_id → procedure (NO ACTION — NULL it, then delete)
--   runbook                 → control_list + protocol
--
-- Strategy: NULL the session_hook FK to allow procedure deletion, then re-link after insert.
-- ============================================================================

-- 0a. Detach session_hook from procedure f1200000 so we can delete/re-insert it.
--     This hook was seeded in 00-base.sql; we re-link it at the end of this file.
UPDATE public.session_hook
  SET linked_procedure_id = NULL
  WHERE id = 'f1300000-0000-0000-0000-000000000000';

-- 0b. Delete confirmation_signature for our demo confirmations
DELETE FROM public.confirmation_signature
  WHERE confirmation_id IN (
    SELECT c.confirmation_id FROM public.confirmation c
    JOIN public.protocol pr ON c.protocol_id = pr.protocol_id
    WHERE pr.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  );

-- 0c. Delete knowledge_test_attempt for our demo tests
DELETE FROM public.knowledge_test_attempt
  WHERE knowledge_test_id IN (
    SELECT kt.knowledge_test_id FROM public.knowledge_test kt
    JOIN public.protocol pr ON kt.protocol_id = pr.protocol_id
    WHERE pr.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  );

-- 0d. Delete confirmation (NO ACTION FK from confirmation_signature, now cleared)
DELETE FROM public.confirmation
  WHERE protocol_id IN (
    SELECT protocol_id FROM public.protocol
    WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
  );

-- 0e. Delete knowledge_test
DELETE FROM public.knowledge_test
  WHERE protocol_id IN (
    SELECT protocol_id FROM public.protocol
    WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
  );

-- 0f. Delete routine (references control_list + procedure — must go before both)
DELETE FROM public.routine
  WHERE protocol_id IN (
    SELECT protocol_id FROM public.protocol
    WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
  );

-- 0g. Delete control_list (routine cleared above; runbook checked — none for demo)
DELETE FROM public.control_list
  WHERE protocol_id IN (
    SELECT protocol_id FROM public.protocol
    WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
  );

-- 0h. Delete protocol_assignment (blocks protocol delete via NO ACTION)
DELETE FROM public.protocol_assignment
  WHERE protocol_id IN (
    SELECT protocol_id FROM public.protocol
    WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
  );

-- 0i. Delete procedure_step, then procedure (session_hook FK already NULLed above)
DELETE FROM public.procedure_step
  WHERE procedure_id IN (
    SELECT p.procedure_id FROM public.procedure p
    JOIN public.protocol pr ON p.protocol_id = pr.protocol_id
    WHERE pr.workspace_id = 'b0000000-0000-0000-0000-000000000000'
  );

DELETE FROM public.procedure
  WHERE protocol_id IN (
    SELECT protocol_id FROM public.protocol
    WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
  );

-- 0j. Delete protocol (now safe: assignments + procedures cleared)
DELETE FROM public.protocol
  WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- 0k. Delete season_policy_binding (CASCADE on delete, but explicit for safety)
DELETE FROM public.season_policy_binding
  WHERE policy_id IN (
    SELECT policy_id FROM public.policy
    WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
  );

-- 0l. Delete policy (contract_obligation has NO ACTION but zero demo rows)
DELETE FROM public.policy
  WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';


-- ============================================================================
-- 1. POLICIES — 6 total (5 core + 1 kitchen-cleaning from 00-base session_hook)
-- ============================================================================
INSERT INTO public.policy (
  policy_id, workspace_id, policy_type, policy_scope,
  name, description, statement, enforcement_status, is_active, created_by,
  valid_from
) VALUES
  -- 1.1 Food safety / HACCP (workspace-wide)
  ('c1000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000000',
   'haccp', 'workspace',
   'Mattrygghet (HACCP)',
   'Mattrygghet for kjøkken og service',
   'Alle ansatte skal følge HACCP-protokollen for mottak, lagring, tilberedning og servering av mat. Avvik skal dokumenteres og meldes kjøkkenleder samme dag.',
   'enforced', true,
   'f0000000-0000-0000-0000-000000000000',
   CURRENT_DATE - INTERVAL '180 days'),

  -- 1.2 Service standards (department-scoped — Service)
  ('c1000000-0000-0000-0000-000000000002',
   'b0000000-0000-0000-0000-000000000000',
   'operational', 'department',
   'Servicestandard',
   'Standarder for gjestekontakt og servering',
   'Servicepersonalet skal hilse gjester innen 30 sekunder, ta bestilling innen 3 minutter, og følge opp hvert bord minimum hvert 10. minutt.',
   'enforced', true,
   'f0000000-0000-0000-0000-000000000000',
   CURRENT_DATE - INTERVAL '180 days'),

  -- 1.3 Onboarding / HR (workspace-wide)
  ('c1000000-0000-0000-0000-000000000003',
   'b0000000-0000-0000-0000-000000000000',
   'hr', 'workspace',
   'Opplæring nye ansatte',
   'Opplæringsprogram for nyansatte',
   'Alle nye ansatte skal gjennomføre obligatorisk opplæring innen 14 dager etter oppstart.',
   'enforced', true,
   'f0000000-0000-0000-0000-000000000000',
   CURRENT_DATE - INTERVAL '180 days'),

  -- 1.4 Bar operations / alcohol handling (department-scoped — Bar)
  ('c1000000-0000-0000-0000-000000000004',
   'b0000000-0000-0000-0000-000000000000',
   'operational', 'department',
   'Bardrift',
   'Prosedyrer for bardrift og alkoholhåndtering',
   'Bartendere skal følge alkoholloven, sjekke legitimasjon ved tvil, og aldri servere synlig berusede gjester.',
   'enforced', true,
   'f0000000-0000-0000-0000-000000000000',
   CURRENT_DATE - INTERVAL '180 days'),

  -- 1.5 Safety / HMS (workspace-wide, aspirational — still building out)
  ('c1000000-0000-0000-0000-000000000005',
   'b0000000-0000-0000-0000-000000000000',
   'safety', 'workspace',
   'HMS og sikkerhet',
   'Helse, miljø og sikkerhet',
   'Alle ansatte skal kjenne til rømningsveier, brannslukker-plassering og førstehjelp.',
   'aspirational', true,
   'f0000000-0000-0000-0000-000000000000',
   CURRENT_DATE - INTERVAL '90 days'),

  -- 1.6 Kitchen cleaning compliance (department-scoped Kitchen — linked to session_hook f1300000)
  ('f1000000-0000-0000-0000-000000000000',
   'b0000000-0000-0000-0000-000000000000',
   'haccp', 'department',
   'Kjøkkenrenhold',
   'Renholdsplan iht. Mattilsynets krav',
   'Kjøkkenet skal rengjøres etter Mattilsynets krav ved åpning og stenging.',
   'enforced', true,
   'f0000000-0000-0000-0000-000000000000',
   CURRENT_DATE - INTERVAL '180 days');


-- ============================================================================
-- 2. SEASON POLICY BINDINGS — bind 4 of 6 policies to the active season
-- ============================================================================
INSERT INTO public.season_policy_binding (
  season_policy_binding_id, workspace_id, season_id, policy_id,
  is_active, notes, activated_by
) VALUES
  ('af000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001',
   true, 'HACCP er alltid aktiv.',
   'f0000000-0000-0000-0000-000000000000'),
  ('af000000-0000-0000-0000-000000000002',
   'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000002',
   true, NULL,
   'f0000000-0000-0000-0000-000000000000'),
  ('af000000-0000-0000-0000-000000000003',
   'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000003',
   true, 'Ekstra viktig i vintesesongen med mange nyansatte.',
   'f0000000-0000-0000-0000-000000000000'),
  ('af000000-0000-0000-0000-000000000004',
   'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000005',
   true, NULL,
   'f0000000-0000-0000-0000-000000000000');


-- ============================================================================
-- 3. PROTOCOLS — 6 total (one per policy)
-- ============================================================================
INSERT INTO public.protocol (
  protocol_id, policy_id, workspace_id, name, description,
  version, status, owner_profile_id, created_by
) VALUES
  -- 3.1 HACCP Kitchen protocol
  ('c2000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000000',
   'HACCP Kjøkken',
   'Temperaturkontroll, mottak, merking, renhold',
   '1.0', 'active',
   'f0000000-0000-0000-0000-000000000002',   -- Erik (kitchen manager)
   'f0000000-0000-0000-0000-000000000000'),

  -- 3.2 Service foundation protocol
  ('c2000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000002',
   'b0000000-0000-0000-0000-000000000000',
   'Service Grunnkurs',
   'Bordservice, bestillingssystem, gjestehåndtering',
   '1.0', 'active',
   'f0000000-0000-0000-0000-000000000007',   -- Service manager
   'f0000000-0000-0000-0000-000000000000'),

  -- 3.3 Employee onboarding protocol
  ('c2000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000003',
   'b0000000-0000-0000-0000-000000000000',
   'Onboarding Program',
   'Dag 1-14 oppgaver, systemtilgang, opplæring',
   '2.0', 'active',
   'f0000000-0000-0000-0000-000000000000',   -- Admin / owner
   'f0000000-0000-0000-0000-000000000000'),

  -- 3.4 Bar procedures protocol
  ('c2000000-0000-0000-0000-000000000004',
   'c1000000-0000-0000-0000-000000000004',
   'b0000000-0000-0000-0000-000000000000',
   'Bar Prosedyrer',
   'Alkoholservering, alderskontroll, barstenging',
   '1.0', 'active',
   'f0000000-0000-0000-0000-000000000004',   -- Ole (bar lead)
   'f0000000-0000-0000-0000-000000000000'),

  -- 3.5 Safety / HMS protocol (draft — content still being developed)
  ('c2000000-0000-0000-0000-000000000005',
   'c1000000-0000-0000-0000-000000000005',
   'b0000000-0000-0000-0000-000000000000',
   'HMS Grunnopplæring',
   'Brann, rømning, førstehjelp',
   '1.0', 'draft',
   'f0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000000'),

  -- 3.6 Daily kitchen cleaning protocol (linked to session_hook pre_open)
  ('f1100000-0000-0000-0000-000000000000',
   'f1000000-0000-0000-0000-000000000000',
   'b0000000-0000-0000-0000-000000000000',
   'Daglig kjøkkenrenhold',
   'Sjekkliste for daglig renhold av kjøkken — iht. Mattilsynets krav',
   '1.0', 'active',
   'f0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000000');


-- ============================================================================
-- 4. PROCEDURES — 10 total (9 core + 1 kitchen-cleaning)
-- ============================================================================
INSERT INTO public.procedure (
  procedure_id, protocol_id, name, description, procedure_type, sort_order, is_active
) VALUES
  -- HACCP procedures (protocol c2…1)
  ('c3000000-0000-0000-0000-000000000001',
   'c2000000-0000-0000-0000-000000000001',
   'Varemottak',
   'Kontroll av varer ved levering: temperatur, emballasje, datomerking',
   'standard', 1, true),
  ('c3000000-0000-0000-0000-000000000002',
   'c2000000-0000-0000-0000-000000000001',
   'Temperaturlogg',
   'Daglig temperaturkontroll av kjøle- og fryseanlegg morgen + kveld',
   'standard', 2, true),
  ('c3000000-0000-0000-0000-000000000003',
   'c2000000-0000-0000-0000-000000000001',
   'Renholdsplan',
   'Ukentlig renholdssjekk av alle kjøkkensoner',
   'maintenance', 3, true),

  -- Service procedures (protocol c2…2)
  ('c3000000-0000-0000-0000-000000000004',
   'c2000000-0000-0000-0000-000000000002',
   'Bordservice Steg-for-Steg',
   'Fra gjest ankommer til betaling — standardisert serviceflyt',
   'standard', 1, true),
  ('c3000000-0000-0000-0000-000000000005',
   'c2000000-0000-0000-0000-000000000002',
   'Kassasystem Opplæring',
   'Bruk av POS, split-betaling, gavekort, dagoppgjør',
   'onboarding', 2, true),

  -- Onboarding procedures (protocol c2…3)
  ('c3000000-0000-0000-0000-000000000006',
   'c2000000-0000-0000-0000-000000000003',
   'Dag 1: Velkomst',
   'Omvisning, uniformering, systemtilgang og introsamtale',
   'onboarding', 1, true),
  ('c3000000-0000-0000-0000-000000000007',
   'c2000000-0000-0000-0000-000000000003',
   'Dag 2-3: Skygging',
   'Følge erfaren kollega på vakt — kjøkken og sal',
   'onboarding', 2, true),

  -- Bar procedures (protocol c2…4)
  ('c3000000-0000-0000-0000-000000000008',
   'c2000000-0000-0000-0000-000000000004',
   'Alderskontroll',
   'Legitimasjonssjekk, avvisning og hendelseslogging',
   'standard', 1, true),
  ('c3000000-0000-0000-0000-000000000009',
   'c2000000-0000-0000-0000-000000000004',
   'Barstenging',
   'Kassaoppgjør, renhold, sikring og locking',
   'standard', 2, true),

  -- Kitchen cleaning procedure (protocol f1100000 — linked to session_hook)
  ('f1200000-0000-0000-0000-000000000000',
   'f1100000-0000-0000-0000-000000000000',
   'Morgenrenhold kjøkken',
   'Sjekkliste for renhold av kjøkken før åpning — 5 sjekkpunkter iht. Mattilsynet',
   'maintenance', 1, true);


-- ============================================================================
-- 5. PROCEDURE STEPS — 18 total (13 core + 5 kitchen-cleaning)
-- ============================================================================
INSERT INTO public.procedure_step (
  step_id, procedure_id, title, description, step_order, is_required, estimated_minutes
) VALUES
  -- Varemottak (c3…1) — 3 steps
  ('c4000000-0000-0000-0000-000000000001',
   'c3000000-0000-0000-0000-000000000001',
   'Sjekk følgeseddel',
   'Kontroller at følgeseddel stemmer med bestilling — antall, vekt, varenummer.',
   1, true, 2),
  ('c4000000-0000-0000-0000-000000000002',
   'c3000000-0000-0000-0000-000000000001',
   'Mål temperatur',
   'Sjekk kjølekjedetemperatur med IR-termometer. Forkast varer >7°C (kjøl) / >-12°C (frys).',
   2, true, 3),
  ('c4000000-0000-0000-0000-000000000003',
   'c3000000-0000-0000-0000-000000000001',
   'Lagre riktig',
   'Plasser varer i korrekt kjøle/frys/tørrlager — FIFO-prinsippet.',
   3, true, 10),

  -- Temperaturlogg (c3…2) — 3 steps
  ('c4000000-0000-0000-0000-000000000004',
   'c3000000-0000-0000-0000-000000000002',
   'Kjøleskap morgen',
   'Logg temperatur kjøleskap 1-3 ved åpning. Maks 4°C.',
   1, true, 3),
  ('c4000000-0000-0000-0000-000000000005',
   'c3000000-0000-0000-0000-000000000002',
   'Fryser morgen',
   'Logg temperatur fryser ved åpning. Maks -18°C.',
   2, true, 2),
  ('c4000000-0000-0000-0000-000000000006',
   'c3000000-0000-0000-0000-000000000002',
   'Kjøleskap kveld',
   'Logg temperatur kjøleskap 1-3 ved stenging. Maks 4°C.',
   3, true, 3),

  -- Bordservice (c3…4) — 4 steps
  ('c4000000-0000-0000-0000-000000000007',
   'c3000000-0000-0000-0000-000000000004',
   'Hilse gjesten',
   'Hils innen 30 sekunder — øyekontakt, smil, tilby meny.',
   1, true, 1),
  ('c4000000-0000-0000-0000-000000000008',
   'c3000000-0000-0000-0000-000000000004',
   'Ta bestilling',
   'Bruk POS, bekreft allergier, gjenta bestilling tilbake til gjest.',
   2, true, 3),
  ('c4000000-0000-0000-0000-000000000009',
   'c3000000-0000-0000-0000-000000000004',
   'Servere mat',
   'Sjekk rett tallerken, server fra venstre, never reach over guest.',
   3, true, 1),
  ('c4000000-0000-0000-0000-000000000010',
   'c3000000-0000-0000-0000-000000000004',
   'Oppfølging',
   'Sjekk bordet 2 min etter servering — tilby tilbehør, vann.',
   4, true, 1),

  -- Alderskontroll (c3…8) — 3 steps
  ('c4000000-0000-0000-0000-000000000011',
   'c3000000-0000-0000-0000-000000000008',
   'Spør om legitimasjon',
   'Alltid ved tvil om alder — "under 25-regelen".',
   1, true, 1),
  ('c4000000-0000-0000-0000-000000000012',
   'c3000000-0000-0000-0000-000000000008',
   'Kontroller ID',
   'Sjekk bilde, utløpsdato, fødselsdato — godkjent: pass, BankID-kort, bankkort med bilde.',
   2, true, 1),
  ('c4000000-0000-0000-0000-000000000013',
   'c3000000-0000-0000-0000-000000000008',
   'Avvis eller server',
   'Høflig avvisning ved tvil — logg hendelsen i vaktbok.',
   3, true, 1),

  -- Morgenrenhold kjøkken (f1200000) — 5 steps (Mattilsynet checkpoints)
  ('f1210000-0000-0000-0000-000000000000',
   'f1200000-0000-0000-0000-000000000000',
   'Rengjør arbeidsflater',
   'Tørk av alle benker og skjærefjøler med desinfiserende middel.',
   1, true, 5),
  ('f1210000-0000-0000-0000-000000000001',
   'f1200000-0000-0000-0000-000000000000',
   'Vask gulv',
   'Feie og vaske kjøkkengulvet. Sjekk under utstyr.',
   2, true, 10),
  ('f1210000-0000-0000-0000-000000000002',
   'f1200000-0000-0000-0000-000000000000',
   'Tøm søppel',
   'Tøm alle søppelbøtter. Sett inn nye poser.',
   3, true, 5),
  ('f1210000-0000-0000-0000-000000000003',
   'f1200000-0000-0000-0000-000000000000',
   'Sjekk håndvask',
   'Kontroller at såpe og papir er fylt opp ved alle håndvasker.',
   4, true, 3),
  ('f1210000-0000-0000-0000-000000000004',
   'f1200000-0000-0000-0000-000000000000',
   'Rengjør kjøleskap utvendig',
   'Tørk av håndtak og overflater på kjøleskap og fryser.',
   5, false, 5);


-- ============================================================================
-- 6. CONTROL LISTS — 3 total
--    c5…1  HACCP temperature log (canonical HACCP items with max_c/min_c)
--    c5…2  Service evening close checklist
--    c5…3  Bar close checklist
-- ============================================================================
INSERT INTO public.control_list (
  control_list_id, protocol_id, name, description, assigned_to_type, items, is_active
) VALUES
  -- 6.1 HACCP — temperature control (flagship; items use canonical max_c/min_c keys)
  ('c5000000-0000-0000-0000-000000000001',
   'c2000000-0000-0000-0000-000000000001',
   'Daglig temperatursjekk',
   'Morgen + kveld temperaturlogg — HACCP kritisk grenseverdier',
   'team_leader',
   '[
     {"label":"Kjøleskap 1-3","type":"temperature","max_c":4,"unit":"C"},
     {"label":"Fryser","type":"temperature","max_c":-18,"unit":"C"},
     {"label":"Varmholding buffet","type":"temperature","min_c":60,"unit":"C"},
     {"label":"Mottakskontroll kjølevare","type":"temperature","max_c":4,"unit":"C"}
   ]'::jsonb,
   true),

  -- 6.2 Service — evening close
  ('c5000000-0000-0000-0000-000000000002',
   'c2000000-0000-0000-0000-000000000002',
   'Kveldsstenging service',
   'Sjekkliste for stenging av sal',
   'manager',
   '[
     {"label":"Alle bord tørket","type":"checkbox"},
     {"label":"Bestikk polert","type":"checkbox"},
     {"label":"Gulv mopp","type":"checkbox"},
     {"label":"Lys av","type":"checkbox"},
     {"label":"Alarm satt","type":"checkbox"}
   ]'::jsonb,
   true),

  -- 6.3 Bar — close checklist
  ('c5000000-0000-0000-0000-000000000003',
   'c2000000-0000-0000-0000-000000000004',
   'Barstenging sjekkliste',
   'Opprydding og sikkerhet ved barstenging',
   'team_leader',
   '[
     {"label":"Alle flasker tilbake","type":"checkbox"},
     {"label":"Bardisk rengjort","type":"checkbox"},
     {"label":"Kassaoppgjør ferdig","type":"checkbox"},
     {"label":"Kjøleskap lukket","type":"checkbox"}
   ]'::jsonb,
   true);


-- ============================================================================
-- 7. ROUTINES — 2 total (both scheduled; reference procedures + control_lists)
-- ============================================================================
INSERT INTO public.routine (
  routine_id, protocol_id, procedure_id, name,
  trigger_type, trigger_config,
  assigned_to_type, assigned_to_ref,
  control_list_id, control_frequency,
  workspace_id, is_active
) VALUES
  -- 7.1 Morning temperature log — fires 09:00 daily (HACCP)
  ('c6000000-0000-0000-0000-000000000001',
   'c2000000-0000-0000-0000-000000000001',
   'c3000000-0000-0000-0000-000000000002',   -- Temperaturlogg procedure
   'Morgen temperaturlogg',
   'scheduled',
   '{"cron":"0 9 * * *","timezone":"Europe/Oslo"}'::jsonb,
   'team',
   'aa000000-0000-0000-0000-000000000001',   -- Kitchen A-Team
   'c5000000-0000-0000-0000-000000000001',   -- HACCP control list
   'every_time',
   'b0000000-0000-0000-0000-000000000000',
   true),

  -- 7.2 Evening service close — fires 22:00 daily
  ('c6000000-0000-0000-0000-000000000002',
   'c2000000-0000-0000-0000-000000000002',
   'c3000000-0000-0000-0000-000000000004',   -- Bordservice procedure
   'Servicerutine kveld',
   'scheduled',
   '{"cron":"0 22 * * *","timezone":"Europe/Oslo"}'::jsonb,
   'team',
   'aa000000-0000-0000-0000-000000000002',   -- Service Evening
   'c5000000-0000-0000-0000-000000000002',   -- Evening close list
   'every_time',
   'b0000000-0000-0000-0000-000000000000',
   true);


-- ============================================================================
-- 8. KNOWLEDGE TESTS — 2 total
-- ============================================================================
INSERT INTO public.knowledge_test (
  knowledge_test_id, protocol_id, name, description,
  questions, pass_threshold, max_attempts, is_active
) VALUES
  -- 8.1 HACCP hygiene quiz — 80% to pass, 3 attempts
  ('c7000000-0000-0000-0000-000000000001',
   'c2000000-0000-0000-0000-000000000001',
   'HACCP Quiz',
   'Test av grunnleggende HACCP-kunnskap og mathygiene',
   '[
     {
       "question": "Hva er maks temperatur for kjølevarer ved mottak?",
       "options": ["4°C","7°C","10°C"],
       "correct": 0
     },
     {
       "question": "Hvor lenge kan fersk mat maksimalt stå i romtemperatur?",
       "options": ["30 minutter","2 timer","4 timer"],
       "correct": 1
     },
     {
       "question": "Hva gjør du ved varemottak hvis temperaturen er for høy?",
       "options": ["Aksepterer og setter i kjøleskap","Avviser og dokumenterer","Spør leverandøren"],
       "correct": 1
     },
     {
       "question": "Hva er minimumstemperatur for varmholding av mat (buffet)?",
       "options": ["50°C","60°C","70°C"],
       "correct": 1
     }
   ]'::jsonb,
   80, 3, true),

  -- 8.2 Responsible alcohol service — 100% required (legal compliance), 2 attempts
  ('c7000000-0000-0000-0000-000000000002',
   'c2000000-0000-0000-0000-000000000004',
   'Alkoholservering',
   'Ansvarlig alkoholhåndtering og alderskontroll',
   '[
     {
       "question": "Hva er aldersgrense for kjøp av alkohol (over 4.7%) i Norge?",
       "options": ["16 år","18 år","20 år"],
       "correct": 2
     },
     {
       "question": "Hva gjør du hvis en gjest ser synlig beruset ut?",
       "options": ["Serverer saktere","Nekter servering og tilbyr vann","Ber dem sitte ned"],
       "correct": 1
     }
   ]'::jsonb,
   100, 2, true);


-- ============================================================================
-- 9. CONFIRMATIONS — 2 total
-- ============================================================================
INSERT INTO public.confirmation (
  confirmation_id, protocol_id, name, confirmation_text, requires_signature, is_active
) VALUES
  -- 9.1 Onboarding sign-off (requires signature)
  ('c8000000-0000-0000-0000-000000000001',
   'c2000000-0000-0000-0000-000000000003',
   'Onboarding bekreftelse',
   'Jeg bekrefter at jeg har gjennomført onboarding-programmet og forstår mine plikter og rettigheter som ansatt ved Demo Restaurant.',
   true, true),

  -- 9.2 HMS acknowledgement (no signature — aspirational status)
  ('c8000000-0000-0000-0000-000000000002',
   'c2000000-0000-0000-0000-000000000005',
   'HMS-bekreftelse',
   'Jeg bekrefter at jeg kjenner rømningsveier, brannslukker-plassering og førstehjelp-prosedyrer på arbeidsstedet.',
   false, true);


-- ============================================================================
-- 10. PROTOCOL ASSIGNMENTS — 10 employees assigned to relevant protocols
-- ============================================================================
INSERT INTO public.protocol_assignment (
  assignment_id, protocol_id, profile_id, workspace_id,
  status, completed_at, assigned_via
) VALUES
  -- Anna (f…1, Kitchen) — HACCP + Onboarding completed
  ('c9000000-0000-0000-0000-000000000001',
   'c2000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000000',
   'completed', NOW() - INTERVAL '30 days', 'workspace'),
  ('c9000000-0000-0000-0000-000000000002',
   'c2000000-0000-0000-0000-000000000003',
   'f0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000000',
   'completed', NOW() - INTERVAL '60 days', 'workspace'),

  -- Erik (f…2, Kitchen, manager) — HACCP completed
  ('c9000000-0000-0000-0000-000000000003',
   'c2000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000002',
   'b0000000-0000-0000-0000-000000000000',
   'completed', NOW() - INTERVAL '45 days', 'workspace'),

  -- Ole (f…4, Bar) — Bar Prosedyrer + Onboarding completed
  ('c9000000-0000-0000-0000-000000000004',
   'c2000000-0000-0000-0000-000000000004',
   'f0000000-0000-0000-0000-000000000004',
   'b0000000-0000-0000-0000-000000000000',
   'completed', NOW() - INTERVAL '20 days', 'workspace'),
  ('c9000000-0000-0000-0000-000000000005',
   'c2000000-0000-0000-0000-000000000003',
   'f0000000-0000-0000-0000-000000000004',
   'b0000000-0000-0000-0000-000000000000',
   'completed', NOW() - INTERVAL '40 days', 'workspace'),

  -- Kari (f…5, Service, trainee) — Service + Onboarding not_started
  ('c9000000-0000-0000-0000-000000000006',
   'c2000000-0000-0000-0000-000000000002',
   'f0000000-0000-0000-0000-000000000005',
   'b0000000-0000-0000-0000-000000000000',
   'not_started', NULL, 'workspace'),
  ('c9000000-0000-0000-0000-000000000007',
   'c2000000-0000-0000-0000-000000000003',
   'f0000000-0000-0000-0000-000000000005',
   'b0000000-0000-0000-0000-000000000000',
   'not_started', NULL, 'workspace'),

  -- Jonas (f…8, Kitchen, trainee) — HACCP + Onboarding not_started
  ('c9000000-0000-0000-0000-000000000008',
   'c2000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000008',
   'b0000000-0000-0000-0000-000000000000',
   'not_started', NULL, 'workspace'),
  ('c9000000-0000-0000-0000-000000000009',
   'c2000000-0000-0000-0000-000000000003',
   'f0000000-0000-0000-0000-000000000008',
   'b0000000-0000-0000-0000-000000000000',
   'not_started', NULL, 'workspace'),

  -- Silje (f…9, Service, trainee) — Service not_started
  ('c9000000-0000-0000-0000-000000000010',
   'c2000000-0000-0000-0000-000000000002',
   'f0000000-0000-0000-0000-000000000009',
   'b0000000-0000-0000-0000-000000000000',
   'not_started', NULL, 'workspace');


-- ============================================================================
-- 11. RE-LINK SESSION HOOK to Morgenrenhold procedure
--     (was NULLed in step 0a to allow procedure delete/re-insert)
-- ============================================================================
UPDATE public.session_hook
  SET linked_procedure_id = 'f1200000-0000-0000-0000-000000000000'
  WHERE id = 'f1300000-0000-0000-0000-000000000000';


COMMIT;
