-- supabase/migrations/20260623100000_botsson_imports_storage_bucket.sql
-- Storage bucket for bulk_import capability — workspace-scoped uploads.
-- Spec: docs/superpowers/specs/2026-05-23-bulk-import-design.md (Sortie 0)
-- Council: 2026-05-23 APPROVE WITH CHANGES

BEGIN;

-- Create the bucket (private, not public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'botsson-imports',
  'botsson-imports',
  FALSE,
  10485760, -- 10 MB cap
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', -- .xlsx
    'application/vnd.ms-excel', -- .xls
    'text/csv', -- .csv
    'application/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Workspace-scoped RLS: only members of the workspace can read their own paths
-- Path convention: {workspace_id}/{import_run_id_or_temp_id}.{ext}

CREATE POLICY "botsson_imports_read_own_workspace"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'botsson-imports'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT workspace_id FROM get_workspace_ids_for_user(auth.uid()) AS workspace_id
    )
  );

CREATE POLICY "botsson_imports_insert_own_workspace_admin"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'botsson-imports'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT workspace_id FROM get_workspace_ids_for_user(auth.uid()) AS workspace_id
    )
    AND is_admin_in_workspace(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

-- Delete policy: admins only, own workspace
CREATE POLICY "botsson_imports_delete_own_workspace_admin"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'botsson-imports'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT workspace_id FROM get_workspace_ids_for_user(auth.uid()) AS workspace_id
    )
    AND is_admin_in_workspace(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

-- NOTE: COMMENT ON POLICY on storage.objects requires storage-owner privileges
-- not granted to migration role; documentation lives in this file header instead.

COMMIT;
