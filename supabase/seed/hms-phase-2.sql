-- HMS Phase 2 Seed Data
-- Run: docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/seed/hms-phase-2.sql
-- NOTE: trg_push_deviation_reported has a bug (uses 'id' instead of 'profile_id').
-- Disable it before inserting deviations if needed:
--   ALTER TABLE deviation DISABLE TRIGGER trg_push_deviation_reported;
--   <inserts>
--   ALTER TABLE deviation ENABLE TRIGGER trg_push_deviation_reported;

-- IDs reference seed data from main seed.sql:
-- workspace: b0000000-0000-0000-0000-000000000000
-- Kitchen dept: d0000000-0000-0000-0000-000000000001
-- Service dept: d0000000-0000-0000-0000-000000000002
-- Active session (Kitchen, today): af000000-0000-0000-0000-000000000003
-- Profiles: f0000000-...-000000000000 (Admin), ...-001 (Anna), ...-002 (Erik)
-- Procedures: c3000000-...-001 (Varemottak), ...-002 (Temperaturlogg), ...-003 (Renholdsplan)
-- Protocols: c2000000-...-001 (HACCP Kjokken), ...-002 (Service Grunnkurs)

-- ── Session Hooks (Kitchen) ──────────────────────────────
INSERT INTO session_hook (id, workspace_id, department_id, hook_type, trigger_offset_min, linked_procedure_id, is_active)
VALUES
  ('ae000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001', 'pre_open', -30, 'c3000000-0000-0000-0000-000000000001', true),
  ('ae000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001', 'scheduled', 60, 'c3000000-0000-0000-0000-000000000002', true),
  ('ae000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001', 'pre_close', -15, 'c3000000-0000-0000-0000-000000000003', true)
ON CONFLICT DO NOTHING;

-- ── Session Tasks (Kitchen active session, today) ────────
-- 2 completed, 1 in_progress, 2 pending. 2 compliance-required.
INSERT INTO session_task (id, workspace_id, department_session_id, session_hook_id, title, description, status, assigned_to, completed_by, completed_at, evidence, is_compliance_required)
VALUES
  -- Completed: opening check
  ('ad000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000003', 'ae000000-0000-0000-0000-000000000001',
   'Apningskontroll', 'Sjekk at alle stasjoner er klare for drift. Rengjort, utstyrt, temperert.', 'completed',
   'f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', NOW() - INTERVAL '3 hours',
   '{"checklist": ["stasjoner_ok", "utstyr_ok"]}', false),

  -- Completed: goods receiving
  ('ad000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000003', 'ae000000-0000-0000-0000-000000000001',
   'Varemottak kontroll', 'Kontroller temperatur pa mottatte varer. Maks 4C for kjolevar.', 'completed',
   'f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', NOW() - INTERVAL '2 hours',
   '{"temperature": 3.1, "supplier": "Asko", "notes": "Alt OK"}', true),

  -- In progress: temperature log (compliance required, overdue)
  ('ad000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000003', 'ae000000-0000-0000-0000-000000000002',
   'Temperaturkontroll kjoleskap', 'Mal temperatur i alle kjoleskap og frysere. Maks 4C / -18C.', 'in_progress',
   'f0000000-0000-0000-0000-000000000001', NULL, NULL,
   NULL, true),

  -- Pending: surface cleaning
  ('ad000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000003', 'ae000000-0000-0000-0000-000000000003',
   'Rengjoring arbeidsflater', 'Rengjor og desinfiser alle arbeidsflater for lunsj.', 'pending',
   NULL, NULL, NULL, NULL, false),

  -- Pending: closing check
  ('ad000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000003', 'ae000000-0000-0000-0000-000000000003',
   'Stengekontroll', 'Sjekk at alt utstyr er slatt av, overflater rengjort, avfall sortert.', 'pending',
   NULL, NULL, NULL, NULL, false)
ON CONFLICT DO NOTHING;

-- Update session counters
UPDATE department_session
SET tasks_total = 5, tasks_completed = 2
WHERE department_session_id = 'af000000-0000-0000-0000-000000000003';

-- ── Deviations ───────────────────────────────────────────
-- 1 open critical (linked to task), 1 acknowledged medium (assigned), 1 resolved low
INSERT INTO deviation (deviation_id, workspace_id, department_id, session_id, domain, severity, title, description, status, source_task_id, procedure_id, protocol_id, reported_by, blocks_day_approval, requires_action, payroll_impact)
VALUES
  -- Open critical: fridge temperature too high, linked to temperature task
  ('ab000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001',
   'af000000-0000-0000-0000-000000000003', 'safety', 'critical',
   'Kjoleskap 8C — over grenseverdi', 'Kjoleskap 2 malte 8.1C ved kontroll kl 10:30. Grense er 4C. Varer flyttet til kjoleskap 1.',
   'open', 'ad000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000001', true, true, false),

  -- Acknowledged medium: missing gloves, assigned to Erik
  ('ab000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001',
   'af000000-0000-0000-0000-000000000003', 'procedure', 'medium',
   'Manglende bruk av hansker', 'Observert at kokk ikke brukte hansker ved tilberedning av salat.',
   'acknowledged', NULL, 'c3000000-0000-0000-0000-000000000003', 'c2000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000002', false, true, false),

  -- Resolved low: missing sign
  ('ab000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002',
   NULL, 'material', 'low',
   'Skilt for handvask mangler', 'Skiltet ved handvaskstasjonen i baren er borte. Nytt bestilt.',
   'resolved', NULL, NULL, NULL,
   'f0000000-0000-0000-0000-000000000001', false, false, false)
ON CONFLICT DO NOTHING;

-- Set resolution on resolved deviation
UPDATE deviation
SET resolved_by = 'f0000000-0000-0000-0000-000000000000',
    resolved_at = NOW() - INTERVAL '1 day',
    resolution_notes = 'Nytt skilt bestilt og hengt opp.'
WHERE deviation_id = 'ab000000-0000-0000-0000-000000000003';
