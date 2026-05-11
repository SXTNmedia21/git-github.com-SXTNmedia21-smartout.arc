SET search_path TO public, extensions;

-- ============================================
-- 20260529000000_chat_list_engine_sessions_archive_drop_emma.sql
-- F-CHAT-LIST (ADR-0296). Two concerns, one commit boundary:
--   1. ADD COLUMN engine_sessions.is_archived (soft-archive for chat-list)
--   2. DROP TABLE emma_transcript + emma_conversation (ghost tables per L-0232)
-- The /api/emma/history route is deleted in the same git commit (not migration)
-- to prevent an orphan endpoint pointing at dropped tables.
-- ============================================

-- ───── (1) Soft-archive column on engine_sessions ─────
ALTER TABLE engine_sessions
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN engine_sessions.is_archived IS
  'Soft-archive flag for chat-list UI (F-CHAT-LIST, ADR-0296). Orthogonal to status — an active or expired session can be archived. Set true by DELETE /api/botsson/sessions/[id].';

-- Index decision: existing idx_engine_sessions_workspace_status already covers
-- the workspace+status predicate. The chat-list query adds mode + channel +
-- is_archived. Profile-level lookup is small (per-user), so a profile-scoped
-- partial index is unnecessary for MVP. Re-evaluate after telemetry shows row
-- counts > 1k per profile.

-- ───── (2) Drop ghost tables (ADR-0296, L-0232) ─────
-- CASCADE removes RLS policies + indexes + FK from emma_transcript→emma_conversation.
-- 0 rows on local DB (verified 2026-05-11). Production audit gate documented in
-- HANDOFF-chat-list.md.
DROP TABLE IF EXISTS emma_transcript CASCADE;
DROP TABLE IF EXISTS emma_conversation CASCADE;
