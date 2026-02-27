-- 00012_profile_logs_and_contracts.sql
-- Expand user profile with full info, create communication log, and employment contracts table

-- 1. Add full HR info fields to the profile table
ALTER TABLE public.profile 
ADD COLUMN IF NOT EXISTS address_line_1 text,
ADD COLUMN IF NOT EXISTS address_line_2 text,
ADD COLUMN IF NOT EXISTS postal_code text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS personal_number text, -- SSN/Fødselsnummer
ADD COLUMN IF NOT EXISTS bank_account text;

-- 2. Create Communication Log table
CREATE TYPE public.communication_channel AS ENUM ('email', 'sms', 'push', 'in_app');
CREATE TYPE public.communication_status AS ENUM ('pending', 'sent', 'delivered', 'failed', 'opened', 'clicked');

CREATE TABLE IF NOT EXISTS public.communication_log (
  log_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  profile_id uuid, -- Can be null if it's sent to an email/phone not yet tied to a profile
  invitation_id uuid, -- Tie directly to the invitation if applicable
  recipient text NOT NULL, -- The specific email or phone number it was sent to
  channel public.communication_channel NOT NULL,
  message_type text NOT NULL, -- e.g. "Invite", "Reminder", "Shift Update"
  status public.communication_status NOT NULL DEFAULT 'pending',
  provider_message_id text, -- ID from SendGrid/Twilio to track delivery webhooks
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT fk_comm_log_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  CONSTRAINT fk_comm_log_profile FOREIGN KEY (profile_id) REFERENCES public.profile(profile_id) ON DELETE SET NULL,
  CONSTRAINT fk_comm_log_invitation FOREIGN KEY (invitation_id) REFERENCES public.invitation(invitation_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_comm_log_workspace ON public.communication_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_comm_log_profile ON public.communication_log(profile_id);
CREATE INDEX IF NOT EXISTS idx_comm_log_invitation ON public.communication_log(invitation_id);
CREATE INDEX IF NOT EXISTS idx_comm_log_provider_id ON public.communication_log(provider_message_id);

ALTER TABLE public.communication_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read communication_logs"
  ON public.communication_log FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "Admin write communication_logs"
  ON public.communication_log FOR ALL
  USING (public.is_admin_in_workspace(auth.uid(), workspace_id));


-- 3. Create Employment Contracts table
CREATE TYPE public.contract_status AS ENUM ('draft', 'sent', 'viewed', 'signed', 'expired', 'terminated');

CREATE TABLE IF NOT EXISTS public.employment_contract (
  contract_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  status public.contract_status NOT NULL DEFAULT 'draft',
  
  -- Key contract terms
  position_title text NOT NULL,
  employment_category text NOT NULL, -- e.g. 'Fast', 'Deltid', 'Tilkalling'
  employment_percentage numeric(5,2), -- e.g. 100.00
  hourly_rate numeric(10,2),
  monthly_salary numeric(10,2),
  start_date date NOT NULL,
  end_date date, -- For temporary contracts
  
  -- Document storage
  document_url text, -- URL to PDF in Supabase Storage
  signature_id text, -- ID from electronic signature provider (e.g., Scrive, DocuSign, BankID)
  
  signed_at timestamptz,
  created_by uuid, -- The admin who generated it
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT fk_contract_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  CONSTRAINT fk_contract_profile FOREIGN KEY (profile_id) REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  CONSTRAINT fk_contract_created_by FOREIGN KEY (created_by) REFERENCES public.profile(profile_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_contract_workspace ON public.employment_contract(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contract_profile ON public.employment_contract(profile_id);

ALTER TABLE public.employment_contract ENABLE ROW LEVEL SECURITY;

-- Admins can read all contracts in their workspace
CREATE POLICY "Admin read employment_contracts"
  ON public.employment_contract FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- Users can read their own contracts
CREATE POLICY "Users can read own contracts"
  ON public.employment_contract FOR SELECT
  USING (profile_id IN (SELECT profile_id FROM public.profile WHERE user_id = auth.uid()));

-- Admins can write contracts
CREATE POLICY "Admin write employment_contracts"
  ON public.employment_contract FOR ALL
  USING (public.is_admin_in_workspace(auth.uid(), workspace_id));


-- Triggers
CREATE TRIGGER set_comm_log_updated_at
  BEFORE UPDATE ON public.communication_log
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_contract_updated_at
  BEFORE UPDATE ON public.employment_contract
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
