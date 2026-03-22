BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('website-assets', 'website-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for all website assets
CREATE POLICY "public_read_website_assets" ON storage.objects FOR SELECT
  USING (bucket_id = 'website-assets');

-- Workspace admin upload
CREATE POLICY "admin_upload_website_assets" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'website-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT ws.workspace_id::text
      FROM public.workspace ws
      WHERE ws.workspace_id IN (
        SELECT public.get_workspace_ids_for_user(auth.uid())
      )
      AND public.is_admin_in_workspace(auth.uid(), ws.workspace_id)
    )
  );

-- Workspace admin update
CREATE POLICY "admin_update_website_assets" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'website-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT ws.workspace_id::text
      FROM public.workspace ws
      WHERE ws.workspace_id IN (
        SELECT public.get_workspace_ids_for_user(auth.uid())
      )
      AND public.is_admin_in_workspace(auth.uid(), ws.workspace_id)
    )
  );

-- Workspace admin delete
CREATE POLICY "admin_delete_website_assets" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'website-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT ws.workspace_id::text
      FROM public.workspace ws
      WHERE ws.workspace_id IN (
        SELECT public.get_workspace_ids_for_user(auth.uid())
      )
      AND public.is_admin_in_workspace(auth.uid(), ws.workspace_id)
    )
  );

COMMIT;
