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
  ('b0000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'HQ Workspace', 'hq', 'Headquarters Workspace', 'NOK', 'no', 'NO');

-- 3. Create a Location
-- ------------------------------------------------------------------------------
INSERT INTO public.location (location_id, workspace_id, name, slug, location_type)
VALUES
  ('c0000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000', 'Oslo Downtown Hub', 'oslo-downtown', 'main');

-- 4. Create a Department
-- ------------------------------------------------------------------------------
INSERT INTO public.department (department_id, workspace_id, name, slug)
VALUES
  ('d0000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000', 'Operations', 'operations');

-- 5. Create a Local Admin User via auth.users
-- ------------------------------------------------------------------------------
-- Note: 'pgcrypto' extension is enabled by default in Supabase.
-- The trigger `handle_new_user` will automatically copy this to `public."user"`.
INSERT INTO auth.users (
  id, 
  instance_id,
  aud, 
  role, 
  email, 
  encrypted_password, 
  email_confirmed_at, 
  raw_user_meta_data, 
  raw_app_meta_data
) VALUES (
  'e0000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'admin@smartout.local',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"first_name": "Admin", "last_name": "Local"}',
  '{"provider": "email", "providers": ["email"]}'
);

-- 6. Link User to Company (Company Member)
-- ------------------------------------------------------------------------------
INSERT INTO public.company_member (user_id, company_id, role)
VALUES
  ('e0000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'owner');

-- 7. Create Profile for the Workspace
-- ------------------------------------------------------------------------------
INSERT INTO public.profile (
  profile_id, 
  profile_code, 
  user_id, 
  workspace_id, 
  company_id, 
  role, 
  status, 
  department_id, 
  location_id, 
  display_name
) VALUES (
  'f0000000-0000-0000-0000-000000000000',
  'ADM001',
  'e0000000-0000-0000-0000-000000000000',
  'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000',
  'owner',
  'active',
  'd0000000-0000-0000-0000-000000000000',
  'c0000000-0000-0000-0000-000000000000',
  'Local Admin'
);

-- 8. Make Admin user a Super Admin for platform-admin development
-- ------------------------------------------------------------------------------
UPDATE public.user_identity
SET is_super_admin = true
WHERE user_id = 'e0000000-0000-0000-0000-000000000000';
