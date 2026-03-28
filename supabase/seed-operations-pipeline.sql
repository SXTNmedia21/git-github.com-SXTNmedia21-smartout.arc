-- Seed: Aktiv Pipeline / Operations dashboard data
-- Workspace: b0000000-0000-0000-0000-000000000000
-- Date: CURRENT_DATE (always seeds "today")
-- Run: docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/seed-operations-pipeline.sql

BEGIN;

-- ─── Variables ──────────────────────────────────────────────────────────────
-- Using fixture IDs from seed.sql

-- Workspace: b0000000-0000-0000-0000-000000000000
-- Departments:
--   Kitchen:    d0000000-0000-0000-0000-000000000001
--   Service:    d0000000-0000-0000-0000-000000000002
--   Bar:        d0000000-0000-0000-0000-000000000003
--   Operations: d0000000-0000-0000-0000-000000000000
-- Profiles:
--   Erik Pedersen:    f0000000-0000-0000-0000-000000000002 (active)
--   Fixture Employee: f0000000-0000-0000-0000-000000000001 (active)
--   Local Admin:      f0000000-0000-0000-0000-000000000000 (active)
--   Ole Torp:         f0000000-0000-0000-0000-000000000004 (active)
--   Jonas Bakken:     f0000000-0000-0000-0000-000000000008 (trainee)
--   Kari Nilsen:      f0000000-0000-0000-0000-000000000005 (trainee)
--   Silje Ruud:       f0000000-0000-0000-0000-000000000009 (trainee)
-- Sessions (existing):
--   Kitchen:  af000000-0000-0000-0000-000000000003 (active)
--   Service:  af000000-0000-0000-0000-000000000004 (upcoming)

-- ─── 1. Add sessions for Bar and Operations ─────────────────────────────────

INSERT INTO department_session (
  department_session_id, workspace_id, department_id, session_date,
  status, planned_open, planned_close, planned_shifts, actual_shifts,
  tasks_total, tasks_completed
) VALUES
  -- Bar: active since 15:00
  ('af000000-0000-0000-0000-000000000005',
   'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000003',
   CURRENT_DATE, 'active', '15:00', '01:00', 3, 2, 6, 2),
  -- Operations: closed (morning shift done)
  ('af000000-0000-0000-0000-000000000006',
   'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000000',
   CURRENT_DATE, 'closed', '07:00', '15:00', 2, 2, 4, 4)
ON CONFLICT (department_session_id) DO NOTHING;

-- ─── 2. Session tasks for Kitchen (active, 8 tasks) ────────────────────────

INSERT INTO session_task (workspace_id, department_session_id, title, description, status, assigned_to, is_compliance_required)
VALUES
  -- 3 completed
  ('b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000003',
   'Temperaturlogg kjøl', 'Sjekk og loggfør temp i alle kjøleskap', 'completed',
   'f0000000-0000-0000-0000-000000000008', true),
  ('b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000003',
   'Mise en place lunsj', 'Forbered alle stasjoner for lunsjservice', 'completed',
   'f0000000-0000-0000-0000-000000000008', false),
  ('b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000003',
   'Varemottak', 'Ta imot og kontroller leveranse', 'completed',
   'f0000000-0000-0000-0000-000000000002', false),
  -- 2 in_progress
  ('b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000003',
   'Mise en place middag', 'Forbered stasjoner for kveldsservice', 'in_progress',
   'f0000000-0000-0000-0000-000000000008', false),
  ('b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000003',
   'Allergenliste oppdatering', 'Oppdater allergeninfo etter menyendring', 'in_progress',
   'f0000000-0000-0000-0000-000000000002', true),
  -- 1 overdue
  ('b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000003',
   'HACCP kontrollpunkt 2', 'Andre HACCP-sjekk kl 14', 'overdue',
   'f0000000-0000-0000-0000-000000000008', true),
  -- 2 pending
  ('b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000003',
   'Lukkerutine kjøkken', 'Rengjøring og nedkjøling', 'pending',
   'f0000000-0000-0000-0000-000000000008', false),
  ('b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000003',
   'Temperaturlogg slutt', 'Sluttkontroll alle kjøleenheter', 'pending',
   'f0000000-0000-0000-0000-000000000002', true);

-- ─── 3. Session tasks for Service (upcoming, 5 tasks) ──────────────────────

