-- ============================================================================
-- System Actor Profile Seed (task #16, R5.3-5 remediation)
-- ----------------------------------------------------------------------------
-- Seeds a reserved sentinel profile row used as the `actor_id` fallback by
-- Edge Functions that emit to `activity_trail` on behalf of the platform
-- itself — primarily `supabase/functions/journey-stuck-detector/index.ts`.
--
-- Background:
--   Before this migration, `journey-stuck-detector` emitted with the literal
--   string `"system"` when no actor could be resolved. That value is not a
--   UUID, failed type checks, and would have violated the
--   `activity_trail.actor_id` FK → `profile.profile_id` in production. The
--   2026-04-21 Journey Runner council verdict R5.3-5 flagged this yellow.
--
--   This migration establishes a deterministic UUID the Edge Function can
--   reference: `00000000-0000-0000-0000-000000000001`.
--
-- Design:
--   * `profile` has NOT NULL FKs to `user_identity`, `workspace`, and
--     `company`. We seed the whole chain idempotently using reserved UUIDs.
--   * The `auth.users` insert reuses the pattern from supabase/seed.sql —
--     marked with a `sentinel=true` app_metadata flag so it's clearly not a
--     real user.
--   * Every insert uses `ON CONFLICT DO NOTHING` so re-runs are safe.
--   * No `ALTER`s of existing rows. The migration is purely additive (L-0075).
--
-- Guardrails:
--   * If the sentinel workspace/company/user already exists (e.g., from a
--     prior run), the inserts skip gracefully. The migration never overwrites
--     real tenant data — the reserved zero-prefixed UUIDs are unambiguously
--     sentinel-class.
--   * Mirrors ADR-0176 (authority seed via migration, not runtime insert).
--
-- Reserved UUIDs (used across the sentinel chain):
--   auth.users.id / user_identity.user_id : 00000000-0000-0000-0000-000000000001
--   company.company_id                    : 00000000-0000-0000-0000-0000000000c1
--   workspace.workspace_id                : 00000000-0000-0000-0000-0000000000a1
--   profile.profile_id (SYSTEM_ACTOR_ID)  : 00000000-0000-0000-0000-000000000001
--
-- Consumer:
--   `supabase/functions/journey-stuck-detector/index.ts` exports
--   `SYSTEM_ACTOR_ID` constant set to the profile.profile_id value above.
-- ============================================================================

-- 1. Sentinel auth user. The `handle_new_user()` trigger fires after this
--    insert and creates the matching `public.user_identity` row automatically
--    (see supabase/migrations/00001_identity_tables.sql). We still issue a
--    defensive `INSERT ... ON CONFLICT DO NOTHING` on `user_identity` below
--    in case the trigger is disabled or was already fired.
--
-- F-DB-03 hardening (2026-05-06 audit): wrap in DO $$ EXCEPTION block so the
-- migration survives Supabase Auth schema upgrades. If `auth.users` adds a
-- new NOT NULL column or drops one of the existing ones, this insert will
-- raise rather than crash db reset — log + continue. The downstream
-- `user_identity` insert (step 2) is independent and can still succeed.
DO $$
BEGIN
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    raw_app_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change_token_current,
    email_change,
    phone,
    phone_change,
    phone_change_token,
    reauthentication_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'system@smartout.internal',
    -- Unusable password hash. This user can never sign in.
    crypt(gen_random_uuid()::text, gen_salt('bf')),
    now(),
    '{"first_name": "Smartout", "last_name": "System"}'::jsonb,
    '{"provider": "system", "providers": ["system"], "sentinel": true}'::jsonb,
    now(),
    now(),
    '', '', '', '', '', NULL, '', '', ''
  )
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN undefined_column OR not_null_violation THEN
    RAISE NOTICE 'auth.users schema mismatch — sentinel auth user not seeded. Likely Supabase Auth upgrade changed column set. Edge Functions emitting via SYSTEM_ACTOR_ID may fail until schema realigned. Error: %', SQLERRM;
  WHEN OTHERS THEN
    RAISE NOTICE 'Unexpected error seeding sentinel auth user: %', SQLERRM;
END $$;

-- 2. Sentinel user_identity. Defensive insert — handle_new_user() trigger
--    above will have populated this row already in the normal case.
INSERT INTO public.user_identity (
  user_id,
  email,
  first_name,
  last_name,
  auth_provider,
  is_active,
  preferred_language,
  timezone
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'system@smartout.internal',
  'Smartout',
  'System',
  'supabase',
  false, -- never logs in; keep the flag honest
  'en',
  'UTC'
)
ON CONFLICT (user_id) DO NOTHING;

-- 3. Sentinel company. Not a real tenant — never shown in UI, never billed.
INSERT INTO public.company (
  company_id,
  name,
  legal_name,
  org_number,
  country,
  industry,
  subscription_status,
  is_active
) VALUES (
  '00000000-0000-0000-0000-0000000000c1',
  'Smartout System',
  'Smartout System (reserved)',
  '000000000', -- reserved sentinel org number
  'NO',
  'other',
  'sentinel',
  false
)
ON CONFLICT (company_id) DO NOTHING;

-- 4. Sentinel workspace. Reserved — no real users assigned, never visible.
INSERT INTO public.workspace (
  workspace_id,
  company_id,
  name,
  slug,
  description,
  country,
  currency,
  language,
  timezone,
  is_active
) VALUES (
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000000c1',
  'Smartout System Workspace',
  'system',
  'Reserved workspace for platform-emitted telemetry. Not a tenant.',
  'NO',
  'NOK',
  'en',
  'UTC',
  false
)
ON CONFLICT (workspace_id) DO NOTHING;

-- 5. Sentinel profile — the row whose profile_id is SYSTEM_ACTOR_ID and is
--    referenced by activity_trail.actor_id from platform Edge Functions.
INSERT INTO public.profile (
  profile_id,
  profile_code,
  user_id,
  workspace_id,
  company_id,
  role,
  status,
  is_active,
  display_name,
  job_title,
  joined_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'SYSTEM',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000000c1',
  'admin',
  'inactive',
  false,
  'Smartout System',
  'Platform Actor (reserved)',
  now()
)
ON CONFLICT (profile_id) DO NOTHING;

-- ─── Annotation ────────────────────────────────────────────────────
-- Future Edge Functions may use this same SYSTEM_ACTOR_ID (profile_id
-- `00000000-0000-0000-0000-000000000001`) for telemetry emits when no
-- tenant actor is available. Do NOT repurpose these reserved UUIDs for
-- any other entity.
COMMENT ON COLUMN public.profile.profile_id IS
  'Profile primary key. The reserved sentinel value ''00000000-0000-0000-0000-000000000001'' represents the platform "system actor" used by Edge Functions (e.g., journey-stuck-detector) when emitting telemetry without a tenant actor. See migration 20260422215500_system_actor_profile_seed.sql.';
