-- =============================================================================
-- DEMO-DAY SEED: 2026-05-29 (Saturday) — hq-workspace full-service roster
-- =============================================================================
-- Target workspace : b0000000-0000-0000-0000-000000000000
-- Business date    : 2026-05-29
-- Purpose          : Realistic Saturday restaurant roster + session_tasks for
--                    the Dagslinjen (day-line) demo view.
-- Safe to re-run   : YES — delete-by-workspace+date before each insert block.
-- Do NOT commit    : LOCAL Supabase only. Never touch prod.
-- =============================================================================
--
-- KNOWN IDs used:
--   Departments :
--     Operations  d0000000-0000-0000-0000-000000000000
--     Kitchen     d0000000-0000-0000-0000-000000000001
--     Service     d0000000-0000-0000-0000-000000000002
--     Bar         d0000000-0000-0000-0000-000000000003
--   Department sessions (2026-05-29):
--     Operations  fb5e20a7-c309-42f4-b668-ff1f2552e4ad
--     Kitchen     04c9eb87-70b7-4872-b98d-256aa5fa5976
--     Service     216e4e90-970a-4752-a698-06b59bd8b451
--     Bar         29e42c1d-d041-4c09-ac3a-e4100f891c15
--   Day lines (2026-05-29):
--     Operations  4693eab3-9024-46c7-8a52-d5305f344257
--     Kitchen     324d3c30-218b-4083-aace-a9adf57207ea
--     Service     4b7f2969-0562-4c0d-a0c2-3ccb8a343cb9
--     Bar         d92be95b-42b3-4753-984f-c6d75415d9e6
--   Zones (all location_id c0000000-0000-0000-0000-000000000000):
--     Hovedsal    d1000000-0000-0000-0000-000000000001
--     Terrasse    d1000000-0000-0000-0000-000000000002
--     Bar-område  d1000000-0000-0000-0000-000000000003
--   Profiles:
--     Local Admin f0000000-0000-0000-0000-000000000000  (Ops, owner/active)
--     Anna Olsen  f0000000-0000-0000-0000-000000000001  (Kitchen, active)
--     Erik Ped.   f0000000-0000-0000-0000-000000000002  (Kitchen, manager)
--     Ole Torp    f0000000-0000-0000-0000-000000000004  (Bar, active)
--     Kari Nilsen f0000000-0000-0000-0000-000000000005  (Service, trainee)
--     Jonas Bakk. f0000000-0000-0000-0000-000000000008  (Kitchen, trainee)
--     Silje Ruud  f0000000-0000-0000-0000-000000000009  (Service, trainee)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- STEP 2: CLEAN — delete all schedule_shift (cascade kills shift_session,
--         shift_session_day_line, shift_zone) for this workspace + date.
--
-- The temporal lock trigger (trg_schedule_shift_temporal_lock) blocks DELETE
-- on shifts whose start_time has already passed today. Since this seed runs
-- on the same calendar date as the shifts, we disable the trigger for the
-- DELETE and immediately re-enable it. This is LOCAL-only — never do this
-- against production (the trigger is a safety rail, not a seed concern).
-- ---------------------------------------------------------------------------

ALTER TABLE schedule_shift DISABLE TRIGGER trg_schedule_shift_temporal_lock;

DELETE FROM schedule_shift
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND shift_date = '2026-05-29';

ALTER TABLE schedule_shift ENABLE TRIGGER trg_schedule_shift_temporal_lock;

-- Also clean session_tasks for the 4 dept sessions (safe — they were empty)

DELETE FROM session_task
WHERE department_session_id IN (
  '04c9eb87-70b7-4872-b98d-256aa5fa5976',  -- Kitchen
  '216e4e90-970a-4752-a698-06b59bd8b451',  -- Service
  '29e42c1d-d041-4c09-ac3a-e4100f891c15',  -- Bar
  'fb5e20a7-c309-42f4-b668-ff1f2552e4ad'   -- Operations
);