INSERT INTO session_task (workspace_id, department_session_id, title, description, status, assigned_to)
VALUES
  ('b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000004',
   'Bordoppsett', 'Dekk alle bord iht reservasjonsliste', 'available',
   'f0000000-0000-0000-0000-000000000005'),
  ('b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000004',
   'Vinlager sjekk', 'Kontroller at alle vin-by-glass er tilgjengelige', 'available',
   'f0000000-0000-0000-0000-000000000005'),
  ('b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000004',
   'Menygjennomgang', 'Briefing om dagens meny og allergener', 'available',
   'f0000000-0000-0000-0000-000000000009'),
  ('b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000004',
   'Reservasjonskontroll', 'Sjekk kveldens reservasjoner og VIP-gjester', 'available',
   'f0000000-0000-0000-0000-000000000009'),
  ('b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000004',
   'Lukkerutine service', 'Rydding, polering, neste dag-prep', 'available',
   'f0000000-0000-0000-0000-000000000005');

-- ─── 4. Session tasks for Bar (active, 6 tasks) ────────────────────────────

INSERT INTO session_task (workspace_id, department_session_id, title, description, status, assigned_to)
VALUES
  ('b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000005',
   'Bar setup', 'Klargjør alle stasjoner og garnish', 'completed',
   'f0000000-0000-0000-0000-000000000004'),
  ('b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000005',
   'Cocktail prep', 'Batch dagens cocktails og siruper', 'completed',
   'f0000000-0000-0000-0000-000000000004'),
  ('b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000005',
   'Fatølkontroll', 'Sjekk trykk og skift fat ved behov', 'in_progress',
   'f0000000-0000-0000-0000-000000000004'),
  ('b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000005',
   'Happy hour oppsett', 'Tavle, priser og spesialtilbud', 'pending',
   'f0000000-0000-0000-0000-000000000004'),
  ('b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000005',
   'Inventartelling bar', 'Ukentlig telling av brennevin og vin', 'pending',
   'f0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000005',
   'Lukkerutine bar', 'Rengjøring, oppgjør, neste dag-prep', 'available',
   NULL);

-- ─── 5. Session tasks for Operations (closed, all done) ────────────────────

