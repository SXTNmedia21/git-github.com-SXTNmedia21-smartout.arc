-- ============ DEMO RESTAURANT CANONICAL ID MAP (do not edit per-file) ============
-- COMPANY        a0000000-0000-0000-0000-000000000000  Smartout AS
-- WORKSPACE      b0000000-0000-0000-0000-000000000000  "Demo Restaurant"
-- LOCATION       c0000000-0000-0000-0000-000000000000  Oslo Downtown Hub
-- ZONE Hovedsal  d1000000-0000-0000-0000-000000000001  | Terrasse d1…2 | Bar d1…3 | Privat d1…4
-- DEPT Operations d0000000-0000-0000-0000-000000000000 | Kitchen d0…1 | Service d0…2 | Bar d0…3
-- PROFILES f0000000-…-{0..9} + new {a..d}; AUTH e0000000-…-{0..9} + new {a..d}
-- LOCAL ONLY — never prod. Idempotent (upsert). password = password123
-- =================================================================================

-- Resolve gen_salt/crypt — Supabase installs pgcrypto in the `extensions`
-- schema by default.
SET search_path = public, extensions, pg_catalog;

BEGIN;

-- ============================================================================
-- 1. COMPANY
-- ============================================================================
INSERT INTO public.company (company_id, name, legal_name, org_number, country, industry)
VALUES
  ('a0000000-0000-0000-0000-000000000000', 'Smartout AS', 'Smartout Corporation', '999888777', 'NO', 'other')
ON CONFLICT (company_id) DO UPDATE SET
  name        = EXCLUDED.name,
  legal_name  = EXCLUDED.legal_name;

-- ============================================================================
-- 2. WORKSPACE
-- ============================================================================
INSERT INTO public.workspace (workspace_id, company_id, name, slug, description, currency, language, country, onboarding_completed)
VALUES
  ('b0000000-0000-0000-0000-000000000000',
   'a0000000-0000-0000-0000-000000000000',
   'Demo Restaurant',
   'demo-restaurant',
   'Full-service restaurant & bar, Oslo',
   'NOK', 'no', 'NO', true)
ON CONFLICT (workspace_id) DO UPDATE SET
  name        = EXCLUDED.name,
  slug        = EXCLUDED.slug,
  description = EXCLUDED.description;

-- ============================================================================
-- 3. LOCATION
-- ============================================================================
INSERT INTO public.location (location_id, workspace_id, name, slug, location_type)
VALUES
  ('c0000000-0000-0000-0000-000000000000',
   'b0000000-0000-0000-0000-000000000000',
   'Oslo Downtown Hub', 'oslo-downtown', 'main')
ON CONFLICT (location_id) DO UPDATE SET
  name = EXCLUDED.name;

-- ============================================================================
-- 4. DEPARTMENTS
-- ============================================================================
INSERT INTO public.department (department_id, workspace_id, name, slug, sort_order)
VALUES
  ('d0000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000', 'Operations', 'operations', 0),
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000', 'Kitchen',     'kitchen',    1),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000', 'Service',     'service',    2),
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000', 'Bar',         'bar',        3)
ON CONFLICT (department_id) DO UPDATE SET
  name       = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;

-- ============================================================================
-- 4b. DEPARTMENT–LOCATION LINKS (ADR-0367 §4.4)
-- ============================================================================
INSERT INTO public.department_location (department_id, location_id, workspace_id)
VALUES
  ('d0000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000'),
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000'),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. AUTH USERS
-- Existing 10 (e0…0 through e0…9) + 4 new (e0…a through e0…d)
-- ============================================================================

-- We use individual INSERT ... WHERE NOT EXISTS per user to sidestep auth.users'
-- multi-unique-index conflicts (phone, email, id) that fire when batching rows
-- some of which may already exist. Each statement is fully atomic.

