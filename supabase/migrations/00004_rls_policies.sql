-- Enable RLS on all tables
ALTER TABLE public.user_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zone ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.position ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedure ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedure_step ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.control_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runbook ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runbook_step ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_test ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confirmation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_assignment ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION public.get_workspace_ids_for_user(uid uuid)
RETURNS SETOF uuid AS $$
  SELECT workspace_id FROM public.profile WHERE user_id = uid AND is_active = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin_in_workspace(uid uuid, wid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile 
    WHERE user_id = uid 
      AND workspace_id = wid 
      AND role IN ('admin', 'owner') 
      AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- User Identity
CREATE POLICY "Users can read own data" ON public.user_identity FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own data" ON public.user_identity FOR UPDATE USING (auth.uid() = user_id);

-- Company
CREATE POLICY "Users can read their companies" ON public.company FOR SELECT USING (
  company_id IN (SELECT company_id FROM public.company_member WHERE user_id = auth.uid() AND is_active = true)
);

-- Company Member
CREATE POLICY "Users can read own memberships" ON public.company_member FOR SELECT USING (user_id = auth.uid());

-- Workspace
CREATE POLICY "Users can read their workspaces" ON public.workspace FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);

-- Profile
CREATE POLICY "Users can read profiles in their workspaces" ON public.profile FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "Users can update own profile" ON public.profile FOR UPDATE USING (user_id = auth.uid());

-- Workspace-scoped tables: SELECT
CREATE POLICY "Read department" ON public.department FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "Read location" ON public.location FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "Read zone" ON public.zone FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "Read asset" ON public.asset FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "Read position" ON public.position FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "Read team" ON public.team FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "Read season" ON public.season FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "Read policy" ON public.policy FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "Read protocol" ON public.protocol FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- Workspace-scoped WRITE (admin/owner only)
CREATE POLICY "Write department" ON public.department FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Write location" ON public.location FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Write zone" ON public.zone FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Write asset" ON public.asset FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Write position" ON public.position FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Write team" ON public.team FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Write season" ON public.season FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Write policy" ON public.policy FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "Write protocol" ON public.protocol FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- Team Member (Junction)
CREATE POLICY "Read team member" ON public.team_member FOR SELECT USING (
  team_id IN (SELECT team_id FROM public.team WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())))
);
CREATE POLICY "Write team member" ON public.team_member FOR ALL USING (
  EXISTS (SELECT 1 FROM public.team WHERE team.team_id = team_member.team_id AND is_admin_in_workspace(auth.uid(), team.workspace_id))
);

-- Protocol children (Procedure, Control List, Routine, Runbook, Knowledge Test, Confirmation)
-- Since they link to Protocol, we verify access via Protocol's workspace_id
CREATE POLICY "Read procedure" ON public.procedure FOR SELECT USING (
  protocol_id IN (SELECT protocol_id FROM public.protocol WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())))
);
CREATE POLICY "Write procedure" ON public.procedure FOR ALL USING (
  EXISTS (SELECT 1 FROM public.protocol WHERE protocol.protocol_id = procedure.protocol_id AND is_admin_in_workspace(auth.uid(), protocol.workspace_id))
);

CREATE POLICY "Read procedure_step" ON public.procedure_step FOR SELECT USING (
  procedure_id IN (
    SELECT procedure_id FROM public.procedure WHERE protocol_id IN (
      SELECT protocol_id FROM public.protocol WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    )
  )
);
CREATE POLICY "Write procedure_step" ON public.procedure_step FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.procedure p
    JOIN public.protocol pr ON p.protocol_id = pr.protocol_id
    WHERE p.procedure_id = procedure_step.procedure_id AND is_admin_in_workspace(auth.uid(), pr.workspace_id)
  )
);

CREATE POLICY "Read control_list" ON public.control_list FOR SELECT USING (
  protocol_id IN (SELECT protocol_id FROM public.protocol WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())))
);
CREATE POLICY "Write control_list" ON public.control_list FOR ALL USING (
  EXISTS (SELECT 1 FROM public.protocol WHERE protocol.protocol_id = control_list.protocol_id AND is_admin_in_workspace(auth.uid(), protocol.workspace_id))
);

CREATE POLICY "Read routine" ON public.routine FOR SELECT USING (
  protocol_id IN (SELECT protocol_id FROM public.protocol WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())))
);
CREATE POLICY "Write routine" ON public.routine FOR ALL USING (
  EXISTS (SELECT 1 FROM public.protocol WHERE protocol.protocol_id = routine.protocol_id AND is_admin_in_workspace(auth.uid(), protocol.workspace_id))
);

CREATE POLICY "Read runbook" ON public.runbook FOR SELECT USING (
  protocol_id IN (SELECT protocol_id FROM public.protocol WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())))
);
CREATE POLICY "Write runbook" ON public.runbook FOR ALL USING (
  EXISTS (SELECT 1 FROM public.protocol WHERE protocol.protocol_id = runbook.protocol_id AND is_admin_in_workspace(auth.uid(), protocol.workspace_id))
);

CREATE POLICY "Read runbook_step" ON public.runbook_step FOR SELECT USING (
  runbook_id IN (
    SELECT runbook_id FROM public.runbook WHERE protocol_id IN (
      SELECT protocol_id FROM public.protocol WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    )
  )
);
CREATE POLICY "Write runbook_step" ON public.runbook_step FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.runbook r
    JOIN public.protocol pr ON r.protocol_id = pr.protocol_id
    WHERE r.runbook_id = runbook_step.runbook_id AND is_admin_in_workspace(auth.uid(), pr.workspace_id)
  )
);

CREATE POLICY "Read knowledge_test" ON public.knowledge_test FOR SELECT USING (
  protocol_id IN (SELECT protocol_id FROM public.protocol WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())))
);
CREATE POLICY "Write knowledge_test" ON public.knowledge_test FOR ALL USING (
  EXISTS (SELECT 1 FROM public.protocol WHERE protocol.protocol_id = knowledge_test.protocol_id AND is_admin_in_workspace(auth.uid(), protocol.workspace_id))
);

CREATE POLICY "Read confirmation" ON public.confirmation FOR SELECT USING (
  protocol_id IN (SELECT protocol_id FROM public.protocol WHERE workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())))
);
CREATE POLICY "Write confirmation" ON public.confirmation FOR ALL USING (
  EXISTS (SELECT 1 FROM public.protocol WHERE protocol.protocol_id = confirmation.protocol_id AND is_admin_in_workspace(auth.uid(), protocol.workspace_id))
);

CREATE POLICY "Read protocol_assignment" ON public.protocol_assignment FOR SELECT USING (
  profile_id IN (SELECT profile_id FROM public.profile WHERE user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.protocol WHERE protocol.protocol_id = protocol_assignment.protocol_id AND is_admin_in_workspace(auth.uid(), protocol.workspace_id))
);
CREATE POLICY "Write protocol_assignment" ON public.protocol_assignment FOR ALL USING (
  EXISTS (SELECT 1 FROM public.protocol WHERE protocol.protocol_id = protocol_assignment.protocol_id AND is_admin_in_workspace(auth.uid(), protocol.workspace_id))
);
