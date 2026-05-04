-- ADR-0188 Phase 1 — stop writes to department_session.handoff_notes
-- Council 2 verdict 2026-04-22
-- Full deprecation schedule: Phase 2 migrates 6 readers (separate sortie),
-- Phase 3 drops column after 30-day observation.

BEGIN;

-- Column stays — 6 readers still query it until Phase 2 migration.
-- But no application code may WRITE to it going forward.
--
-- Revoke UPDATE on this specific column from every application role.
-- Phase 2 backfill INSERTs into session_note (not UPDATE on this column),
-- so service_role also loses the UPDATE privilege here. If Phase 2 is ever
-- reshaped to need it, a superuser-executed migration can restore the grant.

REVOKE UPDATE (handoff_notes) ON public.department_session FROM authenticated;
REVOKE UPDATE (handoff_notes) ON public.department_session FROM anon;
REVOKE UPDATE (handoff_notes) ON public.department_session FROM service_role;

COMMENT ON COLUMN public.department_session.handoff_notes IS
  'DEPRECATED per ADR-0188 (2026-04-22). Phase 1: writes revoked. Phase 2: readers migrate to session_note table. Phase 3: drop column. Canonical store is session_note(note_type=''handoff''). DailyNoteSheet writer migrated 2026-04-22.';

COMMIT;
