-- Private bucket for routine-source images (provenance separation from chat-media).
INSERT INTO storage.buckets (id, name, public)
VALUES ('routine-source', 'routine-source', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: members of the workspace (path prefix = workspace_id) may read/write.
-- Path convention: <workspace_id>/<profile_id>/<uuid>.<ext>
CREATE POLICY "routine_source_member_rw" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'routine-source'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
  )
  WITH CHECK (
    bucket_id = 'routine-source'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
  );
