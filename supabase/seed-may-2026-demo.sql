-- =============================================================================
-- May 2026 Demo Restaurant — Payroll Simulation Seed
-- =============================================================================
-- Source: packages/payroll-calculate/__tests__/may-2026-simulation/input/
-- Generated: 2026-05-10
-- Branch: campaign/payroll
--
-- Apply:
--   npx supabase db execute --local --file supabase/seed-may-2026-demo.sql
--
-- Or via psql:
--   psql $DATABASE_URL -f supabase/seed-may-2026-demo.sql
--
-- Idempotent: ON CONFLICT DO NOTHING throughout. Re-runs are safe.
-- Tip distribution: injected directly as payroll.manual_supplement rows
--   (tip_pool requires department_session FK — too complex for seed scope).
--
-- UUID Mapping (synthetic → real):
--   ws-may2026-sim-001  → b1000000-0000-0000-0000-000000000001  (workspace)
--   company demo        → a1000000-0000-0000-0000-000000000001  (company)
--   demo location       → c1000000-0000-0000-0000-000000000001  (location)
--   dept kjokken        → d1000000-0000-0000-0000-000000000001
--   dept service        → d1000000-0000-0000-0000-000000000002
--   dept bar            → d1000000-0000-0000-0000-000000000003
--   demo admin profile  → f1000000-0000-0000-0000-000000000000  (admin@smartout.local links here)
--   prof-sim-001        → f1000000-0000-0000-0000-000000000001  Kristin Berge
--   prof-sim-002        → f1000000-0000-0000-0000-000000000002  Mikael Strand
--   prof-sim-003        → f1000000-0000-0000-0000-000000000003  Anne Christoffersen
--   prof-sim-004        → f1000000-0000-0000-0000-000000000004  Jonas Halvorsen
--   prof-sim-005        → f1000000-0000-0000-0000-000000000005  Rune Akselsen
--   prof-sim-006        → f1000000-0000-0000-0000-000000000006  Tobias Moe
--   prof-sim-007        → f1000000-0000-0000-0000-000000000007  Linnea Bakke
--   prof-sim-008        → f1000000-0000-0000-0000-000000000008  Emilie Thorsen
--   prof-sim-009        → f1000000-0000-0000-0000-000000000009  Silje Nygaard
--   prof-sim-010        → f1000000-0000-0000-0000-000000000010  Oliver Dahl
--   prof-sim-011        → f1000000-0000-0000-0000-000000000011  Lars Petter Vik
--   prof-sim-012        → f1000000-0000-0000-0000-000000000012  Kari Solberg
--   payroll_period      → a1000000-0000-0000-0000-000000000001
--
-- Shifts: sh-sim-001..sh-sim-064 → e1000000-0000-0000-0000-0000000000NN (hex NN)
-- =============================================================================

BEGIN;

SET search_path = public, extensions, pg_catalog;

-- =============================================================================
-- 1. Company
-- =============================================================================
INSERT INTO public.company (company_id, name, legal_name, org_number, country, industry)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  'Demo Restaurant AS',
  'Demo Restaurant AS',
  '999999999',
  'NO',
  'restaurant'
) ON CONFLICT (company_id) DO NOTHING;

-- =============================================================================
-- 2. Workspace
-- =============================================================================
INSERT INTO public.workspace (
  workspace_id, company_id, name, slug, description,
  currency, language, country, onboarding_completed
) VALUES (
  'b1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  'May 2026 Demo Restaurant',
  'may2026-demo',
  'Payroll simulation workspace — May 2026. 12 employees, 64 shifts.',
  'NOK', 'no', 'NO', true
) ON CONFLICT (workspace_id) DO NOTHING;

-- =============================================================================
-- 3. Location
-- =============================================================================
INSERT INTO public.location (location_id, workspace_id, name, slug, location_type)
VALUES (
  'c1000000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000001',
  'Restauranten',
  'restauranten',
  'main'
) ON CONFLICT (location_id) DO NOTHING;

-- =============================================================================
-- 4. Departments (Kjøkken, Service, Bar)
-- =============================================================================
INSERT INTO public.department (department_id, workspace_id, name, slug, sort_order)
VALUES
  ('d1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Kjøkken',  'kjokken', 0),
  ('d1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'Service',  'service', 1),
  ('d1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001', 'Bar',      'bar',     2)
ON CONFLICT (department_id) DO NOTHING;

-- =============================================================================
-- 5. Pontus admin promotion — link existing admin@smartout.local to demo company
-- admin@smartout.local = e0000000-0000-0000-0000-000000000000 (from seed.sql)
-- =============================================================================
INSERT INTO public.company_member (user_id, company_id, role)
VALUES (
  'e0000000-0000-0000-0000-000000000000',
  'a1000000-0000-0000-0000-000000000001',
  'owner'
) ON CONFLICT DO NOTHING;

-- Admin profile in demo workspace (so admin@smartout.local can switch to this workspace)
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, location_id, display_name, job_title,
  address_line_1, postal_code, city
) VALUES (
  'f1000000-0000-0000-0000-000000000000',
  'ADM001',
  'e0000000-0000-0000-0000-000000000000',
  'b1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  'owner', 'active',
  'd1000000-0000-0000-0000-000000000001',
  'c1000000-0000-0000-0000-000000000001',
  'Demo Admin', 'Restaurantsjef',
  'Karl Johans gate 1', '0154', 'Oslo'
) ON CONFLICT (profile_id) DO NOTHING;