-- Admin
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone, phone_change,
  phone_change_token, reauthentication_token
)
SELECT
  'e0000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'admin@smartout.local',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"first_name": "Admin", "last_name": "Local"}',
  '{"provider": "email", "providers": ["email"]}',
  now(), now(), '', '', '', '', '', NULL, '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = 'e0000000-0000-0000-0000-000000000000'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone, phone_change,
  phone_change_token, reauthentication_token
)
SELECT
  'e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'anna@smartout.local',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"first_name": "Anna", "last_name": "Olsen"}',
  '{"provider": "email", "providers": ["email"]}',
  now(), now(), '', '', '', '', '', '+4791234567', '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = 'e0000000-0000-0000-0000-000000000001'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone, phone_change,
  phone_change_token, reauthentication_token
)
SELECT
  'e0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'erik@smartout.local',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"first_name": "Erik", "last_name": "Pedersen"}',
  '{"provider": "email", "providers": ["email"]}',
  now(), now(), '', '', '', '', '', '+4741122333', '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = 'e0000000-0000-0000-0000-000000000002'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone, phone_change,
  phone_change_token, reauthentication_token
)
SELECT
  'e0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'lise@smartout.local',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"first_name": "Lise", "last_name": "Markussen"}',
  '{"provider": "email", "providers": ["email"]}',
  now(), now(), '', '', '', '', '', '+4792233444', '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = 'e0000000-0000-0000-0000-000000000003'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone, phone_change,
  phone_change_token, reauthentication_token
)
SELECT
  'e0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'ole@smartout.local',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"first_name": "Ole", "last_name": "Torp"}',
  '{"provider": "email", "providers": ["email"]}',
  now(), now(), '', '', '', '', '', '+4743344555', '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = 'e0000000-0000-0000-0000-000000000004'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone, phone_change,
  phone_change_token, reauthentication_token
)
SELECT
  'e0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'kari@smartout.local',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"first_name": "Kari", "last_name": "Nilsen"}',
  '{"provider": "email", "providers": ["email"]}',
  now(), now(), '', '', '', '', '', '+4794455666', '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = 'e0000000-0000-0000-0000-000000000005'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone, phone_change,
  phone_change_token, reauthentication_token
)
SELECT
  'e0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'jon@smartout.local',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"first_name": "Jon", "last_name": "Doe"}',
  '{"provider": "email", "providers": ["email"]}',
  now(), now(), '', '', '', '', '', '+4745566777', '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = 'e0000000-0000-0000-0000-000000000006'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone, phone_change,
  phone_change_token, reauthentication_token
)
SELECT
  'e0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'sara@smartout.local',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"first_name": "Sara", "last_name": "Lee"}',
  '{"provider": "email", "providers": ["email"]}',
  now(), now(), '', '', '', '', '', '+4796677888', '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = 'e0000000-0000-0000-0000-000000000007'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone, phone_change,
  phone_change_token, reauthentication_token
)
SELECT
  'e0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'jonas@smartout.local',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"first_name": "Jonas", "last_name": "Bakken"}',
  '{"provider": "email", "providers": ["email"]}',
  now(), now(), '', '', '', '', '', '+4747788999', '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = 'e0000000-0000-0000-0000-000000000008'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone, phone_change,
  phone_change_token, reauthentication_token
)
SELECT
  'e0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'silje@smartout.local',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"first_name": "Silje", "last_name": "Ruud"}',
  '{"provider": "email", "providers": ["email"]}',
  now(), now(), '', '', '', '', '', '+4798899000', '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = 'e0000000-0000-0000-0000-000000000009'
);

-- New employees e-a through e-d (no phone numbers for new staff)
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone, phone_change,
  phone_change_token, reauthentication_token
)
SELECT
  'e0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'sofia@smartout.local',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"first_name": "Sofia", "last_name": "Berg"}',
  '{"provider": "email", "providers": ["email"]}',
  now(), now(), '', '', '', '', '', NULL, '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = 'e0000000-0000-0000-0000-00000000000a'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone, phone_change,
  phone_change_token, reauthentication_token
)
SELECT
  'e0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'mats@smartout.local',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"first_name": "Mats", "last_name": "Holm"}',
  '{"provider": "email", "providers": ["email"]}',
  now(), now(), '', '', '', '', '', NULL, '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = 'e0000000-0000-0000-0000-00000000000b'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone, phone_change,
  phone_change_token, reauthentication_token
)
SELECT
  'e0000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'nora@smartout.local',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"first_name": "Nora", "last_name": "Lie"}',
  '{"provider": "email", "providers": ["email"]}',
  now(), now(), '', '', '', '', '', NULL, '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = 'e0000000-0000-0000-0000-00000000000c'
);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone, phone_change,
  phone_change_token, reauthentication_token
)
SELECT
  'e0000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'even@smartout.local',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"first_name": "Even", "last_name": "Aas"}',
  '{"provider": "email", "providers": ["email"]}',
  now(), now(), '', '', '', '', '', NULL, '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = 'e0000000-0000-0000-0000-00000000000d'
);

