-- ── Enable Supabase Realtime on engine_event ───────────────────
-- Task #21 follow-through: Fjernkontroll.tsx subscribes to engine_event
-- realtime INSERT events (journey.stuck / journey.completed /
-- journey.run_failed), but the table was not in supabase_realtime
-- publication. The subscription silently never fired.
--
-- This migration:
--   1. Adds public.engine_event to supabase_realtime publication (idempotent).
--   2. Sets REPLICA IDENTITY FULL so realtime INSERT payloads include all
--      columns (default 'd' would only publish PK changes on UPDATE/DELETE,
--      which is also insufficient for consumers needing payload JSONB).
--
-- Idempotent: safe to re-apply. `duplicate_object` guard handles the
-- publication add; REPLICA IDENTITY FULL is unconditional but idempotent.
--
-- Additive only: does NOT remove or alter existing publication entries.

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.engine_event;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- REPLICA IDENTITY FULL ensures INSERT payloads via logical replication
-- include every column (event_type, payload, workspace_id, fired_at, etc.),
-- which the Fjernkontroll UI state machine requires to route journey.* events.
ALTER TABLE public.engine_event REPLICA IDENTITY FULL;
