SET search_path TO public, extensions;

-- Migration: invitation_sms_support
-- Description: Add phone and invite_type columns to invitation table for SMS and link invite support.
-- Connected to: docs/plans/2026-03-01-admin-wizard-completion.md

-- Create the invite_type enum (email, sms, link)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invite_type') THEN
    CREATE TYPE public.invite_type AS ENUM ('email', 'sms', 'link');
  END IF;
END $$;;

-- Add new columns
ALTER TABLE public.invitation
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS invite_type public.invite_type NOT NULL DEFAULT 'email';

-- Relax email NOT NULL to allow phone-only and link invites
ALTER TABLE public.invitation
  ALTER COLUMN email DROP NOT NULL;

-- Drop old unique constraint that requires email
ALTER TABLE public.invitation
  DROP CONSTRAINT IF EXISTS invitation_workspace_id_email_status_key;

-- Add new unique constraint that handles null email (partial index approach)
-- Email invites: unique per workspace + email + status
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitation_unique_email
  ON public.invitation (workspace_id, email, status)
  WHERE email IS NOT NULL;

-- Phone invites: unique per workspace + phone + status
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitation_unique_phone
  ON public.invitation (workspace_id, phone, status)
  WHERE phone IS NOT NULL;

-- Check constraint: must have email or phone (or be a link invite)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invitation_contact_check') THEN
    ALTER TABLE public.invitation ADD CONSTRAINT invitation_contact_check CHECK (email IS NOT NULL OR phone IS NOT NULL OR invite_type = 'link');
  END IF;
END $$;

-- Index for phone lookups
CREATE INDEX IF NOT EXISTS idx_invitation_phone
  ON public.invitation (phone)
  WHERE phone IS NOT NULL;
