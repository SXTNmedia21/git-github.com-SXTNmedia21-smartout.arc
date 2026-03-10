-- workspace-documents: Private bucket for platform-admin document uploads per workspace.
-- Godmode-only access. Path convention: {workspace_id}/{filename}

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workspace-documents',
  'workspace-documents',
  false,
  20971520, -- 20 MB
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Only godmode users can upload
CREATE POLICY "godmode_upload_workspace_documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'workspace-documents'
  AND EXISTS (
    SELECT 1 FROM public.user_identity
    WHERE user_id = auth.uid() AND is_godmode = true
  )
);

-- Only godmode users can read
CREATE POLICY "godmode_read_workspace_documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'workspace-documents'
  AND EXISTS (
    SELECT 1 FROM public.user_identity
    WHERE user_id = auth.uid() AND is_godmode = true
  )
);

-- Only godmode users can update
CREATE POLICY "godmode_update_workspace_documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'workspace-documents'
  AND EXISTS (
    SELECT 1 FROM public.user_identity
    WHERE user_id = auth.uid() AND is_godmode = true
  )
);

-- Only godmode users can delete
CREATE POLICY "godmode_delete_workspace_documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'workspace-documents'
  AND EXISTS (
    SELECT 1 FROM public.user_identity
    WHERE user_id = auth.uid() AND is_godmode = true
  )
);
