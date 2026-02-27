-- Enums
CREATE TYPE policy_type AS ENUM ('operational', 'haccp', 'hr', 'safety', 'access', 'payroll', 'custom');
CREATE TYPE policy_scope AS ENUM ('workspace', 'department', 'team', 'location');
CREATE TYPE enforcement_status AS ENUM ('aspirational', 'enforced');
CREATE TYPE protocol_status AS ENUM ('draft', 'active', 'deprecated');
CREATE TYPE procedure_type AS ENUM ('standard', 'onboarding', 'safety', 'maintenance', 'custom');
CREATE TYPE trigger_type AS ENUM ('scheduled', 'event');
CREATE TYPE routine_assigned_to_type AS ENUM ('team', 'role', 'profile');
CREATE TYPE control_list_assigned_to_type AS ENUM ('team_leader', 'manager', 'admin', 'custom');
CREATE TYPE control_frequency AS ENUM ('every_time', 'every_nth', 'never');
CREATE TYPE protocol_assignment_status AS ENUM ('pending', 'completed', 'expired');

-- Policy
CREATE TABLE public.policy (
  policy_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  season_id uuid,
  policy_type policy_type NOT NULL,
  policy_scope policy_scope NOT NULL,
  scope_ref_id uuid,
  name text NOT NULL,
  description text,
  statement text NOT NULL,
  enforcement_status enforcement_status NOT NULL DEFAULT 'aspirational',
  rules_json jsonb,
  valid_from date,
  valid_to date,
  priority integer DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_policy_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id),
  CONSTRAINT fk_policy_season FOREIGN KEY (season_id) REFERENCES public.season(season_id),
  CONSTRAINT fk_policy_created_by FOREIGN KEY (created_by) REFERENCES public.profile(profile_id)
);
CREATE TRIGGER set_policy_updated_at BEFORE UPDATE ON public.policy FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Protocol
CREATE TABLE public.protocol (
  protocol_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  policy_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  version text NOT NULL DEFAULT '1.0',
  status protocol_status NOT NULL DEFAULT 'draft',
  owner_profile_id uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_protocol_policy FOREIGN KEY (policy_id) REFERENCES public.policy(policy_id),
  CONSTRAINT fk_protocol_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id),
  CONSTRAINT fk_protocol_owner FOREIGN KEY (owner_profile_id) REFERENCES public.profile(profile_id),
  CONSTRAINT fk_protocol_created_by FOREIGN KEY (created_by) REFERENCES public.profile(profile_id),
  CONSTRAINT unique_policy_protocol UNIQUE (policy_id)
);
CREATE TRIGGER set_protocol_updated_at BEFORE UPDATE ON public.protocol FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Procedure
CREATE TABLE public.procedure (
  procedure_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  procedure_type procedure_type NOT NULL DEFAULT 'standard',
  skill_requirements jsonb,
  sort_order integer DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_procedure_protocol FOREIGN KEY (protocol_id) REFERENCES public.protocol(protocol_id)
);
CREATE TRIGGER set_procedure_updated_at BEFORE UPDATE ON public.procedure FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Procedure Step
CREATE TABLE public.procedure_step (
  step_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  procedure_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  step_order integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  estimated_minutes integer,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_procedure_step_procedure FOREIGN KEY (procedure_id) REFERENCES public.procedure(procedure_id)
);
CREATE TRIGGER set_procedure_step_updated_at BEFORE UPDATE ON public.procedure_step FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Control List
CREATE TABLE public.control_list (
  control_list_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  assigned_to_type control_list_assigned_to_type NOT NULL,
  assigned_to_ref uuid,
  items jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_control_list_protocol FOREIGN KEY (protocol_id) REFERENCES public.protocol(protocol_id)
);
CREATE TRIGGER set_control_list_updated_at BEFORE UPDATE ON public.control_list FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Routine
CREATE TABLE public.routine (
  routine_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol_id uuid NOT NULL,
  procedure_id uuid NOT NULL,
  name text NOT NULL,
  trigger_type trigger_type NOT NULL,
  trigger_config jsonb NOT NULL,
  assigned_to_type routine_assigned_to_type NOT NULL,
  assigned_to_ref uuid NOT NULL,
  control_list_id uuid,
  control_frequency control_frequency NOT NULL DEFAULT 'never',
  control_nth integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_routine_protocol FOREIGN KEY (protocol_id) REFERENCES public.protocol(protocol_id),
  CONSTRAINT fk_routine_procedure FOREIGN KEY (procedure_id) REFERENCES public.procedure(procedure_id),
  CONSTRAINT fk_routine_control_list FOREIGN KEY (control_list_id) REFERENCES public.control_list(control_list_id)
);
CREATE TRIGGER set_routine_updated_at BEFORE UPDATE ON public.routine FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Runbook
CREATE TABLE public.runbook (
  runbook_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol_id uuid NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  trigger_event text NOT NULL,
  trigger_conditions jsonb NOT NULL,
  escalation_chain jsonb NOT NULL,
  control_list_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_runbook_protocol FOREIGN KEY (protocol_id) REFERENCES public.protocol(protocol_id),
  CONSTRAINT fk_runbook_control_list FOREIGN KEY (control_list_id) REFERENCES public.control_list(control_list_id)
);
CREATE TRIGGER set_runbook_updated_at BEFORE UPDATE ON public.runbook FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Runbook Step
CREATE TABLE public.runbook_step (
  step_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  runbook_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  step_order integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  estimated_minutes integer,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_runbook_step_runbook FOREIGN KEY (runbook_id) REFERENCES public.runbook(runbook_id)
);
CREATE TRIGGER set_runbook_step_updated_at BEFORE UPDATE ON public.runbook_step FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Knowledge Test
CREATE TABLE public.knowledge_test (
  knowledge_test_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  questions jsonb NOT NULL,
  pass_threshold integer NOT NULL DEFAULT 80,
  max_attempts integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_knowledge_test_protocol FOREIGN KEY (protocol_id) REFERENCES public.protocol(protocol_id)
);
CREATE TRIGGER set_knowledge_test_updated_at BEFORE UPDATE ON public.knowledge_test FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Confirmation
CREATE TABLE public.confirmation (
  confirmation_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol_id uuid NOT NULL,
  name text NOT NULL,
  confirmation_text text NOT NULL,
  requires_signature boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_confirmation_protocol FOREIGN KEY (protocol_id) REFERENCES public.protocol(protocol_id)
);
CREATE TRIGGER set_confirmation_updated_at BEFORE UPDATE ON public.confirmation FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Protocol Assignment
CREATE TABLE public.protocol_assignment (
  assignment_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  status protocol_assignment_status NOT NULL DEFAULT 'pending',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT fk_protocol_assignment_protocol FOREIGN KEY (protocol_id) REFERENCES public.protocol(protocol_id),
  CONSTRAINT fk_protocol_assignment_profile FOREIGN KEY (profile_id) REFERENCES public.profile(profile_id)
);
CREATE TRIGGER set_protocol_assignment_updated_at BEFORE UPDATE ON public.protocol_assignment FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
