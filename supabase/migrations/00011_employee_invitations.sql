-- 00011_employee_invitations.sql
-- Table mapping core invitation states during the onboarding/adding employee flow

CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');

CREATE TABLE IF NOT EXISTS public.invitation (
  invitation_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  company_id uuid NOT NULL,
  email text NOT NULL,
  first_name text,
  last_name text,
  role public.profile_role NOT NULL DEFAULT 'employee',
  department_ids uuid[] DEFAULT '{}',
  team_ids uuid[] DEFAULT '{}',
  status public.invite_status NOT NULL DEFAULT 'pending',
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  invited_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  CONSTRAINT fk_invitation_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  CONSTRAINT fk_invitation_company FOREIGN KEY (company_id) REFERENCES public.company(company_id) ON DELETE CASCADE,
  CONSTRAINT fk_invitation_invited_by FOREIGN KEY (invited_by) REFERENCES public.profile(profile_id) ON DELETE SET NULL,
  UNIQUE(workspace_id, email, status)
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_invitation_workspace_id ON public.invitation (workspace_id);
CREATE INDEX IF NOT EXISTS idx_invitation_email ON public.invitation (email);
CREATE INDEX IF NOT EXISTS idx_invitation_token ON public.invitation (token);

-- Enable RLS
ALTER TABLE public.invitation ENABLE ROW LEVEL SECURITY;

-- Policies

CREATE POLICY "Workspace admins can read invitations"
  ON public.invitation FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "Workspace admins can write invitations"
  ON public.invitation FOR ALL
  USING (public.is_admin_in_workspace(auth.uid(), workspace_id));

-- Trigger for updated_at
CREATE TRIGGER set_invitation_updated_at
  BEFORE UPDATE ON public.invitation
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