-- ============================================================================
-- 5b. AUTH IDENTITIES
-- ============================================================================
INSERT INTO auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) VALUES
  ('e0000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000000',
   jsonb_build_object('sub', 'e0000000-0000-0000-0000-000000000000', 'email', 'admin@smartout.local', 'email_verified', true),
   'email', now(), now(), now()),
  ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
   jsonb_build_object('sub', 'e0000000-0000-0000-0000-000000000001', 'email', 'anna@smartout.local', 'email_verified', true),
   'email', now(), now(), now()),
  ('e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002',
   jsonb_build_object('sub', 'e0000000-0000-0000-0000-000000000002', 'email', 'erik@smartout.local', 'email_verified', true),
   'email', now(), now(), now()),
  ('e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003',
   jsonb_build_object('sub', 'e0000000-0000-0000-0000-000000000003', 'email', 'lise@smartout.local', 'email_verified', true),
   'email', now(), now(), now()),
  ('e0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000004',
   jsonb_build_object('sub', 'e0000000-0000-0000-0000-000000000004', 'email', 'ole@smartout.local', 'email_verified', true),
   'email', now(), now(), now()),
  ('e0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000005',
   jsonb_build_object('sub', 'e0000000-0000-0000-0000-000000000005', 'email', 'kari@smartout.local', 'email_verified', true),
   'email', now(), now(), now()),
  ('e0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000006',
   jsonb_build_object('sub', 'e0000000-0000-0000-0000-000000000006', 'email', 'jon@smartout.local', 'email_verified', true),
   'email', now(), now(), now()),
  ('e0000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000007',
   jsonb_build_object('sub', 'e0000000-0000-0000-0000-000000000007', 'email', 'sara@smartout.local', 'email_verified', true),
   'email', now(), now(), now()),
  ('e0000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000008',
   jsonb_build_object('sub', 'e0000000-0000-0000-0000-000000000008', 'email', 'jonas@smartout.local', 'email_verified', true),
   'email', now(), now(), now()),
  ('e0000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000009',
   jsonb_build_object('sub', 'e0000000-0000-0000-0000-000000000009', 'email', 'silje@smartout.local', 'email_verified', true),
   'email', now(), now(), now()),
  -- New employees
  ('e0000000-0000-0000-0000-00000000000a', 'e0000000-0000-0000-0000-00000000000a',
   jsonb_build_object('sub', 'e0000000-0000-0000-0000-00000000000a', 'email', 'sofia@smartout.local'),
   'email', now(), now(), now()),
  ('e0000000-0000-0000-0000-00000000000b', 'e0000000-0000-0000-0000-00000000000b',
   jsonb_build_object('sub', 'e0000000-0000-0000-0000-00000000000b', 'email', 'mats@smartout.local'),
   'email', now(), now(), now()),
  ('e0000000-0000-0000-0000-00000000000c', 'e0000000-0000-0000-0000-00000000000c',
   jsonb_build_object('sub', 'e0000000-0000-0000-0000-00000000000c', 'email', 'nora@smartout.local'),
   'email', now(), now(), now()),
  ('e0000000-0000-0000-0000-00000000000d', 'e0000000-0000-0000-0000-00000000000d',
   jsonb_build_object('sub', 'e0000000-0000-0000-0000-00000000000d', 'email', 'even@smartout.local'),
   'email', now(), now(), now())
ON CONFLICT (provider_id, provider) DO NOTHING;

-- ============================================================================
-- 6. COMPANY MEMBERS
-- ============================================================================
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
  ('e0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000000', 'member'),
  -- New employees
  ('e0000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000000', 'member'),
  ('e0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-000000000000', 'member'),
  ('e0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-000000000000', 'member'),
  ('e0000000-0000-0000-0000-00000000000d', 'a0000000-0000-0000-0000-000000000000', 'member')
ON CONFLICT (user_id, company_id) DO NOTHING;

-- ============================================================================
-- 7. PROFILES
-- Existing 10 (f0…0 through f0…9) + 4 new (f0…a through f0…d)
--
-- NOTE: trg_auto_assign_protocols fires on INSERT and references NEW.location_id
-- which was removed from the profile table. Disable it for the seed transaction
-- (legacy trigger bug — safe to skip: no protocols exist in a fresh seed DB).
-- ============================================================================
ALTER TABLE public.profile DISABLE TRIGGER trg_auto_assign_protocols;

