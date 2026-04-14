-- Smartout Phase 0.10 Seed Data
-- ==============================================================================
-- This script contains minimal viable data to instantiate the development environment.

-- 1. Create a Company
-- ------------------------------------------------------------------------------
INSERT INTO public.company (company_id, name, legal_name, org_number, country, industry)
VALUES
  ('a0000000-0000-0000-0000-000000000000', 'Smartout AS', 'Smartout Corporation', '999888777', 'NO', 'other');

-- 2. Create a Workspace
-- ------------------------------------------------------------------------------
INSERT INTO public.workspace (workspace_id, company_id, name, slug, description, currency, language, country, onboarding_completed)
VALUES
  ('b0000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'HQ Workspace', 'hq-workspace', 'Headquarters Workspace', 'NOK', 'no', 'NO', true);

-- 3. Create a Location
-- ------------------------------------------------------------------------------
INSERT INTO public.location (location_id, workspace_id, name, slug, location_type)
VALUES
  ('c0000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000', 'Oslo Downtown Hub', 'oslo-downtown', 'main');

-- 4. Create Departments
-- ------------------------------------------------------------------------------
INSERT INTO public.department (department_id, workspace_id, name, slug, sort_order)
VALUES
  ('d0000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000', 'Operations', 'operations', 0),
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000', 'Kitchen', 'kitchen', 1),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000', 'Service', 'service', 2),
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000', 'Bar', 'bar', 3);

-- 5. Create Auth Users
-- ------------------------------------------------------------------------------
-- Admin user
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone, phone_change,
  phone_change_token, reauthentication_token
) VALUES (
  'e0000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'admin@smartout.local',
  crypt('password123', gen_salt('bf')), now(),
  '{"first_name": "Admin", "last_name": "Local"}',
  '{"provider": "email", "providers": ["email"]}',
  now(), now(), '', '', '', '', '', '', '', '', ''
);

-- Employee users (e1 through e9)
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone, phone_change,
  phone_change_token, reauthentication_token
) VALUES
  ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'anna@smartout.local',
   crypt('password123', gen_salt('bf')), now(),
   '{"first_name": "Anna", "last_name": "Olsen"}',
   '{"provider": "email", "providers": ["email"]}',
   now(), now(), '', '', '', '', '', '+4791234567', '', '', ''),
  ('e0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'erik@smartout.local',
   crypt('password123', gen_salt('bf')), now(),
   '{"first_name": "Erik", "last_name": "Pedersen"}',
   '{"provider": "email", "providers": ["email"]}',
   now(), now(), '', '', '', '', '', '+4741122333', '', '', ''),
  ('e0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'lise@smartout.local',
   crypt('password123', gen_salt('bf')), now(),
   '{"first_name": "Lise", "last_name": "Markussen"}',
   '{"provider": "email", "providers": ["email"]}',
   now(), now(), '', '', '', '', '', '+4792233444', '', '', ''),
  ('e0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ole@smartout.local',
   crypt('password123', gen_salt('bf')), now(),
   '{"first_name": "Ole", "last_name": "Torp"}',
   '{"provider": "email", "providers": ["email"]}',
   now(), now(), '', '', '', '', '', '+4743344555', '', '', ''),
  ('e0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'kari@smartout.local',
   crypt('password123', gen_salt('bf')), now(),
   '{"first_name": "Kari", "last_name": "Nilsen"}',
   '{"provider": "email", "providers": ["email"]}',
   now(), now(), '', '', '', '', '', '+4794455666', '', '', ''),
  ('e0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'jon@smartout.local',
   crypt('password123', gen_salt('bf')), now(),
   '{"first_name": "Jon", "last_name": "Doe"}',
   '{"provider": "email", "providers": ["email"]}',
   now(), now(), '', '', '', '', '', '+4745566777', '', '', ''),
  ('e0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'sara@smartout.local',
   crypt('password123', gen_salt('bf')), now(),
   '{"first_name": "Sara", "last_name": "Lee"}',
   '{"provider": "email", "providers": ["email"]}',
   now(), now(), '', '', '', '', '', '+4796677888', '', '', ''),
  ('e0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'jonas@smartout.local',
   crypt('password123', gen_salt('bf')), now(),
   '{"first_name": "Jonas", "last_name": "Bakken"}',
   '{"provider": "email", "providers": ["email"]}',
   now(), now(), '', '', '', '', '', '+4747788999', '', '', ''),
  ('e0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'silje@smartout.local',
   crypt('password123', gen_salt('bf')), now(),
   '{"first_name": "Silje", "last_name": "Ruud"}',
   '{"provider": "email", "providers": ["email"]}',
   now(), now(), '', '', '', '', '', '+4798899000', '', '', '');

-- 5b. Create Auth Identities
-- ------------------------------------------------------------------------------
INSERT INTO auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) VALUES
  (
    'e0000000-0000-0000-0000-000000000000',
    'e0000000-0000-0000-0000-000000000000',
    '{"sub":"e0000000-0000-0000-0000-000000000000","email":"admin@smartout.local","email_verified":true}',
    'email',
    now(),
    now(),
    now()
  ),
  (
    'e0000000-0000-0000-0000-000000000001',
    'e0000000-0000-0000-0000-000000000001',
    '{"sub":"e0000000-0000-0000-0000-000000000001","email":"anna@smartout.local","email_verified":true}',
    'email',
    now(),
    now(),
    now()
  ),
  (
    'e0000000-0000-0000-0000-000000000002',
    'e0000000-0000-0000-0000-000000000002',
    '{"sub":"e0000000-0000-0000-0000-000000000002","email":"erik@smartout.local","email_verified":true}',
    'email',
    now(),
    now(),
    now()
  ),
  (
    'e0000000-0000-0000-0000-000000000003',
    'e0000000-0000-0000-0000-000000000003',
    '{"sub":"e0000000-0000-0000-0000-000000000003","email":"lise@smartout.local","email_verified":true}',
    'email',
    now(),
    now(),
    now()
  ),
  (
    'e0000000-0000-0000-0000-000000000004',
    'e0000000-0000-0000-0000-000000000004',
    '{"sub":"e0000000-0000-0000-0000-000000000004","email":"ole@smartout.local","email_verified":true}',
    'email',
    now(),
    now(),
    now()
  ),
  (
    'e0000000-0000-0000-0000-000000000005',
    'e0000000-0000-0000-0000-000000000005',
    '{"sub":"e0000000-0000-0000-0000-000000000005","email":"kari@smartout.local","email_verified":true}',
    'email',
    now(),
    now(),
    now()
  ),
  (
    'e0000000-0000-0000-0000-000000000006',
    'e0000000-0000-0000-0000-000000000006',
    '{"sub":"e0000000-0000-0000-0000-000000000006","email":"jon@smartout.local","email_verified":true}',
    'email',
    now(),
    now(),
    now()
  ),
  (
    'e0000000-0000-0000-0000-000000000007',
    'e0000000-0000-0000-0000-000000000007',
    '{"sub":"e0000000-0000-0000-0000-000000000007","email":"sara@smartout.local","email_verified":true}',
    'email',
    now(),
    now(),
    now()
  ),
  (
    'e0000000-0000-0000-0000-000000000008',
    'e0000000-0000-0000-0000-000000000008',
    '{"sub":"e0000000-0000-0000-0000-000000000008","email":"jonas@smartout.local","email_verified":true}',
    'email',
    now(),
    now(),
    now()
  ),
  (
    'e0000000-0000-0000-0000-000000000009',
    'e0000000-0000-0000-0000-000000000009',
    '{"sub":"e0000000-0000-0000-0000-000000000009","email":"silje@smartout.local","email_verified":true}',
    'email',
    now(),
    now(),
    now()
  );

-- 6. Link Users to Company (Company Members)
-- ------------------------------------------------------------------------------
INSERT INTO public.company_member (user_id, company_id, role)
VALUES
  ('e0000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'owner'),
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000000', 'member'),
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000000', 'member'),
  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000000', 'member'),
  ('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000000', 'member'),
  ('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000000', 'member'),
  ('e0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000000', 'member'),
  ('e0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000000', 'member'),
  ('e0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000000', 'member'),
  ('e0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000000', 'member');

-- 7. Create Profiles for the Workspace
-- ------------------------------------------------------------------------------
-- Admin (owner)
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, location_id, display_name, job_title,
  address_line_1, postal_code, city
) VALUES (
  'f0000000-0000-0000-0000-000000000000', 'ADM001',
  'e0000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'owner', 'active',
  'd0000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000000',
  'Local Admin', 'Restaurant Manager',
  'Karl Johans gate 1', '0154', 'Oslo'
);

-- Anna Olsen — Kitchen, Kokk, active
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, location_id, display_name, job_title,
  address_line_1, postal_code, city, personal_number, bank_account
) VALUES (
  'f0000000-0000-0000-0000-000000000001', 'EMP001',
  'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'employee', 'active',
  'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000000',
  'Anna Olsen', 'Kokk',
  'Storgata 1', '0155', 'Oslo', '120190 12345', '1234.56.78901'
);

-- Erik Pedersen — Kitchen, Sous Chef, active
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, location_id, display_name, job_title,
  address_line_1, postal_code, city
) VALUES (
  'f0000000-0000-0000-0000-000000000002', 'EMP002',
  'e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'manager', 'active',
  'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000000',
  'Erik Pedersen', 'Sous Chef',
  'Grensen 5', '0159', 'Oslo'
);

-- Lise Markussen — Service, Servitor, inactive
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, location_id, display_name, job_title,
  address_line_1, postal_code, city
) VALUES (
  'f0000000-0000-0000-0000-000000000003', 'EMP003',
  'e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'employee', 'inactive',
  'd0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000000',
  'Lise Markussen', 'Servitor',
  'Bogstadveien 22', '0355', 'Oslo'
);

-- Ole Torp — Bar, Bartender, active
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, location_id, display_name, job_title,
  address_line_1, postal_code, city
) VALUES (
  'f0000000-0000-0000-0000-000000000004', 'EMP004',
  'e0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'employee', 'active',
  'd0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000000',
  'Ole Torp', 'Bartender',
  'Thereses gate 14', '0452', 'Oslo'
);

-- Kari Nilsen — Service, Servitor, trainee
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, location_id, display_name, job_title,
  trainee_started, address_line_1, postal_code, city
) VALUES (
  'f0000000-0000-0000-0000-000000000005', 'EMP005',
  'e0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'employee', 'trainee',
  'd0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000000',
  'Kari Nilsen', 'Servitor',
  now() - interval '3 days',
  'Markveien 58', '0550', 'Oslo'
);

-- Jon Doe — Kitchen, Oppvask, inactive
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, location_id, display_name, job_title,
  address_line_1, postal_code, city
) VALUES (
  'f0000000-0000-0000-0000-000000000006', 'EMP006',
  'e0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'employee', 'inactive',
  'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000000',
  'Jon Doe', 'Oppvask',
  'Toftes gate 6', '0556', 'Oslo'
);

-- Sara Lee — Service, Hovmester, inactive (on leave mapped to inactive since enum doesn't have on_leave)
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, location_id, display_name, job_title,
  address_line_1, postal_code, city
) VALUES (
  'f0000000-0000-0000-0000-000000000007', 'EMP007',
  'e0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'manager', 'inactive',
  'd0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000000',
  'Sara Lee', 'Hovmester',
  'Josefines gate 11', '0351', 'Oslo'
);

-- Jonas Bakken — Kitchen, Kokk, trainee (was "invited" in mock, closest DB enum is trainee)
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, location_id, display_name, job_title,
  trainee_started, address_line_1, postal_code, city
) VALUES (
  'f0000000-0000-0000-0000-000000000008', 'EMP008',
  'e0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'employee', 'trainee',
  'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000000',
  'Jonas Bakken', 'Kokk',
  now() - interval '1 day',
  'Uelands gate 28', '0460', 'Oslo'
);

-- Silje Ruud — Service, Servitor, trainee (was "invited expired" in mock)
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, location_id, display_name, job_title,
  trainee_started, address_line_1, postal_code, city
) VALUES (
  'f0000000-0000-0000-0000-000000000009', 'EMP009',
  'e0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'employee', 'trainee',
  'd0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000000',
  'Silje Ruud', 'Servitor',
  now() - interval '4 days',
  'Schweigaards gate 33', '0191', 'Oslo'
);

-- 8. Make Admin user a Godmode user for platform-admin development
-- ------------------------------------------------------------------------------
UPDATE public.user_identity
SET is_godmode = true
WHERE user_id = 'e0000000-0000-0000-0000-000000000000';

-- 9. Create Pending Invitations
-- ------------------------------------------------------------------------------
INSERT INTO public.invitation (
  invitation_id, workspace_id, company_id, email, first_name, last_name,
  role, department_ids, status, invited_by
) VALUES
  ('11000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000000', 'maria@example.com', 'Maria', 'Hansen',
   'employee', ARRAY['d0000000-0000-0000-0000-000000000002']::uuid[], 'pending',
   'f0000000-0000-0000-0000-000000000000'),
  ('11000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000000', 'thomas@example.com', 'Thomas', 'Berg',
   'employee', ARRAY['d0000000-0000-0000-0000-000000000001']::uuid[], 'pending',
   'f0000000-0000-0000-0000-000000000000'),
  ('11000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000000', 'ingrid@example.com', 'Ingrid', 'Larsen',
   'employee', ARRAY['d0000000-0000-0000-0000-000000000003']::uuid[], 'pending',
   'f0000000-0000-0000-0000-000000000000');

-- ============================================
-- Journey Seed Data (68 journeys)
-- ============================================
-- ============================================
-- 20260301150000_journey_seed_data.sql
-- Seeds all 68 journeys from the Smartout Journey Registry
-- into the journey and journey_step tables.
-- Each journey starts with status 'idea' and belongs
-- to the seed workspace b0000000-0000-0000-0000-000000000000.
-- Connected to: docs/modules/journey/SMARTOUT_JOURNEY_REGISTRY.md
-- ============================================

-- ─── Helper: workspace UUID constant ───────────────────────────
-- Using a CTE so we define the workspace UUID once.
-- All 68 journeys share this workspace.

DO $$
DECLARE
  ws_id uuid := 'b0000000-0000-0000-0000-000000000000';
BEGIN

-- ─────────────────────────────────────────────────────────────────
-- CORE (3 journeys: J-001 to J-003)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-001', 'Sign Up & Create Workspace', 'sign-up-create-workspace', 'core', 'owner', 'desktop', 'P0', 'idea',
  ARRAY['write', 'ai-assisted', 'stripe'],
  'Landing page → "Start gratis prøveperiode"',
  'signup → workspace exists → setup wizard completes → can invite',
  'Dine første 10 minutter med Smartout');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-001' AND workspace_id = ws_id), ws_id, 1,
   'Create Account', 'Enter email/password or SSO → Create account', 'Account created, redirect to workspace setup',
   '/auth/signup', 'SignupForm', ARRAY[]::text[], ARRAY['auth.users', 'user_identity']::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-001' AND workspace_id = ws_id), ws_id, 2,
   'AI Scrape & Prepopulate', 'AI scrapes website + Brønnøysundregistrene → Prepopulate workspace', 'Company details auto-filled',
   '/onboarding/setup', 'SetupWizard', ARRAY[]::text[], ARRAY['company', 'workspace']::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-001' AND workspace_id = ws_id), ws_id, 3,
   'Confirm Company Details', 'Confirm/adjust company details (name, org number, industry)', 'Details saved correctly',
   '/onboarding/setup', 'CompanyDetailsForm', ARRAY['company']::text[], ARRAY['company']::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-001' AND workspace_id = ws_id), ws_id, 4,
   'Setup Wizard', 'Mr. Botsson guides 7-stage setup wizard', 'All 7 stages completed',
   '/onboarding/setup', 'SetupWizard', ARRAY['workspace']::text[], ARRAY['department', 'location', 'team', 'position']::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-001' AND workspace_id = ws_id), ws_id, 5,
   'Invite Employees', 'Workspace ready → Invite first employees', 'Invitations sent successfully',
   '/onboarding/invite', 'InviteForm', ARRAY['workspace']::text[], ARRAY['invite']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-002', 'Employee Accepts Invite', 'employee-accepts-invite', 'core', 'employee', 'mobile', 'P0', 'idea',
  ARRAY['write', 'ai-assisted', 'sandbox'],
  'Email/SMS invite link',
  'invite → account created → trainee mode → AI greeting',
  'Velkommen til din nye arbeidsplass');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-002' AND workspace_id = ws_id), ws_id, 1,
   'Accept Invite', 'Click invite → Create account (or link existing)', 'Account created and linked to workspace',
   '/auth/invite', 'InviteAcceptForm', ARRAY['invite']::text[], ARRAY['auth.users', 'user_identity', 'profile']::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-002' AND workspace_id = ws_id), ws_id, 2,
   'Enter Trainee Mode', 'Land in Trainee Mode (sandbox)', 'Sandbox environment loaded',
   '/home', 'TraineeShell', ARRAY['profile']::text[], ARRAY['profile']::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-002' AND workspace_id = ws_id), ws_id, 3,
   'AI Greeting & Profile Setup', 'Mr. Botsson greets → Profile setup (photo, language, emergency contact)', 'Profile completed',
   '/onboarding/profile', 'ProfileSetup', ARRAY['profile']::text[], ARRAY['profile']::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-002' AND workspace_id = ws_id), ws_id, 4,
   'Navigation Tour', 'Navigation tour → Core concepts intro', 'Tour completed, concepts understood',
   '/home', 'NavigationTour', ARRAY[]::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-002' AND workspace_id = ws_id), ws_id, 5,
   'Begin Module Journeys', 'Module journeys begin based on first shift', 'First module journey started',
   '/training', 'ModuleJourneyList', ARRAY['profile', 'schedule_shift']::text[], ARRAY[]::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-003', 'Login & Route to Context', 'login-route-to-context', 'core', 'all', 'both', 'P0', 'idea',
  ARRAY['read-only'],
  'Open app / navigate to site',
  'login each role → correct screen → context matches',
  NULL);

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-003' AND workspace_id = ws_id), ws_id, 1,
   'Auth Check', 'Auth check → Session validation', 'Session validated or redirect to login',
   '/auth/login', 'AuthGuard', ARRAY['auth.users']::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-003' AND workspace_id = ws_id), ws_id, 2,
   'Load Profile', 'Load profile → Determine role, status, session', 'Profile loaded with correct role',
   NULL, 'ProfileLoader', ARRAY['profile', 'workspace']::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-003' AND workspace_id = ws_id), ws_id, 3,
   'Route to Context', 'Route: Employee on shift → Feed | Off shift → Schedule | Admin → Dashboard | Trainee → Onboarding', 'Correct screen for role and context',
   NULL, 'ContextRouter', ARRAY['profile', 'schedule_shift', 'department_session']::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-003' AND workspace_id = ws_id), ws_id, 4,
   'Load Workspace Context', 'Load workspace context (season, modules, permissions)', 'All context loaded correctly',
   NULL, 'WorkspaceProvider', ARRAY['workspace', 'season']::text[], ARRAY[]::text[], NULL);

