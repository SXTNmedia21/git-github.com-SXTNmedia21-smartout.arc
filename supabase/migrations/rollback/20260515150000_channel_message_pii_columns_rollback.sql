-- ============================================
-- Rollback for 20260515150000_channel_message_pii_columns.sql
-- Progressive Channel Phase 1A — additive schema reversal (ADR-0166)
-- ============================================
-- Emergency rollback if Phase 1A.2 application code is delayed and
-- the columns need to be removed. Safe because the forward migration
-- is additive-only: no rows modified, no constraints tightened, no
-- data migrated.
--
-- ORDER OF OPERATIONS: drop the index first (small cost, easy), then
-- drop the columns in the reverse order they were added. No enum type
-- to drop because none was created.
--
-- Do NOT run if Phase 1A.2 has already backfilled these columns with
-- audit data the organization cares about — the rollback is lossy for
-- any rows where classification_metadata / redacted_at / hash were set.
-- ============================================

SET search_path TO public, extensions;

-- 1. Drop the partial index.
DROP INDEX IF EXISTS public.idx_channel_message_redacted;

-- 2. Drop new columns in reverse add-order.
ALTER TABLE public.channel_message DROP COLUMN IF EXISTS original_content_hash;
ALTER TABLE public.channel_message DROP COLUMN IF EXISTS redacted_at;
ALTER TABLE public.channel_message DROP COLUMN IF EXISTS classification_metadata;
