-- Migration: channel settings columns for the 4 new tab surfaces
-- Adds retention, auto-archive, and legal hold to channel.
-- No new tables; all columns are nullable with sensible defaults so
-- existing rows stay valid without a data backfill.

-- RLS already exists on channel. New columns inherit workspace-scoped
-- policies that let admins write; members can read (public channels).
-- Description column already exists on channel table (schema check confirmed).

ALTER TABLE public.channel
  ADD COLUMN IF NOT EXISTS retention_days       INTEGER       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS auto_archive_days    INTEGER       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS legal_hold_until     TIMESTAMPTZ   DEFAULT NULL;

-- retention_days:       NULL = permanent retention (no scheduled purge)
-- auto_archive_days:    NULL = no auto-archive; set to positive integer to
--                       auto-archive after N days of inactivity
-- legal_hold_until:     NULL = no hold; non-null locks retention to permanent
--                       until the timestamp passes (admin-only write gate in
--                       the Server Action — no DB-level policy needed because
--                       the service-role write path is already admin-gated)

COMMENT ON COLUMN public.channel.retention_days    IS 'Days to keep messages. NULL = permanent. Overridden by legal_hold_until.';
COMMENT ON COLUMN public.channel.auto_archive_days IS 'Archive channel after N days of inactivity. NULL = disabled.';
COMMENT ON COLUMN public.channel.legal_hold_until  IS 'Legal hold — locks retention to permanent until this timestamp. Admin-only.';