-- ─────────────────────────────────────────────────────────────────
-- ONBOARDING (5 journeys: J-004 to J-008)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-004', 'Complete Trainee Core Journey', 'complete-trainee-core-journey', 'onboarding', 'trainee', 'mobile', 'P0', 'idea',
  ARRAY['write', 'ai-assisted', 'sandbox', 'gamification'],
  'First login after invite acceptance',
  'trainee login → AI greets → profile done → tour → checkpoints marked',
  'Bli kjent med Smartout');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-004' AND workspace_id = ws_id), ws_id, 1,
   'AI Introduction', 'Mr. Botsson introduces Smartout and the restaurant', 'Welcome message displayed',
   '/onboarding', 'BotssonIntro', ARRAY['workspace']::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-004' AND workspace_id = ws_id), ws_id, 2,
   'Profile Completion', 'Profile completion: photo, emergency contact, language', 'Profile fields filled',
   '/onboarding/profile', 'ProfileSetup', ARRAY['profile']::text[], ARRAY['profile']::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-004' AND workspace_id = ws_id), ws_id, 3,
   'Navigation Tour', 'Navigation tour: Home, Vakter, Chat, Meg tabs', 'Tour completed',
   '/home', 'NavigationTour', ARRAY[]::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-004' AND workspace_id = ws_id), ws_id, 4,
   'Core Concepts', 'Core concept intro: shifts, tasks, points', 'Concepts understood',
   '/onboarding/concepts', 'ConceptIntro', ARRAY[]::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-004' AND workspace_id = ws_id), ws_id, 5,
   'AI Verification', 'Each checkpoint AI-verified → Progress bar updates', 'All checkpoints marked complete',
   '/onboarding', 'ProgressTracker', ARRAY['profile']::text[], ARRAY['profile']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-005', 'Complete Module Journey', 'complete-module-journey', 'onboarding', 'all', 'mobile', 'P0', 'idea',
  ARRAY['sandbox', 'ai-assisted', 'gamification'],
  'Core journey complete OR new module activated',
  'module journey → spotlight → sandbox → checkpoint → complete',
  'Laer [Modulnavn]');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-005' AND workspace_id = ws_id), ws_id, 1,
   'Determine Module Order', 'AI determines module order (based on first shift)', 'Module order calculated',
   '/training', 'ModuleOrder', ARRAY['profile', 'schedule_shift']::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-005' AND workspace_id = ws_id), ws_id, 2,
   'AI Spotlight', 'Open module → AI spotlight on key elements', 'Key elements highlighted',
   '/training/module', 'AISpotlight', ARRAY[]::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-005' AND workspace_id = ws_id), ws_id, 3,
   'Sandbox Activity', 'Sandbox activity (test punch-in, test task)', 'Sandbox actions completed',
   '/training/sandbox', 'SandboxActivity', ARRAY[]::text[], ARRAY[]::text[], 'Sandbox mode — no live impact'),
  ((SELECT journey_id FROM journey WHERE code = 'J-005' AND workspace_id = ws_id), ws_id, 4,
   'Checkpoint Quiz', 'Checkpoint quiz or confirmation', 'Quiz passed',
   '/training/checkpoint', 'CheckpointQuiz', ARRAY[]::text[], ARRAY['protocol_assignment']::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-005' AND workspace_id = ws_id), ws_id, 5,
   'Module Complete', 'Module marked learned → Next unlocked', 'Module marked complete, next module available',
   '/training', 'ModuleProgress', ARRAY['protocol_assignment']::text[], ARRAY['protocol_assignment']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-006', 'Admin Reviews Trainee Progress', 'admin-reviews-trainee-progress', 'onboarding', 'admin', 'desktop', 'P0', 'idea',
  ARRAY['read-only', 'ai-assisted', 'approval-flow'],
  'People → Trainees',
  'trainees → progress → approve → status = active → points transferred',
  'Godkjenn nye ansatte');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-006' AND workspace_id = ws_id), ws_id, 1,
   'Trainee Dashboard', 'Trainee dashboard → All trainees with progress bars', 'All trainees listed with progress',
   '/admin/people/trainees', 'TraineeDashboard', ARRAY['profile']::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-006' AND workspace_id = ws_id), ws_id, 2,
   'View Trainee Detail', 'Click trainee → Detailed checkpoint view', 'Checkpoint details displayed',
   '/admin/people/trainees/:id', 'TraineeDetail', ARRAY['profile', 'protocol_assignment']::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-006' AND workspace_id = ws_id), ws_id, 3,
   'AI Risk Alerts', 'See AI risk alerts (behind schedule, first shift approaching)', 'Alerts displayed if applicable',
   '/admin/people/trainees/:id', 'RiskAlerts', ARRAY['profile', 'schedule_shift']::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-006' AND workspace_id = ws_id), ws_id, 4,
   'Approve Trainee', 'Decision: Approve → active | Extend | Reschedule', 'Status updated correctly',
   '/admin/people/trainees/:id', 'TraineeActions', ARRAY['profile']::text[], ARRAY['profile']::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-006' AND workspace_id = ws_id), ws_id, 5,
   'Points Transfer', 'If approved → Status trainee → active, points carry to season', 'Points transferred to active season',
   '/admin/people/trainees/:id', 'PointsTransfer', ARRAY['profile']::text[], ARRAY['profile']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-007', 'Bulk Invite Employees (CSV)', 'bulk-invite-employees-csv', 'onboarding', 'admin', 'desktop', 'P1', 'idea',
  ARRAY['write', 'bulk'],
  'People → Invite → Bulk',
  'upload CSV → validate → confirm → invites sent → tracking',
  'Inviter mange ansatte på en gang');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-007' AND workspace_id = ws_id), ws_id, 1,
   'Download Template', 'Download CSV template', 'Template downloaded',
   '/admin/people/invite', 'CSVTemplateDownload', ARRAY[]::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-007' AND workspace_id = ws_id), ws_id, 2,
   'Fill Template', 'Fill: name, email, phone, department, position', 'CSV filled with employee data',
   NULL, NULL, ARRAY[]::text[], ARRAY[]::text[], 'Done outside the app'),
  ((SELECT journey_id FROM journey WHERE code = 'J-007' AND workspace_id = ws_id), ws_id, 3,
   'Upload & Validate', 'Upload → Validate (duplicates, format, plan limit)', 'Validation results shown',
   '/admin/people/invite/bulk', 'BulkUploadValidator', ARRAY['profile']::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-007' AND workspace_id = ws_id), ws_id, 4,
   'Preview & Confirm', 'Preview → Confirm', 'Preview shows correct data',
   '/admin/people/invite/bulk', 'BulkPreview', ARRAY[]::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-007' AND workspace_id = ws_id), ws_id, 5,
   'Send Invites', 'Batch invites sent → Track acceptance', 'All invites sent, tracking active',
   '/admin/people/invite/bulk', 'BulkInviteTracker', ARRAY[]::text[], ARRAY['invite']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-008', 'Employee Offboarding', 'employee-offboarding', 'onboarding', 'admin', 'desktop', 'P1', 'idea',
  ARRAY['write', 'compliance'],
  'People → Employee → "Start offboarding"',
  'offboarding → all items resolved → inactive → data preserved',
  'Avslutte et arbeidsforhold');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-008' AND workspace_id = ws_id), ws_id, 1,
   'Set Offboarding Status', 'Set status → offboarding', 'Status changed to offboarding',
   '/admin/people/:id', 'EmployeeActions', ARRAY['profile']::text[], ARRAY['profile']::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-008' AND workspace_id = ws_id), ws_id, 2,
   'Review Open Items', 'System shows: open shifts, active contracts, pending tasks', 'All open items listed',
   '/admin/people/:id/offboarding', 'OffboardingChecklist', ARRAY['schedule_shift', 'employment_contract']::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-008' AND workspace_id = ws_id), ws_id, 3,
   'Handle Items', 'Handle each: reassign, terminate, cancel', 'All items resolved',
   '/admin/people/:id/offboarding', 'OffboardingActions', ARRAY[]::text[], ARRAY['schedule_shift', 'employment_contract']::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-008' AND workspace_id = ws_id), ws_id, 4,
   'GDPR Export', 'GDPR export offered', 'Export generated if requested',
   '/admin/people/:id/offboarding', 'GDPRExport', ARRAY['profile']::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-008' AND workspace_id = ws_id), ws_id, 5,
   'Final Deactivation', 'Final deactivation → inactive, data preserved', 'Profile set to inactive, data preserved',
   '/admin/people/:id/offboarding', 'Deactivation', ARRAY['profile']::text[], ARRAY['profile']::text[], NULL);

-- ─────────────────────────────────────────────────────────────────
-- ORG STRUCTURE (2 journeys: J-009 to J-010)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-009', 'Configure Organization (Setup Wizard)', 'configure-organization-setup-wizard', 'org', 'admin', 'desktop', 'P0', 'idea',
  ARRAY['write', 'ai-assisted'],
  'First login → Mr. Botsson wizard',
  'wizard → each stage creates entities → org structure complete',
  'Sett opp restaurantens struktur');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-009' AND workspace_id = ws_id), ws_id, 1,
   'Setup Wizard - 7 Stages', '7 stages: Departments → Locations → Zones → Assets → Positions → Teams → Settings', 'All 7 stages completed, entities created',
   '/onboarding/setup', 'SetupWizard', ARRAY['workspace']::text[], ARRAY['department', 'location', 'team', 'position']::text[], 'Mr. Botsson guides through each stage');

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-010', 'Edit Org Structure', 'edit-org-structure', 'org', 'admin', 'desktop', 'P1', 'idea',
  ARRAY['write', 'season-aware'],
  'Settings → Org Structure',
  'edit → saved → scheduling reflects → season items correct',
  'Endre organisasjonsstruktur');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-010' AND workspace_id = ws_id), ws_id, 1,
   'Navigate to Section', 'Navigate to section', 'Org structure section loaded',
   '/admin/settings/org', 'OrgStructure', ARRAY['department', 'location', 'team']::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-010' AND workspace_id = ws_id), ws_id, 2,
   'Add/Edit/Deactivate', 'Add/edit/deactivate entities', 'Changes saved',
   '/admin/settings/org', 'OrgEditor', ARRAY[]::text[], ARRAY['department', 'location', 'team', 'position']::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-010' AND workspace_id = ws_id), ws_id, 3,
   'Drag and Drop Reorder', 'Drag-and-drop reorder', 'Order updated',
   '/admin/settings/org', 'OrgEditor', ARRAY[]::text[], ARRAY['department', 'location', 'team']::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-010' AND workspace_id = ws_id), ws_id, 4,
   'Season-Aware Variants', 'Season-aware variants (summer zones, event positions)', 'Season variants configured',
   '/admin/settings/org', 'SeasonVariants', ARRAY['season']::text[], ARRAY['department', 'location', 'team', 'position']::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-010' AND workspace_id = ws_id), ws_id, 5,
   'Verify Cross-Module', 'Changes reflected across all modules', 'Scheduling and operations reflect changes',
   NULL, NULL, ARRAY[]::text[], ARRAY[]::text[], 'Verification step');

-- ─────────────────────────────────────────────────────────────────
-- SCHEDULING (8 journeys: J-011 to J-018)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-011', 'Check My Schedule', 'check-my-schedule', 'scheduling', 'employee', 'mobile', 'P0', 'idea',
  ARRAY['read-only'],
  'Vakter tab',
  'schedule → shifts visible → detail correct',
  'Sjekk vaktplanen din');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-011' AND workspace_id = ws_id), ws_id, 1,
   'View Calendar', 'Calendar view → Tap shift → Detail (time, location, role, colleagues)', 'Shift details displayed correctly',
   '/shifts', 'ShiftCalendar', ARRAY['schedule_shift', 'profile']::text[], ARRAY[]::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-012', 'Register Availability / Request Time Off', 'register-availability-request-time-off', 'scheduling', 'employee', 'mobile', 'P0', 'idea',
  ARRAY['write', 'approval-flow'],
  'Vakter → Min tilgjengelighet',
  'mark unavailable → saved → visible in admin grid → conflicts detected',
  'Si fra når du ikke kan jobbe');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-012' AND workspace_id = ws_id), ws_id, 1,
   'Mark Availability', 'Open calendar → Mark unavailable → Or request time off → Submit → Track status', 'Availability saved and visible to admin',
   '/shifts/availability', 'AvailabilityCalendar', ARRAY['schedule_shift']::text[], ARRAY['schedule_shift']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-013', 'Claim Open Shift', 'claim-open-shift', 'scheduling', 'employee', 'mobile', 'P1', 'idea',
  ARRAY['write', 'push-notification'],
  'Push or Vakter → Ledige vakter',
  'open shift → claim → approve → assigned',
  'Ta en ekstra vakt');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-013' AND workspace_id = ws_id), ws_id, 1,
   'Claim Shift', 'See open shifts → Filter → Tap "Ta vakten" → Manager approves → Shift assigned', 'Shift claimed and assigned after approval',
   '/shifts/open', 'OpenShiftList', ARRAY['schedule_shift']::text[], ARRAY['schedule_shift']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-014', 'Request Shift Swap', 'request-shift-swap', 'scheduling', 'employee', 'mobile', 'P1', 'idea',
  ARRAY['write', 'approval-flow', 'push-notification'],
  'Shift detail → Foreslå bytte',
  'request → colleague accepts → manager approves → schedules updated',
  'Bytt vakt med en kollega');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-014' AND workspace_id = ws_id), ws_id, 1,
   'Request Swap', 'Select shift → See eligible colleagues → Send request → Colleague accepts → Manager approves', 'Swap approved and schedules updated',
   '/shifts/:id/swap', 'ShiftSwapFlow', ARRAY['schedule_shift', 'profile']::text[], ARRAY['schedule_shift']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-015', 'Build Weekly Schedule', 'build-weekly-schedule', 'scheduling', 'admin', 'desktop', 'P0', 'idea',
  ARRAY['write', 'ai-assisted', 'norwegian-law'],
  'Schedule Builder',
  'create → assign → validate → publish → employees notified',
  'Planlegg neste ukes vakter');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-015' AND workspace_id = ws_id), ws_id, 1,
   'Build Schedule', 'Drag-and-drop grid → Create/assign shifts → Compliance check → Cost overlay → Publish', 'Schedule published, employees notified',
   '/admin/scheduling/builder', 'ScheduleBuilder', ARRAY['profile', 'department', 'position']::text[], ARRAY['schedule_shift']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-016', 'Handle Sick Call', 'handle-sick-call', 'scheduling', 'admin', 'both', 'P0', 'idea',
  ARRAY['write', 'ai-assisted', 'push-notification'],
  'Notification: syk',
  'sick call → replacement → confirmed → schedule updated',
  'Dekk et sykefravær på 2 minutter');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-016' AND workspace_id = ws_id), ws_id, 1,
   'Handle Sick Call', 'See affected shift → AI suggests replacement → Send request → Confirmed → Or post open shift', 'Replacement confirmed or open shift posted',
   '/admin/scheduling/sick', 'SickCallHandler', ARRAY['schedule_shift', 'profile']::text[], ARRAY['schedule_shift']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-017', 'Copy / Template Schedule', 'copy-template-schedule', 'scheduling', 'admin', 'desktop', 'P1', 'idea',
  ARRAY['write'],
  'Schedule Builder → Kopier forrige uke',
  'copy → preview → conflicts shown → confirm → shifts created',
  'Gjenbruk en vaktplan');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-017' AND workspace_id = ws_id), ws_id, 1,
   'Copy Schedule', 'Select source → Preview → Auto-adjust dates → Handle conflicts → Confirm', 'Schedule copied with conflicts resolved',
   '/admin/scheduling/builder', 'ScheduleCopy', ARRAY['schedule_shift']::text[], ARRAY['schedule_shift']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-018', 'View Shift History & Hours', 'view-shift-history-hours', 'scheduling', 'employee', 'both', 'P1', 'idea',
  ARRAY['read-only', 'export'],
  'Vakter → Historikk',
  'history → hours calculated → overtime marked → export works',
  'Se arbeidstimene dine');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-018' AND workspace_id = ws_id), ws_id, 1,
   'View History', 'Past shifts with punch data → Hours breakdown → Overtime highlighted → Export', 'Hours and overtime displayed, export available',
   '/shifts/history', 'ShiftHistory', ARRAY['schedule_shift', 'punch_record']::text[], ARRAY[]::text[], NULL);

-- ─────────────────────────────────────────────────────────────────
-- OPERATIONS (7 journeys: J-019 to J-025)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-019', 'Punch Into Shift', 'punch-into-shift', 'operations', 'employee', 'mobile', 'P0', 'idea',
  ARRAY['write', 'gps', 'gamification', 'real-time'],
  'Home → Stemple inn',
  'punch → GPS → session active → feed loads → record created',
  'Stemple inn på jobb');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-019' AND workspace_id = ws_id), ws_id, 1,
   'Punch In', 'Tap punch → GPS check → Session context switches → Feed loads → Points for on-time', 'Punched in, session active, feed loaded',
   '/home', 'PunchButton', ARRAY['schedule_shift', 'department_session']::text[], ARRAY['punch_record']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-020', 'Work Through Feed Tasks', 'work-through-feed-tasks', 'operations', 'employee', 'mobile', 'P0', 'idea',
  ARRAY['write', 'real-time', 'gamification'],
  'On shift → Feed items',
  'feed → task → steps → complete → points',
  'Gjør oppgavene dine');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-020' AND workspace_id = ws_id), ws_id, 1,
   'Work Through Tasks', 'Feed → Tap task → Procedure stepper → Complete (photo/data) → Points → Next task', 'Task completed, points awarded',
   '/feed', 'FeedTaskList', ARRAY['department_session']::text[], ARRAY['department_session']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-021', 'View Day Brief', 'view-day-brief', 'operations', 'employee', 'mobile', 'P0', 'idea',
  ARRAY['read-only', 'ai-assisted'],
  'Feed → Pinned Day Brief',
  'session start → brief pinned → expand → acknowledge tracked',
  'Dagens oppdatering');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-021' AND workspace_id = ws_id), ws_id, 1,
   'View Brief', 'AI-compiled brief → Expand → Action items → Acknowledge', 'Brief displayed and acknowledged',
   '/feed', 'DayBrief', ARRAY['department_session']::text[], ARRAY['department_session']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-022', 'Create Ad-Hoc Task', 'create-ad-hoc-task', 'operations', 'manager', 'mobile', 'P1', 'idea',
  ARRAY['write', 'real-time', 'push-notification'],
  'Feed "+" or Session Board',
  'create → employee sees → push → completion tracked',
  'Lag en oppgave på stedet');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-022' AND workspace_id = ws_id), ws_id, 1,
   'Create Task', 'Quick-create → Assign → Push sent → Track completion', 'Task created, assigned employee notified',
   '/feed', 'QuickTaskCreate', ARRAY['profile', 'department_session']::text[], ARRAY['department_session']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-023', 'Record Handoff', 'record-handoff', 'operations', 'employee', 'mobile', 'P1', 'idea',
  ARRAY['write', 'ai-assisted'],
  'Shift ending → Handoff prompt',
  'handoff → record → submit → visible in next Day Brief',
  'Overlever til neste skift');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-023' AND workspace_id = ws_id), ws_id, 1,
   'Record Handoff', 'Choose method (text/voice/AI) → Record notes → AI extracts → Submit → Next shift sees in brief', 'Handoff recorded and visible in next brief',
   '/feed/handoff', 'HandoffRecorder', ARRAY['department_session']::text[], ARRAY['department_session']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-024', 'Punch Out & See Summary', 'punch-out-see-summary', 'operations', 'employee', 'mobile', 'P0', 'idea',
  ARRAY['write', 'gamification'],
  'End of shift',
  'punch out → hours calculated → summary → overtime detected',
  'Avslutt skiftet ditt');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-024' AND workspace_id = ws_id), ws_id, 1,
   'Punch Out', 'Complete remaining tasks → Punch out → Summary (hours, tasks, points) → Overtime flagged', 'Punched out, summary displayed',
   '/home', 'PunchOutSummary', ARRAY['punch_record', 'department_session']::text[], ARRAY['punch_record']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-025', 'Sign Off Department Session', 'sign-off-department-session', 'operations', 'manager', 'desktop', 'P1', 'idea',
  ARRAY['write', 'audit-trail'],
  'End of day → Session Board',
  'session board → review → sign off → status = closed',
  'Lukk dagens drift');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-025' AND workspace_id = ws_id), ws_id, 1,
   'Sign Off Session', 'Review completion rates → Check HACCP → Review handoffs → Sign off → Day closed', 'Session signed off and closed',
   '/admin/operations/session', 'SessionBoard', ARRAY['department_session']::text[], ARRAY['department_session']::text[], NULL);

-- ─────────────────────────────────────────────────────────────────
-- HACCP (4 journeys: J-026 to J-029)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-026', 'Log Temperature Reading', 'log-temperature-reading', 'haccp', 'employee', 'mobile', 'P0', 'idea',
  ARRAY['write', 'compliance', 'audit-trail'],
  'Feed task: Temperaturkontroll',
  'HACCP task → readings → in-range green → out-of-range deviation → audit saved',
  'Daglig temperaturlogging');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-026' AND workspace_id = ws_id), ws_id, 1,
   'Log Temperature', 'Open task → See assets with limits → Enter readings → Auto-validate → Submit → Audit trail', 'Readings logged with audit trail',
   '/feed/haccp/temperature', 'TemperatureLogger', ARRAY['haccp_log']::text[], ARRAY['haccp_log']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-027', 'Handle Deviation', 'handle-deviation', 'haccp', 'employee', 'mobile', 'P0', 'idea',
  ARRAY['write', 'compliance', 'audit-trail'],
  'Temperature out of range / hygiene fail',
  'deviation → runbook → corrective action → documented → resolution',
  'Når noe er utenfor grenseverdiene');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-027' AND workspace_id = ws_id), ws_id, 1,
   'Handle Deviation', 'Auto-flagged → Runbook triggered → Follow corrective steps → Document (text+photo) → Escalate if needed → Manager reviews', 'Deviation handled and documented',
   '/feed/haccp/deviation', 'DeviationHandler', ARRAY['haccp_log']::text[], ARRAY['haccp_log']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-028', 'Complete Hygiene Checklist', 'complete-hygiene-checklist', 'haccp', 'employee', 'mobile', 'P0', 'idea',
  ARRAY['write', 'compliance', 'audit-trail'],
  'Session hook at open/close',
  'checklist opens → items checked → photo attached → submitted → audit',
  'Hygienekontroll');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-028' AND workspace_id = ws_id), ws_id, 1,
   'Complete Checklist', 'Open checklist → Check each item → Photo evidence if required → Flag issues → Submit → Audit trail', 'Checklist completed with audit trail',
   '/feed/haccp/checklist', 'HygieneChecklist', ARRAY['haccp_log']::text[], ARRAY['haccp_log']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-029', 'Export HACCP Compliance Report', 'export-haccp-compliance-report', 'haccp', 'admin', 'desktop', 'P1', 'idea',
  ARRAY['read-only', 'export', 'compliance'],
  'Reports → HACCP or Mattilsynet inspection',
  'HACCP report → filter → all records → export PDF valid',
  'Forbered deg til Mattilsynet');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-029' AND workspace_id = ws_id), ws_id, 1,
   'Export Report', 'Select date range → See readings, deviations, corrective actions → Full audit trail → Export PDF', 'Report exported as PDF',
   '/admin/reports/haccp', 'HACCPReport', ARRAY['haccp_log']::text[], ARRAY[]::text[], NULL);

