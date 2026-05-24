-- ============================================
-- 20260625130000_channel_is_active_column.sql
-- BUG-21: add channel.is_active boolean column
-- ============================================
-- Root cause: journey-help E2E tests filter and insert using
-- channel.is_active but the column was never created. The channel
-- table has is_archived (inverse semantics). Adding is_active as an
-- explicit first-class column lets the helpdesk query surface filter
-- "live" channels without relying on is_archived=false semantics,
-- and lets seed code set the flag explicitly on insert.
--
-- Semantics: is_active=true → channel is live (default for new rows).
-- is_active=false → soft-deactivated (does not cascade to is_archived;
-- the two flags are orthogonal — a channel can be archived AND inactive,
-- or active but archived during a grace window).
--
-- Migration is ADDITIVE ONLY. No data backfill required:
-- all existing channels default to is_active=true, which is the
-- correct sentinel for "never explicitly deactivated".
-- ============================================

SET search_path TO public, extensions;

ALTER TABLE public.channel
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.channel.is_active IS
  'BUG-21 fix: first-class active flag. true = channel is live (default). false = soft-deactivated. Orthogonal to is_archived — use is_active for operational filtering, is_archived for end-of-life state.';

-- Partial index to accelerate the common query pattern:
-- .from("channel").eq("helpdesk_enabled", true).eq("is_active", true)
CREATE INDEX IF NOT EXISTS idx_channel_helpdesk_active
  ON public.channel(workspace_id, responsible_profile_id)
  WHERE helpdesk_enabled = true AND is_active = true;
