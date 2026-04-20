-- ============================================
-- 20260515130000_helpdesk_enum_extensions.sql
-- Helpdesk Phase 1 — enum extensions (ADR-0161)
-- ============================================
-- Adds the two enum values that later helpdesk migrations depend on:
--   comm_channel_type += 'desk'  (ADR-0161: desk channel is ownership surface)
--   channel_member_role += 'representative'  (ADR-0161: reps can see desk queue)
--
-- MUST be a separate migration from any DDL that references these values.
-- Postgres requires ALTER TYPE ADD VALUE to commit before the value is
-- usable in CHECK constraints, triggers, or DEFAULT expressions.
-- L-0069 warned about the 4 meanings of "channel" — 'desk' here is the
-- ownership surface, not session_modality, not chat_message.channel_id,
-- not channel_event.channel_id.
-- ============================================

SET search_path TO public, extensions;

-- idempotent ADD VALUE (IF NOT EXISTS, PG 9.6+)
ALTER TYPE comm_channel_type ADD VALUE IF NOT EXISTS 'desk';

ALTER TYPE channel_member_role ADD VALUE IF NOT EXISTS 'representative';