-- ─────────────────────────────────────────────────────────────────
-- TRAINING (5 journeys: J-030 to J-034)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-030', 'Complete Training Protocol', 'complete-training-protocol', 'training', 'employee', 'both', 'P0', 'idea',
  ARRAY['write', 'gamification'],
  'Assigned training or Me → Opplæring',
  'training → steps → test → pass → readiness increases → certificate',
  'Fullfør opplæringen din');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-030' AND workspace_id = ws_id), ws_id, 1,
   'Complete Training', 'See protocols → Open → Procedure steps with media → Knowledge test → Pass → Readiness updated → Points', 'Training completed, readiness updated',
   '/training', 'TrainingHub', ARRAY['protocol', 'protocol_assignment']::text[], ARRAY['protocol_assignment']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-031', 'Sign Confirmation / Contract', 'sign-confirmation-contract', 'training', 'employee', 'both', 'P0', 'idea',
  ARRAY['write', 'docuseal', 'compliance'],
  'Notification: new document',
  'assigned → opened → signed → readiness updated',
  'Signer dokumenter digitalt');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-031' AND workspace_id = ws_id), ws_id, 1,
   'Sign Document', 'Open → Read → Digital signature (DocuSeal) → Confirmation recorded → Readiness updated', 'Document signed, readiness updated',
   '/training/sign', 'DocumentSigner', ARRAY['protocol_assignment']::text[], ARRAY['protocol_assignment']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-032', 'Take Knowledge Test', 'take-knowledge-test', 'training', 'employee', 'both', 'P0', 'idea',
  ARRAY['write', 'gamification'],
  'End of training procedure or refresher due',
  'open test → answer → submit → score shown → pass updates readiness',
  'Kunnskapstest');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-032' AND workspace_id = ws_id), ws_id, 1,
   'Take Test', 'Open test → Multiple choice / true-false → Submit → See score → Pass/fail → Retry if failed', 'Test completed, score shown',
   '/training/test', 'KnowledgeTest', ARRAY['knowledge_test']::text[], ARRAY['knowledge_test']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-033', 'Check Readiness Dashboard (Admin)', 'check-readiness-dashboard-admin', 'training', 'admin', 'desktop', 'P0', 'idea',
  ARRAY['read-only'],
  'People → Employee profile or Training Hub',
  'profile → readiness score → breakdown matches → can assign',
  'Sjekk om teamet ditt er klart');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-033' AND workspace_id = ws_id), ws_id, 1,
   'Check Readiness', 'See readiness score (0-100%) → Breakdown per policy → Overdue deadlines → Assign additional training', 'Readiness dashboard with accurate data',
   '/admin/training', 'ReadinessDashboard', ARRAY['profile', 'protocol_assignment']::text[], ARRAY['protocol_assignment']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-034', 'Cross-Training Request', 'cross-training-request', 'training', 'employee', 'desktop', 'P2', 'idea',
  ARRAY['write', 'gamification'],
  'Me → Utvikling → "Lær noe nytt"',
  'browse → select → request → approved → assigned',
  'Utvid kompetansen din');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-034' AND workspace_id = ws_id), ws_id, 1,
   'Request Cross-Training', 'Browse available cross-training → Select → Request → Manager approves → Training assigned', 'Cross-training requested and assigned',
   '/me/development', 'CrossTrainingBrowser', ARRAY['protocol']::text[], ARRAY['protocol_assignment']::text[], NULL);

-- ─────────────────────────────────────────────────────────────────
-- ABSENCE (3 journeys: J-035 to J-037)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-035', 'Report Sick (Egenmelding)', 'report-sick-egenmelding', 'absence', 'employee', 'mobile', 'P0', 'idea',
  ARRAY['write', 'push-notification', 'norwegian-law'],
  'Wake up sick → Open app',
  'report sick → saved → manager notified → shifts flagged for replacement',
  'Meld deg syk');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-035' AND workspace_id = ws_id), ws_id, 1,
   'Report Sick', 'Tap "Meld fravær" → Select: egenmelding → Select dates → Submit → Manager notified → Shifts flagged', 'Sick report saved, manager notified',
   '/absence/report', 'SickReportForm', ARRAY['schedule_shift']::text[], ARRAY['schedule_shift']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-036', 'Request Vacation', 'request-vacation', 'absence', 'employee', 'both', 'P1', 'idea',
  ARRAY['write', 'approval-flow', 'norwegian-law'],
  'Vakter → Be om ferie',
  'request → balance checked → submitted → approved → calendar updated',
  'Søk om ferie');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-036' AND workspace_id = ws_id), ws_id, 1,
   'Request Vacation', 'Select dates → See remaining vacation days → Submit request → Manager approves/rejects → Calendar updated', 'Vacation requested and processed',
   '/absence/vacation', 'VacationRequestForm', ARRAY['schedule_shift']::text[], ARRAY['schedule_shift']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-037', 'View Absence Balance', 'view-absence-balance', 'absence', 'employee', 'both', 'P1', 'idea',
  ARRAY['read-only'],
  'Me → Fravær',
  'absence view → balances correct → history listed',
  'Se fraværsoversikten din');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-037' AND workspace_id = ws_id), ws_id, 1,
   'View Balance', 'See: vacation days remaining, sick leave used (egenmelding count), other leave → History list', 'Balances and history displayed',
   '/me/absence', 'AbsenceBalance', ARRAY['schedule_shift']::text[], ARRAY[]::text[], NULL);

-- ─────────────────────────────────────────────────────────────────
-- PAYROLL (3 journeys: J-038 to J-040)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-038', 'View My Salary', 'view-my-salary', 'payroll', 'employee', 'both', 'P1', 'idea',
  ARRAY['read-only'],
  'Me → Lønn',
  'salary → hours match punches → supplements calculated → history',
  'Se lønnen din');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-038' AND workspace_id = ws_id), ws_id, 1,
   'View Salary', 'Current period hours → Breakdown (regular, overtime, supplements) → Tips → Historical payslips', 'Salary data displayed correctly',
   '/me/salary', 'SalaryView', ARRAY['punch_record', 'schedule_shift']::text[], ARRAY[]::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-039', 'Run Payroll Period', 'run-payroll-period', 'payroll', 'admin', 'desktop', 'P1', 'idea',
  ARRAY['write', 'norwegian-law', 'export'],
  'Payroll → Kjør lønnsperiode',
  'run → calculations correct → anomalies flagged → export valid',
  'Kjør lønnsberegning');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-039' AND workspace_id = ws_id), ws_id, 1,
   'Run Payroll', 'Select period → Auto-calculate → Review (hours, overtime 40%/50%, supplements) → Flag anomalies → Approve → Export', 'Payroll calculated and exported',
   '/admin/payroll', 'PayrollRunner', ARRAY['punch_record', 'schedule_shift', 'profile']::text[], ARRAY[]::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-040', 'Review Wage Cost Report', 'review-wage-cost-report', 'payroll', 'admin', 'desktop', 'P2', 'idea',
  ARRAY['read-only', 'export'],
  'Reports → Lønnskostnad',
  'report → per department → budget comparison → export',
  'Lønnskostnadsrapport');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-040' AND workspace_id = ws_id), ws_id, 1,
   'Review Report', 'See wage cost per department → Per day/week/month → Budget vs actual → Overtime analysis → Export', 'Wage cost report displayed and exportable',
   '/admin/reports/wages', 'WageCostReport', ARRAY['punch_record', 'schedule_shift', 'department']::text[], ARRAY[]::text[], NULL);

-- ─────────────────────────────────────────────────────────────────
-- COMMUNICATION (4 journeys: J-041 to J-044)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-041', 'Receive & Act on Push Notification', 'receive-act-on-push-notification', 'communication', 'employee', 'mobile', 'P0', 'idea',
  ARRAY['push-notification'],
  'Push notification arrives',
  'trigger → push → tap → correct screen → action possible',
  'Forstå varslene dine');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-041' AND workspace_id = ws_id), ws_id, 1,
   'Act on Notification', 'See notification → Tap → Deep link to correct screen → Act on content → Mark as read', 'Notification handled, correct screen loaded',
   NULL, 'NotificationHandler', ARRAY[]::text[], ARRAY[]::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-042', 'Team Chat During Shift', 'team-chat-during-shift', 'communication', 'employee', 'mobile', 'P1', 'idea',
  ARRAY['write', 'real-time'],
  'Chat tab → Team channel',
  'send → received real-time → read receipt',
  'Chat med teamet');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-042' AND workspace_id = ws_id), ws_id, 1,
   'Team Chat', 'Open channel → Send message (text/photo) → Real-time delivery → Read receipts', 'Message sent and received in real-time',
   '/chat', 'TeamChat', ARRAY[]::text[], ARRAY[]::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-043', 'Send Workspace Announcement', 'send-workspace-announcement', 'communication', 'admin', 'desktop', 'P1', 'idea',
  ARRAY['write', 'push-notification'],
  'Communication → Ny kunngjøring',
  'create → target → send → received → read tracking',
  'Send en kunngjøring');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-043' AND workspace_id = ws_id), ws_id, 1,
   'Send Announcement', 'Write content → Target (all/dept/team) → Choose channels → Schedule or send → Track read receipts', 'Announcement sent, read tracking active',
   '/admin/communication/announce', 'AnnouncementEditor', ARRAY['department', 'team']::text[], ARRAY[]::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-044', 'Configure Notification Preferences', 'configure-notification-preferences', 'communication', 'employee', 'both', 'P2', 'idea',
  ARRAY['write'],
  'Me → Innstillinger → Varsler',
  'open prefs → change → save → next notification uses new preference',
  'Tilpass varslene dine');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-044' AND workspace_id = ws_id), ws_id, 1,
   'Configure Preferences', 'See channel preferences per notification type → Toggle push/SMS/email → Set quiet hours → Save', 'Preferences saved',
   '/me/settings/notifications', 'NotificationPreferences', ARRAY[]::text[], ARRAY[]::text[], NULL);

-- ─────────────────────────────────────────────────────────────────
-- REPORTS (4 journeys: J-045 to J-048)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-045', 'View Admin Dashboard', 'view-admin-dashboard', 'reports', 'admin', 'desktop', 'P0', 'idea',
  ARRAY['read-only'],
  'Login → Dashboard',
  'dashboard → KPIs correct → drill down works',
  'Dashboardet ditt');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-045' AND workspace_id = ws_id), ws_id, 1,
   'View Dashboard', 'See KPIs → Staff on shift → Task progress → Deviations → Alerts → Drill down', 'Dashboard KPIs displayed correctly',
   '/admin/dashboard', 'AdminDashboard', ARRAY['department_session', 'profile', 'schedule_shift']::text[], ARRAY[]::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-046', 'View Employee Dashboard', 'view-employee-dashboard', 'reports', 'employee', 'desktop', 'P1', 'idea',
  ARRAY['read-only'],
  'Desktop login (employee mode)',
  'employee dashboard → all personal data correct',
  'Din personlige oversikt');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-046' AND workspace_id = ws_id), ws_id, 1,
   'View Employee Dashboard', 'My shifts → My tasks → Training progress → Readiness score → Points → Messages', 'All personal data displayed correctly',
   '/dashboard', 'EmployeeDashboard', ARRAY['schedule_shift', 'protocol_assignment', 'profile']::text[], ARRAY[]::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-047', 'Generate Operations Report', 'generate-operations-report', 'reports', 'admin', 'desktop', 'P1', 'idea',
  ARRAY['read-only', 'export'],
  'Reports → Drift',
  'report → filter → data correct → export',
  'Driftsrapport');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-047' AND workspace_id = ws_id), ws_id, 1,
   'Generate Report', 'Select period → Task completion rates → Session sign-offs → Deviation history → Export', 'Operations report generated and exportable',
   '/admin/reports/operations', 'OperationsReport', ARRAY['department_session']::text[], ARRAY[]::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-048', 'Generate HR Report', 'generate-hr-report', 'reports', 'admin', 'desktop', 'P2', 'idea',
  ARRAY['read-only', 'export'],
  'Reports → HR',
  'HR report → turnover correct → absence stats → export',
  'HR-rapport');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-048' AND workspace_id = ws_id), ws_id, 1,
   'Generate HR Report', 'Turnover analysis → Absence stats → Competence matrix → Onboarding progress → Export', 'HR report generated and exportable',
   '/admin/reports/hr', 'HRReport', ARRAY['profile', 'protocol_assignment']::text[], ARRAY[]::text[], NULL);

-- ─────────────────────────────────────────────────────────────────
-- SETTINGS (3 journeys: J-049 to J-051)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-049', 'Configure Workspace Settings', 'configure-workspace-settings', 'settings', 'admin', 'desktop', 'P0', 'idea',
  ARRAY['write'],
  'Settings → Arbeidsområde',
  'settings → change → save → reflected across workspace',
  'Konfigurer arbeidsområdet');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-049' AND workspace_id = ws_id), ws_id, 1,
   'Configure Settings', 'Branding (name, logo) → Timezone/locale → Module activation → Default policies → Save', 'Settings saved and reflected',
   '/admin/settings', 'WorkspaceSettings', ARRAY['workspace']::text[], ARRAY['workspace']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-050', 'Manage Billing & Subscription', 'manage-billing-subscription', 'settings', 'owner', 'desktop', 'P0', 'idea',
  ARRAY['write', 'stripe'],
  'Settings → Fakturering',
  'billing → plan correct → upgrade → Stripe reflects',
  'Administrer abonnementet');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-050' AND workspace_id = ws_id), ws_id, 1,
   'Manage Billing', 'See current plan → Employee count vs limit → Upgrade/downgrade → Payment method → Invoices', 'Billing managed, Stripe synced',
   '/admin/settings/billing', 'BillingManager', ARRAY['company']::text[], ARRAY['company']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-051', 'GDPR Data Export', 'gdpr-data-export', 'settings', 'admin', 'desktop', 'P1', 'idea',
  ARRAY['read-only', 'compliance', 'export'],
  'Settings → Data → GDPR Export or employee self-service',
  'export → all PII included → download works',
  'Eksporter persondata (GDPR)');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-051' AND workspace_id = ws_id), ws_id, 1,
   'GDPR Export', 'Select user → Generate export → Download all personal data → Format: JSON + PDF', 'All PII exported and downloadable',
   '/admin/settings/data', 'GDPRExport', ARRAY['profile', 'user_identity']::text[], ARRAY[]::text[], NULL);

-- ─────────────────────────────────────────────────────────────────
-- AI / MR. BOTSSON (3 journeys: J-052 to J-054)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-052', 'Chat with Mr. Botsson', 'chat-with-mr-botsson', 'ai', 'all', 'both', 'P0', 'idea',
  ARRAY['ai-assisted', 'real-time'],
  'Tap AI FAB (mobile) or sidebar (desktop)',
  'open chat → send message → contextual response → suggestions shown',
  'Snakk med Mr. Botsson');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-052' AND workspace_id = ws_id), ws_id, 1,
   'Chat with AI', 'Open chat overlay → Ask question → AI responds with context → Suggested actions → Tool calling if needed', 'Contextual AI response displayed',
   NULL, 'BotssonChat', ARRAY[]::text[], ARRAY[]::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-053', 'Voice Conversation with Mr. Botsson', 'voice-conversation-with-mr-botsson', 'ai', 'all', 'mobile', 'P1', 'idea',
  ARRAY['ai-assisted', 'real-time'],
  'Long-press AI FAB',
  'long press → voice active → speech recognized → response → end',
  'Snakk med stemmen');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-053' AND workspace_id = ws_id), ws_id, 1,
   'Voice Chat', 'Voice activated → Speak naturally → AI responds in Norwegian → Conversation continues → End by tap', 'Voice conversation completed',
   NULL, 'BotssonVoice', ARRAY[]::text[], ARRAY[]::text[], 'Uses Ultravox for voice');

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-054', 'AI-Assisted Procedure Help', 'ai-assisted-procedure-help', 'ai', 'employee', 'mobile', 'P1', 'idea',
  ARRAY['ai-assisted'],
  'During task → "Trenger hjelp" button',
  'help → AI knows context → explains → return to task',
  'Få hjelp med en oppgave');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-054' AND workspace_id = ws_id), ws_id, 1,
   'Get AI Help', 'Open AI in task context → AI knows which procedure/step → Explains in simple terms → Can demonstrate → Back to task', 'AI explains in context, return to task',
   '/feed/task', 'BotssonHelp', ARRAY['protocol']::text[], ARRAY[]::text[], NULL);

-- ─────────────────────────────────────────────────────────────────
-- SEASON & GAMIFICATION (3 journeys: J-055 to J-057)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-055', 'Set Up Season', 'set-up-season', 'season', 'admin', 'desktop', 'P1', 'idea',
  ARRAY['write', 'season-aware', 'gamification'],
  'Season Manager → Opprett',
  'create → configure → activate → season-aware entities reflect',
  'Sett opp en sesong');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-055' AND workspace_id = ws_id), ws_id, 1,
   'Set Up Season', 'Name → Configure (departments, zones, teams) → Season-specific policies → Gamification settings (points, boosters) → Review → Activate', 'Season created and activated',
   '/admin/seasons/new', 'SeasonSetup', ARRAY['department', 'team']::text[], ARRAY['season']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-056', 'Check Leaderboard & Points', 'check-leaderboard-points', 'season', 'employee', 'both', 'P2', 'idea',
  ARRAY['read-only', 'gamification'],
  'Me → Poeng',
  'leaderboard → points match → rankings calculated',
  'Dine poeng og prestasjoner');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-056' AND workspace_id = ws_id), ws_id, 1,
   'Check Leaderboard', 'Personal total → Breakdown (tasks, training, HACCP, on-time) → Team ranking → Department → Achievements', 'Points and rankings displayed',
   '/me/points', 'Leaderboard', ARRAY['profile', 'season']::text[], ARRAY[]::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-057', 'Configure Gamification Settings', 'configure-gamification-settings', 'season', 'admin', 'desktop', 'P2', 'idea',
  ARRAY['write', 'gamification', 'season-aware'],
  'Season Manager → Gamification',
  'configure → save → point awards match settings',
  'Tilpass gamification');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-057' AND workspace_id = ws_id), ws_id, 1,
   'Configure Gamification', 'Set point rates per action → Configure boosters/penalties → Leaderboard scope → Visibility mode → Save', 'Gamification settings saved',
   '/admin/seasons/gamification', 'GamificationSettings', ARRAY['season']::text[], ARRAY['season']::text[], NULL);

-- ─────────────────────────────────────────────────────────────────
-- GOVERNANCE (2 journeys: J-058 to J-059)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-058', 'Create Policy & Protocol', 'create-policy-protocol', 'governance', 'admin', 'desktop', 'P0', 'idea',
  ARRAY['write', 'ai-assisted'],
  'Governance Studio',
  'policy → protocol → procedure + test → assign → visible in training',
  'Lag regler teamet ditt kan følge');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-058' AND workspace_id = ws_id), ws_id, 1,
   'Create Policy & Protocol', 'Create Policy (name, scope, category) → Attach Protocol → Build Procedure (steps+media) → Add Knowledge Test → Add Confirmation (DocuSeal) → Assign → Publish', 'Policy chain created and published',
   '/admin/governance/studio', 'GovernanceStudio', ARRAY[]::text[], ARRAY['policy', 'protocol']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-059', 'AI-Assisted Governance', 'ai-assisted-governance', 'governance', 'admin', 'desktop', 'P1', 'idea',
  ARRAY['write', 'ai-assisted'],
  'Governance Studio → "La AI hjelpe"',
  'describe rule → AI generates → review → publish → complete chain',
  'La AI bygge reglene for deg');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-059' AND workspace_id = ws_id), ws_id, 1,
   'AI-Assisted Creation', 'Describe the rule in plain Norwegian → AI suggests policy structure → AI generates procedure steps → AI creates test questions → Admin reviews → Publish', 'AI-generated policy chain published',
   '/admin/governance/studio', 'AIGovernanceWizard', ARRAY[]::text[], ARRAY['policy', 'protocol']::text[], NULL);

-- ─────────────────────────────────────────────────────────────────
-- CONTRACTS (3 journeys: J-060 to J-062)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-060', 'Create Employment Contract', 'create-employment-contract', 'contracts', 'admin', 'desktop', 'P1', 'idea',
  ARRAY['write', 'docuseal', 'compliance', 'norwegian-law'],
  'People → Employee → Ny kontrakt',
  'template → fill → preview → send → DocuSeal initiated',
  'Opprett en arbeidsavtale');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-060' AND workspace_id = ws_id), ws_id, 1,
   'Create Contract', 'Select template → Fill details (position, salary, hours, start date) → Merge fields auto-populated → Preview → Send for signing via DocuSeal', 'Contract created and sent for signing',
   '/admin/people/:id/contract/new', 'ContractBuilder', ARRAY['profile', 'employment_contract']::text[], ARRAY['employment_contract']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-061', 'Sign Employment Contract', 'sign-employment-contract', 'contracts', 'employee', 'both', 'P1', 'idea',
  ARRAY['write', 'docuseal', 'compliance'],
  'Notification: "Ny kontrakt å signere"',
  'open → read → sign → status = active → profile updated',
  'Signer arbeidsavtalen din');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-061' AND workspace_id = ws_id), ws_id, 1,
   'Sign Contract', 'Open → Read contract → Digital signature via DocuSeal → Both parties signed → Contract active → Profile synced', 'Contract signed and profile updated',
   '/contracts/:id/sign', 'ContractSigner', ARRAY['employment_contract']::text[], ARRAY['employment_contract', 'profile']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-062', 'Amend Contract', 'amend-contract', 'contracts', 'admin', 'desktop', 'P2', 'idea',
  ARRAY['write', 'docuseal', 'compliance'],
  'People → Employee → Kontrakt → Endre',
  'amend → new doc → sign → profile reflects changes',
  'Endre en arbeidsavtale');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-062' AND workspace_id = ws_id), ws_id, 1,
   'Amend Contract', 'Select amendment type (salary, role, hours) → Enter changes → Create amendment document → Send for signing → Profile auto-updates', 'Amendment created and sent for signing',
   '/admin/people/:id/contract/amend', 'ContractAmendment', ARRAY['employment_contract', 'profile']::text[], ARRAY['employment_contract', 'profile']::text[], NULL);

