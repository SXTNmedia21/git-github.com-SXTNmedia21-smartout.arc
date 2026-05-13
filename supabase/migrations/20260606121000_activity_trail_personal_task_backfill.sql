-- 20260606121000_activity_trail_personal_task_backfill.sql
-- Sortie B Phase 5 — backfill activity_trail rows that carry the stale
-- entity_type value 'personal_task_action' produced before Sortie 1 P8's fix.
--
-- Idempotent: the WHERE predicate targets only 'personal_task_action' rows,
-- so a second run finds 0 matching rows and emits NOTICE "0 rows updated".
-- Orphan guard: entity_id must exist in personal_task — no dangling updates.
-- entity_id is UUID NOT NULL; cast direction ::text is safe (UUID → text coercion).

DO $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE public.activity_trail
  SET    entity_type = 'personal_task'
  WHERE  entity_type = 'personal_task_action'
    AND  entity_id::text IN (SELECT id::text FROM public.personal_task);

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Sortie B backfill: % rows updated', rows_updated;
END $$;