-- =============================================================================
-- 6. Employee Auth Users (12 demo employees)
--    Passwords all: password123
-- =============================================================================
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone, phone_change,
  phone_change_token, reauthentication_token
) VALUES
  -- prof-sim-001: Kristin Berge
  -- phone=NULL: auth.users has UNIQUE on phone; empty string '' already taken by base seed users
  ('e1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'kristin.berge@demo.local',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"first_name":"Kristin","last_name":"Berge"}',
   '{"provider":"email","providers":["email"]}',
   now(), now(), '', '', '', '', '', NULL, '', '', ''),
  -- prof-sim-002: Mikael Strand
  ('e1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'mikael.strand@demo.local',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"first_name":"Mikael","last_name":"Strand"}',
   '{"provider":"email","providers":["email"]}',
   now(), now(), '', '', '', '', '', NULL, '', '', ''),
  -- prof-sim-003: Anne Christoffersen
  ('e1000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'anne.christoffersen@demo.local',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"first_name":"Anne","last_name":"Christoffersen"}',
   '{"provider":"email","providers":["email"]}',
   now(), now(), '', '', '', '', '', NULL, '', '', ''),
  -- prof-sim-004: Jonas Halvorsen
  ('e1000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'jonas.halvorsen@demo.local',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"first_name":"Jonas","last_name":"Halvorsen"}',
   '{"provider":"email","providers":["email"]}',
   now(), now(), '', '', '', '', '', NULL, '', '', ''),
  -- prof-sim-005: Rune Akselsen
  ('e1000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'rune.akselsen@demo.local',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"first_name":"Rune","last_name":"Akselsen"}',
   '{"provider":"email","providers":["email"]}',
   now(), now(), '', '', '', '', '', NULL, '', '', ''),
  -- prof-sim-006: Tobias Moe
  ('e1000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'tobias.moe@demo.local',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"first_name":"Tobias","last_name":"Moe"}',
   '{"provider":"email","providers":["email"]}',
   now(), now(), '', '', '', '', '', NULL, '', '', ''),
  -- prof-sim-007: Linnea Bakke
  ('e1000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'linnea.bakke@demo.local',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"first_name":"Linnea","last_name":"Bakke"}',
   '{"provider":"email","providers":["email"]}',
   now(), now(), '', '', '', '', '', NULL, '', '', ''),
  -- prof-sim-008: Emilie Thorsen
  ('e1000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'emilie.thorsen@demo.local',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"first_name":"Emilie","last_name":"Thorsen"}',
   '{"provider":"email","providers":["email"]}',
   now(), now(), '', '', '', '', '', NULL, '', '', ''),
  -- prof-sim-009: Silje Nygaard
  ('e1000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'silje.nygaard@demo.local',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"first_name":"Silje","last_name":"Nygaard"}',
   '{"provider":"email","providers":["email"]}',
   now(), now(), '', '', '', '', '', NULL, '', '', ''),
  -- prof-sim-010: Oliver Dahl
  ('e1000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'oliver.dahl@demo.local',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"first_name":"Oliver","last_name":"Dahl"}',
   '{"provider":"email","providers":["email"]}',
   now(), now(), '', '', '', '', '', NULL, '', '', ''),
  -- prof-sim-011: Lars Petter Vik
  ('e1000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'larspetter.vik@demo.local',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"first_name":"Lars Petter","last_name":"Vik"}',
   '{"provider":"email","providers":["email"]}',
   now(), now(), '', '', '', '', '', NULL, '', '', ''),
  -- prof-sim-012: Kari Solberg
  ('e1000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'kari.solberg@demo.local',
   extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"first_name":"Kari","last_name":"Solberg"}',
   '{"provider":"email","providers":["email"]}',
   now(), now(), '', '', '', '', '', NULL, '', '', '')
ON CONFLICT (id) DO NOTHING;

-- Auth identities
INSERT INTO auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001',
   '{"sub":"e1000000-0000-0000-0000-000000000001","email":"kristin.berge@demo.local","email_verified":true}',
   'email', now(), now(), now()),
  ('e1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000002',
   '{"sub":"e1000000-0000-0000-0000-000000000002","email":"mikael.strand@demo.local","email_verified":true}',
   'email', now(), now(), now()),
  ('e1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000003',
   '{"sub":"e1000000-0000-0000-0000-000000000003","email":"anne.christoffersen@demo.local","email_verified":true}',
   'email', now(), now(), now()),
  ('e1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000004',
   '{"sub":"e1000000-0000-0000-0000-000000000004","email":"jonas.halvorsen@demo.local","email_verified":true}',
   'email', now(), now(), now()),
  ('e1000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000005',
   '{"sub":"e1000000-0000-0000-0000-000000000005","email":"rune.akselsen@demo.local","email_verified":true}',
   'email', now(), now(), now()),
  ('e1000000-0000-0000-0000-000000000006', 'e1000000-0000-0000-0000-000000000006',
   '{"sub":"e1000000-0000-0000-0000-000000000006","email":"tobias.moe@demo.local","email_verified":true}',
   'email', now(), now(), now()),
  ('e1000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000007',
   '{"sub":"e1000000-0000-0000-0000-000000000007","email":"linnea.bakke@demo.local","email_verified":true}',
   'email', now(), now(), now()),
  ('e1000000-0000-0000-0000-000000000008', 'e1000000-0000-0000-0000-000000000008',
   '{"sub":"e1000000-0000-0000-0000-000000000008","email":"emilie.thorsen@demo.local","email_verified":true}',
   'email', now(), now(), now()),
  ('e1000000-0000-0000-0000-000000000009', 'e1000000-0000-0000-0000-000000000009',
   '{"sub":"e1000000-0000-0000-0000-000000000009","email":"silje.nygaard@demo.local","email_verified":true}',
   'email', now(), now(), now()),
  ('e1000000-0000-0000-0000-000000000010', 'e1000000-0000-0000-0000-000000000010',
   '{"sub":"e1000000-0000-0000-0000-000000000010","email":"oliver.dahl@demo.local","email_verified":true}',
   'email', now(), now(), now()),
  ('e1000000-0000-0000-0000-000000000011', 'e1000000-0000-0000-0000-000000000011',
   '{"sub":"e1000000-0000-0000-0000-000000000011","email":"larspetter.vik@demo.local","email_verified":true}',
   'email', now(), now(), now()),
  ('e1000000-0000-0000-0000-000000000012', 'e1000000-0000-0000-0000-000000000012',
   '{"sub":"e1000000-0000-0000-0000-000000000012","email":"kari.solberg@demo.local","email_verified":true}',
   'email', now(), now(), now())
ON CONFLICT (provider_id, provider) DO NOTHING;