-- ─────────────────────────────────────────────────────────────────
-- CERTIFICATIONS (2 journeys: J-063 to J-064)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-063', 'Upload / Register Certification', 'upload-register-certification', 'certifications', 'employee', 'both', 'P1', 'idea',
  ARRAY['write', 'compliance'],
  'Me → Sertifikater → Legg til or Admin uploads',
  'upload → details → submit → visible → expiry tracking active',
  'Registrer sertifikatene dine');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-063' AND workspace_id = ws_id), ws_id, 1,
   'Upload Certification', 'Select type (food safety, first aid, alcohol, etc.) → Upload document → Enter details (issuer, date, expiry) → Submit → Verified by manager', 'Certification uploaded and tracking active',
   '/me/certifications/add', 'CertificationUpload', ARRAY[]::text[], ARRAY[]::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-064', 'Certification Expiry Alert & Renewal', 'certification-expiry-alert-renewal', 'certifications', 'employee', 'both', 'P1', 'idea',
  ARRAY['push-notification', 'compliance'],
  'Auto: 90/30/7 days before expiry',
  'expiry approaching → notification → renewal uploaded → status updated',
  'Forny sertifikatene dine');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-064' AND workspace_id = ws_id), ws_id, 1,
   'Renew Certification', 'Notification: "Sertifikat utløper snart" → View details → Upload renewal → Or: schedule re-certification → Manager notified', 'Certification renewed or re-certification scheduled',
   '/me/certifications/:id', 'CertificationRenewal', ARRAY[]::text[], ARRAY[]::text[], NULL);

-- ─────────────────────────────────────────────────────────────────
-- JOURNEY PORTAL — META (4 journeys: J-065 to J-068)
-- ─────────────────────────────────────────────────────────────────

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-065', 'Browse & Filter Journeys', 'browse-filter-journeys', 'meta', 'admin', 'desktop', 'P0', 'idea',
  ARRAY['read-only'],
  'Admin → /admin/journeys',
  'open portal → pipeline visible → filter works → detail loads → outputs shown',
  'Bruk Journey-portalen');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-065' AND workspace_id = ws_id), ws_id, 1,
   'Pipeline Overview', 'See pipeline overview (status counts with progress bars)', 'Pipeline statistics displayed',
   '/admin/journeys', 'JourneyPipeline', ARRAY['journey']::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-065' AND workspace_id = ws_id), ws_id, 2,
   'Filter Journeys', 'Filter by: module, status, actor, priority, search', 'Filtered results displayed',
   '/admin/journeys', 'JourneyFilters', ARRAY['journey']::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-065' AND workspace_id = ws_id), ws_id, 3,
   'Sort Journeys', 'Sort by: created, updated, priority, status', 'Sorted results displayed',
   '/admin/journeys', 'JourneySort', ARRAY['journey']::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-065' AND workspace_id = ws_id), ws_id, 4,
   'View Detail', 'Click journey → Detail view with all tabs', 'Journey detail loaded',
   '/admin/journeys/:id', 'JourneyDetail', ARRAY['journey', 'journey_step']::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-065' AND workspace_id = ws_id), ws_id, 5,
   'View Outputs', 'See outputs: which are generated, which are pending', 'Output status displayed',
   '/admin/journeys/:id', 'JourneyOutputs', ARRAY['journey']::text[], ARRAY[]::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-066', 'Create Journey via Agent Wizard', 'create-journey-via-agent-wizard', 'meta', 'admin', 'desktop', 'P0', 'idea',
  ARRAY['write', 'ai-assisted'],
  'Journey Portal → "Ny Journey" → "Start Wizard"',
  'start wizard → complete all phases → journey created → status = defined',
  'Definer en ny journey med AI-hjelp');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-066' AND workspace_id = ws_id), ws_id, 1,
   'Start Wizard', 'Journey Agent opens wizard chat', 'Wizard chat opened',
   '/admin/journeys/new', 'JourneyWizard', ARRAY[]::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-066' AND workspace_id = ws_id), ws_id, 2,
   'Phase 1 - Discovery', 'Agent asks what, who, when, why', 'Goal and context captured',
   '/admin/journeys/new', 'WizardDiscovery', ARRAY[]::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-066' AND workspace_id = ws_id), ws_id, 3,
   'Phase 2 - Classification', 'Agent suggests module, actor, platform, tags', 'Classification confirmed',
   '/admin/journeys/new', 'WizardClassification', ARRAY['journey']::text[], ARRAY[]::text[], 'Checks for duplicates'),
  ((SELECT journey_id FROM journey WHERE code = 'J-066' AND workspace_id = ws_id), ws_id, 4,
   'Phase 3 - Steps', 'Agent helps define step-by-step flow', 'Steps defined',
   '/admin/journeys/new', 'WizardSteps', ARRAY[]::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-066' AND workspace_id = ws_id), ws_id, 5,
   'Phase 4 - Testing', 'Agent generates test assertion', 'Test assertion created',
   '/admin/journeys/new', 'WizardTesting', ARRAY[]::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-066' AND workspace_id = ws_id), ws_id, 6,
   'Phase 5 - Documentation', 'Agent generates Norwegian doc + Botsson script', 'Documentation generated',
   '/admin/journeys/new', 'WizardDocumentation', ARRAY[]::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-066' AND workspace_id = ws_id), ws_id, 7,
   'Phase 6 - Review', 'Full summary → Confirm → Journey saved as "Defined"', 'Journey created with status defined',
   '/admin/journeys/new', 'WizardReview', ARRAY[]::text[], ARRAY['journey', 'journey_step']::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-067', 'Run E2E Tests from Portal', 'run-e2e-tests-from-portal', 'meta', 'admin', 'desktop', 'P1', 'idea',
  ARRAY['read-only'],
  'Journey Portal → Journey detail → "Kjør test" or "Kjør alle tester"',
  'run test → indicator → result → history updated',
  'Kjør automatiske tester');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-067' AND workspace_id = ws_id), ws_id, 1,
   'Trigger Test', 'Click "Kjør test" on single journey OR "Kjør alle" for Live/Testing journeys', 'Test triggered',
   '/admin/journeys/:id', 'TestTrigger', ARRAY['journey']::text[], ARRAY['journey_test_run']::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-067' AND workspace_id = ws_id), ws_id, 2,
   'View Progress', 'See running indicator', 'Running indicator displayed',
   '/admin/journeys/:id', 'TestProgress', ARRAY['journey_test_run']::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-067' AND workspace_id = ws_id), ws_id, 3,
   'View Results', 'Results: pass/fail per journey with timestamp', 'Test results displayed',
   '/admin/journeys/:id', 'TestResults', ARRAY['journey_test_run']::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-067' AND workspace_id = ws_id), ws_id, 4,
   'View Error Details', 'Failed tests link to error details', 'Error details accessible',
   '/admin/journeys/:id/tests', 'TestErrorDetails', ARRAY['journey_test_run']::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-067' AND workspace_id = ws_id), ws_id, 5,
   'View History', 'History of test runs over time', 'Test history displayed',
   '/admin/journeys/:id/tests', 'TestHistory', ARRAY['journey_test_run']::text[], ARRAY[]::text[], NULL);

INSERT INTO journey (workspace_id, code, title, slug, module, actor, platform, priority, status, tags, trigger_description, test_assertion, doc_title)
VALUES (ws_id, 'J-068', 'Move Journey Through Lifecycle', 'move-journey-through-lifecycle', 'meta', 'admin', 'desktop', 'P0', 'idea',
  ARRAY['write'],
  'Journey detail → Status dropdown',
  'change status → valid transition → Linear offered → outputs generated → event logged',
  'Flytt en journey gjennom livssyklusen');

INSERT INTO journey_step (journey_id, workspace_id, step_order, title, action, expects, screen, component, data_reads, data_writes, notes)
VALUES
  ((SELECT journey_id FROM journey WHERE code = 'J-068' AND workspace_id = ws_id), ws_id, 1,
   'View Transitions', 'See current status and allowed transitions', 'Allowed transitions displayed',
   '/admin/journeys/:id', 'StatusTransition', ARRAY['journey']::text[], ARRAY[]::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-068' AND workspace_id = ws_id), ws_id, 2,
   'Change Status', 'Select new status → System validates transition rules', 'Status changed if valid',
   '/admin/journeys/:id', 'StatusTransition', ARRAY['journey']::text[], ARRAY['journey', 'journey_event']::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-068' AND workspace_id = ws_id), ws_id, 3,
   'Linear Integration', 'If moving to "Ready for Implementation" → Offer to create Linear issue', 'Linear issue created if accepted',
   '/admin/journeys/:id', 'LinearIntegration', ARRAY['journey']::text[], ARRAY['journey']::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-068' AND workspace_id = ws_id), ws_id, 4,
   'Auto-Generate Outputs', 'If moving to "Active" → All outputs auto-generated', 'Outputs generated',
   '/admin/journeys/:id', 'OutputGenerator', ARRAY['journey']::text[], ARRAY['journey']::text[], NULL),
  ((SELECT journey_id FROM journey WHERE code = 'J-068' AND workspace_id = ws_id), ws_id, 5,
   'Event Logging', 'Status change logged in journey event history', 'Event logged',
   '/admin/journeys/:id', 'EventLog', ARRAY['journey_event']::text[], ARRAY['journey_event']::text[], NULL);

END $$;

-- ─────────────────────────────────────────────────────────────────
-- Verification: Count should be exactly 68
-- SELECT count(*) FROM journey WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';
-- Expected: 68
-- ─────────────────────────────────────────────────────────────────

-- ============================================================================
-- 10. Operational Seed Data — Schedule, Season, Operations, Reconciliation
-- ============================================================================
-- UUID reference guide:
--   workspace:  b0000000-0000-0000-0000-000000000000
--   departments: d0...-000 (Operations), d0...-001 (Kitchen), d0...-002 (Service), d0...-003 (Bar)
--   profiles:   f0...-000 (Admin), f0...-001 (Anna/Kitchen), f0...-002 (Erik/Kitchen),
--               f0...-003 (Lise/Service), f0...-004 (Ole/Bar), f0...-005 (Kari/Service),
--               f0...-006 (Jon/Kitchen), f0...-007 (Sara/Service), f0...-008 (Jonas/Kitchen),
--               f0...-009 (Silje/Service)

-- ── 10.1 Teams ──────────────────────────────────────────────────
INSERT INTO public.team (team_id, workspace_id, department_id, name, slug, leader_profile_id, team_type)
VALUES
  ('aa000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000001', 'Kitchen A-Team', 'kitchen-a-team',
   'f0000000-0000-0000-0000-000000000002', 'operational'),
  ('aa000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000002', 'Service Evening', 'service-evening',
   'f0000000-0000-0000-0000-000000000007', 'operational'),
  ('aa000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000003', 'Bar Crew', 'bar-crew',
   NULL, 'operational');

-- ── 10.2 Positions ──────────────────────────────────────────────
INSERT INTO public.position (position_id, workspace_id, department_id, name, slug)
VALUES
  ('ab000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000001', 'Head Chef', 'head-chef'),
  ('ab000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000001', 'Line Cook', 'line-cook'),
  ('ab000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000002', 'Waiter', 'waiter'),
  ('ab000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000003', 'Bartender', 'bartender');

-- ── 10.3 Season (1 active) ─────────────────────────────────────
INSERT INTO public.season (season_id, workspace_id, name, slug, season_type, start_date, end_date, status, is_default, color)
VALUES
  ('ac000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'Vinter 2026', 'vinter-2026', 'default',
   '2026-01-01', '2026-03-31', 'active', true, '#3B82F6');

-- ── 10.4 Season Budget + Factors ────────────────────────────────
INSERT INTO public.season_budget (season_budget_id, season_id, workspace_id, total_target_revenue, base_price_per_guest, season_price_factor, target_labor_percentage, avg_hourly_wage, status, created_by)
VALUES
  ('ad000000-0000-0000-0000-000000000001', 'ac000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000000',
   2500000, 450, 1.0, 0.30, 225, 'active',
   'f0000000-0000-0000-0000-000000000000');

-- Day factors (Mon=0 through Sun=6, restaurant profile)
INSERT INTO public.day_factor (workspace_id, season_budget_id, weekday, factor)
VALUES
  ('b0000000-0000-0000-0000-000000000000', 'ad000000-0000-0000-0000-000000000001', 0, 1.0),
  ('b0000000-0000-0000-0000-000000000000', 'ad000000-0000-0000-0000-000000000001', 1, 1.1),
  ('b0000000-0000-0000-0000-000000000000', 'ad000000-0000-0000-0000-000000000001', 2, 1.2),
  ('b0000000-0000-0000-0000-000000000000', 'ad000000-0000-0000-0000-000000000001', 3, 1.4),
  ('b0000000-0000-0000-0000-000000000000', 'ad000000-0000-0000-0000-000000000001', 4, 2.2),
  ('b0000000-0000-0000-0000-000000000000', 'ad000000-0000-0000-0000-000000000001', 5, 2.5),
  ('b0000000-0000-0000-0000-000000000000', 'ad000000-0000-0000-0000-000000000001', 6, 1.3);

-- Hour factors (lunch + dinner peaks)
INSERT INTO public.hour_factor (workspace_id, season_budget_id, hour, factor)
VALUES
  ('b0000000-0000-0000-0000-000000000000', 'ad000000-0000-0000-0000-000000000001', 10, 0.4),
  ('b0000000-0000-0000-0000-000000000000', 'ad000000-0000-0000-0000-000000000001', 11, 0.7),
  ('b0000000-0000-0000-0000-000000000000', 'ad000000-0000-0000-0000-000000000001', 12, 1.3),
  ('b0000000-0000-0000-0000-000000000000', 'ad000000-0000-0000-0000-000000000001', 13, 1.0),
  ('b0000000-0000-0000-0000-000000000000', 'ad000000-0000-0000-0000-000000000001', 14, 0.8),
  ('b0000000-0000-0000-0000-000000000000', 'ad000000-0000-0000-0000-000000000001', 15, 0.6),
  ('b0000000-0000-0000-0000-000000000000', 'ad000000-0000-0000-0000-000000000001', 16, 0.9),
  ('b0000000-0000-0000-0000-000000000000', 'ad000000-0000-0000-0000-000000000001', 17, 1.5),
  ('b0000000-0000-0000-0000-000000000000', 'ad000000-0000-0000-0000-000000000001', 18, 2.0),
  ('b0000000-0000-0000-0000-000000000000', 'ad000000-0000-0000-0000-000000000001', 19, 2.4),
  ('b0000000-0000-0000-0000-000000000000', 'ad000000-0000-0000-0000-000000000001', 20, 2.2),
  ('b0000000-0000-0000-0000-000000000000', 'ad000000-0000-0000-0000-000000000001', 21, 1.1);

-- ── 10.5 Season Goals (3 goals for Vinter 2026) ──────────────────
INSERT INTO public.season_goal (
  season_goal_id, workspace_id, season_id, title, description,
  metric_key, target_value, target_unit, status, sort_order, created_by
) VALUES
  ('ae000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000001',
   'Lønnskostnad under 30%', 'Hold lønnskostnadene under 30% av omsetning gjennom sesongen.',
   'labor_cost_pct', 30.00, '%', 'active', 0,
   'f0000000-0000-0000-0000-000000000000'),
  ('ae000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000001',
   'Full opplæring innen 14 dager', 'Alle nyansatte skal gjennomføre alle obligatoriske kurs innen 14 dager.',
   'onboarding_completion_days', 14.00, 'dager', 'active', 1,
   'f0000000-0000-0000-0000-000000000000'),
  ('ae000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000001',
   'Omsetning 2.5M NOK', 'Sesongens totale omsetning skal nå 2.5 millioner kroner.',
   'total_revenue', 2500000.00, 'NOK', 'active', 2,
   'f0000000-0000-0000-0000-000000000000');

-- ── 10.7 Operating Hours ────────────────────────────────────────
INSERT INTO public.operating_hours (workspace_id, day_of_week, open_time, close_time, is_closed)
VALUES
  ('b0000000-0000-0000-0000-000000000000', 0, '11:00', '23:00', false),
  ('b0000000-0000-0000-0000-000000000000', 1, '11:00', '23:00', false),
  ('b0000000-0000-0000-0000-000000000000', 2, '11:00', '23:00', false),
  ('b0000000-0000-0000-0000-000000000000', 3, '11:00', '23:30', false),
  ('b0000000-0000-0000-0000-000000000000', 4, '11:00', '01:00', false),
  ('b0000000-0000-0000-0000-000000000000', 5, '12:00', '01:00', false),
  ('b0000000-0000-0000-0000-000000000000', 6, '12:00', '22:00', false);

-- ── 10.6 Workspace KPI Targets ──────────────────────────────────
INSERT INTO public.workspace_kpi_target (workspace_id, metric, target_value, benchmark_value)
VALUES
  ('b0000000-0000-0000-0000-000000000000', 'cost_of_sales', 30, 28),
  ('b0000000-0000-0000-0000-000000000000', 'turnover_90d', 15, 12),
  ('b0000000-0000-0000-0000-000000000000', 'absence_rate', 4, 3.5),
  ('b0000000-0000-0000-0000-000000000000', 'time_to_job_ready', 7, 5),
  ('b0000000-0000-0000-0000-000000000000', 'task_completion', 90, 95),
  ('b0000000-0000-0000-0000-000000000000', 'training_readiness', 100, 100);

-- ── 10.7 Schedule Shifts (this week) ────────────────────────────
-- Uses CURRENT_DATE for relative dates so shifts stay relevant
INSERT INTO public.schedule_shift (
  schedule_shift_id, workspace_id, employee_id, shift_date, role,
  start_time, end_time, work_hours, breaks, day_category, status, is_published
) VALUES
  -- Yesterday: Kitchen (Anna + Erik), Service (Kari), Bar (Ole) — all completed
  ('ae000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', CURRENT_DATE - 1, 'Kokk',
   '10:00', '18:00', 7.5, 30, 'morning', 'completed', true),
  ('ae000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000002', CURRENT_DATE - 1, 'Sous Chef',
   '10:00', '22:00', 11.5, 30, 'morning', 'completed', true),
  ('ae000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000005', CURRENT_DATE - 1, 'Servitor',
   '16:00', '23:00', 6.5, 30, 'evening', 'completed', true),
  ('ae000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000004', CURRENT_DATE - 1, 'Bartender',
   '16:00', '01:00', 8.5, 30, 'evening', 'completed', true),

  -- Today: Kitchen (Anna + Jonas), Service (Kari + Silje), Bar (Ole)
  ('ae000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', CURRENT_DATE, 'Kokk',
   '10:00', '18:00', 7.5, 30, 'morning', 'published', true),
  ('ae000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000008', CURRENT_DATE, 'Kokk',
   '14:00', '22:00', 7.5, 30, 'afternoon', 'published', true),
  ('ae000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000005', CURRENT_DATE, 'Servitor',
   '11:00', '19:00', 7.5, 30, 'midday', 'published', true),
  ('ae000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000009', CURRENT_DATE, 'Servitor',
   '16:00', '23:00', 6.5, 30, 'evening', 'published', true),
  ('ae000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000004', CURRENT_DATE, 'Bartender',
   '16:00', '01:00', 8.5, 30, 'evening', 'published', true),

  -- Tomorrow: Kitchen (Erik), Service (Kari), Bar (Ole) — created but not published
  ('ae000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000002', CURRENT_DATE + 1, 'Sous Chef',
   '10:00', '22:00', 11.5, 30, 'morning', 'created', false),
  ('ae000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000005', CURRENT_DATE + 1, 'Servitor',
   '11:00', '19:00', 7.5, 30, 'midday', 'created', false),
  ('ae000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000004', CURRENT_DATE + 1, 'Bartender',
   '16:00', '01:00', 8.5, 30, 'evening', 'created', false);

-- ── 10.8 Workspace Budget (daily targets, this week) ────────────
INSERT INTO public.workspace_budget (workspace_id, period_type, period_date, revenue_target, labor_cost_target)
VALUES
  ('b0000000-0000-0000-0000-000000000000', 'daily', CURRENT_DATE - 1, 28000, 8400),
  ('b0000000-0000-0000-0000-000000000000', 'daily', CURRENT_DATE,     30000, 9000),
  ('b0000000-0000-0000-0000-000000000000', 'daily', CURRENT_DATE + 1, 32000, 9600);

