-- Smartout Preview Branch DB Seed
-- ================================================================
-- Minimal data for Supabase Branch DB preview environments.
-- Run after branch creation to enable basic feature testing.
--
-- Based on supabase/seed.sql but reduced to essentials:
-- 1 company, 1 workspace, 1 admin user, core agent config.
-- ================================================================

-- 1. Company
INSERT INTO public.company (company_id, name, legal_name, org_number, country, industry)
VALUES ('a0000000-0000-0000-0000-000000000000', 'Preview Corp', 'Preview Corporation', '999000111', 'NO', 'hospitality')
ON CONFLICT (company_id) DO NOTHING;

-- 2. Workspace
INSERT INTO public.workspace (workspace_id, company_id, name, slug, description, currency, language, country, onboarding_completed)
VALUES ('b0000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'Preview Workspace', 'preview-ws', 'Branch DB preview', 'NOK', 'no', 'NO', true)
ON CONFLICT (workspace_id) DO NOTHING;

-- 3. Location
-- NOTE: Verify location_type enum values against database.types.ts before running.
-- Common values: 'headquarters', 'branch', 'warehouse'. Adjust if 'main' is not valid.
INSERT INTO public.location (location_id, workspace_id, name, slug, location_type)
VALUES ('c0000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000', 'Preview Location', 'preview-loc', 'headquarters')
ON CONFLICT (location_id) DO NOTHING;

-- 4. Department
INSERT INTO public.department (department_id, workspace_id, name, slug, sort_order)
VALUES ('d0000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000', 'Service', 'service', 0)
ON CONFLICT (department_id) DO NOTHING;

-- 5. Admin user (test only — email @preview.local)
-- IMPORTANT: auth.users INSERT triggers handle_new_user() which creates user_identity.
-- But we also need company_member + profile for workspace access and RLS.
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone, phone_change,
  phone_change_token, reauthentication_token
) VALUES (
  'e0000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'admin@preview.local',
  crypt('preview123', gen_salt('bf')), now(),
  '{"first_name": "Preview", "last_name": "Admin"}',
  '{"provider": "email", "providers": ["email"]}',
  now(), now(), '', '', '', '', '', '', '', '', ''
) ON CONFLICT (id) DO NOTHING;

-- 5b. Company member (links user to company with owner role)
INSERT INTO public.company_member (user_id, company_id, role)
VALUES ('e0000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000', 'owner')
ON CONFLICT (user_id, company_id) DO NOTHING;

-- 5c. Profile (workspace-scoped, required for RLS)
INSERT INTO public.profile (profile_id, workspace_id, user_id, display_name, role, profile_status)
VALUES ('f0000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000', 'e0000000-0000-0000-0000-000000000000', 'Preview Admin', 'owner', 'active')
ON CONFLICT (profile_id) DO NOTHING;

-- 6. Default engine_authority_config (read_only baseline)
INSERT INTO public.engine_authority_config (workspace_id, capability, authority_level)
VALUES
  ('b0000000-0000-0000-0000-000000000000', 'schedule', 'read_only'),
  ('b0000000-0000-0000-0000-000000000000', 'training', 'read_only'),
  ('b0000000-0000-0000-0000-000000000000', 'operations', 'read_only')
ON CONFLICT (workspace_id, capability) DO NOTHING;
