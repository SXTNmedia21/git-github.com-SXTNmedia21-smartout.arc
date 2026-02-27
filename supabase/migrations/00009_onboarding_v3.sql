-- Smartout Workspace Onboarding Architecture v3.1 Migrations
-- Target: onboarding_session, company, workspace

-- 1. Workspace table additions
ALTER TABLE public.workspace ADD COLUMN IF NOT EXISTS cover_photo_url text;
ALTER TABLE public.workspace ADD COLUMN IF NOT EXISTS slogan text;
ALTER TABLE public.workspace ADD COLUMN IF NOT EXISTS short_description varchar(280);
ALTER TABLE public.workspace ADD COLUMN IF NOT EXISTS extended_description text;
ALTER TABLE public.workspace ADD COLUMN IF NOT EXISTS brand_color varchar(7);
ALTER TABLE public.workspace ADD COLUMN IF NOT EXISTS communication_tone varchar(20);

-- 2. Company table additions
ALTER TABLE public.company ADD COLUMN IF NOT EXISTS legal_name text;
ALTER TABLE public.company ADD COLUMN IF NOT EXISTS nace_code varchar(10);
ALTER TABLE public.company ADD COLUMN IF NOT EXISTS nace_description text;
ALTER TABLE public.company ADD COLUMN IF NOT EXISTS daglig_leder text;
ALTER TABLE public.company ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE public.company ADD COLUMN IF NOT EXISTS company_type varchar(10);
ALTER TABLE public.company ADD COLUMN IF NOT EXISTS registration_date date;

-- 3. Onboarding session table
CREATE TABLE IF NOT EXISTS public.onboarding_session (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid REFERENCES auth.users(id),
  company_id             uuid REFERENCES public.company(company_id),
  workspace_id           uuid REFERENCES public.workspace(workspace_id),
  season_id              uuid REFERENCES public.season(season_id),

  -- Progress
  current_step           integer DEFAULT 0,
  completed_steps        integer[] DEFAULT '{}',
  seasonal_context       varchar(20),        -- low | getting_ready | high | normal

  -- Intelligence sources (raw data for reference)
  source_url             text,
  scraped_data           jsonb,
  brreg_data             jsonb,
  web_search_data        jsonb,              -- NEW: web search results
  ai_analysis            jsonb,

  -- What AI suggested vs what admin confirmed (learning data)
  suggested_departments  jsonb,
  confirmed_departments  jsonb,
  suggested_positions    jsonb,
  confirmed_positions    jsonb,
  suggested_teams        jsonb,
  confirmed_teams        jsonb,
  suggested_locations    jsonb,
  confirmed_locations    jsonb,
  suggested_branding     jsonb,
  confirmed_branding     jsonb,

  -- Contract
  contract_generated_at  timestamptz,
  contract_sent_at       timestamptz,
  contract_signed_at     timestamptz,
  contract_url           text,

  -- Meta
  started_at             timestamptz DEFAULT now(),
  completed_at           timestamptz,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now()
);

-- Enable RLS on onboarding_session
ALTER TABLE public.onboarding_session ENABLE ROW LEVEL SECURITY;

-- Add basic RLS policies for onboarding_session
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'onboarding_session' AND policyname = 'Users can view their own onboarding sessions'
    ) THEN
        CREATE POLICY "Users can view their own onboarding sessions" 
            ON public.onboarding_session FOR SELECT 
            USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'onboarding_session' AND policyname = 'Users can create onboarding sessions'
    ) THEN
        CREATE POLICY "Users can create onboarding sessions" 
            ON public.onboarding_session FOR INSERT 
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'onboarding_session' AND policyname = 'Users can update their own onboarding sessions'
    ) THEN
        CREATE POLICY "Users can update their own onboarding sessions" 
            ON public.onboarding_session FOR UPDATE 
            USING (auth.uid() = user_id);
    END IF;
END $$;