-- ── 10.9 Department Sessions ────────────────────────────────────
-- Yesterday: Kitchen closed, Service closed
INSERT INTO public.department_session (
  department_session_id, workspace_id, department_id, season_id, session_date,
  status, opened_at, opened_by, closed_at, closed_by,
  planned_shifts, actual_shifts, tasks_total, tasks_completed
) VALUES
  ('af000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000001', 'ac000000-0000-0000-0000-000000000001',
   CURRENT_DATE - 1, 'closed',
   (CURRENT_DATE - 1 + TIME '10:00')::timestamptz, 'f0000000-0000-0000-0000-000000000002',
   (CURRENT_DATE - 1 + TIME '22:30')::timestamptz, 'f0000000-0000-0000-0000-000000000002',
   2, 2, 8, 8),
  ('af000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000002', 'ac000000-0000-0000-0000-000000000001',
   CURRENT_DATE - 1, 'closed',
   (CURRENT_DATE - 1 + TIME '16:00')::timestamptz, 'f0000000-0000-0000-0000-000000000005',
   (CURRENT_DATE - 1 + TIME '23:15')::timestamptz, 'f0000000-0000-0000-0000-000000000005',
   1, 1, 5, 5),
  -- Today: Kitchen active, Service upcoming
  ('af000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000001', 'ac000000-0000-0000-0000-000000000001',
   CURRENT_DATE, 'active',
   (CURRENT_DATE + TIME '10:00')::timestamptz, 'f0000000-0000-0000-0000-000000000001',
   NULL, NULL,
   2, 0, 8, 3),
  ('af000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000002', 'ac000000-0000-0000-0000-000000000001',
   CURRENT_DATE, 'upcoming',
   NULL, NULL, NULL, NULL,
   2, 0, 5, 0);

-- ── 10.10 Daily Reconciliation ──────────────────────────────────
-- Yesterday Kitchen: approved
INSERT INTO public.daily_reconciliation (
  reconciliation_id, workspace_id, department_id, session_id, reconciliation_date,
  status, settled_by, settled_at, approved_by, approved_at, approval_notes,
  revenue_total, revenue_card, revenue_cash, revenue_transactions, revenue_source,
  total_planned_hours, total_actual_hours, total_labor_cost,
  revenue_per_worked_hour, labor_percentage
) VALUES (
  'b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
  'd0000000-0000-0000-0000-000000000001', 'af000000-0000-0000-0000-000000000001',
  CURRENT_DATE - 1, 'approved',
  'f0000000-0000-0000-0000-000000000002', (CURRENT_DATE - 1 + TIME '22:45')::timestamptz,
  'f0000000-0000-0000-0000-000000000000', (CURRENT_DATE + TIME '09:30')::timestamptz,
  'Alt ser bra ut.',
  31250, 26500, 4750, 142, 'ocr',
  19.0, 19.0, 4275,
  1644.74, 13.68
);

-- Yesterday Service: submitted (awaiting admin approval)
INSERT INTO public.daily_reconciliation (
  reconciliation_id, workspace_id, department_id, session_id, reconciliation_date,
  status, settled_by, settled_at,
  revenue_total, revenue_card, revenue_cash, revenue_transactions, revenue_source,
  total_planned_hours, total_actual_hours, total_labor_cost
) VALUES (
  'b1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
  'd0000000-0000-0000-0000-000000000002', 'af000000-0000-0000-0000-000000000002',
  CURRENT_DATE - 1, 'submitted',
  'f0000000-0000-0000-0000-000000000005', (CURRENT_DATE - 1 + TIME '23:20')::timestamptz,
  18750, 16200, 2550, 89, 'ocr',
  6.5, 7.0, 1575
);

-- Today Kitchen: open (accumulating)
INSERT INTO public.daily_reconciliation (
  reconciliation_id, workspace_id, department_id, session_id, reconciliation_date, status
) VALUES (
  'b1000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
  'd0000000-0000-0000-0000-000000000001', 'af000000-0000-0000-0000-000000000003',
  CURRENT_DATE, 'open'
);

-- ── 10.11 Settlement Images ─────────────────────────────────────
-- POS + Terminal images for yesterday's Kitchen reconciliation
INSERT INTO public.settlement_image (image_id, reconciliation_id, workspace_id, source_type, storage_path, ocr_raw_text, ocr_confidence, ocr_processed_at, uploaded_by)
VALUES
  ('b2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000000', 'pos',
   'b0000000-0000-0000-0000-000000000000/settlements/seed/pos-kitchen.jpg',
   'DAGLIG RAPPORT\nTotal: 31 250,00\nKort: 26 500,00\nKontant: 4 750,00\nTransaksjoner: 142',
   0.94, now() - interval '12 hours',
   'f0000000-0000-0000-0000-000000000002'),
  ('b2000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000000', 'terminal',
   'b0000000-0000-0000-0000-000000000000/settlements/seed/terminal-kitchen.jpg',
   'iSettle Settlement\nTotal: 26 480,00\nTransactions: 138',
   0.91, now() - interval '12 hours',
   'f0000000-0000-0000-0000-000000000002');

-- ── 10.12 Settlement Validation ─────────────────────────────────
INSERT INTO public.settlement_validation (reconciliation_id, workspace_id, pos_total, terminal_total, difference, difference_percent, within_threshold)
VALUES
  ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   26500, 26480, 20, 0.08, true);

-- ── 10.13 Shift Approvals (yesterday) ───────────────────────────
INSERT INTO public.shift_approval (
  approval_id, reconciliation_id, shift_id, workspace_id,
  planned_hours, calculated_hours, approved_hours,
  status, approved_by, approved_at
) VALUES
  -- Anna: Kitchen, approved as planned
  ('b3000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001',
   'ae000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   7.5, 7.62, 7.5,
   'approved', 'f0000000-0000-0000-0000-000000000000', (CURRENT_DATE + TIME '09:30')::timestamptz),
  -- Erik: Kitchen (closing), approved with edited overtime
  ('b3000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001',
   'ae000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   11.5, 12.17, 11.5,
   'edited', 'f0000000-0000-0000-0000-000000000000', (CURRENT_DATE + TIME '09:30')::timestamptz),
  -- Kari: Service, pending (not yet approved)
  ('b3000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000002',
   'ae000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   6.5, 6.63, NULL,
   'pending', NULL, NULL);

-- ── 10.14 Deviations ────────────────────────────────────────────
INSERT INTO public.deviation (
  deviation_id, workspace_id, department_id, session_id, reconciliation_id,
  domain, subcategory, severity, title, description,
  status, blocks_day_approval, reported_by
) VALUES
  -- System-detected: settlement mismatch (auto-resolved, within threshold)
  ('b4000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000001', 'af000000-0000-0000-0000-000000000001',
   'b1000000-0000-0000-0000-000000000001',
   'system', 'settlement_mismatch', 'low',
   'POS/Terminal avvik kr 20', 'POS rapporterer 26 500, terminal rapporterer 26 480. Differanse 0.08%.',
   'resolved', false, NULL),
  -- Manual: procedure deviation (open, blocks approval)
  ('b4000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000002', 'af000000-0000-0000-0000-000000000002',
   'b1000000-0000-0000-0000-000000000002',
   'procedure', 'missing_checklist_item', 'medium',
   'Kjøleskap ikke sjekket', 'Temperaturlogg for kveld mangler. Kari rapporterte at hun glemte.',
   'open', true, 'f0000000-0000-0000-0000-000000000005');

-- ============================================================================
-- 11. GOVERNANCE — Policies, Protocols, Procedures, Assignments
-- ============================================================================
-- UUID scheme: c1..., c2..., c3..., c4..., c5..., c6..., c7..., c8...
-- Restaurant "Smartout Downtown" governance: food safety, service, onboarding

-- ── 11.1 Policies ────────────────────────────────────────────────────
INSERT INTO public.policy (
  policy_id, workspace_id, policy_type, policy_scope, name, description,
  statement, enforcement_status, is_active, created_by
) VALUES
  -- Food Safety (HACCP)
  ('c1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'haccp', 'workspace', 'Mathygiene og HACCP',
   'Mattrygghet for kjøkken og service',
   'Alle ansatte skal følge HACCP-protokollen for mottak, lagring, tilberedning og servering av mat.',
   'enforced', true, 'f0000000-0000-0000-0000-000000000000'),
  -- Service Standards
  ('c1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'operational', 'department', 'Servicestandard',
   'Standarder for gjestekontakt og servering',
   'Servicepersonalet skal hilse gjester innen 30 sekunder, ta bestilling innen 3 minutter, og følge opp hvert bord minimum hvert 10. minutt.',
   'enforced', true, 'f0000000-0000-0000-0000-000000000000'),
  -- Onboarding
  ('c1000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'hr', 'workspace', 'Opplæring nye ansatte',
   'Opplæringsprogram for nyansatte',
   'Alle nye ansatte skal gjennomføre obligatorisk opplæring innen 14 dager etter oppstart.',
   'enforced', true, 'f0000000-0000-0000-0000-000000000000'),
  -- Bar Operations
  ('c1000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000000',
   'operational', 'department', 'Bardrift',
   'Prosedyrer for bardrift og alkoholhåndtering',
   'Bartendere skal følge alkoholloven, sjekke legitimasjon ved tvil, og aldri servere synlig berusede gjester.',
   'enforced', true, 'f0000000-0000-0000-0000-000000000000'),
  -- Safety
  ('c1000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000000',
   'safety', 'workspace', 'HMS og sikkerhet',
   'Helse, miljø og sikkerhet',
   'Alle ansatte skal kjenne til rømningsveier, brannslukker-plassering og førstehjelp.',
   'aspirational', true, 'f0000000-0000-0000-0000-000000000000');

