-- ============================================================================
-- seed-admin.sql — ENV-2: accountant user + grant for admin e2e tests
--
-- Unblocks: apps/e2e/admin/avstemming.spec.ts (10/11 tests skipped)
-- Status: seeded (2026-05-24)
--
-- Inserts:
--   1 × auth.users row        (accountant@smartout.local / password123)
--   1 × auth.identities row
--   1 × user_identity row     (auto via trigger — explicit insert as fallback)
--   1 × company_member row    (links accountant to Smartout AS company)
--   1 × billing.accountant_company_grant row (full_kartotek scope)
--
-- Idempotent: all inserts use ON CONFLICT DO NOTHING.
-- Run after supabase/seed.sql (depends on company a0000000-...).
-- ============================================================================

SET search_path = public, extensions, billing, pg_catalog;

-- ─── 1. Auth user ────────────────────────────────────────────────────────────
-- UUID e0000000-0000-0000-0000-00000000000a = accountant slot
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new,
  email_change_token_current, email_change, phone, phone_change,
  phone_change_token, reauthentication_token
) VALUES (
  'e0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'accountant@smartout.local',
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"first_name": "Regnskap", "last_name": "Tester"}',
  '{"provider": "email", "providers": ["email"]}',
  now(), now(), '', '', '', '', '', NULL, '', '', ''
) ON CONFLICT (id) DO NOTHING;

-- ─── 2. Auth identity ────────────────────────────────────────────────────────
INSERT INTO auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) VALUES (
  'e0000000-0000-0000-0000-00000000000a',
  'e0000000-0000-0000-0000-00000000000a',
  '{"sub":"e0000000-0000-0000-0000-00000000000a","email":"accountant@smartout.local","email_verified":true}',
  'email',
  now(), now(), now()
) ON CONFLICT (provider_id, provider) DO NOTHING;

-- ─── 3. user_identity (defensive — handle_new_user trigger usually covers this) ───
INSERT INTO public.user_identity (user_id, email, first_name, last_name)
VALUES (
  'e0000000-0000-0000-0000-00000000000a',
  'accountant@smartout.local',
  'Regnskap',
  'Tester'
) ON CONFLICT (user_id) DO NOTHING;

-- ─── 4. Company member (links accountant user to Smartout AS company) ─────────
-- Accountants are NOT company_members in the workspace sense; this is the
-- company-level link. The actual grant is in billing.accountant_company_grant.
INSERT INTO public.company_member (user_id, company_id, role)
VALUES (
  'e0000000-0000-0000-0000-00000000000a',
  'a0000000-0000-0000-0000-000000000000',
  'member'
) ON CONFLICT (user_id, company_id) DO NOTHING;

-- ─── 5. Accountant grant ──────────────────────────────────────────────────────
-- Links accountant@smartout.local to Smartout AS with full_kartotek scope.
-- granted_by = admin/godmode user (e0000000-...-0000).
INSERT INTO billing.accountant_company_grant (
  grant_id,
  user_id,
  company_id,
  scope,
  granted_by,
  granted_at
) VALUES (
  'ac000000-0000-0000-0000-000000000001',
  'e0000000-0000-0000-0000-00000000000a',
  'a0000000-0000-0000-0000-000000000000',
  'full_kartotek',
  'e0000000-0000-0000-0000-000000000000',  -- admin/godmode granted
  now()
) ON CONFLICT (user_id, company_id) DO NOTHING;