INSERT INTO session_task (workspace_id, department_session_id, title, description, status, assigned_to, completed_by, completed_at)
VALUES
  ('b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000006',
   'Åpning lokale', 'Lås opp, alarm av, lys og ventilasjon', 'completed',
   'f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - interval '6 hours'),
  ('b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000006',
   'Vareleveranse morgen', 'Mottak av daglig leveranse', 'completed',
   'f0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', CURRENT_TIMESTAMP - interval '5 hours'),
  ('b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000006',
   'Rengjøring fellesareal', 'Gulv, toaletter, inngangsparti', 'completed',
   'f0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000000', CURRENT_TIMESTAMP - interval '4 hours'),
  ('b0000000-0000-0000-0000-000000000000', 'af000000-0000-0000-0000-000000000006',
   'Utstyrssjekk', 'Kontroller oppvaskmaskin, kaffemaskin, is', 'completed',
   'f0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000000', CURRENT_TIMESTAMP - interval '3 hours');

-- ─── 6. Fix shifts: add department_id and more shifts ───────────────────────

-- Update existing shifts with department_id
UPDATE schedule_shift SET department_id = 'd0000000-0000-0000-0000-000000000001'
WHERE schedule_shift_id = 'ae000000-0000-0000-0000-000000000006'; -- Jonas, Kokk → Kitchen

UPDATE schedule_shift SET department_id = 'd0000000-0000-0000-0000-000000000002'
WHERE schedule_shift_id = 'ae000000-0000-0000-0000-000000000007'; -- Kari, Servitor → Service

UPDATE schedule_shift SET department_id = 'd0000000-0000-0000-0000-000000000002'
WHERE schedule_shift_id = 'ae000000-0000-0000-0000-000000000008'; -- Silje, Servitor → Service

UPDATE schedule_shift SET department_id = 'd0000000-0000-0000-0000-000000000003'
WHERE schedule_shift_id = 'ae000000-0000-0000-0000-000000000009'; -- Ole, Bartender → Bar

-- Add more shifts (morning crew + one open/unassigned)
INSERT INTO schedule_shift (
  workspace_id, department_id, employee_id, shift_date,
  role, start_time, end_time, work_hours, status, day_category, is_published
) VALUES
  -- Morning Kitchen: Erik
  ('b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000002', CURRENT_DATE,
   'Kokk', '08:00', '16:00', 7.5, 'published', 'morning', true),
  -- Morning Operations: Fixture Employee + Local Admin
  ('b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', CURRENT_DATE,
   'Driftsleder', '07:00', '15:00', 7.5, 'published', 'morning', true),
  ('b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000000', CURRENT_DATE,
   'Driftsleder', '07:00', '15:00', 7.5, 'published', 'morning', true),
  -- Ubemannet kveldsvakt Bar (open shift — drives stress up)
  ('b0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000003',
   NULL, CURRENT_DATE,
   'Bartender', '18:00', '01:00', 6.5, 'published', 'evening', true);

-- ─── 7. Deviations ─────────────────────────────────────────────────────────
-- Temporarily disable the broken push trigger (references id instead of profile_id)
ALTER TABLE deviation DISABLE TRIGGER trg_push_deviation_reported;

INSERT INTO deviation (
  workspace_id, department_id, session_id, domain, severity,
  title, description, status, reported_by, blocks_day_approval, requires_action
) VALUES
  -- High severity HACCP deviation in Kitchen
  ('b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000001',
   'af000000-0000-0000-0000-000000000003',
   'safety', 'high',
   'Kjøleskap #3 over temperaturgrense',
   'Temperatur målt til 7.2°C, grense er 4°C. Varer flyttet til reservekjøl.',
   'open',
   'f0000000-0000-0000-0000-000000000008',
   true, true),
  -- Medium severity procedure deviation in Bar
  ('b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000003',
   'af000000-0000-0000-0000-000000000005',
   'procedure', 'medium',
   'Manglende allergenliste på ny cocktailmeny',
   'Ny sesongmeny satt ut uten oppdatert allergeninfo. Rettet manuelt.',
   'acknowledged',
   'f0000000-0000-0000-0000-000000000004',
   false, true);

ALTER TABLE deviation ENABLE TRIGGER trg_push_deviation_reported;

-- ─── 8. Update daily_reconciliation with real numbers ──────────────────────

UPDATE daily_reconciliation SET
  revenue_total = 38500,
  revenue_card = 31200,
  revenue_cash = 7300,
  revenue_transactions = 87,
  total_planned_hours = 60,
  total_actual_hours = 47.5,
  total_labor_cost = 14250,
  revenue_per_worked_hour = 810,
  labor_percentage = 37
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND reconciliation_date = CURRENT_DATE;

-- ─── 9. Hourly budget targets ──────────────────────────────────────────────

-- Remove the existing non-hourly row
DELETE FROM workspace_budget
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
  AND period_date = CURRENT_DATE;

-- Insert per-hour targets (typical restaurant curve: low morning, peak lunch + dinner)
INSERT INTO workspace_budget (workspace_id, period_type, period_date, hour_slot, revenue_target, labor_cost_target)
VALUES
  ('b0000000-0000-0000-0000-000000000000', 'daily', CURRENT_DATE,  9,  800,  600),
  ('b0000000-0000-0000-0000-000000000000', 'daily', CURRENT_DATE, 10, 1200,  800),
  ('b0000000-0000-0000-0000-000000000000', 'daily', CURRENT_DATE, 11, 2500, 1000),
  ('b0000000-0000-0000-0000-000000000000', 'daily', CURRENT_DATE, 12, 5500, 1400),
  ('b0000000-0000-0000-0000-000000000000', 'daily', CURRENT_DATE, 13, 4200, 1200),
  ('b0000000-0000-0000-0000-000000000000', 'daily', CURRENT_DATE, 14, 2800, 1000),
  ('b0000000-0000-0000-0000-000000000000', 'daily', CURRENT_DATE, 15, 1500,  800),
  ('b0000000-0000-0000-0000-000000000000', 'daily', CURRENT_DATE, 16, 1800, 1000),
  ('b0000000-0000-0000-0000-000000000000', 'daily', CURRENT_DATE, 17, 3200, 1200),
  ('b0000000-0000-0000-0000-000000000000', 'daily', CURRENT_DATE, 18, 5800, 1600),
  ('b0000000-0000-0000-0000-000000000000', 'daily', CURRENT_DATE, 19, 7200, 1800),
  ('b0000000-0000-0000-0000-000000000000', 'daily', CURRENT_DATE, 20, 6500, 1600),
  ('b0000000-0000-0000-0000-000000000000', 'daily', CURRENT_DATE, 21, 4000, 1200),
  ('b0000000-0000-0000-0000-000000000000', 'daily', CURRENT_DATE, 22, 1500,  800);

-- ─── 10. Update session counters to match actual tasks ─────────────────────

UPDATE department_session SET tasks_total = 8, tasks_completed = 3
WHERE department_session_id = 'af000000-0000-0000-0000-000000000003';

UPDATE department_session SET tasks_total = 5, tasks_completed = 0
WHERE department_session_id = 'af000000-0000-0000-0000-000000000004';

COMMIT;

-- ─── Summary ────────────────────────────────────────────────────────────────
-- Sessions: 4 (Kitchen=active, Service=upcoming, Bar=active, Operations=closed)
-- Tasks: 23 total (10 completed, 3 in_progress, 1 overdue, 4 pending, 5 available)
-- Shifts: 8 (7 assigned + 1 open = 87.5% capacity = Middels stress)
-- Deviations: 2 (1 high/blocking + 1 medium/acknowledged)
-- Revenue: 38,500 NOK vs 14,250 NOK labor (37% labor cost)
-- Budget: 14 hourly targets with restaurant lunch+dinner curve