-- ---------------------------------------------------------------------------
-- STEP 3: INSERT coherent Saturday roster
-- work_hours = (end - start) in hours minus (breaks / 60)
-- Overnight shift (Ole Torp 16:00-00:00) = 8h - 0.5h break = 7.5h
--
-- indicator colours by dept:
--   Kitchen   = orange
--   Service   = blue
--   Bar       = purple
--   Operations= emerald
-- ---------------------------------------------------------------------------

-- ── KITCHEN ──────────────────────────────────────────────────────────────────

-- Anna Olsen: Kokk 08:00–16:00 (prep + lunsj) → 8h - 30m = 7.50h
INSERT INTO schedule_shift (
  schedule_shift_id, workspace_id, department_id,
  employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks,
  day_category, status, is_published, indicator, source
) VALUES (
  '10000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000000',
  'd0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000001',
  'Kokk',
  '2026-05-29', '08:00', '16:00', 7.50, 30,
  'morning', 'published', true, 'orange', 'operational'
);

-- Erik Pedersen: Kjøkkensjef 12:00–22:00 (kveld) → 10h - 30m = 9.50h
INSERT INTO schedule_shift (
  schedule_shift_id, workspace_id, department_id,
  employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks,
  day_category, status, is_published, indicator, source
) VALUES (
  '10000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000000',
  'd0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000002',
  'Kjøkkensjef',
  '2026-05-29', '12:00', '22:00', 9.50, 30,
  'midday', 'published', true, 'orange', 'operational'
);

-- Jonas Bakken: Kokk lærling 15:00–23:00 (kveld) → 8h - 30m = 7.50h
INSERT INTO schedule_shift (
  schedule_shift_id, workspace_id, department_id,
  employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks,
  day_category, status, is_published, indicator, source
) VALUES (
  '10000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000000',
  'd0000000-0000-0000-0000-000000000001',
  'f0000000-0000-0000-0000-000000000008',
  'Kokk lærling',
  '2026-05-29', '15:00', '23:00', 7.50, 30,
  'afternoon', 'published', true, 'orange', 'operational'
);

-- ── SERVICE ───────────────────────────────────────────────────────────────────

-- Kari Nilsen: Servitør 11:00–19:00 (lunsj) → 8h - 30m = 7.50h
INSERT INTO schedule_shift (
  schedule_shift_id, workspace_id, department_id,
  employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks,
  day_category, status, is_published, indicator, source
) VALUES (
  '10000000-0000-0000-0000-000000000004',
  'b0000000-0000-0000-0000-000000000000',
  'd0000000-0000-0000-0000-000000000002',
  'f0000000-0000-0000-0000-000000000005',
  'Servitør',
  '2026-05-29', '11:00', '19:00', 7.50, 30,
  'midday', 'published', true, 'blue', 'operational'
);

-- Silje Ruud: Servitør 16:00–23:00 (kveld) → 7h - 30m = 6.50h
INSERT INTO schedule_shift (
  schedule_shift_id, workspace_id, department_id,
  employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks,
  day_category, status, is_published, indicator, source
) VALUES (
  '10000000-0000-0000-0000-000000000005',
  'b0000000-0000-0000-0000-000000000000',
  'd0000000-0000-0000-0000-000000000002',
  'f0000000-0000-0000-0000-000000000009',
  'Servitør',
  '2026-05-29', '16:00', '23:00', 6.50, 30,
  'evening', 'published', true, 'blue', 'operational'
);

-- OPEN SHIFT: Servitør kveld 17:00–23:00 (employee_id NULL = open)
-- → 6h - 0m break = 6.00h (no break on open shift — break assigned when filled)
-- is_published = false: genuinely unassigned, not yet released to staff
INSERT INTO schedule_shift (
  schedule_shift_id, workspace_id, department_id,
  employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks,
  day_category, status, is_published, indicator, source
) VALUES (
  '10000000-0000-0000-0000-000000000006',
  'b0000000-0000-0000-0000-000000000000',
  'd0000000-0000-0000-0000-000000000002',
  NULL,
  'Servitør kveld',
  '2026-05-29', '17:00', '23:00', 6.00, 0,
  'evening', 'created', false, 'blue', 'operational'
);

