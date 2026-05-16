-- ============================================================
-- 20260616100500_session_note_targeted_fanout.sql
-- Dagslinjen QuickAdd — targeted note fanout schema delta
--
-- PURPOSE
-- -------
-- Extends public.session_note with four new columns supporting
-- scheduled, audience-targeted note fanout (Journey 3 + 4,
-- spec 2026-05-15-dagslinjen-quickadd-design.md § 5):
--
--   audience     JSONB       — Audience specification: optional arrays of
--                              dept_ids / team_ids / shift_ids / profile_ids.
--                              Resolved at notify_at by note-fanout-scheduler.
--   notify_at    TIMESTAMPTZ — When the scheduler should fire fanout. NULL for
--                              non-scheduled (immediate) notes.
--   delivered_at TIMESTAMPTZ — Set by note-fanout-scheduler after successful
--                              fanout. Serves as idempotency guard (ADR-0332).
--   deleted_at   TIMESTAMPTZ — Soft-delete timestamp. NULL = active.
--
-- Also adds enum value 'targeted' to session_note_type (idempotent IF NOT EXISTS).
--
-- AUDIENCE JSONB SHAPE
-- --------------------
-- {
--   "dept_ids":    ["uuid", ...],   -- optional — departments
--   "team_ids":    ["uuid", ...],   -- optional — teams
--   "shift_ids":   ["uuid", ...],   -- optional — specific shifts
--   "profile_ids": ["uuid", ...]    -- optional — individual profiles
-- }
-- At least one array must be non-empty when notify_at IS NOT NULL.
-- Resolved to final profile_ids[] at fire-time; membership changes
-- between create-time and notify_at are intentionally picked up.
-- See ADR-0331 rationale ("resolve at fire-time" semantics).
--
-- CONSTRAINT
-- ----------
-- session_note_audience_when_targeted_chk enforces:
--   (notify_at IS NULL AND audience IS NULL)          — plain note
--   OR
--   (notify_at IS NOT NULL AND audience IS NOT NULL   — targeted note
--    AND audience != '{}'::jsonb)
-- This means: you cannot set notify_at without a non-empty audience,
-- and a non-scheduled note must not carry an audience payload.
--
-- RLS UNCHANGED
-- -------------
-- audience is a fanout target specification, not a read gate.
-- Existing session_note RLS policies (jwt_read, jwt_insert, service_role)
-- continue to gate on workspace_id + session→department membership.
-- No new policies needed for Phase 1 (ADR-0331 § Rationale).
--
-- INDEXES
-- -------
-- idx_session_note_fanout_pending  — partial B-tree on (notify_at) for the
--   scheduler hot-path query:
--     SELECT ... WHERE notify_at <= now() AND delivered_at IS NULL
--     AND notify_at IS NOT NULL AND deleted_at IS NULL
--   Small index — only rows awaiting delivery are indexed.
--
-- idx_session_note_audience_gin — GIN on (audience) for future containment
--   queries like audience @> '{"team_ids":["<uuid>"]}' (Phase 2 reporting).
--
-- REFERENCES
-- ----------
-- ADR-0331: audience model (JSONB blob vs junction table)
-- ADR-0332: scheduler cadence + transport
-- ADR-0333: cross-dept C4 authority gate
-- Spec:     docs/superpowers/specs/2026-05-15-dagslinjen-quickadd-design.md § 5
-- ============================================================

SET search_path TO public, extensions;

-- ─── 1. Add enum value 'targeted' (idempotent) ────────────────────────────────
-- ALTER TYPE ... ADD VALUE is a non-transactional DDL in Postgres — it cannot
-- be inside a transaction block. IF NOT EXISTS prevents re-run failure.
ALTER TYPE public.session_note_type ADD VALUE IF NOT EXISTS 'targeted';

-- ─── 2. Add columns to session_note ──────────────────────────────────────────
ALTER TABLE public.session_note
  ADD COLUMN IF NOT EXISTS audience       JSONB,
  ADD COLUMN IF NOT EXISTS notify_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at     TIMESTAMPTZ;

-- ─── 3. Column comments ───────────────────────────────────────────────────────
COMMENT ON COLUMN public.session_note.audience IS
  'JSONB with optional arrays of dept_ids/team_ids/shift_ids/profile_ids. '
  'Resolved to profile_ids[] at notify_at by note-fanout-scheduler Edge Function. '
  'NULL for non-targeted notes. Shape: {"dept_ids?": [uuid], "team_ids?": [uuid], '
  '"shift_ids?": [uuid], "profile_ids?": [uuid]}. '
  'Audience snapshot is the manager''s intent at write-time; resolution is live at fire-time. '
  'ADR-0331.';

COMMENT ON COLUMN public.session_note.notify_at IS
  'When note-fanout-scheduler should fire. NULL for non-scheduled (untargeted) notes. '
  'pg_cron job runs every 5 minutes; worst-case delivery is notify_at + 5 min. '
  'UX label: "Påminner ca HH:MM (±5 min)". ADR-0332.';

COMMENT ON COLUMN public.session_note.delivered_at IS
  'Set by note-fanout-scheduler Edge Function after successful audience resolution + '
  'notification emit. NULL = pending. Non-NULL = delivered (idempotency guard). '
  'Scheduler predicate: WHERE delivered_at IS NULL AND notify_at <= now(). ADR-0332.';

COMMENT ON COLUMN public.session_note.deleted_at IS
  'Soft-delete timestamp. NULL = active. Scheduler skips rows WHERE deleted_at IS NOT NULL. '
  'Application must filter WHERE deleted_at IS NULL for all reads.';

-- ─── 4. CHECK constraint: targeted notes require audience ─────────────────────
-- Prevents: notify_at set with NULL or empty audience (would cause fanout with
--           zero recipients — silent no-op that looks like success).
-- Permits:  plain notes (both NULL), targeted notes (both non-NULL + non-empty).
ALTER TABLE public.session_note
  ADD CONSTRAINT session_note_audience_when_targeted_chk
  CHECK (
    (notify_at IS NULL AND audience IS NULL)
    OR
    (notify_at IS NOT NULL AND audience IS NOT NULL AND audience != '{}'::jsonb)
  );

-- ─── 5. Partial B-tree index for scheduler hot-path ──────────────────────────
-- Covers the exact WHERE clause used by the fanout scheduler query (spec § 4
-- Journey 4). Keeps the index small — only pending targeted notes are indexed.
CREATE INDEX IF NOT EXISTS idx_session_note_fanout_pending
  ON public.session_note (notify_at)
  WHERE delivered_at IS NULL
    AND notify_at IS NOT NULL
    AND deleted_at IS NULL;

-- ─── 6. GIN index on audience JSONB ──────────────────────────────────────────
-- Supports future containment queries: audience @> '{"team_ids":["<uuid>"]}'
-- Partial WHERE audience IS NOT NULL keeps index off the majority of rows
-- (non-targeted notes never have audience set).
CREATE INDEX IF NOT EXISTS idx_session_note_audience_gin
  ON public.session_note USING GIN (audience)
  WHERE audience IS NOT NULL;
