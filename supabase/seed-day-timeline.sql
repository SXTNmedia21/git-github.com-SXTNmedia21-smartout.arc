-- Seed: Dagslinjen test data — notes/tasks/deviations/bookings for today.
-- Workspace + sessions assumed to exist (use seed.sql + seed-operations-pipeline.sql first).
-- Run: docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/seed-day-timeline.sql
--
-- Resolves today's department_session for the kitchen + service depts in the
-- fixture workspace b0000000-… and inserts varied events on those sessions.

BEGIN;

-- ─── Variables ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_workspace UUID := 'b0000000-0000-0000-0000-000000000000';
  v_kitchen_dept UUID := 'd0000000-0000-0000-0000-000000000001';
  v_service_dept UUID := 'd0000000-0000-0000-0000-000000000002';
  v_today DATE := CURRENT_DATE;
  v_kitchen_session UUID;
  v_service_session UUID;
  v_admin UUID := 'f0000000-0000-0000-0000-000000000000';
  v_erik  UUID := 'f0000000-0000-0000-0000-000000000002';
  v_ole   UUID := 'f0000000-0000-0000-0000-000000000004';
  v_kari  UUID := 'f0000000-0000-0000-0000-000000000005';
BEGIN
  -- Resolve sessions for today (any status)
  SELECT department_session_id INTO v_kitchen_session
  FROM department_session
  WHERE workspace_id = v_workspace AND department_id = v_kitchen_dept AND session_date = v_today
  LIMIT 1;

  SELECT department_session_id INTO v_service_session
  FROM department_session
  WHERE workspace_id = v_workspace AND department_id = v_service_dept AND session_date = v_today
  LIMIT 1;

  IF v_kitchen_session IS NULL THEN
    RAISE NOTICE 'No kitchen session today — skipping kitchen seeds. Run seed-operations-pipeline.sql first.';
  END IF;

  -- ─── 1. Notes ──────────────────────────────────────────────────────────
  IF v_kitchen_session IS NOT NULL THEN
    INSERT INTO session_note (workspace_id, department_session_id, note_type, content, created_by, created_at)
    VALUES
      (v_workspace, v_kitchen_session, 'general',
       'Levering fra Solberg forsinket — kommer 11:30 i stedet for 09:00. Sett Erik på prep i mellomtiden.',
       v_admin, v_today + TIME '08:45'),
      (v_workspace, v_kitchen_session, 'handoff',
       'Pre-prep ferdig: lapskaus + dagens fisk. Ovn 2 ringer underlig — bestilt service.',
       v_erik, v_today + TIME '11:00'),
      (v_workspace, v_kitchen_session, 'general',
       'Bordet 7 ringte og spurte etter glutenfri meny — Kari har laget en versjon i Notion.',
       v_kari, v_today + TIME '13:20'),
      (v_workspace, v_kitchen_session, 'closing',
       'Stengetid: kjølerom satt til 4°C, frys 2 har stoppet et par sekunder — bør sjekkes i morgen.',
       v_admin, v_today + TIME '22:50')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_service_session IS NOT NULL THEN
    INSERT INTO session_note (workspace_id, department_session_id, note_type, content, created_by, created_at)
    VALUES
      (v_workspace, v_service_session, 'general',
       'Bordet 12 vil ha bursdagsdessert til 19:30 — Ole tar ansvar.',
       v_ole, v_today + TIME '17:15')
    ON CONFLICT DO NOTHING;
  END IF;

  -- ─── 2. Session tasks ──────────────────────────────────────────────────
  IF v_kitchen_session IS NOT NULL THEN
    INSERT INTO session_task (workspace_id, department_session_id, title, description, status, assigned_to, completed_by, completed_at, created_at)
    VALUES
      (v_workspace, v_kitchen_session, 'Sjekk kjølerom-temperatur',
       'Loggfør i HACCP-skjema. Mål med begge prober.',
       'completed', v_erik, v_erik, v_today + TIME '09:30', v_today + TIME '08:00'),
      (v_workspace, v_kitchen_session, 'Mise en place — varmkjøkken',
       'Saus, stek, sider klare før service starter.',
       'completed', v_erik, v_erik, v_today + TIME '11:45', v_today + TIME '10:00'),
      (v_workspace, v_kitchen_session, 'Glutenfri meny til bord 7',
       'Tilpass dagens lunsj — sjekk allergi-skjema.',
       'in_progress', v_kari, NULL, NULL, v_today + TIME '13:00'),
      (v_workspace, v_kitchen_session, 'Rengjør grill og platetopp',
       'Etter lunsj-service, før middags-prep.',
       'pending', v_erik, NULL, NULL, v_today + TIME '14:30'),
      (v_workspace, v_kitchen_session, 'Telle inventar — kjøkken',
       'Stikkprøve på fisk, kjøtt, meieri.',
       'pending', v_admin, NULL, NULL, v_today + TIME '20:30')
    ON CONFLICT DO NOTHING;
  END IF;

  -- ─── 3. Deviations ─────────────────────────────────────────────────────
  IF v_kitchen_session IS NOT NULL THEN
    INSERT INTO deviation (workspace_id, department_id, session_id, domain, subcategory, severity, title, description, status, reported_by, created_at)
    VALUES
      (v_workspace, v_kitchen_dept, v_kitchen_session,
       'safety', 'temperature', 'medium',
       'Frys 2 stoppet kort',
       'Frys 2 var nede i ca. 8 minutter rundt 12:30. Termometer viste 6°C på topphylle. Servicepartner varslet.',
       'open', v_erik, v_today + TIME '12:48'),
      (v_workspace, v_kitchen_dept, v_kitchen_session,
       'material', 'shortage', 'low',
       'Tom for laks',
       'Lunsj-rush solgte ut laksen. Erstatter med torsk for resten av dagen.',
       'acknowledged', v_kari, v_today + TIME '13:55'),
      (v_workspace, v_kitchen_dept, v_kitchen_session,
       'procedure', 'late_checkin', 'low',
       'Erik 12 minutter sen',
       'Forsinket buss. Ringt inn 06:48.',
       'resolved', v_admin, v_today + TIME '07:12')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_service_session IS NOT NULL THEN
    INSERT INTO deviation (workspace_id, department_id, session_id, domain, subcategory, severity, title, description, status, reported_by, created_at)
    VALUES
      (v_workspace, v_service_dept, v_service_session,
       'customer', 'complaint', 'high',
       'Klage på ventetid bord 4',
       '45 min ventetid på hovedrett. Gjest fikk 50% rabatt + dessert. Manager varslet.',
       'open', v_ole, v_today + TIME '20:35')
    ON CONFLICT DO NOTHING;
  END IF;

  -- ─── 4. Bookings ───────────────────────────────────────────────────────
  -- Workspace-scoped, no dept FK — show on all session days.
  INSERT INTO schedule_day_booking (workspace_id, shift_date, title, guest_count, menu, booking_time, location, status, is_vip, notes, contact_person)
  VALUES
    (v_workspace, v_today, 'Solberg AS — lunsj',  8, '3-retters lunsj',  '12:30', 'Bord 12-13', 'confirmed', false, 'Allergier: 1x gluten',          'Kari Solberg'),
    (v_workspace, v_today, 'Bryllup Hansen',     22, '5-retters middag', '18:00', 'Privat sal', 'confirmed', true,  'Tale kl 19:30, kake 21:00',     'Marius Hansen'),
    (v_workspace, v_today, 'Bjørn 60 år',         6, 'À la carte',       '19:30', 'Bord 7',     'confirmed', true,  'Bursdagsdessert med stjernelys', 'Vibeke Holm'),
    (v_workspace, v_today, 'Walk-in pre-teater', 12, NULL,               '17:00', 'Bord 3-4',   'pending',   false, 'Skal til Operaen 19:30',         'Telefonbestilling')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Day timeline seeded for % — kitchen=%, service=%', v_today, v_kitchen_session, v_service_session;
END $$;

COMMIT;