-- ── BAR ───────────────────────────────────────────────────────────────────────

-- Ole Torp: Bartender 16:00–00:00 (kveld/natt) → 8h - 30m = 7.50h
INSERT INTO schedule_shift (
  schedule_shift_id, workspace_id, department_id,
  employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks,
  day_category, status, is_published, indicator, source
) VALUES (
  '10000000-0000-0000-0000-000000000007',
  'b0000000-0000-0000-0000-000000000000',
  'd0000000-0000-0000-0000-000000000003',
  'f0000000-0000-0000-0000-000000000004',
  'Bartender',
  '2026-05-29', '16:00', '00:00', 7.50, 30,
  'evening', 'published', true, 'purple', 'operational'
);

-- ── OPERATIONS ────────────────────────────────────────────────────────────────

-- Local Admin: Daglig leder 10:00–18:00 → 8h - 30m = 7.50h
INSERT INTO schedule_shift (
  schedule_shift_id, workspace_id, department_id,
  employee_id, role,
  shift_date, start_time, end_time, work_hours, breaks,
  day_category, status, is_published, indicator, source
) VALUES (
  '10000000-0000-0000-0000-000000000008',
  'b0000000-0000-0000-0000-000000000000',
  'd0000000-0000-0000-0000-000000000000',
  'f0000000-0000-0000-0000-000000000000',
  'Daglig leder',
  '2026-05-29', '10:00', '18:00', 7.50, 30,
  'morning', 'published', true, 'emerald', 'operational'
);

-- ---------------------------------------------------------------------------
-- STEP 4: shift_zone assignments for FoH
--
-- The trigger trg_ensure_shift_session auto-creates shift_session +
-- shift_session_day_line rows when a schedule_shift with employee_id is
-- inserted (ADR-0367 §5.6). We DO NOT insert those manually — we let the
-- trigger run, then look up the auto-created shift_session_id by
-- schedule_shift_id to anchor shift_zone rows.
--
-- Only Service (dept …0002) and Bar (…0003) get zones.
-- Kitchen + Operations are back-of-house → no zone.
-- Location for all zones: c0000000-0000-0000-0000-000000000000 (Oslo Downtown Hub)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_kari_ss_id   uuid;
  v_silje_ss_id  uuid;
  v_ole_ss_id    uuid;
  v_svc_dl_id    uuid := '4b7f2969-0562-4c0d-a0c2-3ccb8a343cb9';  -- Service day_line
  v_bar_dl_id    uuid := 'd92be95b-42b3-4753-984f-c6d75415d9e6';  -- Bar day_line
  v_loc_id       uuid := 'c0000000-0000-0000-0000-000000000000';  -- Oslo Downtown Hub
  v_ws_id        uuid := 'b0000000-0000-0000-0000-000000000000';
