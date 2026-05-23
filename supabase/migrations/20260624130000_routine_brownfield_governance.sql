-- 2B brownfield: routines/procedures may be born ungoverned (no protocol).
-- Adds governance_status + image-provenance columns. Idempotent guards so it
-- is safe regardless of which Phase-1 columns already exist.

-- 1. Relax the governance chain.
ALTER TABLE public.procedure ALTER COLUMN protocol_id DROP NOT NULL;
ALTER TABLE public.routine   ALTER COLUMN protocol_id DROP NOT NULL;

-- 2. procedure.workspace_id must exist for bare (protocol-less) procedures,
--    since workspace can no longer be derived through protocol.
ALTER TABLE public.procedure ADD COLUMN IF NOT EXISTS workspace_id uuid;
-- Backfill any nulls from the parent protocol (existing rows all have protocol).
UPDATE public.procedure pc
SET workspace_id = pr.workspace_id
FROM public.protocol pr
WHERE pc.protocol_id = pr.protocol_id AND pc.workspace_id IS NULL;

-- 3. governance_status on routine.
DO $$ BEGIN
  CREATE TYPE public.governance_status AS ENUM ('unassigned', 'attached');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.routine
  ADD COLUMN IF NOT EXISTS governance_status public.governance_status
  NOT NULL DEFAULT 'attached';
-- Every existing routine has a protocol → attached (default already covers it).
UPDATE public.routine SET governance_status = 'attached' WHERE protocol_id IS NOT NULL;

-- 4. Image-provenance on the routine (template-level; session_task instances
--    trace back via routine_id, then to source_reference here).
ALTER TABLE public.routine ADD COLUMN IF NOT EXISTS created_via text NOT NULL DEFAULT 'manual';
ALTER TABLE public.routine ADD COLUMN IF NOT EXISTS source_reference text;
COMMENT ON COLUMN public.routine.created_via IS
  '''manual'' | ''image'' | ''import'' — how this routine template was authored.';
COMMENT ON COLUMN public.routine.source_reference IS
  'Provenance artifact (e.g. routine-source storage_path) when created_via != manual.';
