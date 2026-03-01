-- ============================================
-- 20260301400000_landing_event_table.sql
-- Creates the landing_event table for tracking
-- anonymous visitor activity on the landing page.
-- Connected to: apps/landing/src/app/api/track/route.ts (writes)
--               apps/web/src/app/platform-admin/landing/ (reads)
-- ============================================

-- Tracks anonymous events from the public landing page.
-- No RLS — service role access only, consistent with other platform-admin tables.
CREATE TABLE public.landing_event (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type  text NOT NULL,  -- 'page_view' | 'voice_session_started' | 'cta_click'
  variant     text,           -- 'B' | 'E' | 'T' | 'K' | 'A' | 'F' | 'S'
  session_id  text,           -- anonymous browser session ID from sessionStorage
  referrer    text,           -- document.referrer at time of event
  ip_address  inet,           -- captured server-side from x-forwarded-for
  user_agent  text,           -- captured server-side from User-Agent header
  details     jsonb DEFAULT '{}', -- flexible extra data: { label, callId, mission, etc. }
  created_at  timestamptz DEFAULT now() NOT NULL
);

-- Primary access pattern: recent events in reverse chronological order
CREATE INDEX idx_landing_event_time ON public.landing_event (created_at DESC);

-- Filtering by event type (e.g., count voice sessions today)
CREATE INDEX idx_landing_event_type ON public.landing_event (event_type, created_at DESC);