BEGIN

  -- Look up auto-created shift_session IDs via schedule_shift_id
  SELECT shift_session_id INTO v_kari_ss_id
  FROM shift_session WHERE schedule_shift_id = '10000000-0000-0000-0000-000000000004';

  SELECT shift_session_id INTO v_silje_ss_id
  FROM shift_session WHERE schedule_shift_id = '10000000-0000-0000-0000-000000000005';

  SELECT shift_session_id INTO v_ole_ss_id
  FROM shift_session WHERE schedule_shift_id = '10000000-0000-0000-0000-000000000007';

  -- Guard: if trigger didn't fire (no day_line match), sessions may be NULL.
  -- In that case, skip zone inserts gracefully.
  IF v_kari_ss_id IS NOT NULL THEN
    -- Ensure shift_session_day_line exists (trigger auto-creates, but guard with ON CONFLICT)
    INSERT INTO shift_session_day_line (shift_session_id, day_line_id)
    VALUES (v_kari_ss_id, v_svc_dl_id)
    ON CONFLICT DO NOTHING;

    -- Kari Nilsen → Hovedsal (lunch service, main dining room)
    INSERT INTO shift_zone (workspace_id, shift_session_id, day_line_id, zone_id, location_id)
    VALUES (v_ws_id, v_kari_ss_id, v_svc_dl_id, 'd1000000-0000-0000-0000-000000000001', v_loc_id)
    ON CONFLICT (shift_session_id, day_line_id, zone_id) DO NOTHING;
  END IF;

  IF v_silje_ss_id IS NOT NULL THEN
    -- Ensure shift_session_day_line
    INSERT INTO shift_session_day_line (shift_session_id, day_line_id)
    VALUES (v_silje_ss_id, v_svc_dl_id)
    ON CONFLICT DO NOTHING;

    -- Silje Ruud → Hovedsal (evening primary)
    INSERT INTO shift_zone (workspace_id, shift_session_id, day_line_id, zone_id, location_id)
    VALUES (v_ws_id, v_silje_ss_id, v_svc_dl_id, 'd1000000-0000-0000-0000-000000000001', v_loc_id)
    ON CONFLICT (shift_session_id, day_line_id, zone_id) DO NOTHING;

    -- Silje Ruud → Terrasse (split coverage on busy Saturday)
    INSERT INTO shift_zone (workspace_id, shift_session_id, day_line_id, zone_id, location_id)
    VALUES (v_ws_id, v_silje_ss_id, v_svc_dl_id, 'd1000000-0000-0000-0000-000000000002', v_loc_id)
    ON CONFLICT (shift_session_id, day_line_id, zone_id) DO NOTHING;
  END IF;

  IF v_ole_ss_id IS NOT NULL THEN
    -- Ensure shift_session_day_line
    INSERT INTO shift_session_day_line (shift_session_id, day_line_id)
    VALUES (v_ole_ss_id, v_bar_dl_id)
    ON CONFLICT DO NOTHING;

    -- Ole Torp → Bar-område
    INSERT INTO shift_zone (workspace_id, shift_session_id, day_line_id, zone_id, location_id)
    VALUES (v_ws_id, v_ole_ss_id, v_bar_dl_id, 'd1000000-0000-0000-0000-000000000003', v_loc_id)
    ON CONFLICT (shift_session_id, day_line_id, zone_id) DO NOTHING;
  END IF;

END $$;

-- ---------------------------------------------------------------------------
-- STEP 5: session_tasks — the timeline's core content
-- scheduled_at uses Europe/Oslo timezone (UTC+2 on 2026-05-29, CEST)
-- status = 'pending' for all (nothing started yet — demo of a future day)
-- origin = 'manual' (seed/manager created)
-- generated_by = 'manager' (valid for manual task)
-- ---------------------------------------------------------------------------

-- ── KITCHEN tasks ─────────────────────────────────────────────────────────────

-- 08:00 Mise-en-place frokost (Anna)
INSERT INTO session_task (
  id, workspace_id, department_session_id,
  title, description,
  status, assigned_to,
  is_compliance_required, origin, generated_by,
  scheduled_at, duration_minutes
) VALUES (
  '40000000-0000-0000-0000-000000000101',
  'b0000000-0000-0000-0000-000000000000',
  '04c9eb87-70b7-4872-b98d-256aa5fa5976',
  'Mise-en-place frokost',
  'Sett frem og klargjør frokostelementene. Sjekk dybfryser og kjølerom.',
  'pending',
  'f0000000-0000-0000-0000-000000000001',
  false, 'manual', 'manager',
  '2026-05-29 08:00:00+02', 60
);

-- 10:30 Lunsjprep (Anna)
INSERT INTO session_task (
  id, workspace_id, department_session_id,
  title, description,
  status, assigned_to,
  is_compliance_required, origin, generated_by,
  scheduled_at, duration_minutes
) VALUES (
  '40000000-0000-0000-0000-000000000102',
  'b0000000-0000-0000-0000-000000000000',
  '04c9eb87-70b7-4872-b98d-256aa5fa5976',
  'Lunsjprep',
  'Klargjøring av lunsjmenyen: suppe, dagensrett og salater.',
  'pending',
  'f0000000-0000-0000-0000-000000000001',
  false, 'manual', 'manager',
  '2026-05-29 10:30:00+02', 90
);

