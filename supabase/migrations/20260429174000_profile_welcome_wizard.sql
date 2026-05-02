-- Migration: welcome wizard columns
-- Adds `is_welcome_complete`, `welcome_completed_at`, and `family_situation`
-- to the `profile` table. All other wizard fields (name, phone, date_of_birth,
-- address_line_1, postal_code, city, bank_account, personal_number,
-- emergency_contact_*) already exist on `profile` or `user_identity`.
--
-- `family_situation` is a soft enum stored as text. Using a constraint rather
-- than a PG ENUM so it can be extended without a DDL migration.
--
-- Depends on: existing `profile` table (public schema).

-- ── Welcome wizard completion flag ───────────────────────────────────────────

ALTER TABLE public.profile
  ADD COLUMN IF NOT EXISTS is_welcome_complete BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profile
  ADD COLUMN IF NOT EXISTS welcome_completed_at TIMESTAMPTZ NULL;

-- ── Family situation (soft enum) ─────────────────────────────────────────────

ALTER TABLE public.profile
  ADD COLUMN IF NOT EXISTS family_situation TEXT NULL
    CHECK (family_situation IN ('enslig', 'samboer', 'gift', 'barn'));

-- ── Comments ─────────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.profile.is_welcome_complete IS
  'True once the employee has completed the first-login welcome wizard. '
  'Gates dashboard access: DashboardShell renders WelcomeWizard overlay until true.';

COMMENT ON COLUMN public.profile.welcome_completed_at IS
  'Timestamp when is_welcome_complete was set to true. Audit trail only.';

COMMENT ON COLUMN public.profile.family_situation IS
  'Self-reported family situation. One of: enslig, samboer, gift, barn. '
  'Optional; collected in welcome wizard Step 5.';