-- Admin (owner)
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, display_name, job_title,
  address_line_1, postal_code, city
) VALUES (
  'f0000000-0000-0000-0000-000000000000', 'ADM001',
  'e0000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'owner', 'active',
  'd0000000-0000-0000-0000-000000000000',
  'Local Admin', 'Restaurant Manager',
  'Karl Johans gate 1', '0154', 'Oslo'
)
ON CONFLICT (profile_id) DO UPDATE SET
  role         = EXCLUDED.role,
  status       = EXCLUDED.status,
  department_id = EXCLUDED.department_id,
  display_name = EXCLUDED.display_name,
  job_title    = EXCLUDED.job_title;

-- Anna Olsen — Kitchen, Kokk, active
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, display_name, job_title,
  address_line_1, postal_code, city, personal_number, bank_account
) VALUES (
  'f0000000-0000-0000-0000-000000000001', 'EMP001',
  'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'employee', 'active',
  'd0000000-0000-0000-0000-000000000001',
  'Anna Olsen', 'Kokk',
  'Storgata 1', '0155', 'Oslo', '120190 12345', '1234.56.78901'
)
ON CONFLICT (profile_id) DO UPDATE SET
  role         = EXCLUDED.role,
  status       = EXCLUDED.status,
  department_id = EXCLUDED.department_id,
  display_name = EXCLUDED.display_name,
  job_title    = EXCLUDED.job_title;

-- Erik Pedersen — Kitchen, Sous Chef, manager/active
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, display_name, job_title,
  address_line_1, postal_code, city
) VALUES (
  'f0000000-0000-0000-0000-000000000002', 'EMP002',
  'e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'manager', 'active',
  'd0000000-0000-0000-0000-000000000001',
  'Erik Pedersen', 'Sous Chef',
  'Grensen 5', '0159', 'Oslo'
)
ON CONFLICT (profile_id) DO UPDATE SET
  role         = EXCLUDED.role,
  status       = EXCLUDED.status,
  department_id = EXCLUDED.department_id,
  display_name = EXCLUDED.display_name,
  job_title    = EXCLUDED.job_title;

-- Lise Markussen — Service, Servitor, inactive
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, display_name, job_title,
  address_line_1, postal_code, city
) VALUES (
  'f0000000-0000-0000-0000-000000000003', 'EMP003',
  'e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'employee', 'inactive',
  'd0000000-0000-0000-0000-000000000002',
  'Lise Markussen', 'Servitor',
  'Bogstadveien 22', '0355', 'Oslo'
)
ON CONFLICT (profile_id) DO UPDATE SET
  role         = EXCLUDED.role,
  status       = EXCLUDED.status,
  department_id = EXCLUDED.department_id,
  display_name = EXCLUDED.display_name,
  job_title    = EXCLUDED.job_title;

-- Ole Torp — Bar, Bartender, active
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, display_name, job_title,
  address_line_1, postal_code, city
) VALUES (
  'f0000000-0000-0000-0000-000000000004', 'EMP004',
  'e0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'employee', 'active',
  'd0000000-0000-0000-0000-000000000003',
  'Ole Torp', 'Bartender',
  'Thereses gate 14', '0452', 'Oslo'
)
ON CONFLICT (profile_id) DO UPDATE SET
  role         = EXCLUDED.role,
  status       = EXCLUDED.status,
  department_id = EXCLUDED.department_id,
  display_name = EXCLUDED.display_name,
  job_title    = EXCLUDED.job_title;

-- Kari Nilsen — Service, Servitor, trainee
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, display_name, job_title,
  trainee_started, address_line_1, postal_code, city
) VALUES (
  'f0000000-0000-0000-0000-000000000005', 'EMP005',
  'e0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'employee', 'trainee',
  'd0000000-0000-0000-0000-000000000002',
  'Kari Nilsen', 'Servitor',
  now() - interval '3 days',
  'Markveien 58', '0550', 'Oslo'
)
ON CONFLICT (profile_id) DO UPDATE SET
  role         = EXCLUDED.role,
  status       = EXCLUDED.status,
  department_id = EXCLUDED.department_id,
  display_name = EXCLUDED.display_name,
  job_title    = EXCLUDED.job_title;