-- 11:00 HACCP kjøletemp (Anna) — compliance
INSERT INTO session_task (
  id, workspace_id, department_session_id,
  title, description,
  status, assigned_to,
  is_compliance_required, origin, generated_by,
  scheduled_at, duration_minutes
) VALUES (
  '40000000-0000-0000-0000-000000000103',
  'b0000000-0000-0000-0000-000000000000',
  '04c9eb87-70b7-4872-b98d-256aa5fa5976',
  'HACCP — kjøletemp skap 1–3',
  'Mål og loggfør temperatur i alle kjøleskap. Maks +4°C. Dokumentér avvik.',
  'pending',
  'f0000000-0000-0000-0000-000000000001',
  true, 'manual', 'manager',
  '2026-05-29 11:00:00+02', 15
);

-- 12:00 Lunsjservice (unassigned — full kitchen team)
INSERT INTO session_task (
  id, workspace_id, department_session_id,
  title, description,
  status, assigned_to,
  is_compliance_required, origin, generated_by,
  scheduled_at, duration_minutes
) VALUES (
  '40000000-0000-0000-0000-000000000104',
  'b0000000-0000-0000-0000-000000000000',
  '04c9eb87-70b7-4872-b98d-256aa5fa5976',
  'Lunsjservice',
  'Aktiv lunsjservice 12:00–15:00. Prioriter rask omsetning.',
  'pending',
  NULL,
  false, 'manual', 'manager',
  '2026-05-29 12:00:00+02', 180
);

-- 15:00 Middagsprep fisk (Erik)
INSERT INTO session_task (
  id, workspace_id, department_session_id,
  title, description,
  status, assigned_to,
  is_compliance_required, origin, generated_by,
  scheduled_at, duration_minutes
) VALUES (
  '40000000-0000-0000-0000-000000000105',
  'b0000000-0000-0000-0000-000000000000',
  '04c9eb87-70b7-4872-b98d-256aa5fa5976',
  'Middagsprep — fisk',
  'Porsjoner og mariner kveldsmenyen. Sjekk fangstdato og kjerne-temp.',
  'pending',
  'f0000000-0000-0000-0000-000000000002',
  false, 'manual', 'manager',
  '2026-05-29 15:00:00+02', 120
);

-- 18:00 Kveldsservice (Erik)
INSERT INTO session_task (
  id, workspace_id, department_session_id,
  title, description,
  status, assigned_to,
  is_compliance_required, origin, generated_by,
  scheduled_at, duration_minutes
) VALUES (
  '40000000-0000-0000-0000-000000000106',
  'b0000000-0000-0000-0000-000000000000',
  '04c9eb87-70b7-4872-b98d-256aa5fa5976',
  'Kveldsservice',
  'Koordiner kjøkkenet gjennom kveldsservice. Følg à la carte-timingen.',
  'pending',
  'f0000000-0000-0000-0000-000000000002',
  false, 'manual', 'manager',
  '2026-05-29 18:00:00+02', 240
);

-- 22:30 Nedvask + HACCP-logg (Jonas) — compliance
INSERT INTO session_task (
  id, workspace_id, department_session_id,
  title, description,
  status, assigned_to,
  is_compliance_required, origin, generated_by,
  scheduled_at, duration_minutes
) VALUES (
  '40000000-0000-0000-0000-000000000107',
  'b0000000-0000-0000-0000-000000000000',
  '04c9eb87-70b7-4872-b98d-256aa5fa5976',
  'Nedvask + HACCP-logg',
  'Avslutt vaskeplan. Fyll ut HACCP-daglogg. Signér og arkivér.',
  'pending',
  'f0000000-0000-0000-0000-000000000008',
  true, 'manual', 'manager',
  '2026-05-29 22:30:00+02', 45
);

-- ── SERVICE tasks ─────────────────────────────────────────────────────────────

