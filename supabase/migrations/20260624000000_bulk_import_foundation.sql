-- supabase/migrations/20260624000000_bulk_import_foundation.sql
-- bulk_import Sortie A foundation: pg_trgm + GIN indexes + import_run + RPC + ALTER CHECK
-- ADRs: 0401 (capability), 0404 (schedule_shift.source)
-- Council: 2026-05-23
-- DO NOT apply during Task 4 — apply runs in Task 6 (supabase db reset).
--
-- Pre-work findings:
--   - cascade_initiator ENUM values confirmed: 'cascade_engine','admin_manual','c1_calibration','bootstrap'
--   - profile.display_name confirmed (NOT first_name/last_name) — GIN index + RPC use display_name as-is
--   - department.name + location.name confirmed
--   - get_workspace_ids_for_user + is_admin_in_workspace confirmed (00004_rls_policies.sql)
--   - public.set_updated_at() exists (00001_identity_tables.sql) — reused for import_run trigger
--   - schedule_shift.source CHECK was added inline (anonymous) in 20260515100600; DROP CONSTRAINT IF
--     EXISTS is a safe no-op; the named ADD CONSTRAINT below gives it an explicit name (ADR-0404).

BEGIN;

-- ============================================================================
-- 1. pg_trgm extension (fuzzy matching for resolver)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ============================================================================
-- 2. pg_trgm GIN indexes on name columns + BTREE on workspace_id for the
--    fuzzy-match query pattern: WHERE workspace_id = X AND similarity(name, Y) >= T.
--    Two-index strategy: planner combines via BITMAP scan. Composite GIN on
--    (UUID, text gin_trgm_ops) is NOT supported — UUID has no GIN opclass and
--    btree_gin extension is not installed (only btree_gist for GiST exclusion).
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_profile_displayname_trgm
  ON profile USING GIN (display_name extensions.gin_trgm_ops);
-- profile.workspace_id btree already exists from 00001_identity_tables.sql (idx_profile_workspace_id)

