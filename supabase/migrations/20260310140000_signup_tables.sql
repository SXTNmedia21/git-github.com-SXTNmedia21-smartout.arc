-- Migration: signup_tables
-- Description: Create 5 tables for the signup flow:
--   signup_progress, company_scraped_data, company_details,
--   company_opening_hours, company_social_media

-- ============================================================
-- 1. signup_progress
-- ============================================================
CREATE TABLE public.signup_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step integer NOT NULL DEFAULT 1,
  step_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.signup_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signup_progress_select_own" ON public.signup_progress
  FOR SELECT USING (auth.uid() = auth_id);

CREATE POLICY "signup_progress_insert_own" ON public.signup_progress
  FOR INSERT WITH CHECK (auth.uid() = auth_id);

CREATE POLICY "signup_progress_update_own" ON public.signup_progress
  FOR UPDATE USING (auth.uid() = auth_id);

CREATE TRIGGER set_signup_progress_updated_at
  BEFORE UPDATE ON public.signup_progress
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 2. company_scraped_data
-- ============================================================
CREATE TABLE public.company_scraped_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspace(workspace_id),
  source_url text NOT NULL,
  scrape_status text NOT NULL DEFAULT 'pending'
    CHECK (scrape_status IN ('pending', 'scraping', 'success', 'partial', 'failed')),
  raw_data jsonb,
  parsed_data jsonb,
  scraped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_company_scraped_data_auth_id ON public.company_scraped_data(auth_id);

ALTER TABLE public.company_scraped_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_scraped_data_select_own" ON public.company_scraped_data
  FOR SELECT USING (auth.uid() = auth_id);

CREATE POLICY "company_scraped_data_insert_own" ON public.company_scraped_data
  FOR INSERT WITH CHECK (auth.uid() = auth_id);

CREATE POLICY "company_scraped_data_update_own" ON public.company_scraped_data
  FOR UPDATE USING (auth.uid() = auth_id);

CREATE TRIGGER set_company_scraped_data_updated_at
  BEFORE UPDATE ON public.company_scraped_data
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 3. company_details
-- ============================================================
CREATE TABLE public.company_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  about_us text,
  our_history text,
  our_concept text,
  restaurant_type text,
  cuisine_types text[] DEFAULT '{}',
  price_category text,
  menu_description text,
  employee_count text,
  ai_generated_fields text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_details_select_workspace" ON public.company_details
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "company_details_all_admin" ON public.company_details
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE TRIGGER set_company_details_updated_at
  BEFORE UPDATE ON public.company_details
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 4. company_opening_hours
-- ============================================================
CREATE TABLE public.company_opening_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_closed boolean NOT NULL DEFAULT false,
  open_time time,
  close_time time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, day_of_week)
);

ALTER TABLE public.company_opening_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_opening_hours_select_workspace" ON public.company_opening_hours
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "company_opening_hours_all_admin" ON public.company_opening_hours
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE TRIGGER set_company_opening_hours_updated_at
  BEFORE UPDATE ON public.company_opening_hours
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 5. company_social_media
-- ============================================================
CREATE TABLE public.company_social_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  platform text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, platform)
);

ALTER TABLE public.company_social_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_social_media_select_workspace" ON public.company_social_media
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "company_social_media_all_admin" ON public.company_social_media
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE TRIGGER set_company_social_media_updated_at
  BEFORE UPDATE ON public.company_social_media
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
