-- Handbook chapter storage for Document Mode
-- Each workspace has up to 10 fixed chapters (company handbook structure)

CREATE TABLE IF NOT EXISTS public.handbook_chapter (
  handbook_chapter_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  chapter_key        TEXT NOT NULL,
  title              TEXT NOT NULL,
  content            JSONB NOT NULL DEFAULT '{}',
  updated_by         UUID REFERENCES public.user_identity(user_id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, chapter_key)
);

ALTER TABLE public.handbook_chapter ENABLE ROW LEVEL SECURITY;

-- JWT policies
DROP POLICY IF EXISTS "jwt_read_handbook_chapter" ON public.handbook_chapter;
CREATE POLICY "jwt_read_handbook_chapter" ON public.handbook_chapter
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_write_handbook_chapter" ON public.handbook_chapter;
CREATE POLICY "jwt_write_handbook_chapter" ON public.handbook_chapter
  FOR ALL USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- API key policy
DROP POLICY IF EXISTS "api_key_read_handbook_chapter" ON public.handbook_chapter;
CREATE POLICY "api_key_read_handbook_chapter" ON public.handbook_chapter
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- Auto-update timestamp
DROP TRIGGER IF EXISTS set_updated_at ON public.handbook_chapter;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.handbook_chapter
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