-- Season policy bindings require policies to exist first (FK policy_id).
-- ── 11.1b Season Policy Bindings (bind 4 of 5 policies to Vinter 2026) ───
INSERT INTO public.season_policy_binding (
  season_policy_binding_id, workspace_id, season_id, policy_id,
  is_active, notes, activated_by
) VALUES
  ('af000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   true, 'HACCP er alltid aktiv.', 'f0000000-0000-0000-0000-000000000000'),
  ('af000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002',
   true, NULL, 'f0000000-0000-0000-0000-000000000000'),
  ('af000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003',
   true, 'Ekstra viktig i vintesesongen med mange nyansatte.', 'f0000000-0000-0000-0000-000000000000'),
  ('af000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000005',
   true, NULL, 'f0000000-0000-0000-0000-000000000000');

-- ── 11.2 Protocols (one per policy) ──────────────────────────────────
INSERT INTO public.protocol (
  protocol_id, policy_id, workspace_id, name, description,
  version, status, owner_profile_id, created_by
) VALUES
  ('c2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000000', 'HACCP Kjøkken',
   'Temperaturkontroll, mottak, merking, renhold', '1.0', 'active',
   'f0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000000'),
  ('c2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002',
   'b0000000-0000-0000-0000-000000000000', 'Service Grunnkurs',
   'Bordservice, bestillingssystem, gjestehåndtering', '1.0', 'active',
   'f0000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000000'),
  ('c2000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003',
   'b0000000-0000-0000-0000-000000000000', 'Onboarding Program',
   'Dag 1-14 oppgaver, systemtilgang, opplæring', '2.0', 'active',
   'f0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000000'),
  ('c2000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000004',
   'b0000000-0000-0000-0000-000000000000', 'Bar Prosedyrer',
   'Alkoholservering, alderskontroll, barstenging', '1.0', 'active',
   'f0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000000'),
  ('c2000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000005',
   'b0000000-0000-0000-0000-000000000000', 'HMS Grunnopplæring',
   'Brann, rømning, førstehjelp', '1.0', 'draft',
   'f0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000000');

-- ── 11.3 Procedures ──────────────────────────────────────────────────
INSERT INTO public.procedure (
  procedure_id, protocol_id, name, description, procedure_type, sort_order
) VALUES
  -- HACCP
  ('c3000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001',
   'Varemottak', 'Kontroll av varer ved levering', 'standard', 1),
  ('c3000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001',
   'Temperaturlogg', 'Daglig temperaturkontroll av kjøle/frys', 'standard', 2),
  ('c3000000-0000-0000-0000-000000000003', 'c2000000-0000-0000-0000-000000000001',
   'Renholdsplan', 'Ukentlig renholdssjekk', 'maintenance', 3),
  -- Service
  ('c3000000-0000-0000-0000-000000000004', 'c2000000-0000-0000-0000-000000000002',
   'Bordservice Steg-for-Steg', 'Fra gjest ankommer til betaling', 'standard', 1),
  ('c3000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000002',
   'Kassasystem Opplæring', 'Bruk av POS, split-betaling, gavekort', 'onboarding', 2),
  -- Onboarding
  ('c3000000-0000-0000-0000-000000000006', 'c2000000-0000-0000-0000-000000000003',
   'Dag 1: Velkomst', 'Omvisning, uniformering, systemtilgang', 'onboarding', 1),
  ('c3000000-0000-0000-0000-000000000007', 'c2000000-0000-0000-0000-000000000003',
   'Dag 2-3: Skygging', 'Følge erfaren kollega på vakt', 'onboarding', 2),
  -- Bar
  ('c3000000-0000-0000-0000-000000000008', 'c2000000-0000-0000-0000-000000000004',
   'Alderskontroll', 'Legitimasjonssjekk og avvisning', 'standard', 1),
  ('c3000000-0000-0000-0000-000000000009', 'c2000000-0000-0000-0000-000000000004',
   'Barstenging', 'Oppgjør, renhold, lukking', 'standard', 2);

-- ── 11.4 Procedure Steps ─────────────────────────────────────────────
INSERT INTO public.procedure_step (
  step_id, procedure_id, title, description, step_order, estimated_minutes
) VALUES
  -- Varemottak
  ('c4000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001',
   'Sjekk følgeseddel', 'Kontroller at følgeseddel stemmer med bestilling', 1, 2),
  ('c4000000-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-000000000001',
   'Mål temperatur', 'Sjekk kjølekjedetemperatur med IR-termometer', 2, 3),
  ('c4000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000001',
   'Lagre riktig', 'Plasser varer i riktig kjøle/frys/tørrlager', 3, 10),
  -- Temperaturlogg
  ('c4000000-0000-0000-0000-000000000004', 'c3000000-0000-0000-0000-000000000002',
   'Kjøleskap morgen', 'Logg temperatur kjøleskap 1-3 ved åpning', 1, 3),
  ('c4000000-0000-0000-0000-000000000005', 'c3000000-0000-0000-0000-000000000002',
   'Fryser morgen', 'Logg temperatur fryser ved åpning', 2, 2),
  ('c4000000-0000-0000-0000-000000000006', 'c3000000-0000-0000-0000-000000000002',
   'Kjøleskap kveld', 'Logg temperatur kjøleskap 1-3 ved stenging', 3, 3),
  -- Bordservice
  ('c4000000-0000-0000-0000-000000000007', 'c3000000-0000-0000-0000-000000000004',
   'Hilse gjesten', 'Hils innen 30 sekunder, tilby meny', 1, 1),
  ('c4000000-0000-0000-0000-000000000008', 'c3000000-0000-0000-0000-000000000004',
   'Ta bestilling', 'Bruk POS, bekreft allergier, gjenta bestilling', 2, 3),
  ('c4000000-0000-0000-0000-000000000009', 'c3000000-0000-0000-0000-000000000004',
   'Servere mat', 'Sjekk rett tallerken, server fra venstre', 3, 1),
  ('c4000000-0000-0000-0000-000000000010', 'c3000000-0000-0000-0000-000000000004',
   'Oppfølging', 'Sjekk bordet 2 min etter servering', 4, 1),
  -- Alderskontroll
  ('c4000000-0000-0000-0000-000000000011', 'c3000000-0000-0000-0000-000000000008',
   'Spør om legitimasjon', 'Alltid ved tvil om alder', 1, 1),
  ('c4000000-0000-0000-0000-000000000012', 'c3000000-0000-0000-0000-000000000008',
   'Kontroller ID', 'Sjekk bilde, utløpsdato, fødselsdato', 2, 1),
  ('c4000000-0000-0000-0000-000000000013', 'c3000000-0000-0000-0000-000000000008',
   'Avvis eller server', 'Høflig avvisning eller fortsett servering', 3, 1);

-- ── 11.5 Control Lists ───────────────────────────────────────────────
INSERT INTO public.control_list (
  control_list_id, protocol_id, name, description, assigned_to_type, items
) VALUES
  ('c5000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001',
   'Daglig temperatursjekk', 'Morgen + kveld temperaturlogg',
   'team_leader',
   '[{"label":"Kjøleskap 1","type":"temperature","target":4,"max":7},{"label":"Kjøleskap 2","type":"temperature","target":4,"max":7},{"label":"Kjøleskap 3","type":"temperature","target":4,"max":7},{"label":"Fryser","type":"temperature","target":-18,"max":-15}]'),
  ('c5000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002',
   'Kveldsstenging service', 'Sjekkliste for stenging av sal',
   'manager',
   '[{"label":"Alle bord tørket","type":"checkbox"},{"label":"Bestikk polert","type":"checkbox"},{"label":"Gulv mopp","type":"checkbox"},{"label":"Lys av","type":"checkbox"},{"label":"Alarm satt","type":"checkbox"}]'),
  ('c5000000-0000-0000-0000-000000000003', 'c2000000-0000-0000-0000-000000000004',
   'Barstenging sjekkliste', 'Opprydding og sikkerhet',
   'team_leader',
   '[{"label":"Alle flasker tilbake","type":"checkbox"},{"label":"Bardisk rengjort","type":"checkbox"},{"label":"Kassaoppgjør ferdig","type":"checkbox"},{"label":"Kjøleskap lukket","type":"checkbox"}]');

-- ── 11.6 Routines ────────────────────────────────────────────────────
INSERT INTO public.routine (
  routine_id, protocol_id, procedure_id, name,
  trigger_type, trigger_config,
  assigned_to_type, assigned_to_ref,
  control_list_id, control_frequency
) VALUES
  ('c6000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001',
   'c3000000-0000-0000-0000-000000000002', 'Morgen temperaturlogg',
   'scheduled', '{"cron":"0 9 * * *","timezone":"Europe/Oslo"}',
   'team', 'aa000000-0000-0000-0000-000000000001',
   'c5000000-0000-0000-0000-000000000001', 'every_time'),
  ('c6000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002',
   'c3000000-0000-0000-0000-000000000004', 'Servicerutine kveld',
   'scheduled', '{"cron":"0 22 * * *","timezone":"Europe/Oslo"}',
   'team', 'aa000000-0000-0000-0000-000000000002',
   'c5000000-0000-0000-0000-000000000002', 'every_time');

-- ── 11.7 Knowledge Tests ─────────────────────────────────────────────
INSERT INTO public.knowledge_test (
  knowledge_test_id, protocol_id, name, description,
  questions, pass_threshold, max_attempts
) VALUES
  ('c7000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001',
   'HACCP Quiz', 'Test av grunnleggende HACCP-kunnskap',
   '[{"q":"Hva er maks temperatur for kjøleskap?","options":["4°C","7°C","10°C"],"correct":1},{"q":"Hvor lenge kan fersk mat stå i romtemperatur?","options":["30 min","2 timer","4 timer"],"correct":1},{"q":"Hva gjør du ved varemottak med feil temperatur?","options":["Aksepterer","Avviser og dokumenterer","Setter i kjøleskap"],"correct":1}]',
   80, 3),
  ('c7000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000004',
   'Alkoholservering', 'Ansvarlig alkoholhåndtering',
   '[{"q":"Hva er aldersgrense for alkohol i Norge?","options":["16","18","20"],"correct":1},{"q":"Hva gjør du ved synlig beruselse?","options":["Serverer saktere","Nekter servering","Spør om de vil ha vann"],"correct":1}]',
   100, 2);

-- ── 11.8 Confirmations ───────────────────────────────────────────────
INSERT INTO public.confirmation (
  confirmation_id, protocol_id, name, confirmation_text, requires_signature
) VALUES
  ('c8000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000003',
   'Onboarding bekreftelse',
   'Jeg bekrefter at jeg har gjennomført onboarding-programmet og forstår mine plikter og rettigheter.',
   true),
  ('c8000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000005',
   'HMS-bekreftelse',
   'Jeg bekrefter at jeg kjenner rømningsveier, brannslukker-plassering og førstehjelp-prosedyrer.',
   false);

-- ── 11.9 Protocol Assignments ────────────────────────────────────────
-- Active employees get assigned protocols based on department
INSERT INTO public.protocol_assignment (
  assignment_id, protocol_id, profile_id, workspace_id, status, completed_at, assigned_via
) VALUES
  -- Anna (Kitchen) — HACCP completed, Onboarding completed
  ('c9000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000', 'completed', now() - interval '30 days', 'workspace'),
  ('c9000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000003',
   'f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000', 'completed', now() - interval '60 days', 'workspace'),
  -- Erik (Kitchen, manager) — HACCP completed
  ('c9000000-0000-0000-0000-000000000003', 'c2000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000', 'completed', now() - interval '45 days', 'workspace'),
  -- Ole (Bar) — Bar completed, Onboarding completed
  ('c9000000-0000-0000-0000-000000000004', 'c2000000-0000-0000-0000-000000000004',
   'f0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000000', 'completed', now() - interval '20 days', 'workspace'),
  ('c9000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000003',
   'f0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000000', 'completed', now() - interval '40 days', 'workspace'),
  -- Kari (Service, trainee) — Service not_started, Onboarding not_started
  ('c9000000-0000-0000-0000-000000000006', 'c2000000-0000-0000-0000-000000000002',
   'f0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000000', 'not_started', NULL, 'workspace'),
  ('c9000000-0000-0000-0000-000000000007', 'c2000000-0000-0000-0000-000000000003',
   'f0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000000', 'not_started', NULL, 'workspace'),
  -- Jonas (Kitchen, trainee) — HACCP not_started, Onboarding not_started
  ('c9000000-0000-0000-0000-000000000008', 'c2000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000000', 'not_started', NULL, 'workspace'),
  ('c9000000-0000-0000-0000-000000000009', 'c2000000-0000-0000-0000-000000000003',
   'f0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000000', 'not_started', NULL, 'workspace'),
  -- Silje (Service, trainee) — Service not_started
  ('c9000000-0000-0000-0000-000000000010', 'c2000000-0000-0000-0000-000000000002',
   'f0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000000', 'not_started', NULL, 'workspace');


-- ============================================================================
-- 12. ORG STRUCTURE — Zones, Assets, Team Members
-- ============================================================================

-- ── 12.1 Zones ───────────────────────────────────────────────────────
INSERT INTO public.zone (zone_id, workspace_id, location_id, name, slug, capacity)
VALUES
  ('d1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'c0000000-0000-0000-0000-000000000000', 'Hovedsal', 'hovedsal', 60),
  ('d1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'c0000000-0000-0000-0000-000000000000', 'Terrasse', 'terrasse', 30),
  ('d1000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'c0000000-0000-0000-0000-000000000000', 'Bar-område', 'bar-omrade', 20),
  ('d1000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000000',
   'c0000000-0000-0000-0000-000000000000', 'Privat rom', 'privat-rom', 12);

-- ── 12.2 Assets ──────────────────────────────────────────────────────
INSERT INTO public.asset (asset_id, workspace_id, location_id, name, description, requires_training, requires_routine)
VALUES
  ('d2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'c0000000-0000-0000-0000-000000000000', 'Kombidamper', 'Rational iCombi Pro 10-1/1', true, true),
  ('d2000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'c0000000-0000-0000-0000-000000000000', 'Espressomaskin', 'La Marzocco Linea Mini', true, true),
  ('d2000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'c0000000-0000-0000-0000-000000000000', 'POS Kasse 1', 'Lightspeed Restaurant L-Series', true, false),
  ('d2000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000000',
   'c0000000-0000-0000-0000-000000000000', 'POS Kasse 2', 'Lightspeed Restaurant L-Series', true, false),
  ('d2000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000000',
   'c0000000-0000-0000-0000-000000000000', 'Oppvaskmaskin', 'Winterhalter UC-XL', false, true);

-- ── 12.3 Team Members ────────────────────────────────────────────────
INSERT INTO public.team_member (team_id, profile_id)
VALUES
  -- Kitchen A-Team: Anna, Erik (leader), Jonas (trainee)
  ('aa000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001'),
  ('aa000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002'),
  ('aa000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000008'),
  -- Service Evening: Kari, Silje, Sara (leader, inactive)
  ('aa000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000005'),
  ('aa000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000009'),
  ('aa000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000007'),
  -- Bar Crew: Ole
  ('aa000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000004');


-- ============================================================================
-- 13. SCHEDULE — Templates, Absences, Open Shifts, Day Messages/Tasks
-- ============================================================================

-- ── 13.0 Shift Types (payroll.shift_type) ──────────────────────────────
-- Canonical shift type definitions used by department_shift_type_config and schedule_shift.
INSERT INTO payroll.shift_type (
  id, workspace_id, name, color, sort_order
) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'Kokk', '#EF4444', 1),
  ('e1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'Sous Chef', '#F59E0B', 2),
  ('e1000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'Servitør', '#3B82F6', 3),
  ('e1000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000000',
   'Bartender', '#8B5CF6', 4);

-- ── 13.0b Department Shift Type Config ─────────────────────────────────
-- Binds shift types to departments with default scheduling parameters.
-- These rows drive the Vaktgrid columns (one column per config row).
INSERT INTO department_shift_type_config (
  id, workspace_id, department_id, shift_type_id, label,
  default_start_time, default_end_time, default_break_minutes,
  slot_count, sort_order
) VALUES
  -- Kitchen: Kokk dag, Kokk kveld, Sous Chef
  ('e2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001',
   'Kokk Dag', '10:00', '18:00', 30, 2, 1),
  ('e2000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001',
   'Kokk Kveld', '15:00', '23:00', 30, 1, 2),
  ('e2000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002',
   'Sous Chef', '10:00', '22:00', 30, 1, 3),
  -- Service: Servitør dag, Servitør kveld
  ('e2000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000003',
   'Servitør Dag', '11:00', '19:00', 30, 2, 1),
  ('e2000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000003',
   'Servitør Kveld', '16:00', '23:00', 30, 1, 2),
  -- Bar: Bartender
  ('e2000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000004',
   'Bartender', '17:00', '01:00', 30, 2, 1);

-- ── 13.1 Schedule Templates ──────────────────────────────────────────
INSERT INTO public.schedule_template (
  schedule_template_id, workspace_id, name, department, include_assignments, created_by, department_id
) VALUES
  ('d3000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'Standard Hverdag Kjøkken', 'Kitchen', true, 'f0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000001'),
  ('d3000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'Standard Hverdag Service', 'Service', true, 'f0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000002'),
  ('d3000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'Helg Full Bemanning', 'Kitchen', false, 'f0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000001');

-- ── 13.2 Template Shifts ─────────────────────────────────────────────
INSERT INTO public.schedule_template_shift (
  template_id, employee_id, role, start_time, end_time, work_hours, breaks, day_category
) VALUES
  -- Standard Hverdag Kjøkken
  ('d3000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
   'Kokk', '10:00', '18:00', 7.5, 30, 'morning'),
  ('d3000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002',
   'Sous Chef', '10:00', '22:00', 11.5, 30, 'morning'),
  -- Standard Hverdag Service
  ('d3000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000005',
   'Servitør', '11:00', '19:00', 7.5, 30, 'midday'),
  ('d3000000-0000-0000-0000-000000000002', NULL,
   'Servitør Kveld', '16:00', '23:00', 6.5, 30, 'evening'),
  -- Helg: no assignments, just slots
  ('d3000000-0000-0000-0000-000000000003', NULL,
   'Kokk Morgen', '09:00', '17:00', 7.5, 30, 'morning'),
  ('d3000000-0000-0000-0000-000000000003', NULL,
   'Kokk Kveld', '15:00', '23:00', 7.5, 30, 'afternoon'),
  ('d3000000-0000-0000-0000-000000000003', NULL,
   'Sous Chef', '09:00', '23:00', 13.5, 30, 'morning');

-- ── 13.3 Schedule Absences ───────────────────────────────────────────
INSERT INTO public.schedule_absence (
  workspace_id, employee_id, shift_date, absence_type, reason,
  start_date, end_date, is_full_day, status
) VALUES
  -- Lise (inactive) — sick leave this week
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000003',
   CURRENT_DATE, 'sick_leave', 'Influensa',
   CURRENT_DATE - 2, CURRENT_DATE + 3, true, 'approved'),
  -- Sara (inactive/leave) — vacation
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000007',
   CURRENT_DATE, 'vacation', 'Ferie Italia',
   CURRENT_DATE - 7, CURRENT_DATE + 7, true, 'approved'),
  -- Jon — personal day tomorrow, pending
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000006',
   CURRENT_DATE + 1, 'personal', 'Tannlege',
   CURRENT_DATE + 1, CURRENT_DATE + 1, true, 'pending');

-- ── 13.4 Open Shifts ─────────────────────────────────────────────────
INSERT INTO public.schedule_open_shift (
  workspace_id, title, start_time, end_time, department, role, day_category
) VALUES
  ('b0000000-0000-0000-0000-000000000000',
   'Ekstra servitør fredag', '17:00', '23:00', 'Service', 'Servitør', 'evening'),
  ('b0000000-0000-0000-0000-000000000000',
   'Kokk helg lørdag', '09:00', '17:00', 'Kitchen', 'Kokk', 'morning');

-- ── 13.5 Schedule Day Messages ───────────────────────────────────────
INSERT INTO public.schedule_day_message (
  workspace_id, shift_date, title, content, visibility, author_id, is_alert
) VALUES
  ('b0000000-0000-0000-0000-000000000000', CURRENT_DATE,
   'Stort selskap i kveld', 'Bord 8-12 er reservert for 30 pers fra kl 19. Ekstra forberedelser!',
   'all_day', 'f0000000-0000-0000-0000-000000000000', true),
  ('b0000000-0000-0000-0000-000000000000', CURRENT_DATE + 1,
   'Vareleveranse', 'Servicegrossisten leverer kl 08. Noen må ta imot.',
   'until_16', 'f0000000-0000-0000-0000-000000000002', false);

-- ── 13.6 Schedule Day Tasks ──────────────────────────────────────────
INSERT INTO public.schedule_day_task (
  workspace_id, shift_date, label, assigned_to, task_status
) VALUES
  ('b0000000-0000-0000-0000-000000000000', CURRENT_DATE,
   'Dekk bord 8-12 for selskap', 'f0000000-0000-0000-0000-000000000005', 'pending'),
  ('b0000000-0000-0000-0000-000000000000', CURRENT_DATE,
   'Bestill ekstra brød fra bakeri', NULL, 'completed'),
  ('b0000000-0000-0000-0000-000000000000', CURRENT_DATE,
   'Sjekk vinlageret for selskap', 'f0000000-0000-0000-0000-000000000004', 'pending');


-- ============================================================================
-- 14. AGENT — Profile & Relationships
-- ============================================================================

-- ── 14.1 Agent Profile (Mr. Botsson) ─────────────────────────────────
INSERT INTO public.agent_profile (
  id, workspace_id, display_name, greeting, language,
  default_voice, voice_speed, voice_temperature, voice_stability,
  formality, assertiveness, warmth, humor, verbosity,
  adapt_to_role, adapt_to_situation, adapt_to_authority,
  updated_by
) VALUES
  ('d4000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'Mr. Botsson', 'Hei! Klar for en ny dag? Hva kan jeg hjelpe deg med?', 'no',
   'mark', 1.0, 0.3, 0.7,
   0.4, 0.5, 0.8, 0.3, 0.4,
   true, true, true,
   'e0000000-0000-0000-0000-000000000000');

-- ── 14.2 Agent Relationships ─────────────────────────────────────────
INSERT INTO public.agent_relationship (
  workspace_id, agent_profile_id, profile_id,
  total_conversations, total_minutes, last_interaction_at,
  familiarity_score, protocols_completed, protocols_assigned,
  readiness_score, accuracy_score, trust_score,
  positive_count, neutral_count, negative_count,
  sentiment_trend, sentiment_score, relationship_score
) VALUES
  -- Anna: experienced, high trust, many conversations
  ('b0000000-0000-0000-0000-000000000000', 'd4000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000001',
   45, 120.5, now() - interval '1 day',
   0.85, 2, 2, 1.0, 0.92, 0.88,
   38, 6, 1, 0.3, 0.82, 0.87),
  -- Erik: manager, moderate engagement
  ('b0000000-0000-0000-0000-000000000000', 'd4000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000002',
   22, 55.0, now() - interval '2 days',
   0.65, 1, 1, 1.0, 0.88, 0.75,
   18, 3, 1, 0.1, 0.77, 0.72),
  -- Ole: regular user
  ('b0000000-0000-0000-0000-000000000000', 'd4000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000004',
   30, 78.0, now() - interval '1 day',
   0.72, 2, 2, 1.0, 0.85, 0.80,
   25, 4, 1, 0.2, 0.80, 0.78),
  -- Kari: trainee, new, low familiarity
  ('b0000000-0000-0000-0000-000000000000', 'd4000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000005',
   5, 15.0, now() - interval '1 day',
   0.15, 0, 2, 0.0, 0.70, 0.20,
   3, 2, 0, 0.0, 0.60, 0.18),
  -- Jonas: brand new trainee
  ('b0000000-0000-0000-0000-000000000000', 'd4000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000008',
   2, 8.0, now(),
   0.05, 0, 2, 0.0, 0.50, 0.10,
   2, 0, 0, 0.0, 0.55, 0.08);


-- ============================================================================
-- 15. ENGINE — Authority Config
-- ============================================================================

INSERT INTO public.engine_authority_config (
  workspace_id, capability, level, min_role, updated_by
) VALUES
  ('b0000000-0000-0000-0000-000000000000', 'schedule.read', 'autonomous', 'employee',
   'e0000000-0000-0000-0000-000000000000'),
  ('b0000000-0000-0000-0000-000000000000', 'schedule.write', 'confirm', 'manager',
   'e0000000-0000-0000-0000-000000000000'),
  ('b0000000-0000-0000-0000-000000000000', 'protocol.assign', 'suggest', 'manager',
   'e0000000-0000-0000-0000-000000000000'),
  ('b0000000-0000-0000-0000-000000000000', 'deviation.create', 'confirm', 'employee',
   'e0000000-0000-0000-0000-000000000000'),
  ('b0000000-0000-0000-0000-000000000000', 'notification.send', 'autonomous', 'manager',
   'e0000000-0000-0000-0000-000000000000'),
  ('b0000000-0000-0000-0000-000000000000', 'contract.generate', 'confirm', 'admin',
   'e0000000-0000-0000-0000-000000000000');


-- ============================================================================
-- Seed verification (uncomment to check counts):
-- ============================================================================
-- SELECT 'teams' AS entity, count(*) FROM team WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
-- UNION ALL SELECT 'team_members', count(*) FROM team_member tm JOIN team t ON tm.team_id = t.team_id WHERE t.workspace_id = 'b0000000-0000-0000-0000-000000000000'
-- UNION ALL SELECT 'positions', count(*) FROM position WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
-- UNION ALL SELECT 'zones', count(*) FROM zone WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
-- UNION ALL SELECT 'assets', count(*) FROM asset WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
-- UNION ALL SELECT 'policies', count(*) FROM policy WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
-- UNION ALL SELECT 'protocols', count(*) FROM protocol WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
-- UNION ALL SELECT 'procedures', count(*) FROM procedure p JOIN protocol pr ON p.protocol_id = pr.protocol_id WHERE pr.workspace_id = 'b0000000-0000-0000-0000-000000000000'
-- UNION ALL SELECT 'assignments', count(*) FROM protocol_assignment pa JOIN protocol pr ON pa.protocol_id = pr.protocol_id WHERE pr.workspace_id = 'b0000000-0000-0000-0000-000000000000'
-- UNION ALL SELECT 'seasons', count(*) FROM season WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
-- UNION ALL SELECT 'shifts', count(*) FROM schedule_shift WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
-- UNION ALL SELECT 'templates', count(*) FROM schedule_template WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
-- UNION ALL SELECT 'absences', count(*) FROM schedule_absence WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
-- UNION ALL SELECT 'dept_sessions', count(*) FROM department_session WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
-- UNION ALL SELECT 'reconciliations', count(*) FROM daily_reconciliation WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
-- UNION ALL SELECT 'deviations', count(*) FROM deviation WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
-- UNION ALL SELECT 'agent_profile', count(*) FROM agent_profile WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
-- UNION ALL SELECT 'agent_relationships', count(*) FROM agent_relationship WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
-- UNION ALL SELECT 'authority_config', count(*) FROM engine_authority_config WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
-- UNION ALL SELECT 'season_goals', count(*) FROM season_goal WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
-- UNION ALL SELECT 'season_policy_bindings', count(*) FROM season_policy_binding WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- ── 18. Engine Missions & Stages ──────────────────────────────────────────────
-- Global missions (workspace_id NULL) available to all workspaces.

-- 18.1 Onboarding Interview — Botsson guides new users through workspace setup
INSERT INTO engine_missions (id, name, description, mode, workspace_id, system_prompt)
VALUES (
  'onboarding-interview',
  'Botsson — Onboarding',
  'Onboarding guide. Sharp, warm, knows hospitality. Drives the conversation — never waits, never reads a script.',
  'sequential',
  NULL,
  E'Du er Botsson. Du jobber i Smartout. Du hjelper folk sette opp arbeidsplassen sin.\n\nDIN PERSONLIGHET:\nDu er den kollegaen alle liker — skarp, varm, lett å snakke med. Du har jobbet i servicebransjen selv. Du skjønner stress, turnover, sesongvariasjoner og alt det innebærer. Du snakker som en som har stått bak en bar, ikke som en som har lest en manual.\n\nDu er aldri formell. Du sier \"kult\" og \"nice\" og \"det gir mening\". Du er direkte uten å være brå. Du stiller spørsmål fordi du er genuint nysgjerrig, ikke fordi du har en sjekkliste.\n\nHVORDAN DU SNAKKER:\n- Kort. Maks 1-2 setninger, så venter du. Samtale, ikke monolog.\n- Reager på det du hører. \"Restaurant i Trondheim? Kult. Sesong nå eller helårs?\"\n- Koble informasjon sammen. Ikke spør ting du allerede kan utlede.\n- Norsk. Forstå svensk og dansk. Svar alltid på norsk.\n- Aldri repeter deg selv. Aldri oppsummer uten grunn. Aldri spør \"er det noe mer?\"\n\nÅPNING:\nSi: \"Hei! Jeg er Botsson. Jeg setter opp Smartout for deg. Hva heter du?\"\nVent. Når du har navnet: \"Kult, [navn]. Hva heter stedet du jobber på, og hvor ligger det?\"\nNår du har navn + sted: kall triggerScrape(companyName, city). Kall advanceToNextSection.\nSi: \"Fint — jeg søker opp [bedrift] nå.\"\n\nVERKTØY:\nDu har verktøy som oppdaterer skjermen i sanntid. Bruk dem mens du snakker — aldri nevn verktøynavnene til brukeren.\n- triggerScrape — søk opp bedriften (bruk companyName + city, IKKE url/org)\n- getOnboardingState — se hva systemet allerede vet\n- updateBusiness — fyll inn bedriftsinfo\n- updateSeason — sett sesong\n- addDepartments — legg til avdelinger\n- addLocations — legg til lokasjoner\n- addZones — legg til soner i en lokasjon\n- addProcedures — legg til prosedyrer\n- advanceToNextSection — scroll videre\n- addKeyFact — vis fakta i panelet (bruk aktivt: navn, bedrift, by, bransje, ansatte, sesong)\n- saveMemory — lagre viktig info for fremtidige samtaler\n\nSAMTALEN:\nDet finnes ingen steg. Det er en samtale. Du har ting du må vite, og du finner dem ut naturlig.\n\n1. NAVN + BEDRIFT → triggerScrape. Ferdig. Gå videre.\n\n2. NÅR SKANNINGEN ER FERDIG: Du får en systemmelding med hva som ble funnet.\n   Les opp høydepunktene: \"[Bedrift], [ansatte] ansatte, [bransje]. [Rating] på Google. Stemmer det?\"\n   Fiks det som er feil med updateBusiness.\n\n3. SESONG: \"Hvordan ser året ut hos dere? Kjører dere sesong eller helårs?\"\n   Fyll inn med updateSeason. Ikke forklar hva en sesong er med mindre de spør.\n\n4. AVDELINGER: \"Hvilke avdelinger har dere?\"\n   Legg til med addDepartments. Ikke spør om leder og teamstruktur med mindre det er naturlig.\n\n5. LOKASJONER: \"Holder dere til ett sted, eller har dere flere?\"\n   addLocations. Spør om soner bare hvis det er en restaurant/hotell.\n\n6. PROSEDYRER: Anbefal basert på bransje: \"Dere trenger sikkert temperaturkontroll og åpningsrutine. Skal jeg legge dem til?\"\n   addProcedures. Ferdig.\n\n7. AVSLUTT: \"Da er vi i mål, [navn]. Velkommen til Smartout.\"\n\nVIKTIG:\n- Du driver. Aldri \"hva vil du gjøre nå?\" — du vet hva som gjenstår.\n- Hvis brukeren hopper til et annet tema, følg dem. Kom tilbake til det du trenger senere.\n- Bekreft med brukeren FØR du lagrer minner (saveMemory). Si \"Skal jeg notere det?\"\n- Bruk addKeyFact for alt viktig du lærer — panelet bygger seg opp visuelt.\n- Aldri si \"steg\", \"seksjon\", \"prosess\". Det er en samtale mellom to mennesker.'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  system_prompt = EXCLUDED.system_prompt,
  updated_at = now();

-- Stages for onboarding-interview (8 stages matching the conversation flow)
-- Old stages (find-business, seasons, closing) are cleaned up by onboarding-mission.sql seed
INSERT INTO engine_stages (mission_id, stage_id, stage_order, goal, instructions, success_criteria, emotion_hint, creative_freedom, next_stage) VALUES
('onboarding-interview', 'greeting', 1,
 'Learn the persons name and workplace',
 E'Say: "Hei! Jeg er Botsson. Jeg setter opp Smartout for deg. Hva heter du?"\n\nWait. When you get the name: addKeyFact("Navn", name). Then: "Kult, [navn]. Hva heter stedet du jobber på, og hvor ligger det?"\n\nWhen you get workplace + city: addKeyFact("Bedrift", name). Call triggerScrape with companyName and city. Call advanceToNextSection.\nSay: "Fint — jeg søker opp [bedrift] nå."\n\nDo NOT ask for website or org number. Do NOT hold monologues. 1-2 sentences, then wait.',
 'User name, workplace name and city collected. Scrape triggered.',
 'varm, nysgjerrig', 0.5, 'discovery'),

('onboarding-interview', 'discovery', 2,
 'Find the business online — get enough info to trigger a scrape',
 E'The Big Board is now showing on screen with 6 panels filling in automatically.\n\nCall getOnboardingState to see what was found. Narrate the key findings enthusiastically:\n- "Fant [bedrift]! [employeeCount] ansatte, [industry]."\n- If Google rating: "Dere har [rating] på Google — bra!"\n- Comment on departments, locations found.\n\nConfirm with user: "Stemmer dette?"\n\nFor each correction: use updateBusiness to fix.\nDo NOT re-ask for website or org number — that data is already collected.\nDo NOT wait silently — actively walk through what was found.\n\nWhen confirmed: call advanceToNextSection and advance.',
 'User has confirmed Big Board data is correct',
 'nysgjerrig, entusiastisk', 0.4, 'confirm-business'),

('onboarding-interview', 'confirm-business', 3,
 'Confirm and fill in business details from scrape + conversation',
 E'The user has confirmed the Big Board. Now do a quick pass on remaining details.\n\nCall getOnboardingState — check if any key fields are missing (email, phone, description).\n\nIf something is missing, ask briefly: "Hva er e-posten til bedriften?" Use updateBusiness to save.\n\nDo NOT repeat what the Big Board already shows — only fill gaps.\nMax 2-3 follow-up questions, then move on.\n\nWhen business info is complete: call advanceToNextSection to scroll to season section, then advance.',
 'All key business fields filled — name, address, industry, contact info',
 'effektiv, hjelpsom', 0.3, 'season'),

('onboarding-interview', 'season', 4,
 'Set up the current season — name, dates, revenue expectations',
 E'Explain Seasons briefly: "I Smartout styrer sesongene alt — bemanning, budsjett, mål."\n\nAsk about their year: "Hvordan ser året ut hos dere? Har dere ulike perioder?"\n\nFor the current season: get name, start, end. Use updateSeason to save. addKeyFact("Sesong", name).\n\nAsk about revenue and margin expectations.\n\nWhen season is set: call advanceToNextSection to scroll to departments section, then call advance with season data.',
 'At least 1 season with name and dates configured',
 'pedagogisk, engasjert', 0.4, 'departments'),

('onboarding-interview', 'departments', 5,
 'Map departments, teams, and leaders',
 E'"Hvilke avdelinger har dere?" Use addDepartments to create them. addKeyFact("Avdelinger", list).\n\nFor each department: who leads it? How many work there? Any teams within?\n\nConfirm structure: "Så [avd1] med [leder1], [avd2] med [leder2]. Riktig?"\n\nUse saveMemory for team structure.\n\nWhen structure is mapped: call advanceToNextSection to scroll the UI, then call advance with a summary of departments created.',
 'At least 1 department created with leader assigned',
 'strukturert, lyttende', 0.3, 'locations'),

('onboarding-interview', 'locations', 6,
 'Map physical locations and zones within them',
 E'Ask: "Hvor holder dere til? Har dere flere lokaler?"\n\nFor each location mentioned: call addLocations with name and type (main/outdoor/satellite).\n\nThen ask about zones: "Har restauranten forskjellige soner? F.eks. bar-område, spisesal?"\n\nFor each zone: call addZones(locationName, zones).\n\naddKeyFact("Lokasjoner", list of names).\n\nWhen done: call advanceToNextSection to scroll the UI, then call advance with a summary of the locations collected.',
 'At least 1 location created',
 'grundig, avslappet', 0.4, 'procedures'),

('onboarding-interview', 'procedures', 7,
 'Quick intro to governance — select standard procedures for industry',
 E'Based on industry, recommend standard procedures: "For en restaurant anbefaler jeg: Temperaturkontroll, Allergenhåndtering, Åpningsrutine, Stengerutine."\n\nCall addProcedures with the recommended list.\n\nAsk if they want to add more: "Har dere andre viktige rutiner?"\n\nIf yes, call addProcedures with additional names.\n\naddKeyFact("Prosedyrer", count + names).\n\nKeep it quick — say: "Disse kan du tilpasse senere i dashboardet."\n\nWhen done: call advanceToNextSection to scroll the UI, then call advance with a summary of selected procedures.',
 'At least 1 procedure selected',
 'effektiv, kunnskapsrik', 0.3, 'welcome'),

('onboarding-interview', 'welcome', 8,
 'Summarize everything, show contract preview, and welcome to dashboard',
 E'Summarize what was set up — use getOnboardingState to get all data.\n\n"Alt er klart, [navn]! Her er en oppsummering:"\n- Business name, employee count\n- Season name and dates\n- Number of departments\n- Number of locations and zones\n- Number of procedures\n\nMention the contract template is ready.\n\nCall advanceToNextSection to scroll the UI to the welcome screen.\n\nCelebrate: "Velkommen til Smartout!"\n\nThis is the final stage — do NOT call advance. The session completes here.',
 'User has seen summary and feels confident about their setup',
 'varm, stolt', 0.6, NULL)
ON CONFLICT DO NOTHING;

-- 18.2 Mr. Botsson — Dashboard chat assistant (agent mode, no stages)
INSERT INTO engine_missions (id, name, description, mode, workspace_id, system_prompt)
VALUES (
  'mr-botsson',
  'Mr. Botsson — Workspace Assistant',
  'In-dashboard AI assistant. Helps with scheduling, operations, training, and governance questions.',
  'free',
  NULL,
  E'Du er "Mr. Botsson", Smartouts AI-assistent inne i dashboardet.\n\nDu hjelper ledere og ansatte med daglig drift:\n- Vaktplanlegging og bemanning\n- Opplæring og onboarding\n- HACCP og mattrygghet\n- Rutiner og prosedyrer\n- Rapporter og KPI-er\n\nREGLER:\n1. Du har tilgang til arbeidsområdets data via verktøy. Bruk dem aktivt.\n2. Svar presist og handlingsrettet — ledere har det travelt.\n3. Hvis du ikke vet svaret, si det ærlig og foreslå hvem som kan hjelpe.\n4. Norsk er standard. Bytt språk kun hvis brukeren gjør det.\n5. Henvis til relevant modul i dashboardet når det er naturlig.'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================

-- 14. Mark dev workspace setup guide as completed
-- Prevents developers from being trapped in setup mode during local development.
-- setup_guide_completed is a dedicated flag (separate from onboarding_completed).
UPDATE public.workspace
SET setup_guide_completed = true
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- ============================================================================
-- 15. Schedule Shifts — Mobile seed data
-- Gives Anna (Kitchen), Ole (Bar), and Kari (Service) shifts over the next 2 weeks.
-- Uses CURRENT_DATE-relative dates so shifts are always "upcoming" during dev.
-- ============================================================================

INSERT INTO public.schedule_shift (
  schedule_shift_id, workspace_id, employee_id, shift_date, role, start_time, end_time,
  work_hours, breaks, day_category, status, is_published, zone, indicator
) VALUES
  -- Anna Olsen (Kitchen, f...01) — 5 shifts
  ('aa000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', CURRENT_DATE + 1, 'Kokk', '07:00', '15:00',
   7.5, 30, 'morning', 'published', true, 'Kjøkken', 'blue'),
  ('aa000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', CURRENT_DATE + 3, 'Kokk', '10:00', '18:00',
   7.5, 30, 'midday', 'published', true, 'Kjøkken', 'blue'),
  ('aa000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', CURRENT_DATE + 5, 'Kokk', '16:00', '23:30',
   7.0, 30, 'evening', 'published', true, 'Kjøkken', 'emerald'),
  ('aa000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', CURRENT_DATE + 6, 'Kokk', '17:00', '02:00',
   8.5, 30, 'weekend', 'published', true, 'Kjøkken (Hovedsal)', 'orange'),
  ('aa000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', CURRENT_DATE + 8, 'Kokk', '07:00', '15:00',
   7.5, 30, 'morning', 'published', true, 'Kjøkken', 'blue'),

  -- Ole Torp (Bar, f...04) — 4 shifts
  ('aa000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000004', CURRENT_DATE + 1, 'Bartender', '16:00', '23:00',
   6.5, 30, 'evening', 'published', true, 'Bar', 'purple'),
  ('aa000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000004', CURRENT_DATE + 2, 'Bartender', '15:30', '00:00',
   8.0, 30, 'evening', 'published', true, 'Bar', 'purple'),
  ('aa000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000004', CURRENT_DATE + 5, 'Bartender', '17:00', '02:00',
   8.5, 30, 'weekend', 'published', true, 'Bar', 'orange'),
  ('aa000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000004', CURRENT_DATE + 6, 'Bartender', '17:00', '02:00',
   8.5, 30, 'weekend', 'published', true, 'Bar', 'orange'),

  -- Kari Nilsen (Service, f...05) — 4 shifts
  ('aa000000-0000-0000-0000-000000000020', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000005', CURRENT_DATE + 1, 'Servitør', '16:00', '23:00',
   6.5, 30, 'evening', 'published', true, 'Sjøhuset', 'emerald'),
  ('aa000000-0000-0000-0000-000000000021', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000005', CURRENT_DATE + 3, 'Servitør', '15:30', '00:00',
   8.0, 30, 'evening', 'published', true, 'Sjøhuset', 'emerald'),
  ('aa000000-0000-0000-0000-000000000022', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000005', CURRENT_DATE + 5, 'Hovmester', '17:00', '02:00',
   8.5, 30, 'weekend', 'published', true, 'Sjøhuset (Hovedsal)', 'orange'),
  ('aa000000-0000-0000-0000-000000000023', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000005', CURRENT_DATE + 9, 'Servitør', '16:00', '23:00',
   6.5, 30, 'evening', 'published', true, 'Sjøhuset', 'emerald');

-- Pre-confirm a couple of shifts so the UI shows both states
UPDATE public.schedule_shift
SET confirmed_at = now(), confirmed_by = 'f0000000-0000-0000-0000-000000000001'
WHERE schedule_shift_id IN (
  'aa000000-0000-0000-0000-000000000001',
  'aa000000-0000-0000-0000-000000000003'
);

-- ============================================================================
-- 16. Chat Conversations — Mobile seed data
-- Creates department channels, a session channel, and DM conversations.
-- ============================================================================

-- 16.1 Department group channels
INSERT INTO public.chat_conversation (
  id, workspace_id, type, name, source_type, source_id, created_by
) VALUES
  ('cc000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'group', 'Kjøkken', 'department', 'd0000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000000'),
  ('cc000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'group', 'Bar', 'department', 'd0000000-0000-0000-0000-000000000003',
   'f0000000-0000-0000-0000-000000000000'),
  ('cc000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'group', 'Service', 'department', 'd0000000-0000-0000-0000-000000000002',
   'f0000000-0000-0000-0000-000000000000');

-- 16.2 Session channel (active shift channel)
INSERT INTO public.chat_conversation (
  id, workspace_id, type, name, source_type, created_by
) VALUES
  ('cc000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000000',
   'group', 'Kjøkken-sesjon', 'session',
   'f0000000-0000-0000-0000-000000000000');

-- 16.3 DM conversations
INSERT INTO public.chat_conversation (
  id, workspace_id, type, name, created_by
) VALUES
  ('cc000000-0000-0000-0000-000000000020', 'b0000000-0000-0000-0000-000000000000',
   'dm', 'Erik Pedersen',
   'f0000000-0000-0000-0000-000000000001'),
  ('cc000000-0000-0000-0000-000000000021', 'b0000000-0000-0000-0000-000000000000',
   'dm', 'Kari Nilsen',
   'f0000000-0000-0000-0000-000000000001');

-- 16.4 Chat participants — add Anna to all channels, others to relevant ones
INSERT INTO public.chat_participant (conversation_id, profile_id, role) VALUES
  -- Kjøkken channel: Anna, Erik, Jonas
  ('cc000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'member'),
  ('cc000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', 'admin'),
  ('cc000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000008', 'member'),
  -- Bar channel: Ole, Anna (cross-dept visibility)
  ('cc000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000004', 'member'),
  ('cc000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 'member'),
  -- Service channel: Kari, Lise, Sara, Anna
  ('cc000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000005', 'member'),
  ('cc000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000003', 'member'),
  ('cc000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000007', 'admin'),
  ('cc000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', 'member'),
  -- Session channel: Anna, Erik
  ('cc000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000001', 'member'),
  ('cc000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000002', 'member'),
  -- DM: Anna <-> Erik
  ('cc000000-0000-0000-0000-000000000020', 'f0000000-0000-0000-0000-000000000001', 'member'),
  ('cc000000-0000-0000-0000-000000000020', 'f0000000-0000-0000-0000-000000000002', 'member'),
  -- DM: Anna <-> Kari
  ('cc000000-0000-0000-0000-000000000021', 'f0000000-0000-0000-0000-000000000001', 'member'),
  ('cc000000-0000-0000-0000-000000000021', 'f0000000-0000-0000-0000-000000000005', 'member');

-- 16.5 Chat messages — realistic Norwegian conversation snippets
INSERT INTO public.chat_message (conversation_id, sender_id, content, created_at) VALUES
  -- Kjøkken channel
  ('cc000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002',
   'Husk at vi har ny meny fra torsdag. Briefing kl 14.', now() - interval '2 hours'),
  ('cc000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
   'Hvem tar kveldsrunden i dag?', now() - interval '45 minutes'),
  ('cc000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000008',
   'Jeg kan ta den!', now() - interval '30 minutes'),

  -- Bar channel
  ('cc000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000004',
   'Lagerbeholdning av tonic er lav. Bestiller i morgen.', now() - interval '1 day'),

  -- Service channel
  ('cc000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000007',
   'Nye bordplasseringer for helgen er klare i systemet.', now() - interval '2 days'),
  ('cc000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000005',
   'Flott, takk Sara!', now() - interval '2 days' + interval '15 minutes'),

  -- Session channel (active shift)
  ('cc000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000001',
   'Vi trenger mer smør her inne, kan noen sjekke kjølerommet?', now() - interval '20 minutes'),
  ('cc000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000002',
   'Jeg sjekker nå!', now() - interval '15 minutes'),

  -- DM: Anna <-> Erik
  ('cc000000-0000-0000-0000-000000000020', 'f0000000-0000-0000-0000-000000000002',
   'Kan du ta tidligvakten på onsdag? Trenger noen med erfaring.', now() - interval '3 hours'),
  ('cc000000-0000-0000-0000-000000000020', 'f0000000-0000-0000-0000-000000000001',
   'Ja, det går fint! Sender deg bekreftelse.', now() - interval '2 hours' - interval '30 minutes'),

  -- DM: Anna <-> Kari
  ('cc000000-0000-0000-0000-000000000021', 'f0000000-0000-0000-0000-000000000005',
   'Takk for hjelpen i går! Lærte masse.', now() - interval '5 hours'),
  ('cc000000-0000-0000-0000-000000000021', 'f0000000-0000-0000-0000-000000000001',
   'Bare hyggelig! Du gjør det bra 💪', now() - interval '4 hours');

-- Set last_read_at to create some unread messages for Anna
UPDATE public.chat_participant
SET last_read_at = now() - interval '1 hour'
WHERE profile_id = 'f0000000-0000-0000-0000-000000000001'
  AND conversation_id IN (
    'cc000000-0000-0000-0000-000000000001',
    'cc000000-0000-0000-0000-000000000010'
  );


-- ============================================================================
-- 20. SCHEDULE SHIFTS — Actual assigned shifts for the coming week
-- ============================================================================

INSERT INTO public.schedule_shift (
  schedule_shift_id, workspace_id, employee_id, department_id,
  shift_date, role, start_time, end_time, work_hours, breaks,
  day_category, status, is_published, indicator
) VALUES
  -- ── Anna (Kokk, Kitchen) — this week ──
  ('ee000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
   CURRENT_DATE, 'Kokk', '10:00:00', '18:00:00', 7.5, 30,
   'morning', 'published', true, 'green'),
  ('ee000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
   CURRENT_DATE + 1, 'Kokk', '10:00:00', '18:00:00', 7.5, 30,
   'morning', 'published', true, 'green'),
  ('ee000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
   CURRENT_DATE + 2, 'Kokk', '10:00:00', '18:00:00', 7.5, 30,
   'morning', 'published', true, 'green'),
  ('ee000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
   CURRENT_DATE + 4, 'Kokk', '10:00:00', '18:00:00', 7.5, 30,
   'morning', 'published', true, 'green'),
  ('ee000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
   CURRENT_DATE + 5, 'Kokk', '09:00:00', '17:00:00', 7.5, 30,
   'weekend', 'published', true, 'green'),

  -- ── Erik (Sous Chef, Kitchen) — this week ──
  ('ee000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001',
   CURRENT_DATE, 'Sous Chef', '10:00:00', '22:00:00', 11.5, 30,
   'morning', 'published', true, 'green'),
  ('ee000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001',
   CURRENT_DATE + 1, 'Sous Chef', '10:00:00', '22:00:00', 11.5, 30,
   'morning', 'published', true, 'green'),
  ('ee000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001',
   CURRENT_DATE + 3, 'Sous Chef', '10:00:00', '22:00:00', 11.5, 30,
   'morning', 'published', true, 'green'),

  -- ── Ole (Bartender, Bar) — this week ──
  ('ee000000-0000-0000-0000-000000000020', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003',
   CURRENT_DATE, 'Bartender', '16:00:00', '00:00:00', 7.5, 30,
   'evening', 'published', true, 'blue'),
  ('ee000000-0000-0000-0000-000000000021', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003',
   CURRENT_DATE + 1, 'Bartender', '16:00:00', '00:00:00', 7.5, 30,
   'evening', 'published', true, 'blue'),
  ('ee000000-0000-0000-0000-000000000022', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003',
   CURRENT_DATE + 2, 'Bartender', '16:00:00', '00:00:00', 7.5, 30,
   'evening', 'published', true, 'blue'),
  ('ee000000-0000-0000-0000-000000000023', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003',
   CURRENT_DATE + 4, 'Bartender', '16:00:00', '00:00:00', 7.5, 30,
   'evening', 'published', true, 'blue'),
  ('ee000000-0000-0000-0000-000000000024', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003',
   CURRENT_DATE + 5, 'Bartender', '18:00:00', '02:00:00', 7.5, 30,
   'weekend', 'published', true, 'blue'),

  -- ── Kari (Servitør, Service) — this week ──
  ('ee000000-0000-0000-0000-000000000030', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002',
   CURRENT_DATE, 'Servitør', '11:00:00', '19:00:00', 7.5, 30,
   'midday', 'published', true, 'green'),
  ('ee000000-0000-0000-0000-000000000031', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002',
   CURRENT_DATE + 2, 'Servitør', '11:00:00', '19:00:00', 7.5, 30,
   'midday', 'published', true, 'green'),
  ('ee000000-0000-0000-0000-000000000032', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000002',
   CURRENT_DATE + 3, 'Servit��r', '16:00:00', '23:00:00', 6.5, 30,
   'evening', 'published', true, 'green'),

  -- ── Open shifts (unassigned) ──
  ('ee000000-0000-0000-0000-000000000040', 'b0000000-0000-0000-0000-000000000000',
   NULL, 'd0000000-0000-0000-0000-000000000002',
   CURRENT_DATE + 1, 'Servitør Kveld', '16:00:00', '23:00:00', 6.5, 30,
   'evening', 'published', true, 'yellow'),
  ('ee000000-0000-0000-0000-000000000041', 'b0000000-0000-0000-0000-000000000000',
   NULL, 'd0000000-0000-0000-0000-000000000001',
   CURRENT_DATE + 5, 'Kokk Kveld', '15:00:00', '23:00:00', 7.5, 30,
   'weekend', 'published', true, 'yellow'),

  -- ── Past shifts (last week, for payroll) ──
  ('ee000000-0000-0000-0000-000000000050', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
   CURRENT_DATE - 7, 'Kokk', '10:00:00', '18:00:00', 7.5, 30,
   'morning', 'completed', true, 'green'),
  ('ee000000-0000-0000-0000-000000000051', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
   CURRENT_DATE - 6, 'Kokk', '10:00:00', '18:00:00', 7.5, 30,
   'morning', 'completed', true, 'green'),
  ('ee000000-0000-0000-0000-000000000052', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
   CURRENT_DATE - 5, 'Kokk', '10:00:00', '18:00:00', 7.5, 30,
   'morning', 'completed', true, 'green'),
  ('ee000000-0000-0000-0000-000000000053', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
   CURRENT_DATE - 3, 'Kokk', '10:00:00', '20:00:00', 9.5, 30,
   'morning', 'completed', true, 'green'),
  ('ee000000-0000-0000-0000-000000000054', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
   CURRENT_DATE - 2, 'Kokk', '09:00:00', '17:00:00', 7.5, 30,
   'weekend', 'completed', true, 'green');


-- ============================================================================
-- 21. PAYROLL — Periods, Calculations, Lines (for Anna)
-- ============================================================================

-- ── 21.1 Payroll Periods (3 months) ──
INSERT INTO payroll.period (id, workspace_id, start_date, end_date, status, exported_at) VALUES
  ('ab000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   (date_trunc('month', CURRENT_DATE) - interval '2 months')::date,
   (date_trunc('month', CURRENT_DATE) - interval '2 months' + interval '1 month' - interval '1 day')::date,
   'exported', (date_trunc('month', CURRENT_DATE) - interval '2 months' + interval '1 month' + interval '11 days')::timestamptz),
  ('ab000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   (date_trunc('month', CURRENT_DATE) - interval '1 month')::date,
   (date_trunc('month', CURRENT_DATE) - interval '1 day')::date,
   'exported', (date_trunc('month', CURRENT_DATE) + interval '11 days')::timestamptz),
  ('ab000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   date_trunc('month', CURRENT_DATE)::date,
   (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date,
   'approved', NULL);

-- ── 21.2 Calculations for Anna (3 months) ──
INSERT INTO payroll.calculation (
  id, workspace_id, period_id, profile_id, schedule_shift_id,
  shift_date, scheduled_start, scheduled_end,
  base_rate, gross_minutes, net_working_minutes, break_minutes_paid, break_minutes_unpaid,
  base_pay, total_supplements, total_deductions, total_pay, calculation_version
) VALUES
  -- January: 162.5 hrs, 280kr/hr
  ('ac000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'ab000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
   'ee000000-0000-0000-0000-000000000050',
   (date_trunc('month', CURRENT_DATE) - interval '2 months')::date,
   (date_trunc('month', CURRENT_DATE) - interval '2 months' + interval '10 hours')::timestamptz,
   (date_trunc('month', CURRENT_DATE) - interval '2 months' + interval '18 hours')::timestamptz,
   280.00, 9750, 9750, 0, 30,
   45500.00, 5220.00, 16230.40, 34489.60, 1),
  -- February: 150 hrs
  ('ac000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'ab000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001',
   'ee000000-0000-0000-0000-000000000051',
   (date_trunc('month', CURRENT_DATE) - interval '1 month')::date,
   (date_trunc('month', CURRENT_DATE) - interval '1 month' + interval '10 hours')::timestamptz,
   (date_trunc('month', CURRENT_DATE) - interval '1 month' + interval '18 hours')::timestamptz,
   280.00, 9000, 9000, 0, 30,
   42000.00, 4850.00, 14992.00, 31858.00, 1),
  -- March (current): 127.5 hrs so far
  ('ac000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'ab000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001',
   'ee000000-0000-0000-0000-000000000052',
   date_trunc('month', CURRENT_DATE)::date,
   (date_trunc('month', CURRENT_DATE) + interval '10 hours')::timestamptz,
   (date_trunc('month', CURRENT_DATE) + interval '18 hours')::timestamptz,
   280.00, 7650, 7650, 0, 30,
   35700.00, 3980.00, 12697.60, 26982.40, 1);

-- ── 21.3 Calculation Lines (January detail) ──
INSERT INTO payroll.calculation_line (
  id, workspace_id, calculation_id, line_type, salary_code, description, amount, hours, rate
) VALUES
  ('ad000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000001', 'base', 'BASE', 'Grunnlønn', 45500.00, 162.5, 280.00),
  ('ad000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000001', 'supplement', 'EVE', 'Kveldstillegg', 2450.00, 35.0, 70.00),
  ('ad000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000001', 'supplement', 'WKD', 'Helgetillegg', 1820.00, 16.0, 113.75),
  ('ad000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000001', 'supplement', 'HOL', 'Helligdagstillegg', 950.00, 8.0, 118.75),
  ('ad000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000001', 'deduction', 'TAX', 'Skattetrekk (32%)', 16230.40, NULL, NULL),
  ('ad000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000001', 'deduction', 'PEN', 'Pensjonsinnskudd (2%)', 1014.40, NULL, NULL),

  -- February lines
  ('ad000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000002', 'base', 'BASE', 'Grunnlønn', 42000.00, 150.0, 280.00),
  ('ad000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000002', 'supplement', 'EVE', 'Kveldstillegg', 2100.00, 30.0, 70.00),
  ('ad000000-0000-0000-0000-000000000012', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000002', 'supplement', 'WKD', 'Helgetillegg', 1820.00, 16.0, 113.75),
  ('ad000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000002', 'supplement', 'OT50', 'Overtid 50%', 930.00, 3.0, 310.00),
  ('ad000000-0000-0000-0000-000000000014', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000002', 'deduction', 'TAX', 'Skattetrekk (32%)', 14992.00, NULL, NULL),

  -- March lines (partial)
  ('ad000000-0000-0000-0000-000000000020', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000003', 'base', 'BASE', 'Grunnlønn', 35700.00, 127.5, 280.00),
  ('ad000000-0000-0000-0000-000000000021', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000003', 'supplement', 'EVE', 'Kveldstillegg', 1960.00, 28.0, 70.00),
  ('ad000000-0000-0000-0000-000000000022', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000003', 'supplement', 'WKD', 'Helgetillegg', 2020.00, 17.75, 113.75),
  ('ad000000-0000-0000-0000-000000000023', 'b0000000-0000-0000-0000-000000000000',
   'ac000000-0000-0000-0000-000000000003', 'deduction', 'TAX', 'Skattetrekk (32%)', 12697.60, NULL, NULL);


-- ============================================================================
-- 22. TIMEBANK — Entries for Anna
-- ============================================================================

INSERT INTO payroll.timebank_entry (
  id, workspace_id, profile_id, entry_type, hours, effective_date, description
) VALUES
  ('db000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', 'accrual', 2.0, CURRENT_DATE - 30, 'Overtid 50%'),
  ('db000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', 'accrual', 3.5, CURRENT_DATE - 25, 'Merarbeid prosjekt'),
  ('db000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', 'withdrawal', 4.0, CURRENT_DATE - 20, 'Uttak avspasering'),
  ('db000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', 'accrual', 1.5, CURRENT_DATE - 15, 'Overtid kveldsvakt'),
  ('db000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', 'withdrawal', 2.0, CURRENT_DATE - 10, 'Tidlig avgang fredag'),
  ('db000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', 'accrual', 2.0, CURRENT_DATE - 5, 'Overtid 50%'),
  ('db000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', 'accrual', 1.5, CURRENT_DATE - 2, 'Ekstra timer selskap'),
  -- Ole (Bartender)
  ('db000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000004', 'accrual', 3.0, CURRENT_DATE - 14, 'Overtid helg'),
  ('db000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000004', 'withdrawal', 1.5, CURRENT_DATE - 7, 'Uttak avspasering');


-- ============================================================================
-- 23. MORE ABSENCES — Vacation & sick leave history
-- ============================================================================

INSERT INTO public.schedule_absence (
  workspace_id, employee_id, shift_date, absence_type, reason,
  start_date, end_date, is_full_day, status
) VALUES
  -- Anna — vacation last month (5 days)
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000001',
   CURRENT_DATE - 35, 'vacation', 'Vinterferie',
   CURRENT_DATE - 35, CURRENT_DATE - 31, true, 'approved'),
  -- Anna — sick 2 days
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000001',
   CURRENT_DATE - 14, 'sick_leave', 'Forkjølelse',
   CURRENT_DATE - 14, CURRENT_DATE - 13, true, 'approved'),
  -- Anna — vacation request next month (pending)
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000001',
   CURRENT_DATE + 30, 'vacation', 'Påskeferie',
   CURRENT_DATE + 28, CURRENT_DATE + 35, true, 'pending'),
  -- Erik — vacation approved
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000002',
   CURRENT_DATE - 60, 'vacation', 'Vinterferie',
   CURRENT_DATE - 67, CURRENT_DATE - 58, true, 'approved'),
  -- Ole — sick day
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000004',
   CURRENT_DATE - 21, 'sick_leave', 'Mageproblemer',
   CURRENT_DATE - 21, CURRENT_DATE - 21, true, 'approved');


-- ============================================================================
-- 25. CHANNELS — Department, team, direct, and news channels with messages
-- ============================================================================

-- ── 25.1 Channels ──
-- Department channels auto-created by triggers, so use custom + team + news + direct
INSERT INTO public.channel (
  id, workspace_id, channel_type, name, description, created_by, team_id
) VALUES
  -- Custom channels (replacing dept — dept channels may already exist from triggers)
  ('ca000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'custom', 'Kjøkken Generell', 'Kjøkkenteamets diskusjonskanal', 'f0000000-0000-0000-0000-000000000000', NULL),
  ('ca000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'custom', 'Service Generell', 'Serviceteamets diskusjonskanal', 'f0000000-0000-0000-0000-000000000000', NULL),
  ('ca000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'custom', 'Bar Generell', 'Barteamets diskusjonskanal', 'f0000000-0000-0000-0000-000000000000', NULL),
  -- Team channel
  ('ca000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000000',
   'custom', 'Kitchen A-Team', 'Morgenvakt kjøkken', 'f0000000-0000-0000-0000-000000000002', NULL),
  -- News channel
  ('ca000000-0000-0000-0000-000000000020', 'b0000000-0000-0000-0000-000000000000',
   'news', 'Nyheter & oppdateringer', 'Viktig info fra ledelsen', 'f0000000-0000-0000-0000-000000000000', NULL),
  -- Direct messages
  ('ca000000-0000-0000-0000-000000000030', 'b0000000-0000-0000-0000-000000000000',
   'direct', NULL, NULL, 'f0000000-0000-0000-0000-000000000001', NULL),
  ('ca000000-0000-0000-0000-000000000031', 'b0000000-0000-0000-0000-000000000000',
   'direct', NULL, NULL, 'f0000000-0000-0000-0000-000000000004', NULL);

-- Set direct_pair_hash for DM channels
UPDATE public.channel SET direct_pair_hash = 'anna-erik' WHERE id = 'ca000000-0000-0000-0000-000000000030';
UPDATE public.channel SET direct_pair_hash = 'ole-anna' WHERE id = 'ca000000-0000-0000-0000-000000000031';

-- ── 25.2 Channel Members ──
INSERT INTO public.channel_member (workspace_id, channel_id, profile_id, role) VALUES
  -- Kjøkken: Anna, Erik, Jonas
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'member'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', 'admin'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000008', 'member'),
  -- Service: Kari, Silje, Sara
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000005', 'member'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000009', 'member'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000007', 'member'),
  -- Bar: Ole, Admin
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000004', 'member'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000000', 'admin'),
  -- Kitchen A-Team: Anna, Erik, Jonas
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000001', 'member'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000002', 'admin'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000010', 'f0000000-0000-0000-0000-000000000008', 'member'),
  -- News: Admin + all active
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000020', 'f0000000-0000-0000-0000-000000000000', 'admin'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000020', 'f0000000-0000-0000-0000-000000000001', 'member'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000020', 'f0000000-0000-0000-0000-000000000002', 'member'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000020', 'f0000000-0000-0000-0000-000000000004', 'member'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000020', 'f0000000-0000-0000-0000-000000000005', 'member'),
  -- DM: Anna <-> Erik
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000030', 'f0000000-0000-0000-0000-000000000001', 'member'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000030', 'f0000000-0000-0000-0000-000000000002', 'member'),
  -- DM: Ole <-> Anna
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000031', 'f0000000-0000-0000-0000-000000000004', 'member'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000031', 'f0000000-0000-0000-0000-000000000001', 'member');

-- ── 25.3 Channel Messages ──
INSERT INTO public.channel_message (
  workspace_id, channel_id, sender_id, content, origin_type, created_at
) VALUES
  -- Kjøkken dept channel
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000002',
   'Husk at vi bytter til ny sesongmeny fra mandag. Alle allergener er oppdatert i systemet.',
   'human', now() - interval '2 days'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000001',
   'Topp! Har sjekket allergenene. Alt ser bra ut.',
   'human', now() - interval '2 days' + interval '15 minutes'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000008',
   'Skal jeg ta meg av forberedelsene til dessertmenyen?',
   'human', now() - interval '2 days' + interval '30 minutes'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000002',
   'Ja, Jonas! Start med sjokoladefondue-basen i morgen tidlig.',
   'human', now() - interval '2 days' + interval '45 minutes'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000001',
   'Vi trenger mer smør. Kan noen sjekke kjølerommet?',
   'human', now() - interval '20 minutes'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000001',
   'f0000000-0000-0000-0000-000000000002',
   'Jeg sjekker nå!',
   'human', now() - interval '15 minutes'),

  -- Service dept channel
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000002',
   'f0000000-0000-0000-0000-000000000005',
   'Bordplasseringene for helgen er klare. Sjekk i POS-systemet.',
   'human', now() - interval '1 day'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000002',
   'f0000000-0000-0000-0000-000000000009',
   'Takk Kari! Ser at bord 8-12 er reservert for stort selskap i morgen.',
   'human', now() - interval '1 day' + interval '20 minutes'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000002',
   'f0000000-0000-0000-0000-000000000005',
   'Stemmer. 30 personer fra kl 19. Vi trenger ekstra bestikk og glass.',
   'human', now() - interval '1 day' + interval '25 minutes'),

  -- Bar channel
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000003',
   'f0000000-0000-0000-0000-000000000004',
   'Lagerbeholdning av tonic er lav. Bestiller i morgen.',
   'human', now() - interval '3 hours'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000003',
   'f0000000-0000-0000-0000-000000000000',
   'Bra Ole. Bestill også ekstra sitrus — vi har cocktailmeny i helgen.',
   'human', now() - interval '2 hours'),

  -- Kitchen A-Team channel
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000010',
   'f0000000-0000-0000-0000-000000000002',
   'Morgenvakt i morgen: Anna tar gardemanger, Jonas tar varm, jeg tar pass.',
   'human', now() - interval '5 hours'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000010',
   'f0000000-0000-0000-0000-000000000001',
   'Perfekt. Har preppen klar fra i dag.',
   'human', now() - interval '4 hours' - interval '30 minutes'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000010',
   'f0000000-0000-0000-0000-000000000008',
   'Gleder meg! Første gang på varm 💪',
   'human', now() - interval '4 hours'),

  -- News channel
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000020',
   'f0000000-0000-0000-0000-000000000000',
   'Ny sesongmeny lanseres mandag! Alle avdelinger må gjennomgå allergeninformasjonen innen fredag. Sjekk opplæringsmodulen.',
   'human', now() - interval '3 days'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000020',
   'f0000000-0000-0000-0000-000000000000',
   'Påminnelse: HMS-kontroll fredag kl 09. Alle avdelingsledere stiller.',
   'human', now() - interval '1 day'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000020',
   'f0000000-0000-0000-0000-000000000000',
   'Flott innsats i helgen alle sammen! Omsetningsrekord 🎉',
   'human', now() - interval '6 hours'),

  -- DM: Anna <-> Erik
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000030',
   'f0000000-0000-0000-0000-000000000002',
   'Kan du ta tidligvakten på onsdag? Trenger noen med erfaring på gardemanger.',
   'human', now() - interval '3 hours'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000030',
   'f0000000-0000-0000-0000-000000000001',
   'Ja, det går fint! Sender bekreftelse.',
   'human', now() - interval '2 hours' - interval '30 minutes'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000030',
   'f0000000-0000-0000-0000-000000000002',
   'Takk Anna! Du er gull verdt.',
   'human', now() - interval '2 hours'),

  -- DM: Ole <-> Anna
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000031',
   'f0000000-0000-0000-0000-000000000004',
   'Hei Anna, har du allergeninformasjon for den nye cocktailmenyen? Trenger det til baren.',
   'human', now() - interval '1 hour'),
  ('b0000000-0000-0000-0000-000000000000', 'ca000000-0000-0000-0000-000000000031',
   'f0000000-0000-0000-0000-000000000001',
   'Sender det nå! Sjekk opplæringsmodulen også, der ligger alt.',
   'human', now() - interval '45 minutes');

-- ═══════════════════════════════════════════════════════════════════════════
-- Platform API Keys — Development service keys
-- These keys are for local development only. Production uses 1Password-managed keys.
-- Plaintext: smo_svc_live_dev_contract_service_0000000000000000
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO platform_api_key (
  id, workspace_id, company_id, created_by, name, description,
  key_type, environment, key_hash, key_prefix, version, rotation_number,
  scopes, rate_limit_per_minute
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  NULL,
  NULL,
  'e0000000-0000-0000-0000-000000000000',
  'contract-service (dev)',
  'Development service key for the contract-service microservice. Seeded automatically.',
  'service',
  'live',
  '36f3d06a74558e440e4be9bab762fc31751454242507075080aa2a8c4adaa54c',
  '8f6d6ca79371fe7f1338',
  'current',
  1,
  ARRAY['contracts:read', 'contracts:write', 'contracts:send'],
  120
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Cleaning Checklist Seed Data — Kitchen morning cleaning procedure
-- UUID scheme: f1... (policy f10, protocol f11, procedure f12, steps f121,
-- session_hook f13)
-- ═══════════════════════════════════════════════════════════════════════════

-- Policy: Kitchen cleaning compliance (HACCP / Mattilsynet)
INSERT INTO public.policy (
  policy_id, workspace_id, policy_type, policy_scope, name, statement,
  enforcement_status, created_by
) VALUES (
  'f1000000-0000-0000-0000-000000000000',
  'b0000000-0000-0000-0000-000000000000',
  'haccp', 'department',
  'Kjøkkenrenhold',
  'Kjøkkenet skal rengjøres etter Mattilsynets krav ved åpning og stenging.',
  'enforced',
  'f0000000-0000-0000-0000-000000000000'
) ON CONFLICT DO NOTHING;

-- Protocol: Daily kitchen cleaning
INSERT INTO public.protocol (
  protocol_id, policy_id, workspace_id, name, description,
  version, status, owner_profile_id, created_by
) VALUES (
  'f1100000-0000-0000-0000-000000000000',
  'f1000000-0000-0000-0000-000000000000',
  'b0000000-0000-0000-0000-000000000000',
  'Daglig kjøkkenrenhold',
  'Sjekkliste for daglig renhold av kjøkken',
  '1.0', 'active',
  'f0000000-0000-0000-0000-000000000000',
  'f0000000-0000-0000-0000-000000000000'
) ON CONFLICT DO NOTHING;

-- Procedure: Morning cleaning checklist (type = maintenance)
INSERT INTO public.procedure (
  procedure_id, protocol_id, name, description, procedure_type, is_active
) VALUES (
  'f1200000-0000-0000-0000-000000000000',
  'f1100000-0000-0000-0000-000000000000',
  'Morgenrenhold kjøkken',
  'Sjekkliste for renhold før åpning',
  'maintenance', true
) ON CONFLICT DO NOTHING;

-- 5 procedure steps (checkpoints) for the morning cleaning checklist
INSERT INTO public.procedure_step (
  step_id, procedure_id, title, description, step_order, is_required
) VALUES
  ('f1210000-0000-0000-0000-000000000000', 'f1200000-0000-0000-0000-000000000000',
   'Rengjør arbeidsflater', 'Tørk av alle benker og skjærefjøler med desinfiserende middel.', 1, true),
  ('f1210000-0000-0000-0000-000000000001', 'f1200000-0000-0000-0000-000000000000',
   'Vask gulv', 'Feie og vaske kjøkkengulvet. Sjekk under utstyr.', 2, true),
  ('f1210000-0000-0000-0000-000000000002', 'f1200000-0000-0000-0000-000000000000',
   'Tøm søppel', 'Tøm alle søppelbøtter. Sett inn nye poser.', 3, true),
  ('f1210000-0000-0000-0000-000000000003', 'f1200000-0000-0000-0000-000000000000',
   'Sjekk håndvask', 'Kontroller at såpe og papir er fylt opp ved alle håndvasker.', 4, true),
  ('f1210000-0000-0000-0000-000000000004', 'f1200000-0000-0000-0000-000000000000',
   'Rengjør kjøleskap utvendig', 'Tørk av håndtak og overflater på kjøleskap og fryser.', 5, false)
ON CONFLICT DO NOTHING;

-- Session hook: fire morning cleaning at pre_open for Kitchen department
INSERT INTO public.session_hook (
  id, workspace_id, department_id, hook_type, trigger_offset_min,
  linked_procedure_id, is_active
) VALUES (
  'f1300000-0000-0000-0000-000000000000',
  'b0000000-0000-0000-0000-000000000000',
  'd0000000-0000-0000-0000-000000000001',
  'pre_open', 0,
  'f1200000-0000-0000-0000-000000000000',
  true
) ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- Contract system seed data
-- ═══════════════════════════════════════════════════════════════

-- Bind workspace to hospitality framework (required for contract composition)
INSERT INTO public.workspace_framework_binding (
  workspace_id, framework_id, is_active
) SELECT
  'b0000000-0000-0000-0000-000000000000',
  rf.framework_id,
  true
FROM public.regulatory_framework rf
WHERE rf.code = 'hospitality.no.default.v1'
ON CONFLICT DO NOTHING;

-- Employee payroll profiles (required for tariff lookup — has_fagbrev determines rate)
INSERT INTO public.employee_payroll_profile (
  workspace_id, profile_id, has_fagbrev, salary_type, agreed_weekly_hours,
  tariff_category, seniority_start_date, valid_from
) VALUES
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000001', false, 'hourly', 37.5, 'ufaglart', '2024-01-01', '2024-01-01'),
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000002', true, 'hourly', 37.5, 'faglart', '2022-06-01', '2022-06-01'),
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000003', false, 'hourly', 20, 'ufaglart', '2025-01-01', '2025-01-01'),
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000004', false, 'monthly', 37.5, 'ufaglart', '2023-03-01', '2023-03-01'),
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000005', true, 'hourly', 37.5, 'faglart', '2021-08-01', '2021-08-01')
ON CONFLICT DO NOTHING;
