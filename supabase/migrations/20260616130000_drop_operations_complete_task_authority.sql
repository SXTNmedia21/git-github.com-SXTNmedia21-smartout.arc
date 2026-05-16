-- Drop orphaned authority rows after hard-delete of operations.complete_task tool.
-- ADR-0298 Sortie 5b 2026-05-13.
-- Idempotent: re-running yields 0 rows affected.

DELETE FROM public.engine_authority_config
WHERE capability = 'operations.complete_task';

-- Note: operations capability still exists (createDeviation tool); only the
-- complete_task action authority is dropped here.
