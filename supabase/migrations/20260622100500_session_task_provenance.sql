-- 20260622100500_session_task_provenance.sql
-- Provenance triple: no task exists without origin/generated_by/source_reference.
-- Spec: docs/superpowers/specs/2026-05-22-procedure-engine-design.md §2.3, §7b
--
-- PRE-FLIGHT VERIFIED (2026-05-22):
--   public.session_task PK = id (UUID)

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_origin') THEN
    CREATE TYPE task_origin AS ENUM ('session','adhoc','routine','procedure','projection','manual');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_generated_by') THEN
    CREATE TYPE task_generated_by AS ENUM ('cron','manager','agent','system');
  END IF;
END $$;

ALTER TABLE public.session_task
  ADD COLUMN IF NOT EXISTS origin task_origin,
  ADD COLUMN IF NOT EXISTS generated_by task_generated_by,
  ADD COLUMN IF NOT EXISTS source_reference uuid;

COMMENT ON COLUMN public.session_task.source_reference IS 'FK-less ref to the producing entity (session_hook.id, routine_id, timeline_template_id) — interpreted with origin.';
