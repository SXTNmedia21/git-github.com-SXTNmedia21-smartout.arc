-- Migration: 20260801000001_add_channel_constraint_to_engine_authority_config.sql
-- ADR-0430 Rule 9 — Channel pinning (ADR-0078)
-- Pre-sortie gate: AC-0.9 PLAN-0 pre-flight
--
-- Why: engine_authority_config.channel_constraint is required by Rule 9 to mark
-- roster.add_shift_manual (and any zone-assignment capability) as 'chat_only'.
-- Without this column Rule 9 cannot be enforced at the engine level.
-- The ADR-0430 pre-flight confirmed 0 rows returned for this column → BLOCKER.
--
-- Shape: TEXT NULL with a CHECK constraint allowing the values defined by ADR-0078.
-- NULL means "no channel restriction" (backward-compatible default).
-- Forward-only, idempotent via ADD COLUMN IF NOT EXISTS.

ALTER TABLE public.engine_authority_config
  ADD COLUMN IF NOT EXISTS channel_constraint TEXT
    CONSTRAINT engine_authority_config_channel_constraint_check
    CHECK (channel_constraint IN ('chat_only', 'voice_only', 'any') OR channel_constraint IS NULL);

COMMENT ON COLUMN public.engine_authority_config.channel_constraint IS
  'ADR-0078 channel guard. NULL = no restriction. chat_only = blocks voice surface. '
  'voice_only = blocks chat surface. any = all channels permitted. '
  'ADR-0430 Rule 9: roster.add_shift_manual must be chat_only.';
