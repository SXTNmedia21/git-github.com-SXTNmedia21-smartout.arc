-- Migration: 20260620140700_announcement_kind_add_celebration_and_system_message.sql
--
-- WHY: Two announcement_kind values required by tooling have no DB synonyms:
--   - celebration: required by ADR-0372 bursdag-pipe (birthday/anniversary use cases)
--   - system_message: required by publish_announcement tool DSL (mandatory ops messaging)
--
-- workspace_news → general and external_link → external are handled as code-only renames
-- (exact DB synonyms already exist; no new enum values needed for those).
--
-- Postgres requires ADD VALUE to be in its own migration (cannot be combined with
-- other DDL that touches the same type in the same transaction on PG < 14).
-- This migration contains ONLY enum extension — no other DDL.

ALTER TYPE public.announcement_kind ADD VALUE IF NOT EXISTS 'celebration';
ALTER TYPE public.announcement_kind ADD VALUE IF NOT EXISTS 'system_message';