-- Jon Doe — Kitchen, Oppvask, inactive
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, display_name, job_title,
  address_line_1, postal_code, city
) VALUES (
  'f0000000-0000-0000-0000-000000000006', 'EMP006',
  'e0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'employee', 'inactive',
  'd0000000-0000-0000-0000-000000000001',
  'Jon Doe', 'Oppvask',
  'Toftes gate 6', '0556', 'Oslo'
)
ON CONFLICT (profile_id) DO UPDATE SET
  role         = EXCLUDED.role,
  status       = EXCLUDED.status,
  department_id = EXCLUDED.department_id,
  display_name = EXCLUDED.display_name,
  job_title    = EXCLUDED.job_title;

-- Sara Lee — Service, Hovmester, inactive (manager)
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, display_name, job_title,
  address_line_1, postal_code, city
) VALUES (
  'f0000000-0000-0000-0000-000000000007', 'EMP007',
  'e0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'manager', 'inactive',
  'd0000000-0000-0000-0000-000000000002',
  'Sara Lee', 'Hovmester',
  'Josefines gate 11', '0351', 'Oslo'
)
ON CONFLICT (profile_id) DO UPDATE SET
  role         = EXCLUDED.role,
  status       = EXCLUDED.status,
  department_id = EXCLUDED.department_id,
  display_name = EXCLUDED.display_name,
  job_title    = EXCLUDED.job_title;

-- Jonas Bakken — Kitchen, Kokk, trainee
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, display_name, job_title,
  trainee_started, address_line_1, postal_code, city
) VALUES (
  'f0000000-0000-0000-0000-000000000008', 'EMP008',
  'e0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'employee', 'trainee',
  'd0000000-0000-0000-0000-000000000001',
  'Jonas Bakken', 'Kokk',
  now() - interval '1 day',
  'Uelands gate 28', '0460', 'Oslo'
)
ON CONFLICT (profile_id) DO UPDATE SET
  role         = EXCLUDED.role,
  status       = EXCLUDED.status,
  department_id = EXCLUDED.department_id,
  display_name = EXCLUDED.display_name,
  job_title    = EXCLUDED.job_title;

-- Silje Ruud — Service, Servitor, trainee
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, display_name, job_title,
  trainee_started, address_line_1, postal_code, city
) VALUES (
  'f0000000-0000-0000-0000-000000000009', 'EMP009',
  'e0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'employee', 'trainee',
  'd0000000-0000-0000-0000-000000000002',
  'Silje Ruud', 'Servitor',
  now() - interval '4 days',
  'Schweigaards gate 33', '0191', 'Oslo'
)
ON CONFLICT (profile_id) DO UPDATE SET
  role         = EXCLUDED.role,
  status       = EXCLUDED.status,
  department_id = EXCLUDED.department_id,
  display_name = EXCLUDED.display_name,
  job_title    = EXCLUDED.job_title;

-- ── New active employees (Saturday roster fill) ──────────────────────────────

-- Sofia Berg — Service, Sommelier, active
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, display_name, job_title,
  address_line_1, postal_code, city
) VALUES (
  'f0000000-0000-0000-0000-00000000000a', 'EMP010',
  'e0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'employee', 'active',
  'd0000000-0000-0000-0000-000000000002',
  'Sofia Berg', 'Sommelier',
  'Frognerveien 12', '0263', 'Oslo'
)
ON CONFLICT (profile_id) DO UPDATE SET
  role         = EXCLUDED.role,
  status       = EXCLUDED.status,
  department_id = EXCLUDED.department_id,
  display_name = EXCLUDED.display_name,
  job_title    = EXCLUDED.job_title;

-- Mats Holm — Bar, Bartender, active
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, display_name, job_title,
  address_line_1, postal_code, city
) VALUES (
  'f0000000-0000-0000-0000-00000000000b', 'EMP011',
  'e0000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'employee', 'active',
  'd0000000-0000-0000-0000-000000000003',
  'Mats Holm', 'Bartender',
  'Majorstugata 9', '0367', 'Oslo'
)
ON CONFLICT (profile_id) DO UPDATE SET
  role         = EXCLUDED.role,
  status       = EXCLUDED.status,
  department_id = EXCLUDED.department_id,
  display_name = EXCLUDED.display_name,
  job_title    = EXCLUDED.job_title;

