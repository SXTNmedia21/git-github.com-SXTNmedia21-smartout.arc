-- ============================================
-- 20260301600000_landing_session_tracking.sql
-- Creates landing_visitor and landing_session tables,
-- and extends landing_event with visitor_id FK.
-- Enables per-visitor and per-session analytics
-- for the landing page funnel.
-- Connected to: apps/landing/src/app/api/track/route.ts (writes)
--               apps/web/src/app/platform-admin/landing/ (reads)
--               supabase/migrations/20260301400000_landing_event_table.sql
-- ============================================

-- ======================
-- 1. landing_visitor
-- ======================
-- One row per unique cookie (smo_vid). Tracks repeat visitors,
-- links to user_identity if they later sign up, and supports
-- manual tagging by platform admins.
-- No RLS — service role access only (platform-admin table).
CREATE TABLE public.landing_visitor (
  id                uuid PRIMARY KEY,                          -- = smo_vid cookie value
  first_seen        timestamptz NOT NULL DEFAULT now(),
  last_seen         timestamptz NOT NULL DEFAULT now(),
  visit_count       int NOT NULL DEFAULT 1,
  first_referrer    text,
  first_variant     text,
  ip_addresses      text[] NOT NULL DEFAULT '{}',
  user_agents       text[] NOT NULL DEFAULT '{}',
  user_identity_id  uuid REFERENCES public.user_identity(user_id) ON DELETE SET NULL,
  manual_label      text,
  manual_notes      text,
  tagged_by         uuid REFERENCES public.user_identity(user_id) ON DELETE SET NULL,
  tagged_at         timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Recent visitors first (admin dashboard default sort)
CREATE INDEX idx_landing_visitor_last_seen ON public.landing_visitor(last_seen DESC);

-- Quick lookup when linking visitor to signed-up user
CREATE INDEX idx_landing_visitor_identity ON public.landing_visitor(user_identity_id) WHERE user_identity_id IS NOT NULL;

-- ======================
-- 2. landing_session
-- ======================
-- One row per browser tab session. Aggregates event-level data
-- into session-level metrics for funnel analysis.
-- No RLS — service role access only (platform-admin table).
CREATE TABLE public.landing_session (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id        uuid NOT NULL REFERENCES public.landing_visitor(id) ON DELETE CASCADE,
  session_id        text NOT NULL,
  started_at        timestamptz NOT NULL DEFAULT now(),
  ended_at          timestamptz,
  duration_seconds  int,
  max_scroll_depth  int NOT NULL DEFAULT 0,
  page_count        int NOT NULL DEFAULT 0,
  click_count       int NOT NULL DEFAULT 0,
  cta_click_count   int NOT NULL DEFAULT 0,
  variant           text,
  referrer          text,
  ip_address        inet,
  user_agent        text,
  device_type       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- All sessions for a given visitor
CREATE INDEX idx_landing_session_visitor ON public.landing_session(visitor_id);

-- Recent sessions first (admin dashboard)
CREATE INDEX idx_landing_session_started ON public.landing_session(started_at DESC);

-- Lookup by session_id (from cookie/sessionStorage value)
CREATE UNIQUE INDEX idx_landing_session_sid ON public.landing_session(session_id);

-- ======================
-- 3. Extend landing_event
-- ======================
-- Add visitor_id FK so events can be grouped by visitor.
-- session_id column already exists (text) — just add indexes.
ALTER TABLE public.landing_event
  ADD COLUMN visitor_id uuid REFERENCES public.landing_visitor(id) ON DELETE SET NULL;

-- Events by visitor (for visitor detail view)
CREATE INDEX idx_landing_event_visitor ON public.landing_event(visitor_id) WHERE visitor_id IS NOT NULL;

-- Events by session (for session replay / timeline)
CREATE INDEX idx_landing_event_session ON public.landing_event(session_id) WHERE session_id IS NOT NULL;
