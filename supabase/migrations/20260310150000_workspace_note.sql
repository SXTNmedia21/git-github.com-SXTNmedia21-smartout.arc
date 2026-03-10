-- workspace_note: Mutable notes for platform-admin workspace management.
-- Separate from platform_audit_log (immutable audit trail).
-- No RLS — platform-admin only, service role access.

CREATE TABLE public.workspace_note (
  note_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  admin_id      uuid NOT NULL REFERENCES public.user_identity(user_id),
  content       text NOT NULL,
  created_at    timestamptz DEFAULT now() NOT NULL,
  updated_at    timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_workspace_note_workspace ON public.workspace_note (workspace_id, created_at DESC);

CREATE TRIGGER set_workspace_note_updated_at
  BEFORE UPDATE ON public.workspace_note
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
