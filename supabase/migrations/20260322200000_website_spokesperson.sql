-- Website spokesperson: approval flow tracking
-- Plan: docs/superpowers/plans/2026-03-22-website-factory-b2b.md

BEGIN;

-- Add spokesperson to section_type CHECK constraint
ALTER TABLE websites.website_section
  DROP CONSTRAINT website_section_section_type_check,
  ADD CONSTRAINT website_section_section_type_check
    CHECK (section_type IN (
      'hero', 'rich_text', 'text_image', 'feature_grid', 'gallery',
      'testimonials', 'cta', 'hours', 'map', 'contact',
      'menu_preview', 'menu_full', 'faq', 'booking_cta',
      'pdf_viewer', 'footer', 'spokesperson'
    ));

-- Spokesperson approval status
CREATE TYPE websites.spokesperson_status AS ENUM (
  'pending',    -- assigned, notification sent
  'approved',   -- employee accepted
  'declined',   -- employee declined
  'revoked'     -- admin removed
);

-- Spokesperson assignment tracking (one per section — UNIQUE constraint enforces this)
CREATE TABLE websites.website_spokesperson (
  website_spokesperson_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites.website(website_id),
  website_section_id UUID NOT NULL REFERENCES websites.website_section(website_section_id),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id),
  profile_id UUID NOT NULL REFERENCES public.profile(profile_id),
  role_title TEXT NOT NULL DEFAULT '',
  quote TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  status websites.spokesperson_status NOT NULL DEFAULT 'pending',
  decline_reason TEXT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  assigned_by UUID NOT NULL REFERENCES auth.users(id),
  content_schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(website_section_id)
);

-- Indexes
CREATE INDEX idx_spokesperson_website ON websites.website_spokesperson(website_id);
CREATE INDEX idx_spokesperson_profile ON websites.website_spokesperson(profile_id);
CREATE INDEX idx_spokesperson_status ON websites.website_spokesperson(status);

-- Trigger
CREATE TRIGGER set_website_spokesperson_updated_at
  BEFORE UPDATE ON websites.website_spokesperson
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE websites.website_spokesperson ENABLE ROW LEVEL SECURITY;

-- Admins have full access to spokesperson assignments in their workspace
CREATE POLICY "admin_all_spokesperson"
  ON websites.website_spokesperson
  FOR ALL
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- Employee can read their own spokesperson assignment
CREATE POLICY "employee_read_own_spokesperson"
  ON websites.website_spokesperson
  FOR SELECT
  USING (profile_id IN (
    SELECT profile_id FROM public.profile WHERE user_id = auth.uid()
  ));

-- Employee can update status on own assignment (approve/decline)
CREATE POLICY "employee_update_own_spokesperson"
  ON websites.website_spokesperson
  FOR UPDATE
  USING (profile_id IN (
    SELECT profile_id FROM public.profile WHERE user_id = auth.uid()
  ))
  WITH CHECK (profile_id IN (
    SELECT profile_id FROM public.profile WHERE user_id = auth.uid()
  ));

COMMIT;
