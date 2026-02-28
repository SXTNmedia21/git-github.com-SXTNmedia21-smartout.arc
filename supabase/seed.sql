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
INSERT INTO public.workspace (workspace_id, company_id, name, slug, description, currency, language, country)
VALUES
  ('b0000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'HQ Workspace', 'hq-workspace', 'Headquarters Workspace', 'NOK', 'no', 'NO');

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
