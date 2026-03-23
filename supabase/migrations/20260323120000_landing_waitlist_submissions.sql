SET search_path TO public, extensions;

-- ============================================
-- 20260323120000_landing_waitlist_submissions.sql
-- Creates structured waitlist storage for public
-- landing campaigns such as free4ever.smartout.ai.
--
-- Schema placement decision:
-- - Use public because this is a platform-admin
--   marketing surface, not a workspace-scoped domain.
-- - It belongs next to landing_event, landing_visitor
--   and landing_session rather than a tenant schema.
-- - No RLS because writes happen through service-role
--   campaign endpoints and reads are platform-admin only.
-- ============================================

CREATE TABLE IF NOT EXISTS public.landing_waitlist_submission (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_key                    text NOT NULL,
  full_name                       text NOT NULL,
  company_name                    text NOT NULL,
  email                           text NOT NULL,
  phone                           text,
  employee_count                  text NOT NULL,
  interested_package              text NOT NULL,
  premium_reservation_interest    boolean NOT NULL DEFAULT false,
  status                          text NOT NULL DEFAULT 'new',
  source_hostname                 text,
  source_path                     text,
  variant                         text,
  visitor_id                      uuid REFERENCES public.landing_visitor(id) ON DELETE SET NULL,
  session_id                      text,
  ip_address                      inet,
  user_agent                      text,
  created_at                      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_landing_waitlist_campaign
  ON public.landing_waitlist_submission (campaign_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_landing_waitlist_status
  ON public.landing_waitlist_submission (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_landing_waitlist_email
  ON public.landing_waitlist_submission (email);