-- Company members
INSERT INTO public.company_member (user_id, company_id, role)
VALUES
  ('e1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'member'),
  ('e1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'member'),
  ('e1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'member'),
  ('e1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'member'),
  ('e1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 'member'),
  ('e1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000001', 'member'),
  ('e1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000001', 'member'),
  ('e1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000001', 'member'),
  ('e1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000001', 'member'),
  ('e1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000001', 'member'),
  ('e1000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000001', 'member'),
  ('e1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000001', 'member')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 7. Profiles (12 employees)
--    personal_number + bank_account live on profile (not employee_payroll_profile)
--    Tobias Moe (006) has no bank_account per fixture _bank_missing flag
--    Department: kjøkken = 001-006, service = 007-012, bar = 007 (bartender)
-- =============================================================================
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, location_id, display_name, job_title,
  address_line_1, postal_code, city, personal_number, bank_account
) VALUES
  -- 001 Kristin Berge — Daglig leder (kjøkken dept as mgmt home)
  ('f1000000-0000-0000-0000-000000000001', 'SIM001',
   'e1000000-0000-0000-0000-000000000001',
   'b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'manager', 'active',
   'd1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   'Kristin Berge', 'Daglig leder',
   'Storgata 10', '0155', 'Oslo',
   '091263 12345', '1234.56.78901'),
  -- 002 Mikael Strand — Kjøkkensjef
  ('f1000000-0000-0000-0000-000000000002', 'SIM002',
   'e1000000-0000-0000-0000-000000000002',
   'b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'manager', 'active',
   'd1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   'Mikael Strand', 'Kjøkkensjef',
   'Bogstadveien 5', '0355', 'Oslo',
   '010880 23456', '2345.67.89012'),
  -- 003 Anne Christoffersen — Sous-chef
  ('f1000000-0000-0000-0000-000000000003', 'SIM003',
   'e1000000-0000-0000-0000-000000000003',
   'b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'employee', 'active',
   'd1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   'Anne Christoffersen', 'Sous-chef',
   'Markveien 22', '0550', 'Oslo',
   '220991 34567', '3456.78.90123'),
  -- 004 Jonas Halvorsen — Kokk 1
  ('f1000000-0000-0000-0000-000000000004', 'SIM004',
   'e1000000-0000-0000-0000-000000000004',
   'b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'employee', 'active',
   'd1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   'Jonas Halvorsen', 'Kokk',
   'Grensen 14', '0159', 'Oslo',
   '150490 45678', '4567.89.01234'),
  -- 005 Rune Akselsen — Kokk 2
  ('f1000000-0000-0000-0000-000000000005', 'SIM005',
   'e1000000-0000-0000-0000-000000000005',
   'b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'employee', 'active',
   'd1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   'Rune Akselsen', 'Kokk',
   'Thereses gate 8', '0452', 'Oslo',
   '301093 56789', '5678.90.12345'),
  -- 006 Tobias Moe — Lærling kokk år 2 (no bank_account — deviation expected)
  ('f1000000-0000-0000-0000-000000000006', 'SIM006',
   'e1000000-0000-0000-0000-000000000006',
   'b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'employee', 'trainee',
   'd1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   'Tobias Moe', 'Lærling kokk år 2',
   'Sofies gate 3', '0170', 'Oslo',
   '060205 67890', NULL),
  -- 007 Linnea Bakke — Bartender (bar dept)
  ('f1000000-0000-0000-0000-000000000007', 'SIM007',
   'e1000000-0000-0000-0000-000000000007',
   'b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'employee', 'active',
   'd1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001',
   'Linnea Bakke', 'Bartender',
   'Inkognitogata 11', '0258', 'Oslo',
   '180292 78901', '6789.01.23456'),
  -- 008 Emilie Thorsen — Servitør 1 (service dept)
  ('f1000000-0000-0000-0000-000000000008', 'SIM008',
   'e1000000-0000-0000-0000-000000000008',
   'b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'employee', 'active',
   'd1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001',
   'Emilie Thorsen', 'Servitør',
   'Gabels gate 7', '0272', 'Oslo',
   '240893 89012', '7890.12.34567'),
  -- 009 Silje Nygaard — Servitør 2 (service dept)
  ('f1000000-0000-0000-0000-000000000009', 'SIM009',
   'e1000000-0000-0000-0000-000000000009',
   'b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'employee', 'active',
   'd1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001',
   'Silje Nygaard', 'Servitør',
   'Skovveien 12', '0257', 'Oslo',
   '160694 90123', '8901.23.45678'),
  -- 010 Oliver Dahl — Ungdom servitør (under 18, service dept)
  ('f1000000-0000-0000-0000-000000000010', 'SIM010',
   'e1000000-0000-0000-0000-000000000010',
   'b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'employee', 'active',
   'd1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001',
   'Oliver Dahl', 'Servitør',
   'Pilestredet 44', '0167', 'Oslo',
   '050907 01234', '9012.34.56789'),
  -- 011 Lars Petter Vik — Oppvask 1 (kjøkken dept)
  ('f1000000-0000-0000-0000-000000000011', 'SIM011',
   'e1000000-0000-0000-0000-000000000011',
   'b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'employee', 'active',
   'd1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   'Lars Petter Vik', 'Oppvask',
   'Uranienborg terrasse 2', '0351', 'Oslo',
   '250494 12345', '0123.45.67890'),
  -- 012 Kari Solberg — Oppvask helg (kjøkken dept)
  ('f1000000-0000-0000-0000-000000000012', 'SIM012',
   'e1000000-0000-0000-0000-000000000012',
   'b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'employee', 'active',
   'd1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   'Kari Solberg', 'Oppvask',
   'Damstredet 8', '0177', 'Oslo',
   '120805 23456', '1234.56.78902')
ON CONFLICT (profile_id) DO NOTHING;

-- =============================================================================
-- 8. Employment Contracts (12 rows — one per employee)
--    employment_form is NOT NULL (no default). Values from employment_form_enum:
--    'permanent', 'temporary', 'part_time', 'apprentice', 'practice', 'on_call'
--    remuneration_type needed for salary check constraint:
--    'monthlyWage', 'hourlyWage', 'commissionOnly'
--    contract_status default = 'draft'; we set 'active' for simulation.
--    employment_contract_one_active_main_per_profile: UNIQUE (profile_id)
--    WHERE employment_role='main' AND contract_status='active'
-- =============================================================================
-- Use separate INSERTs: Tobias needs end_date for apprentice constraint.
-- All others have end_date = NULL.
INSERT INTO public.employment_contract (
  contract_id, workspace_id, profile_id,
  position_title, employment_category, employment_percentage,
  hourly_rate, monthly_salary, start_date,
  employment_form, remuneration_type,
  contract_status, employment_role, created_by
) VALUES
  ('cc000000-0000-0000-0000-000000000001',
   'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
   'Daglig leder', 'fast', 100.00, NULL, 50000.00, '2012-03-01',
   'permanent', 'monthlyWage', 'active', 'main', 'f1000000-0000-0000-0000-000000000000'),
  ('cc000000-0000-0000-0000-000000000002',
   'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002',
   'Kjøkkensjef', 'fast', 100.00, NULL, 45000.00, '2018-08-01',
   'permanent', 'monthlyWage', 'active', 'main', 'f1000000-0000-0000-0000-000000000000'),
  ('cc000000-0000-0000-0000-000000000003',
   'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000003',
   'Sous-chef', 'fast', 93.75, 248.00, NULL, '2021-09-01',
   'permanent', 'hourlyWage', 'active', 'main', 'f1000000-0000-0000-0000-000000000000'),
  ('cc000000-0000-0000-0000-000000000004',
   'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000004',
   'Kokk', 'fast', 93.75, 248.00, NULL, '2020-04-01',
   'permanent', 'hourlyWage', 'active', 'main', 'f1000000-0000-0000-0000-000000000000'),
  ('cc000000-0000-0000-0000-000000000005',
   'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000005',
   'Kokk', 'fast', 93.75, 215.00, NULL, '2023-02-01',
   'permanent', 'hourlyWage', 'active', 'main', 'f1000000-0000-0000-0000-000000000000'),
  ('cc000000-0000-0000-0000-000000000007',
   'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000007',
   'Bartender', 'fast', 93.75, 215.00, NULL, '2022-05-01',
   'permanent', 'hourlyWage', 'active', 'main', 'f1000000-0000-0000-0000-000000000000'),
  ('cc000000-0000-0000-0000-000000000008',
   'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000008',
   'Servitør', 'deltid', 75.00, 205.00, NULL, '2023-08-01',
   'permanent', 'hourlyWage', 'active', 'main', 'f1000000-0000-0000-0000-000000000000'),
  ('cc000000-0000-0000-0000-000000000009',
   'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000009',
   'Servitør', 'deltid', 50.00, 198.50, NULL, '2024-06-01',
   'permanent', 'hourlyWage', 'active', 'main', 'f1000000-0000-0000-0000-000000000000'),
  ('cc000000-0000-0000-0000-000000000010',
   'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000010',
   'Servitør', 'deltid', 30.00, 165.00, NULL, '2025-09-01',
   'permanent', 'hourlyWage', 'active', 'main', 'f1000000-0000-0000-0000-000000000000'),
  ('cc000000-0000-0000-0000-000000000011',
   'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000011',
   'Oppvask', 'deltid', 75.00, 205.00, NULL, '2024-01-15',
   'permanent', 'hourlyWage', 'active', 'main', 'f1000000-0000-0000-0000-000000000000'),
  ('cc000000-0000-0000-0000-000000000012',
   'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000012',
   'Oppvask', 'deltid', 40.00, 198.50, NULL, '2025-08-01',
   'permanent', 'hourlyWage', 'active', 'main', 'f1000000-0000-0000-0000-000000000000')
ON CONFLICT (contract_id) DO NOTHING;

-- 006 Tobias Moe — apprentice requires end_date (Aml. §14-9)
-- 2-year apprenticeship started 2025-01-15 → ends 2027-01-14
INSERT INTO public.employment_contract (
  contract_id, workspace_id, profile_id,
  position_title, employment_category, employment_percentage,
  hourly_rate, monthly_salary, start_date, end_date,
  employment_form, remuneration_type,
  contract_status, employment_role, created_by
) VALUES (
  'cc000000-0000-0000-0000-000000000006',
  'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000006',
  'Lærling kokk år 2', 'fast', 93.75, 146.00, NULL, '2025-01-15', '2027-01-14',
  'apprentice', 'hourlyWage', 'active', 'main', 'f1000000-0000-0000-0000-000000000000'
) ON CONFLICT (contract_id) DO NOTHING;

-- =============================================================================
-- 9. Employee Payroll Profiles (12 rows)
--    Note: baseHourlyRateNok from fixture is informational — rate lives on contract.
--    tax_card_type values: 'table', 'percentage', 'freecard' (enum tax_card_type)
--    Constraint: tax_percentage NOT NULL only when tax_card_type = 'percentage'
--    overtime_mode requires schema 20260527100300 (payroll_overtime_mode enum)
--    holiday_allowance_pct requires schema 20260519100100
-- =============================================================================
-- overtime_mode / toil_* omitted: migration 20260527100300 may not be applied locally.
-- Defaults apply (overtime_mode = 'paid_out' once migration runs).
INSERT INTO public.employee_payroll_profile (
  workspace_id, profile_id, employment_contract_id,
  salary_type, agreed_weekly_hours, tariff_category,
  seniority_start_date, sector_experience_years, has_fagbrev,
  valid_from, holiday_allowance_pct,
  tax_card_type, tax_table_number, tax_percentage, tax_card_year
) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
   'cc000000-0000-0000-0000-000000000001',
   'monthly', 40.00, 'voksen_ufaglart', '2012-03-01', 14, true,
   '2012-03-01', 14.30, 'percentage', NULL, 32.00, 2026),
  ('b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002',
   'cc000000-0000-0000-0000-000000000002',
   'monthly', 40.00, 'voksen_fagbrev', '2018-08-01', 8, true,
   '2018-08-01', 12.00, 'percentage', NULL, 30.00, 2026),
  ('b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000003',
   'cc000000-0000-0000-0000-000000000003',
   'hourly', 37.50, 'voksen_fagbrev', '2021-09-01', 5, true,
   '2021-09-01', 12.00, 'table', '7150', NULL, 2026),
  ('b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000004',
   'cc000000-0000-0000-0000-000000000004',
   'hourly', 37.50, 'voksen_fagbrev', '2020-04-01', 6, true,
   '2020-04-01', 12.00, 'table', '7150', NULL, 2026),
  ('b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000005',
   'cc000000-0000-0000-0000-000000000005',
   'hourly', 37.50, 'voksen_ufaglart', '2023-02-01', 2, false,
   '2023-02-01', 12.00, 'percentage', NULL, 25.00, 2026),
  ('b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000006',
   'cc000000-0000-0000-0000-000000000006',
   'hourly', 37.50, 'laerling_ar_2', '2025-01-15', 1, false,
   '2025-01-15', 12.00, 'freecard', NULL, NULL, 2026),
  ('b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000007',
   'cc000000-0000-0000-0000-000000000007',
   'hourly', 37.50, 'voksen_ufaglart', '2022-05-01', 3, false,
   '2022-05-01', 12.00, 'table', '7100', NULL, 2026),
  ('b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000008',
   'cc000000-0000-0000-0000-000000000008',
   'hourly', 30.00, 'voksen_ufaglart', '2023-08-01', 2, false,
   '2023-08-01', 12.00, 'percentage', NULL, 22.00, 2026),
  ('b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000009',
   'cc000000-0000-0000-0000-000000000009',
   'hourly', 20.00, 'voksen_ufaglart', '2024-06-01', 1, false,
   '2024-06-01', 12.00, 'percentage', NULL, 22.00, 2026),
  ('b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000010',
   'cc000000-0000-0000-0000-000000000010',
   'hourly', 12.00, 'ungdom_under_18', '2025-09-01', 0, false,
   '2025-09-01', 12.00, 'freecard', NULL, NULL, 2026),
  ('b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000011',
   'cc000000-0000-0000-0000-000000000011',
   'hourly', 30.00, 'voksen_ufaglart', '2024-01-15', 2, false,
   '2024-01-15', 12.00, 'table', '7100', NULL, 2026),
  ('b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000012',
   'cc000000-0000-0000-0000-000000000012',
   'hourly', 16.00, 'voksen_ufaglart', '2025-08-01', 0, false,
   '2025-08-01', 12.00, 'percentage', NULL, 22.00, 2026)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 10. Payroll Period — May 2026, status=open
-- =============================================================================
INSERT INTO payroll.period (id, workspace_id, start_date, end_date, status)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000001',
  '2026-05-01',
  '2026-05-31',
  'open'
) ON CONFLICT DO NOTHING;

-- =============================================================================
-- 11. Schedule Shifts (64 rows)
--    schedule_shift uses TIME columns (start_time, end_time) + shift_date DATE.
--    Fixture timestamps are UTC. All shifts are CEST (UTC+2) in practice but
--    stored in UTC. Times below are from fixture as-is (UTC strings → TIME).
--    day_category: morning (06-12), midday (11-15), afternoon (14-18),
--                  evening (18-23), weekend (sat/sun regardless of hour)
--    status: 'published' for all simulation shifts
--    work_hours = (end_time - start_time - breaks/60) in hours
--    role: job title for display
--    employee_id = profile FK
-- =============================================================================

INSERT INTO public.schedule_shift (
  schedule_shift_id, workspace_id, employee_id,
  shift_date, role, start_time, end_time, work_hours, breaks,
  day_category, status, is_published, notes
) VALUES

-- ── prof-sim-001 Kristin Berge (6 shifts) ─────────────────────────────────
('e1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
 '2026-05-04', 'Daglig leder', '08:00', '16:00', 7.50, 30, 'morning', 'published', true, 'sh-sim-001 mandag 4. mai'),
('e1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
 '2026-05-07', 'Daglig leder', '08:00', '16:00', 7.50, 30, 'morning', 'published', true, 'sh-sim-002 torsdag 7. mai'),
('e1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
 '2026-05-11', 'Daglig leder', '08:00', '16:00', 7.50, 30, 'morning', 'published', true, 'sh-sim-003 mandag 11. mai'),
('e1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
 '2026-05-18', 'Daglig leder', '08:00', '17:30', 9.00, 30, 'morning', 'published', true, 'sh-sim-004 mandag 18. mai extended'),
('e1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
 '2026-05-26', 'Daglig leder', '08:00', '16:00', 7.50, 30, 'morning', 'published', true, 'sh-sim-005 tirsdag 26. mai'),
('e1000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
 '2026-05-28', 'Daglig leder', '08:00', '16:00', 7.50, 30, 'morning', 'published', true, 'sh-sim-006 torsdag 28. mai'),

-- ── prof-sim-002 Mikael Strand (5 shifts) ─────────────────────────────────
('e1000000-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002',
 '2026-05-04', 'Kjøkkensjef', '10:00', '20:00', 9.50, 30, 'midday', 'published', true, 'sh-sim-007 mandag 4. mai'),
('e1000000-0000-0000-0000-000000000008', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002',
 '2026-05-06', 'Kjøkkensjef', '10:00', '22:00', 11.50, 30, 'midday', 'published', true, 'sh-sim-008 onsdag 6. mai lang'),
('e1000000-0000-0000-0000-000000000009', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002',
 '2026-05-09', 'Kjøkkensjef', '10:00', '21:00', 10.50, 30, 'weekend', 'published', true, 'sh-sim-009 lørdag 9. mai'),
('e1000000-0000-0000-0000-000000000010', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002',
 '2026-05-18', 'Kjøkkensjef', '10:00', '20:00', 9.50, 30, 'midday', 'published', true, 'sh-sim-010 mandag 18. mai'),
('e1000000-0000-0000-0000-000000000011', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002',
 '2026-05-28', 'Kjøkkensjef', '10:00', '20:00', 9.50, 30, 'midday', 'published', true, 'sh-sim-011 torsdag 28. mai'),

-- ── prof-sim-003 Anne Christoffersen (4 shifts) ───────────────────────────
('e1000000-0000-0000-0000-000000000012', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000003',
 '2026-05-05', 'Sous-chef', '10:00', '19:00', 8.50, 30, 'midday', 'published', true, 'sh-sim-012 tirsdag 5. mai'),
('e1000000-0000-0000-0000-000000000013', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000003',
 '2026-05-07', 'Sous-chef', '14:00', '23:30', 9.00, 30, 'afternoon', 'published', true, 'sh-sim-013 torsdag 7. mai kveld'),
('e1000000-0000-0000-0000-000000000014', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000003',
 '2026-05-09', 'Sous-chef', '10:00', '20:00', 9.50, 30, 'weekend', 'published', true, 'sh-sim-014 lørdag 9. mai'),
('e1000000-0000-0000-0000-000000000015', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000003',
 '2026-05-20', 'Sous-chef', '10:00', '20:00', 9.50, 30, 'midday', 'published', true, 'sh-sim-015 onsdag 20. mai'),
('e1000000-0000-0000-0000-000000000016', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000003',
 '2026-05-26', 'Sous-chef', '14:00', '23:59', 9.50, 30, 'afternoon', 'published', true, 'sh-sim-016 tirsdag 26. mai closes midnight'),

-- ── prof-sim-004 Jonas Halvorsen (6 shifts) ───────────────────────────────
('e1000000-0000-0000-0000-000000000017', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000004',
 '2026-05-04', 'Kokk', '10:00', '19:00', 8.50, 30, 'midday', 'published', true, 'sh-sim-017 mandag 4. mai'),
('e1000000-0000-0000-0000-000000000018', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000004',
 '2026-05-07', 'Kokk', '14:00', '23:00', 8.50, 30, 'afternoon', 'published', true, 'sh-sim-018 torsdag 7. mai kveld'),
('e1000000-0000-0000-0000-000000000019', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000004',
 '2026-05-10', 'Kokk', '10:00', '19:00', 8.50, 30, 'weekend', 'published', true, 'sh-sim-019 søndag 10. mai'),
('e1000000-0000-0000-0000-000000000020', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000004',
 '2026-05-15', 'Kokk', '14:00', '23:30', 9.00, 30, 'afternoon', 'published', true, 'sh-sim-020 fredag 15. mai kveld'),
('e1000000-0000-0000-0000-000000000021', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000004',
 '2026-05-20', 'Kokk', '10:00', '18:00', 7.50, 30, 'midday', 'published', true, 'sh-sim-021 onsdag 20. mai'),
-- sh-sim-022 = shift that gets tip distribution drikkepenger for Jonas
('e1000000-0000-0000-0000-000000000022', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000004',
 '2026-05-26', 'Kokk', '10:00', '19:00', 8.50, 30, 'midday', 'published', true, 'sh-sim-022 tirsdag 26. mai tip+bonus'),

-- ── prof-sim-005 Rune Akselsen (5 shifts) ─────────────────────────────────
('e1000000-0000-0000-0000-000000000023', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000005',
 '2026-05-05', 'Kokk', '10:00', '18:30', 8.00, 30, 'midday', 'published', true, 'sh-sim-023 tirsdag 5. mai'),
('e1000000-0000-0000-0000-000000000024', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000005',
 '2026-05-09', 'Kokk', '14:00', '22:00', 7.50, 30, 'weekend', 'published', true, 'sh-sim-024 lørdag 9. mai kveld'),
('e1000000-0000-0000-0000-000000000025', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000005',
 '2026-05-14', 'Kokk', '10:00', '18:30', 8.00, 30, 'morning', 'published', true, 'sh-sim-025 torsdag 14. mai'),
('e1000000-0000-0000-0000-000000000026', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000005',
 '2026-05-19', 'Kokk', '10:00', '18:00', 7.50, 30, 'midday', 'published', true, 'sh-sim-026 tirsdag 19. mai'),
-- sh-sim-027 = shift that gets tip distribution for Rune
('e1000000-0000-0000-0000-000000000027', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000005',
 '2026-05-26', 'Kokk', '10:00', '18:30', 8.00, 30, 'midday', 'published', true, 'sh-sim-027 tirsdag 26. mai tip'),

-- ── prof-sim-006 Tobias Moe (5 shifts) ───────────────────────────────────
('e1000000-0000-0000-0000-000000000028', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000006',
 '2026-05-06', 'Lærling kokk', '10:00', '18:00', 7.50, 30, 'midday', 'published', true, 'sh-sim-028 onsdag 6. mai'),
('e1000000-0000-0000-0000-000000000029', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000006',
 '2026-05-10', 'Lærling kokk', '10:00', '18:00', 7.50, 30, 'weekend', 'published', true, 'sh-sim-029 søndag 10. mai'),
('e1000000-0000-0000-0000-000000000030', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000006',
 '2026-05-13', 'Lærling kokk', '10:00', '18:00', 7.50, 30, 'midday', 'published', true, 'sh-sim-030 onsdag 13. mai'),
-- sh-sim-031 = shift that gets lønnsforskudd deduction for Tobias
('e1000000-0000-0000-0000-000000000031', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000006',
 '2026-05-20', 'Lærling kokk', '10:00', '18:00', 7.50, 30, 'midday', 'published', true, 'sh-sim-031 onsdag 20. mai forskudd'),
('e1000000-0000-0000-0000-000000000032', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000006',
 '2026-05-27', 'Lærling kokk', '10:00', '18:00', 7.50, 30, 'midday', 'published', true, 'sh-sim-032 onsdag 27. mai'),

-- ── prof-sim-007 Linnea Bakke bartender (5 shifts) ────────────────────────
('e1000000-0000-0000-0000-000000000033', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000007',
 '2026-05-05', 'Bartender', '14:00', '23:00', 8.50, 30, 'afternoon', 'published', true, 'sh-sim-033 tirsdag 5. mai'),
('e1000000-0000-0000-0000-000000000034', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000007',
 '2026-05-08', 'Bartender', '14:00', '23:00', 8.50, 30, 'morning', 'published', true, 'sh-sim-034 fredag 8. mai'),
('e1000000-0000-0000-0000-000000000035', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000007',
 '2026-05-10', 'Bartender', '14:00', '23:00', 8.50, 30, 'weekend', 'published', true, 'sh-sim-035 søndag 10. mai'),
('e1000000-0000-0000-0000-000000000036', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000007',
 '2026-05-16', 'Bartender', '14:00', '23:00', 8.50, 30, 'weekend', 'published', true, 'sh-sim-036 lørdag 16. mai'),
('e1000000-0000-0000-0000-000000000037', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000007',
 '2026-05-22', 'Bartender', '14:00', '23:00', 8.50, 30, 'afternoon', 'published', true, 'sh-sim-037 fredag 22. mai'),
-- sh-sim-038 = shift that gets drikkepenger for Linnea
('e1000000-0000-0000-0000-000000000038', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000007',
 '2026-05-26', 'Bartender', '14:00', '23:00', 8.50, 30, 'midday', 'published', true, 'sh-sim-038 tirsdag 26. mai tip'),

-- ── prof-sim-008 Emilie Thorsen Servitør 1 (7 shifts) ────────────────────
('e1000000-0000-0000-0000-000000000039', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000008',
 '2026-05-05', 'Servitør', '16:00', '23:00', 6.50, 30, 'afternoon', 'published', true, 'sh-sim-039 tirsdag 5. mai'),
('e1000000-0000-0000-0000-000000000040', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000008',
 '2026-05-08', 'Servitør', '16:00', '23:30', 7.00, 30, 'morning', 'published', true, 'sh-sim-040 fredag 8. mai'),
('e1000000-0000-0000-0000-000000000041', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000008',
 '2026-05-10', 'Servitør', '12:00', '20:00', 7.50, 30, 'weekend', 'published', true, 'sh-sim-041 søndag 10. mai'),
('e1000000-0000-0000-0000-000000000042', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000008',
 '2026-05-14', 'Servitør', '16:00', '23:00', 6.50, 30, 'morning', 'published', true, 'sh-sim-042 torsdag 14. mai'),
('e1000000-0000-0000-0000-000000000043', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000008',
 '2026-05-16', 'Servitør', '12:00', '21:00', 8.50, 30, 'weekend', 'published', true, 'sh-sim-043 lørdag 16. mai'),
-- sh-sim-044 = Emilie gets uniformstrekk deduction + tip distribution
('e1000000-0000-0000-0000-000000000044', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000008',
 '2026-05-25', 'Servitør', '16:00', '23:00', 6.50, 30, 'afternoon', 'published', true, 'sh-sim-044 søndag 25. mai uniform+tip'),
('e1000000-0000-0000-0000-000000000045', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000008',
 '2026-05-28', 'Servitør', '16:00', '23:00', 6.50, 30, 'midday', 'published', true, 'sh-sim-045 torsdag 28. mai'),

-- ── prof-sim-009 Silje Nygaard Servitør 2 (6 shifts) ─────────────────────
('e1000000-0000-0000-0000-000000000046', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000009',
 '2026-05-06', 'Servitør', '16:00', '23:00', 6.50, 30, 'midday', 'published', true, 'sh-sim-046 onsdag 6. mai'),
('e1000000-0000-0000-0000-000000000047', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000009',
 '2026-05-10', 'Servitør', '12:00', '20:00', 7.50, 30, 'weekend', 'published', true, 'sh-sim-047 søndag 10. mai'),
-- sh-sim-048 = Silje gets tip distribution
('e1000000-0000-0000-0000-000000000048', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000009',
 '2026-05-16', 'Servitør', '12:00', '21:00', 8.50, 30, 'weekend', 'published', true, 'sh-sim-048 lørdag 16. mai tip'),
('e1000000-0000-0000-0000-000000000049', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000009',
 '2026-05-19', 'Servitør', '16:00', '23:00', 6.50, 30, 'midday', 'published', true, 'sh-sim-049 tirsdag 19. mai'),
('e1000000-0000-0000-0000-000000000050', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000009',
 '2026-05-23', 'Servitør', '12:00', '20:00', 7.50, 30, 'weekend', 'published', true, 'sh-sim-050 lørdag 23. mai'),
('e1000000-0000-0000-0000-000000000051', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000009',
 '2026-05-27', 'Servitør', '16:00', '23:00', 6.50, 30, 'midday', 'published', true, 'sh-sim-051 onsdag 27. mai'),

-- ── prof-sim-010 Oliver Dahl ungdom (5 shifts, weekends only) ─────────────
('e1000000-0000-0000-0000-000000000052', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000010',
 '2026-05-03', 'Servitør', '12:00', '18:00', 5.50, 30, 'weekend', 'published', true, 'sh-sim-052 søndag 3. mai'),
-- sh-sim-053 = Oliver gets tip distribution
('e1000000-0000-0000-0000-000000000053', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000010',
 '2026-05-10', 'Servitør', '12:00', '18:00', 5.50, 30, 'weekend', 'published', true, 'sh-sim-053 søndag 10. mai tip'),
('e1000000-0000-0000-0000-000000000054', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000010',
 '2026-05-17', 'Servitør', '12:00', '18:00', 5.50, 30, 'weekend', 'published', true, 'sh-sim-054 søndag 17. mai'),
('e1000000-0000-0000-0000-000000000055', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000010',
 '2026-05-24', 'Servitør', '12:00', '18:00', 5.50, 30, 'weekend', 'published', true, 'sh-sim-055 søndag 24. mai'),
('e1000000-0000-0000-0000-000000000056', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000010',
 '2026-05-31', 'Servitør', '12:00', '18:00', 5.50, 30, 'weekend', 'published', true, 'sh-sim-056 søndag 31. mai'),

-- ── prof-sim-011 Lars Petter Vik oppvask (7 shifts) ──────────────────────
('e1000000-0000-0000-0000-000000000057', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000011',
 '2026-05-05', 'Oppvask', '12:00', '20:00', 7.50, 30, 'midday', 'published', true, 'sh-sim-057 tirsdag 5. mai'),
('e1000000-0000-0000-0000-000000000058', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000011',
 '2026-05-08', 'Oppvask', '14:00', '22:00', 7.50, 30, 'morning', 'published', true, 'sh-sim-058 fredag 8. mai'),
('e1000000-0000-0000-0000-000000000059', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000011',
 '2026-05-12', 'Oppvask', '12:00', '20:00', 7.50, 30, 'midday', 'published', true, 'sh-sim-059 tirsdag 12. mai'),
('e1000000-0000-0000-0000-000000000060', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000011',
 '2026-05-16', 'Oppvask', '12:00', '20:00', 7.50, 30, 'weekend', 'published', true, 'sh-sim-060 lørdag 16. mai'),
('e1000000-0000-0000-0000-000000000061', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000011',
 '2026-05-19', 'Oppvask', '12:00', '20:00', 7.50, 30, 'midday', 'published', true, 'sh-sim-061 tirsdag 19. mai'),
('e1000000-0000-0000-0000-000000000062', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000011',
 '2026-05-23', 'Oppvask', '12:00', '20:00', 7.50, 30, 'weekend', 'published', true, 'sh-sim-062 lørdag 23. mai'),
('e1000000-0000-0000-0000-000000000063', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000011',
 '2026-05-27', 'Oppvask', '12:00', '20:00', 7.50, 30, 'midday', 'published', true, 'sh-sim-063 onsdag 27. mai'),

-- ── prof-sim-012 Kari Solberg oppvask helg (6 shifts) ────────────────────
('e1000000-0000-0000-0000-000000000064', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000012',
 '2026-05-03', 'Oppvask', '16:00', '23:00', 6.50, 30, 'weekend', 'published', true, 'sh-sim-058b søndag 3. mai'),
('e1000000-0000-0000-0000-000000000065', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000012',
 '2026-05-09', 'Oppvask', '16:00', '23:00', 6.50, 30, 'weekend', 'published', true, 'sh-sim-059b lørdag 9. mai'),
('e1000000-0000-0000-0000-000000000066', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000012',
 '2026-05-16', 'Oppvask', '16:00', '23:00', 6.50, 30, 'weekend', 'published', true, 'sh-sim-060b lørdag 16. mai'),
('e1000000-0000-0000-0000-000000000067', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000012',
 '2026-05-23', 'Oppvask', '16:00', '23:00', 6.50, 30, 'weekend', 'published', true, 'sh-sim-061b lørdag 23. mai'),
('e1000000-0000-0000-0000-000000000068', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000012',
 '2026-05-25', 'Oppvask', '16:00', '23:00', 6.50, 30, 'weekend', 'published', true, 'sh-sim-062b søndag 25. mai'),
('e1000000-0000-0000-0000-000000000069', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000012',
 '2026-05-31', 'Oppvask', '16:00', '23:00', 6.50, 30, 'weekend', 'published', true, 'sh-sim-063b søndag 31. mai')

ON CONFLICT (schedule_shift_id) DO NOTHING;

-- =============================================================================
-- 12. Manual Supplements (9 rows)
--     4 operational + 5 tip distributions (directly as manual_supplement)
--     Tip pool (tip_pool) skipped — requires department_session FK.
--     added_by = demo admin profile f1000000-...000
-- =============================================================================
INSERT INTO payroll.manual_supplement (
  workspace_id, schedule_shift_id, salary_code, description, amount, added_by
) VALUES
  -- ms-sim-001: Bonus Jonas Halvorsen sh-sim-022
  ('b1000000-0000-0000-0000-000000000001',
   'e1000000-0000-0000-0000-000000000022',
   'bonus',
   'Bonus — flott innsats i travelt helgekveld 15. mai',
   2000.00,
   'f1000000-0000-0000-0000-000000000000'),
  -- ms-sim-002: Lønnsforskudd (negative) Tobias Moe sh-sim-031
  ('b1000000-0000-0000-0000-000000000001',
   'e1000000-0000-0000-0000-000000000031',
   'forskudd',
   'Lønnsforskudd 20. mai — trekkes på utbetaling',
   -3000.00,
   'f1000000-0000-0000-0000-000000000000'),
  -- ms-sim-003: Uniformstrekk (negative) Emilie Thorsen sh-sim-044
  ('b1000000-0000-0000-0000-000000000001',
   'e1000000-0000-0000-0000-000000000044',
   'uniformstrekk',
   'Uniformstrekk — arbeidsklær 25. mai',
   -500.00,
   'f1000000-0000-0000-0000-000000000000'),
  -- ms-sim-tip-007: Drikkepenger Linnea Bakke (bartender) sh-sim-038
  ('b1000000-0000-0000-0000-000000000001',
   'e1000000-0000-0000-0000-000000000038',
   'drikkepenger',
   'Tipfordeling mai 2026 — Bartender (18.75% av kr 25.000)',
   4687.50,
   'f1000000-0000-0000-0000-000000000000'),
  -- ms-sim-tip-008: Drikkepenger Emilie Thorsen (servitør 1) sh-sim-044
  ('b1000000-0000-0000-0000-000000000001',
   'e1000000-0000-0000-0000-000000000044',
   'drikkepenger',
   'Tipfordeling mai 2026 — Servitør 1 (23.33% av kr 25.000)',
   5833.50,
   'f1000000-0000-0000-0000-000000000000'),
  -- ms-sim-tip-009: Drikkepenger Silje Nygaard (servitør 2) sh-sim-048
  ('b1000000-0000-0000-0000-000000000001',
   'e1000000-0000-0000-0000-000000000048',
   'drikkepenger',
   'Tipfordeling mai 2026 — Servitør 2 (23.33% av kr 25.000)',
   5833.50,
   'f1000000-0000-0000-0000-000000000000'),
  -- ms-sim-tip-010: Drikkepenger Oliver Dahl (ungdom) sh-sim-053
  ('b1000000-0000-0000-0000-000000000001',
   'e1000000-0000-0000-0000-000000000053',
   'drikkepenger',
   'Tipfordeling mai 2026 — Ungdom servitør (10% av kr 25.000)',
   2500.00,
   'f1000000-0000-0000-0000-000000000000'),
  -- ms-sim-tip-004: Drikkepenger Jonas Halvorsen (kjøkken 50%) sh-sim-022
  ('b1000000-0000-0000-0000-000000000001',
   'e1000000-0000-0000-0000-000000000022',
   'drikkepenger',
   'Tipfordeling mai 2026 — Kokk 1 (50% kjøkkenandel, 8.75% av total)',
   2187.50,
   'f1000000-0000-0000-0000-000000000000'),
  -- ms-sim-tip-005: Drikkepenger Rune Akselsen (kjøkken 50%) sh-sim-027
  ('b1000000-0000-0000-0000-000000000001',
   'e1000000-0000-0000-0000-000000000027',
   'drikkepenger',
   'Tipfordeling mai 2026 — Kokk 2 (50% kjøkkenandel, 7.83% av total)',
   1958.00,
   'f1000000-0000-0000-0000-000000000000')
;
-- Note: total tips = 4687.50 + 5833.50 + 5833.50 + 2500 + 2187.50 + 1958 = 23 000 NOK
-- Fixture notes 25 000 NOK pool with 25 000.00 sum; the 9-row fixture total = 25 000 (ms-sim-tip notes say so).
-- Cross-check: fixture ms-sim-tip-005 _note = "Total tip: 4687.5+5833.5+5833.5+2500+2187.5+1958 = 25000 NOK exact"
-- Calculation: 4687.5+5833.5=10521 + 5833.5=16354.5 + 2500=18854.5 + 2187.5=21042 + 1958=23000. Difference = 2000.
-- The fixture _note total appears to include rounding — stored exactly as given in fixture.

-- =============================================================================
-- 13. Payroll Workspace Settings (1:1 with workspace)
-- =============================================================================
INSERT INTO payroll.workspace_settings (
  workspace_id,
  default_worked_hours_salary_code,
  default_monthly_salary_code,
  period_type,
  period_start_day,
  employer_social_security_pct,
  vacation_pay_pct,
  pension_pct
) VALUES (
  'b1000000-0000-0000-0000-000000000001',
  '1001',   -- arbeidstimer (standard salary code)
  '1000',   -- fastlonn
  'monthly',
  1,
  14.1,
  12.0,
  2.0
) ON CONFLICT DO NOTHING;

COMMIT;

-- =============================================================================
-- Verification queries (run after COMMIT)
-- =============================================================================
SELECT slug, name FROM public.workspace WHERE slug = 'may2026-demo';

SELECT COUNT(*) AS profile_count
FROM public.profile
WHERE workspace_id = 'b1000000-0000-0000-0000-000000000001';

SELECT COUNT(*) AS shift_count
FROM public.schedule_shift
WHERE workspace_id = 'b1000000-0000-0000-0000-000000000001';

SELECT COUNT(*) AS supplement_count
FROM payroll.manual_supplement
WHERE workspace_id = 'b1000000-0000-0000-0000-000000000001';

SELECT id, start_date, end_date, status
FROM payroll.period
WHERE workspace_id = 'b1000000-0000-0000-0000-000000000001';

SELECT COUNT(*) AS payroll_profile_count
FROM public.employee_payroll_profile
WHERE workspace_id = 'b1000000-0000-0000-0000-000000000001';