-- Nora Lie — Kitchen, Konditor, active
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, display_name, job_title,
  address_line_1, postal_code, city
) VALUES (
  'f0000000-0000-0000-0000-00000000000c', 'EMP012',
  'e0000000-0000-0000-0000-00000000000c', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'employee', 'active',
  'd0000000-0000-0000-0000-000000000001',
  'Nora Lie', 'Konditor',
  'Pilestred 20', '0176', 'Oslo'
)
ON CONFLICT (profile_id) DO UPDATE SET
  role         = EXCLUDED.role,
  status       = EXCLUDED.status,
  department_id = EXCLUDED.department_id,
  display_name = EXCLUDED.display_name,
  job_title    = EXCLUDED.job_title;

-- Even Aas — Service, Vertinne, active
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, display_name, job_title,
  address_line_1, postal_code, city
) VALUES (
  'f0000000-0000-0000-0000-00000000000d', 'EMP013',
  'e0000000-0000-0000-0000-00000000000d', 'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000', 'employee', 'active',
  'd0000000-0000-0000-0000-000000000002',
  'Even Aas', 'Vertinne',
  'Grünerløkka 5', '0554', 'Oslo'
)
ON CONFLICT (profile_id) DO UPDATE SET
  role         = EXCLUDED.role,
  status       = EXCLUDED.status,
  department_id = EXCLUDED.department_id,
  display_name = EXCLUDED.display_name,
  job_title    = EXCLUDED.job_title;

ALTER TABLE public.profile ENABLE TRIGGER trg_auto_assign_protocols;

-- ============================================================================
-- 8. GODMODE (admin user)
-- ============================================================================
UPDATE public.user_identity
SET is_godmode = true
WHERE user_id = 'e0000000-0000-0000-0000-000000000000';

-- ============================================================================
-- 9. PENDING INVITATIONS
-- ============================================================================
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
   'f0000000-0000-0000-0000-000000000000')
ON CONFLICT (invitation_id) DO NOTHING;

-- ============================================================================
-- 10. ORG STRUCTURE — Zones, Teams, Positions
-- ============================================================================