-- 11:00 Rigg sal + dekke (Kari)
INSERT INTO session_task (
  id, workspace_id, department_session_id,
  title, description,
  status, assigned_to,
  is_compliance_required, origin, generated_by,
  scheduled_at, duration_minutes
) VALUES (
  '40000000-0000-0000-0000-000000000201',
  'b0000000-0000-0000-0000-000000000000',
  '216e4e90-970a-4752-a698-06b59bd8b451',
  'Rigg sal + dekke',
  'Sett frem bestikk, glass og menyer. Sjekk blomster og lys.',
  'pending',
  'f0000000-0000-0000-0000-000000000005',
  false, 'manual', 'manager',
  '2026-05-29 11:00:00+02', 45
);

-- 12:00 Lunsjservice (Kari)
INSERT INTO session_task (
  id, workspace_id, department_session_id,
  title, description,
  status, assigned_to,
  is_compliance_required, origin, generated_by,
  scheduled_at, duration_minutes
) VALUES (
  '40000000-0000-0000-0000-000000000202',
  'b0000000-0000-0000-0000-000000000000',
  '216e4e90-970a-4752-a698-06b59bd8b451',
  'Lunsjservice',
  'Server lunsj. Koordiner med kjøkkenet på timing.',
  'pending',
  'f0000000-0000-0000-0000-000000000005',
  false, 'manual', 'manager',
  '2026-05-29 12:00:00+02', 180
);

-- 16:00 Dekke om til kveld (Silje)
INSERT INTO session_task (
  id, workspace_id, department_session_id,
  title, description,
  status, assigned_to,
  is_compliance_required, origin, generated_by,
  scheduled_at, duration_minutes
) VALUES (
  '40000000-0000-0000-0000-000000000203',
  'b0000000-0000-0000-0000-000000000000',
  '216e4e90-970a-4752-a698-06b59bd8b451',
  'Dekke om til kveld',
  'Bytt til kveldsoppsett: stearinlys, mørk duk, kveldsmeny på bordet.',
  'pending',
  'f0000000-0000-0000-0000-000000000009',
  false, 'manual', 'manager',
  '2026-05-29 16:00:00+02', 45
);

-- 18:00 Kveldsservice (Silje)
INSERT INTO session_task (
  id, workspace_id, department_session_id,
  title, description,
  status, assigned_to,
  is_compliance_required, origin, generated_by,
  scheduled_at, duration_minutes
) VALUES (
  '40000000-0000-0000-0000-000000000204',
  'b0000000-0000-0000-0000-000000000000',
  '216e4e90-970a-4752-a698-06b59bd8b451',
  'Kveldsservice',
  'Server à la carte. Koordiner dessert og kaffe med kjøkkenet.',
  'pending',
  'f0000000-0000-0000-0000-000000000009',
  false, 'manual', 'manager',
  '2026-05-29 18:00:00+02', 300
);

-- 23:00 Kasseoppgjør (Silje)
INSERT INTO session_task (
  id, workspace_id, department_session_id,
  title, description,
  status, assigned_to,
  is_compliance_required, origin, generated_by,
  scheduled_at, duration_minutes
) VALUES (
  '40000000-0000-0000-0000-000000000205',
  'b0000000-0000-0000-0000-000000000000',
  '216e4e90-970a-4752-a698-06b59bd8b451',
  'Kasseoppgjør',
  'Tell opp kasse, match mot POS. Lever kontant til daglig leder.',
  'pending',
  'f0000000-0000-0000-0000-000000000009',
  false, 'manual', 'manager',
  '2026-05-29 23:00:00+02', 30
);

-- ── BAR tasks ─────────────────────────────────────────────────────────────────

-- 16:00 Bar-rigg + cocktail-prep (Ole)
INSERT INTO session_task (
  id, workspace_id, department_session_id,
  title, description,
  status, assigned_to,
  is_compliance_required, origin, generated_by,
  scheduled_at, duration_minutes
) VALUES (
  '40000000-0000-0000-0000-000000000301',
  'b0000000-0000-0000-0000-000000000000',
  '29e42c1d-d041-4c09-ac3a-e4100f891c15',
  'Bar-rigg + cocktail-prep',
  'Fyll opp is, juice, saft og garnish. Forbered husets signaturer.',
  'pending',
  'f0000000-0000-0000-0000-000000000004',
  false, 'manual', 'manager',
  '2026-05-29 16:00:00+02', 60
);

