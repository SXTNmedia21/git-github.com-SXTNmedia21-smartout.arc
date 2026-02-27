-- Enums
CREATE TYPE auth_provider AS ENUM ('supabase', 'google', 'microsoft');
CREATE TYPE preferred_language AS ENUM ('no', 'sv', 'en', 'da', 'fi');
CREATE TYPE profile_role AS ENUM ('employee', 'manager', 'admin', 'owner');
CREATE TYPE profile_status AS ENUM ('trainee', 'active', 'inactive', 'offboarding');
CREATE TYPE industry AS ENUM ('restaurant', 'hotel', 'cafe', 'bar', 'catering', 'other');
CREATE TYPE currency AS ENUM ('NOK', 'SEK', 'DKK', 'EUR');
CREATE TYPE country AS ENUM ('NO', 'SE', 'DK', 'FI');
CREATE TYPE company_member_role AS ENUM ('owner', 'admin', 'member');

-- Updated_at Trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── GDPR PII VAULT ──────────────────────────────────────────
-- Highly restricted table containing all personal identifiers.
-- Only accessible to the user themselves or via audited Edge Functions.
CREATE TABLE public.user_identity (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text NOT NULL UNIQUE,
  phone text,
  auth_provider auth_provider NOT NULL DEFAULT 'supabase',
  auth_provider_id text,
  first_name text NOT NULL,
  last_name text NOT NULL,
  personal_email text,
  date_of_birth date,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  preferred_language preferred_language NOT NULL DEFAULT 'no',
  timezone text NOT NULL DEFAULT 'Europe/Oslo',
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE TRIGGER set_user_identity_updated_at BEFORE UPDATE ON public.user_identity FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Company
CREATE TABLE public.company (
  company_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  legal_name text,
  org_number text NOT NULL,
  country country NOT NULL DEFAULT 'NO',
  address_line_1 text,
  address_line_2 text,
  postal_code text,
  city text,
  phone text,
  email text,
  website text,
  logo_url text,
  industry industry NOT NULL DEFAULT 'restaurant',
  default_language preferred_language NOT NULL DEFAULT 'no',
  default_currency currency NOT NULL DEFAULT 'NOK',
  billing_email text,
  subscription_plan text,
  subscription_status text DEFAULT 'trial',
  trial_ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE TRIGGER set_company_updated_at BEFORE UPDATE ON public.company FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Workspace
CREATE TABLE public.workspace (
  workspace_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  timezone text NOT NULL DEFAULT 'Europe/Oslo',
  currency currency NOT NULL DEFAULT 'NOK',
  language preferred_language NOT NULL DEFAULT 'no',
  country country NOT NULL DEFAULT 'NO',
  address_line_1 text,
  address_line_2 text,
  postal_code text,
  city text,
  phone text,
  email text,
  logo_url text,
  active_modules text[] DEFAULT '{}',
  max_profiles integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_workspace_company FOREIGN KEY (company_id) REFERENCES public.company(company_id),
  UNIQUE(company_id, slug)
);
CREATE TRIGGER set_workspace_updated_at BEFORE UPDATE ON public.workspace FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Profile (Operational Data Only)
-- Contains absolutely no strict PII. Extremely permissive for complex inner joins during operational querying.
CREATE TABLE public.profile (
  profile_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_code text NOT NULL,
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  company_id uuid NOT NULL,
  
  -- Identity & Access
  role profile_role NOT NULL DEFAULT 'employee',
  status profile_status NOT NULL DEFAULT 'trainee',
  is_active boolean NOT NULL DEFAULT true,

  -- Organizational Placement
  department_id uuid,
  departments uuid[] DEFAULT '{}',
  location_id uuid,
  locations uuid[] DEFAULT '{}',
  
  -- Work Identity (No PII, just references)
  display_name text NOT NULL,
  job_title text,
  employee_number text,
  avatar_url text,
  
  -- Lifecycle
  trainee_started timestamptz,
  trainee_completed timestamptz,
  
  -- Preferences
  notification_pref jsonb DEFAULT '{"push": true, "sms": false, "email": true}'::jsonb,
  language_override preferred_language,
  
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES public.user_identity(user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_profile_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id),
  CONSTRAINT fk_profile_company FOREIGN KEY (company_id) REFERENCES public.company(company_id)
);
CREATE TRIGGER set_profile_updated_at BEFORE UPDATE ON public.profile FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Company Member (Operational)
CREATE TABLE public.company_member (
  company_member_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  role company_member_role NOT NULL DEFAULT 'member',
  title text,
  is_active boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_company_member_user FOREIGN KEY (user_id) REFERENCES public.user_identity(user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_company_member_company FOREIGN KEY (company_id) REFERENCES public.company(company_id)
);
CREATE TRIGGER set_company_member_updated_at BEFORE UPDATE ON public.company_member FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX idx_company_org_number ON public.company(org_number);
CREATE INDEX idx_profile_workspace_id ON public.profile(workspace_id);
CREATE INDEX idx_profile_user_id ON public.profile(user_id);

-- Auth integration trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_identity (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── GDPR Right to be Forgotten ──────────────────────────────────
-- Erases strict identity while leaving operational analytics intact
CREATE OR REPLACE FUNCTION public.anonymize_user(target_user_id UUID)
RETURNS void AS $$
BEGIN
  -- 1. Overwrite operational references
  UPDATE public.profile 
  SET 
    display_name = 'Anonymized User', 
    avatar_url = NULL, 
    employee_number = NULL,
    is_active = false
  WHERE user_id = target_user_id;

  -- 2. Destroy PII in the vault
  UPDATE public.user_identity
  SET
    email = 'anonymized_' || target_user_id || '@deleted.smartout.local',
    first_name = 'Anonymized',
    last_name = 'User',
    phone = NULL,
    personal_email = NULL,
    date_of_birth = NULL,
    emergency_contact_name = NULL,
    emergency_contact_phone = NULL,
    emergency_contact_relation = NULL,
    is_active = false
  WHERE user_id = target_user_id;

  -- Ensure they can never auth again
  UPDATE auth.users 
  SET email = 'anonymized_' || target_user_id || '@deleted.smartout.local', raw_user_meta_data = '{}'::jsonb
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