-- ── 10.1 Zones ───────────────────────────────────────────────────────────────
INSERT INTO public.zone (zone_id, workspace_id, location_id, name, slug, capacity)
VALUES
  ('d1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'c0000000-0000-0000-0000-000000000000', 'Hovedsal',   'hovedsal',   60),
  ('d1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'c0000000-0000-0000-0000-000000000000', 'Terrasse',   'terrasse',   30),
  ('d1000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'c0000000-0000-0000-0000-000000000000', 'Bar-område', 'bar-omrade', 20),
  ('d1000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000000',
   'c0000000-0000-0000-0000-000000000000', 'Privat rom', 'privat-rom', 12)
ON CONFLICT (zone_id) DO UPDATE SET
  name     = EXCLUDED.name,
  capacity = EXCLUDED.capacity;

-- ── 10.2 Teams ───────────────────────────────────────────────────────────────
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
   NULL, 'operational')
ON CONFLICT (team_id) DO UPDATE SET
  name              = EXCLUDED.name,
  leader_profile_id = EXCLUDED.leader_profile_id;

-- ── 10.3 Positions (existing 4 + 4 new = 8 total) ────────────────────────────
INSERT INTO public.position (position_id, workspace_id, department_id, name, slug)
VALUES
  -- Existing
  ('ab000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000001', 'Head Chef',   'head-chef'),
  ('ab000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000001', 'Line Cook',   'line-cook'),
  ('ab000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000002', 'Waiter',      'waiter'),
  ('ab000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000003', 'Bartender',   'bartender'),
  -- New
  ('ab000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000000', 'Daglig leder', 'daglig-leder'),
  ('ab000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000001', 'Kjøkkensjef',  'kjokkensjef'),
  ('ab000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000002', 'Hovmester',    'hovmester'),
  ('ab000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000000',
   'd0000000-0000-0000-0000-000000000001', 'Oppvask',      'oppvask')
ON CONFLICT (position_id) DO UPDATE SET
  name          = EXCLUDED.name,
  department_id = EXCLUDED.department_id;

-- ── 10.4 Team Members ────────────────────────────────────────────────────────
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
  -- Bar Crew: Ole, Mats (new)
  ('aa000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000004'),
  ('aa000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-00000000000b')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 11. DEPARTMENT OPERATING HOURS
-- 4 departments × 7 weekdays = 28 rows.
-- day_of_week: 0=Monday … 6=Sunday (ISO-style used throughout Smartout).
-- Unique index: uq_dept_hours_weekly (department_id, location_id, season_id, day_of_week) NULLS NOT DISTINCT
-- location_id + season_id = NULL → workspace defaults, never seasonally restricted.
-- ============================================================================
INSERT INTO public.department_operating_hours (
  id, workspace_id, department_id, location_id, season_id,
  day_of_week, open_time, close_time, is_closed
)
SELECT
  gen_random_uuid(),
  'b0000000-0000-0000-0000-000000000000'::uuid,
  dept_id,
  NULL,
  NULL,
  dow,
  '10:00'::time,
  '23:00'::time,
  false
FROM (VALUES
  ('d0000000-0000-0000-0000-000000000000'::uuid),
  ('d0000000-0000-0000-0000-000000000001'::uuid),
  ('d0000000-0000-0000-0000-000000000002'::uuid),
  ('d0000000-0000-0000-0000-000000000003'::uuid)
) AS depts(dept_id)
CROSS JOIN generate_series(0, 6) AS dow
ON CONFLICT (department_id, location_id, season_id, day_of_week) DO NOTHING;

-- ============================================================================
-- 12. EMPLOYEE PAYROLL PROFILES
-- One row per ACTIVE (or otherwise billing-relevant) profile.
-- seniority_start_date + valid_from are date-dynamic (no hardcoded dates).
-- ============================================================================
INSERT INTO public.employee_payroll_profile (
  workspace_id, profile_id, has_fagbrev, salary_type, agreed_weekly_hours,
  tariff_category, seniority_start_date, valid_from
) VALUES
  -- Existing 9
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000001',
   false, 'hourly',   37.5, 'ufaglart', CURRENT_DATE - interval '2 years',   CURRENT_DATE - interval '2 years'),
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000002',
   true,  'hourly',   37.5, 'faglart',  CURRENT_DATE - interval '4 years',   CURRENT_DATE - interval '4 years'),
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000003',
   false, 'hourly',   20,   'ufaglart', CURRENT_DATE - interval '1 year',    CURRENT_DATE - interval '1 year'),
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000004',
   false, 'monthly',  37.5, 'ufaglart', CURRENT_DATE - interval '3 years',   CURRENT_DATE - interval '3 years'),
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000005',
   true,  'hourly',   37.5, 'faglart',  CURRENT_DATE - interval '5 years',   CURRENT_DATE - interval '5 years'),
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000006',
   false, 'hourly',   30,   'ufaglart', CURRENT_DATE - interval '2 years 6 months', CURRENT_DATE - interval '2 years 6 months'),
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000007',
   true,  'monthly',  37.5, 'faglart',  CURRENT_DATE - interval '7 years',   CURRENT_DATE - interval '7 years'),
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000008',
   false, 'hourly',   37.5, 'ufaglart', CURRENT_DATE - interval '45 days',   CURRENT_DATE - interval '45 days'),
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-000000000009',
   false, 'hourly',   20,   'ufaglart', CURRENT_DATE - interval '48 days',   CURRENT_DATE - interval '48 days'),
  -- 4 new employees
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-00000000000a',
   true,  'hourly',   37.5, 'faglart',  CURRENT_DATE - interval '3 years',   CURRENT_DATE - interval '3 years'),
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-00000000000b',
   false, 'hourly',   37.5, 'ufaglart', CURRENT_DATE - interval '1 year 6 months', CURRENT_DATE - interval '1 year 6 months'),
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-00000000000c',
   true,  'hourly',   37.5, 'faglart',  CURRENT_DATE - interval '2 years',   CURRENT_DATE - interval '2 years'),
  ('b0000000-0000-0000-0000-000000000000', 'f0000000-0000-0000-0000-00000000000d',
   false, 'hourly',   30,   'ufaglart', CURRENT_DATE - interval '8 months',  CURRENT_DATE - interval '8 months')
ON CONFLICT (profile_id) DO UPDATE SET
  has_fagbrev         = EXCLUDED.has_fagbrev,
  salary_type         = EXCLUDED.salary_type,
  agreed_weekly_hours = EXCLUDED.agreed_weekly_hours,
  tariff_category     = EXCLUDED.tariff_category;

COMMIT;