-- 19:00 Kveldsservice bar (Ole)
INSERT INTO session_task (
  id, workspace_id, department_session_id,
  title, description,
  status, assigned_to,
  is_compliance_required, origin, generated_by,
  scheduled_at, duration_minutes
) VALUES (
  '40000000-0000-0000-0000-000000000302',
  'b0000000-0000-0000-0000-000000000000',
  '29e42c1d-d041-4c09-ac3a-e4100f891c15',
  'Kveldsservice bar',
  'Betjen bar-gjester og restaurant-gjester. Prioriter hurtighet.',
  'pending',
  'f0000000-0000-0000-0000-000000000004',
  false, 'manual', 'manager',
  '2026-05-29 19:00:00+02', 300
);

-- 00:00 Bar-oppgjør (Ole) — midnight = 2026-05-30 00:00 Oslo = 2026-05-29 22:00 UTC
INSERT INTO session_task (
  id, workspace_id, department_session_id,
  title, description,
  status, assigned_to,
  is_compliance_required, origin, generated_by,
  scheduled_at, duration_minutes
) VALUES (
  '40000000-0000-0000-0000-000000000303',
  'b0000000-0000-0000-0000-000000000000',
  '29e42c1d-d041-4c09-ac3a-e4100f891c15',
  'Bar-oppgjør',
  'Tøm kasse, match mot bongsystem, lås ned bar.',
  'pending',
  'f0000000-0000-0000-0000-000000000004',
  false, 'manual', 'manager',
  '2026-05-30 00:00:00+02', 30
);

-- ── OPERATIONS tasks ──────────────────────────────────────────────────────────

-- 10:00 Morgenbrief + dagsplan (Local Admin)
INSERT INTO session_task (
  id, workspace_id, department_session_id,
  title, description,
  status, assigned_to,
  is_compliance_required, origin, generated_by,
  scheduled_at, duration_minutes
) VALUES (
  '40000000-0000-0000-0000-000000000401',
  'b0000000-0000-0000-0000-000000000000',
  'fb5e20a7-c309-42f4-b668-ff1f2552e4ad',
  'Morgenbrief + dagsplan',
  'Gå gjennom dagsplan med kjøkkensjef og serviceleder. Sjekk reservasjoner.',
  'pending',
  'f0000000-0000-0000-0000-000000000000',
  false, 'manual', 'manager',
  '2026-05-29 10:00:00+02', 30
);

-- 14:00 Mottak vareleveranse (Local Admin)
INSERT INTO session_task (
  id, workspace_id, department_session_id,
  title, description,
  status, assigned_to,
  is_compliance_required, origin, generated_by,
  scheduled_at, duration_minutes
) VALUES (
  '40000000-0000-0000-0000-000000000402',
  'b0000000-0000-0000-0000-000000000000',
  'fb5e20a7-c309-42f4-b668-ff1f2552e4ad',
  'Mottak vareleveranse',
  'Kontroller leveranse mot bestilling. Signér følgeseddel. Flytt til lager.',
  'pending',
  'f0000000-0000-0000-0000-000000000000',
  false, 'manual', 'manager',
  '2026-05-29 14:00:00+02', 45
);

-- 18:00 Dagsoppgjør + Z-rapport (Local Admin)
INSERT INTO session_task (
  id, workspace_id, department_session_id,
  title, description,
  status, assigned_to,
  is_compliance_required, origin, generated_by,
  scheduled_at, duration_minutes
) VALUES (
  '40000000-0000-0000-0000-000000000403',
  'b0000000-0000-0000-0000-000000000000',
  'fb5e20a7-c309-42f4-b668-ff1f2552e4ad',
  'Dagsoppgjør + Z-rapport',
  'Kjør Z-rapport fra POS. Summer kassene. Send rapport til regnskapspartner.',
  'pending',
  'f0000000-0000-0000-0000-000000000000',
  false, 'manual', 'manager',
  '2026-05-29 18:00:00+02', 30
);

COMMIT;
