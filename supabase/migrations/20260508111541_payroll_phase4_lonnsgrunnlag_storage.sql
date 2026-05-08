-- Migration: payroll Phase 4 — Lønnsgrunnlag storage bucket + RLS
-- ADR: ADR-0294 (PDF lønnsgrunnlag, @react-pdf/renderer)
-- Created: 2026-05-08
--
-- Storage bucket: payroll-lonnsgrunnlag (private)
-- Path convention: {workspace_id}/{period_id}/{profile_id}.pdf
--
-- RLS policies:
--   admin/owner: read all files under their workspace_id path prefix
--   employee:    read only files where the path's third segment matches their profile_id
--
-- NOTE: Storage writes (uploads) are performed with service role in the BFF/
--       capability tool (Wave B). No INSERT policy is needed for service role.
--
-- NOTE on schema verification: Supabase storage RLS uses storage.objects table.
--   storage.foldername(name) splits the path by '/' and returns segments as text[].
--   For path "{workspace_id}/{period_id}/{profile_id}.pdf":
--     foldername(name)[1] = workspace_id
--     foldername(name)[2] = period_id
--     foldername(name)[3] = "{profile_id}.pdf"  (includes extension)
--   We strip the .pdf extension with replace(..., '.pdf', '') when comparing profile_id.
--
-- Profile table: public.profile
--   - workspace_id: text (workspace FK)
--   - profile_id: text (PK)
--   - user_id: text (auth.uid() FK)
--   - role: profile_role enum ('employee', 'manager', 'admin', 'owner', 'system')
--
-- Verified against packages/supabase/src/database.types.ts (2026-05-08).

-- ─── Storage bucket ────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payroll-lonnsgrunnlag',
  'payroll-lonnsgrunnlag',
  false,                        -- private: no direct URL access
  10485760,                     -- 10 MB per file (PDF lønnsgrunnlag should be <<1MB)
  ARRAY['application/pdf']      -- PDF only
)
ON CONFLICT (id) DO NOTHING;

-- ─── RLS policies ─────────────────────────────────────────────────────────────

-- Policy 1: Admin and owner can read ALL files under their workspace path.
-- Path segment [1] = workspace_id; we verify the authenticated user has a profile
-- with role 'admin' or 'owner' in that workspace.

DROP POLICY IF EXISTS "lonnsgrunnlag_admin_read" ON storage.objects;

CREATE POLICY "lonnsgrunnlag_admin_read" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'payroll-lonnsgrunnlag'
    AND EXISTS (
      SELECT 1
      FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.workspace_id::text = (storage.foldername(name))[1]
        AND p.role IN ('admin', 'owner')
    )
  );

-- Policy 2: Employee (and manager) can read only their own profile_id file.
-- Path segment [3] = "{profile_id}.pdf"; strip extension before comparing.
-- Employees can only access their own lønnsgrunnlag, not other employees'.
--
-- NOTE: Managers are NOT given admin-level access here by design — they can
-- view their own lønnsgrunnlag but NOT other employees'. Admin-level report
-- access for managers requires a separate explicit grant (Wave C decision).

DROP POLICY IF EXISTS "lonnsgrunnlag_employee_read_own" ON storage.objects;

CREATE POLICY "lonnsgrunnlag_employee_read_own" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'payroll-lonnsgrunnlag'
    AND EXISTS (
      SELECT 1
      FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.profile_id::text = replace(
          (storage.foldername(name))[3],
          '.pdf',
          ''
        )
    )
  );

-- ─── Comment for reviewers ─────────────────────────────────────────────────────

COMMENT ON TABLE storage.objects IS
  'Supabase storage objects. payroll-lonnsgrunnlag bucket (added 20260508111541): '
  'path={workspace_id}/{period_id}/{profile_id}.pdf. '
  'Admin read = workspace match + role IN (admin, owner). '
  'Employee read = profile_id match in path. '
  'Writes: service role only (no INSERT policy). '
  'ADR-0294.';
