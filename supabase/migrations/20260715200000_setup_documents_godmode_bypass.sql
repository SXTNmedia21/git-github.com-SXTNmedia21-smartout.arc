-- Add godmode bypass to setup-documents storage policies.
--
-- Without this, super-admins (user_identity.is_godmode = true) hit 400 on
-- upload to setup-documents when they have no company_member row for the
-- target workspace's company. Godmode is supposed to grant platform-wide
-- access — every other godmode-aware policy in the codebase honours it
-- (see super_admin_all on platform_api_key, etc., 20260301120000).
--
-- Forward-only: drop then recreate with the OR-branch.

DROP POLICY IF EXISTS "workspace_upload_setup_docs" ON storage.objects;
DROP POLICY IF EXISTS "workspace_read_setup_docs" ON storage.objects;
DROP POLICY IF EXISTS "workspace_delete_setup_docs" ON storage.objects;

CREATE POLICY "workspace_upload_setup_docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'setup-documents'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT ws.workspace_id::text
      FROM public.workspace ws
      JOIN public.company_member cm ON cm.company_id = ws.company_id
      JOIN public.user_identity ui ON ui.user_id = cm.user_id
      WHERE ui.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_identity
      WHERE user_id = auth.uid() AND is_godmode = true
    )
  )
);

CREATE POLICY "workspace_read_setup_docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'setup-documents'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT ws.workspace_id::text
      FROM public.workspace ws
      JOIN public.company_member cm ON cm.company_id = ws.company_id
      JOIN public.user_identity ui ON ui.user_id = cm.user_id
      WHERE ui.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_identity
      WHERE user_id = auth.uid() AND is_godmode = true
    )
  )
);

CREATE POLICY "workspace_delete_setup_docs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'setup-documents'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT ws.workspace_id::text
      FROM public.workspace ws
      JOIN public.company_member cm ON cm.company_id = ws.company_id
      JOIN public.user_identity ui ON ui.user_id = cm.user_id
      WHERE ui.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_identity
      WHERE user_id = auth.uid() AND is_godmode = true
    )
  )
);
