-- Migration: Add attachments JSONB column to contract_template + storage bucket
-- Purpose: Enable PDF file attachments on contract templates (DPA, vedlegg, etc.)

-- 1. Add attachments column to contract_template
ALTER TABLE public.contract_template
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.contract_template.attachments IS
  'Array of attached files (PDFs). Shape: [{id, file_name, file_path, file_size, mime_type, uploaded_at}]';

-- 2. Create storage bucket for contract attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contract-attachments',
  'contract-attachments',
  false,
  10485760, -- 10 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS policies

-- Authenticated users can read attachments
CREATE POLICY "Authenticated users can read contract attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'contract-attachments');

-- Service role handles upload (via server actions) — no INSERT policy for anon/authenticated
-- This means only server actions with service role can upload

-- Authenticated users can delete their own uploads (via server action proxy)
CREATE POLICY "Authenticated users can delete contract attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'contract-attachments');