CREATE INDEX IF NOT EXISTS idx_department_name_trgm
  ON department USING GIN (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_department_workspace_id_btree
  ON department (workspace_id);

CREATE INDEX IF NOT EXISTS idx_location_name_trgm
  ON location USING GIN (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_location_workspace_id_btree
  ON location (workspace_id);

-- ============================================================================
-- 3. import_run table (Sortie A schema home; ADR-0401)
-- ============================================================================
CREATE TABLE import_run (
  import_run_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  created_by          UUID NOT NULL REFERENCES profile(profile_id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at          TIMESTAMPTZ,
  applied_by          UUID REFERENCES profile(profile_id),

  source_filename     TEXT NOT NULL,
  source_storage_path TEXT NOT NULL,
  source_kind         TEXT NOT NULL CHECK (source_kind IN ('vaktliste','kjoreplan','mixed')),
  excel_sha256        TEXT NOT NULL,
  row_hashes          TEXT[] NOT NULL DEFAULT '{}',

  parsed_rows         JSONB NOT NULL,
  resolver_decisions  JSONB NOT NULL DEFAULT '[]'::jsonb,
  user_overrides      JSONB NOT NULL DEFAULT '[]'::jsonb,

  ready_to_assign     JSONB NOT NULL DEFAULT '[]'::jsonb,
  pending_rows        JSONB NOT NULL DEFAULT '[]'::jsonb,
  rejected_rows       JSONB NOT NULL DEFAULT '[]'::jsonb,

  status              TEXT NOT NULL DEFAULT 'parsed'
                        CHECK (status IN (
                          'parsed','previewed','awaiting_resolution',
                          'awaiting_approval','applied','failed','cancelled','expired'
                        )),
  initiator           cascade_initiator NOT NULL DEFAULT 'admin_manual',

  notes               TEXT,
  failure_reason      TEXT,

  CONSTRAINT unique_workspace_file_hash UNIQUE (workspace_id, excel_sha256)
);

CREATE INDEX IF NOT EXISTS idx_import_run_workspace_status ON import_run (workspace_id, status);

-- updated_at trigger (reuses public.set_updated_at() — exists since 00001_identity_tables.sql)
CREATE TRIGGER trg_import_run_updated_at
  BEFORE UPDATE ON import_run
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE import_run ENABLE ROW LEVEL SECURITY;

-- JWT-only policies (capability runs direct_admin/service_role per ADR-0401)
CREATE POLICY jwt_read_import_run ON import_run FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY jwt_insert_import_run ON import_run FOR INSERT
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE POLICY jwt_update_import_run ON import_run FOR UPDATE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE POLICY jwt_delete_import_run ON import_run FOR DELETE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

COMMENT ON TABLE import_run IS
  'bulk_import capability state per uploaded file. ADR-0401. JWT-only RLS — capability '
  'tools run direct_admin (service_role) and bypass RLS; policies cover dashboard reads '
  'and admin overrides. Idempotency: UNIQUE (workspace_id, excel_sha256) prevents '
  'duplicate processing of the same file in the same workspace.';

-- ============================================================================
-- 4. fn_fuzzy_match_entity RPC (SECURITY DEFINER + workspace-scoped + active-only)
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_fuzzy_match_entity(
  p_workspace_id UUID,
  p_entity_type  TEXT,
  p_raw_name     TEXT,
  p_threshold    NUMERIC DEFAULT 0.9
)
RETURNS TABLE (
  matched_id   UUID,
  matched_name TEXT,
  confidence   NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_entity_type NOT IN ('profile','department','location') THEN
    RAISE EXCEPTION 'fn_fuzzy_match_entity: invalid entity_type %', p_entity_type
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_raw_name IS NULL OR length(trim(p_raw_name)) = 0 THEN
    RAISE EXCEPTION 'fn_fuzzy_match_entity: p_raw_name required'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_threshold < 0 OR p_threshold > 1 THEN
    RAISE EXCEPTION 'fn_fuzzy_match_entity: threshold must be 0..1'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_entity_type = 'profile' THEN
    RETURN QUERY
      SELECT p.profile_id,
             p.display_name,
             ROUND(extensions.similarity(p.display_name, p_raw_name)::numeric, 4)
      FROM profile p
      WHERE p.workspace_id = p_workspace_id
        AND p.status <> 'offboarding'
        AND p.display_name IS NOT NULL
        AND extensions.similarity(p.display_name, p_raw_name) >= p_threshold
      ORDER BY extensions.similarity(p.display_name, p_raw_name) DESC
      LIMIT 5;
  ELSIF p_entity_type = 'department' THEN
    RETURN QUERY
      SELECT d.department_id,
             d.name,
             ROUND(extensions.similarity(d.name, p_raw_name)::numeric, 4)
      FROM department d
      WHERE d.workspace_id = p_workspace_id
        AND d.is_active = true
        AND d.name IS NOT NULL
        AND extensions.similarity(d.name, p_raw_name) >= p_threshold
      ORDER BY extensions.similarity(d.name, p_raw_name) DESC
      LIMIT 5;
  ELSE -- location
    RETURN QUERY
      SELECT l.location_id,
             l.name,
             ROUND(extensions.similarity(l.name, p_raw_name)::numeric, 4)
      FROM location l
      WHERE l.workspace_id = p_workspace_id
        AND l.is_active = true
        AND l.name IS NOT NULL
        AND extensions.similarity(l.name, p_raw_name) >= p_threshold
      ORDER BY extensions.similarity(l.name, p_raw_name) DESC
      LIMIT 5;
  END IF;
END;
$$;

COMMENT ON FUNCTION fn_fuzzy_match_entity IS
  'Workspace-scoped fuzzy match for bulk_import resolver. ADR-0401. SECURITY DEFINER + '
  'pinned search_path. Filters by active-status (profile.status != ''offboarding''; '
  'department.is_active + location.is_active). Returns top-5 candidates above threshold '
  'sorted by similarity DESC. Empty result = no candidate met threshold.';

-- Grant EXECUTE to authenticated + service_role (capability runs service_role)
GRANT EXECUTE ON FUNCTION fn_fuzzy_match_entity TO authenticated, service_role;

-- ============================================================================
-- 5. ALTER schedule_shift.source CHECK — add 'v3_bulk_import' (ADR-0404)
--    The original CHECK was added inline (anonymous) in 20260515100600.
--    DROP CONSTRAINT IF EXISTS is a safe no-op for the unnamed constraint;
--    the new named constraint replaces/extends it with the v3_bulk_import value.
-- ============================================================================
ALTER TABLE schedule_shift DROP CONSTRAINT IF EXISTS schedule_shift_source_check;

ALTER TABLE schedule_shift ADD CONSTRAINT schedule_shift_source_check
  CHECK (source IN ('operational','bubble_migration','v3_engine','v3_bulk_import'));

COMMENT ON CONSTRAINT schedule_shift_source_check ON schedule_shift IS
  'Source provenance. v3_bulk_import added per ADR-0404 (Sortie A) — writer ships Sortie C '
  'via scheduler.create_shift_via_bulk_import cascade-delegated helper.';

COMMIT;
