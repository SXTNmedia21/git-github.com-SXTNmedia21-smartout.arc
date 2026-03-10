-- Storage RLS policies for setup-documents bucket
-- Allows authenticated users to upload/read/delete files scoped to their workspace

CREATE POLICY "workspace_upload_setup_docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'setup-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT ws.workspace_id::text
    FROM public.workspace ws
    JOIN public.company_member cm ON cm.company_id = ws.company_id
    JOIN public.user_identity ui ON ui.user_id = cm.user_id
    WHERE ui.user_id = auth.uid()
  )
);

CREATE POLICY "workspace_read_setup_docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'setup-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT ws.workspace_id::text
    FROM public.workspace ws
    JOIN public.company_member cm ON cm.company_id = ws.company_id
    JOIN public.user_identity ui ON ui.user_id = cm.user_id
    WHERE ui.user_id = auth.uid()
  )
);

CREATE POLICY "workspace_delete_setup_docs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'setup-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT ws.workspace_id::text
    FROM public.workspace ws
    JOIN public.company_member cm ON cm.company_id = ws.company_id
    JOIN public.user_identity ui ON ui.user_id = cm.user_id
    WHERE ui.user_id = auth.uid()
  )
);
