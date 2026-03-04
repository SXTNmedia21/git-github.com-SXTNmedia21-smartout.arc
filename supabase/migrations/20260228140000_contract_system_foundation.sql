SET search_path TO public, extensions;

-- =============================================================
-- Migration: Contract System Foundation
-- Evolves existing platform_contract_* tables and adds new tables
-- per docs/architecture/SMARTOUT_CONTRACT_SYSTEM.md Section 3
-- =============================================================

-- ─── 1. Rename existing platform tables (if they exist) ─────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_contract_template') THEN
    ALTER TABLE public.platform_contract_template RENAME TO contract_template;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_contract_instance') THEN
    ALTER TABLE public.platform_contract_instance RENAME TO contract;
  END IF;
END $$;

-- Rename triggers (if they exist)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_platform_contract_template_updated_at') THEN
    ALTER TRIGGER set_platform_contract_template_updated_at ON public.contract_template RENAME TO set_contract_template_updated_at;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_platform_contract_instance_updated_at') THEN
    ALTER TRIGGER set_platform_contract_instance_updated_at ON public.contract RENAME TO set_contract_updated_at;
  END IF;
END $$;

-- Rename indexes (if they exist)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_platform_contract_company') THEN
    ALTER INDEX idx_platform_contract_company RENAME TO idx_contract_company;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_platform_contract_workspace') THEN
    ALTER INDEX idx_platform_contract_workspace RENAME TO idx_contract_ws;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_platform_contract_status') THEN
    ALTER INDEX idx_platform_contract_status RENAME TO idx_contract_status;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_platform_contract_template') THEN
    ALTER INDEX idx_platform_contract_template RENAME TO idx_contract_template;
  END IF;
END $$;

-- ─── 2. Evolve contract_template ────────────────────────────────
-- Keep existing: template_id, name, description, docuseal_template_id,
--   template_type, locale, status, variable_fields, created_by, created_at, updated_at
-- Add new columns from architecture spec
ALTER TABLE public.contract_template
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspace(workspace_id),
  ADD COLUMN IF NOT EXISTS contract_type text NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'no',
  ADD COLUMN IF NOT EXISTS content_html text,
  ADD COLUMN IF NOT EXISTS content_css text,
  ADD COLUMN IF NOT EXISTS header_html text,
  ADD COLUMN IF NOT EXISTS footer_html text,
  ADD COLUMN IF NOT EXISTS watermark_url text,
  ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#FF6B35',
  ADD COLUMN IF NOT EXISTS placeholders jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- ─── 3. Evolve contract table ───────────────────────────────────
-- Keep existing: contract_id, template_id, company_id, workspace_id,
--   title, status, docuseal_submission_id, field_values, signatories,
--   sent_at, signed_at, expires_at, document_url, created_by, created_at, updated_at
-- Add new columns from architecture spec
ALTER TABLE public.contract
  ADD COLUMN IF NOT EXISTS contract_type text NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS contract_number text,
  ADD COLUMN IF NOT EXISTS resolved_html text,
  ADD COLUMN IF NOT EXISTS resolved_values jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS sender_email text,
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS recipient_email text,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS decline_reason text,
  ADD COLUMN IF NOT EXISTS docuseal_submitter_id integer,
  ADD COLUMN IF NOT EXISTS signing_url text,
  ADD COLUMN IF NOT EXISTS signed_pdf_url text,
  ADD COLUMN IF NOT EXISTS audit_log_url text,
  ADD COLUMN IF NOT EXISTS journey_type text,
  ADD COLUMN IF NOT EXISTS auto_create_workspace boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- Add index on docuseal_submission_id for webhook lookups
CREATE INDEX IF NOT EXISTS idx_contract_docuseal_sub
  ON public.contract(docuseal_submission_id);
CREATE INDEX IF NOT EXISTS idx_contract_recipient
  ON public.contract(recipient_email);

-- ─── 4. Create contract_event (immutable audit trail) ───────────
CREATE TABLE IF NOT EXISTS public.contract_event (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     uuid NOT NULL REFERENCES public.contract(contract_id),
  workspace_id    uuid,
  event_type      text NOT NULL,
  actor_type      text NOT NULL,        -- 'user', 'webhook', 'system', 'cron'
  actor_id        text,
  details         jsonb DEFAULT '{}',
  ip_address      inet,
  user_agent      text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_contract ON public.contract_event(contract_id);
CREATE INDEX IF NOT EXISTS idx_event_type ON public.contract_event(event_type);

-- ─── 5. Create contract_reminder ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contract_reminder (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     uuid NOT NULL REFERENCES public.contract(contract_id),
  workspace_id    uuid REFERENCES public.workspace(workspace_id),
  reminder_type   text NOT NULL,         -- 'email', 'sms'
  template_key    text NOT NULL,
  language        text NOT NULL DEFAULT 'no',
  scheduled_at    timestamptz NOT NULL,
  sent_at         timestamptz,
  status          text DEFAULT 'scheduled',  -- 'scheduled', 'sent', 'skipped'
  skip_reason     text,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminder_pending
  ON public.contract_reminder(scheduled_at)
  WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_reminder_contract
  ON public.contract_reminder(contract_id);

-- ─── 6. Create message_template ─────────────────────────────────
-- System table — no RLS (service role only)
CREATE TABLE IF NOT EXISTS public.message_template (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key               text NOT NULL UNIQUE,
  channel           text NOT NULL,         -- 'email', 'sms', 'push'
  category          text NOT NULL,         -- 'contract', 'onboarding', 'operations'
  subject_no        text,
  subject_en        text,
  body_no           text NOT NULL,
  body_en           text,
  cta_label_no      text,
  cta_label_en      text,
  cta_url_template  text,
  sms_body_no       text,
  sms_body_en       text,
  is_active         boolean DEFAULT true,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- ─── 7. Create clause_library ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clause_library (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  summary         text,
  content_html    text NOT NULL,
  category        text NOT NULL,           -- 'identification', 'service', 'financial', 'compliance', 'legal', 'signature'
  contract_types  text[] DEFAULT '{}',
  language        text NOT NULL DEFAULT 'no',
  tags            text[] DEFAULT '{}',
  is_active       boolean DEFAULT true,
  sort_order      integer DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- ─── 8. Add contract columns to workspace ───────────────────────
-- Uses plain text, NOT the existing contract_status enum (from migration 00012)
ALTER TABLE public.workspace
  ADD COLUMN IF NOT EXISTS contract_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS grace_period_ends timestamptz,
  ADD COLUMN IF NOT EXISTS active_contract_id uuid,
  ADD COLUMN IF NOT EXISTS override_access boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_note text,
  ADD COLUMN IF NOT EXISTS override_expires timestamptz;

-- ─── 9. RLS policies for new contract tables ────────────────────

-- contract_template: workspace-scoped + system templates visible to all
ALTER TABLE public.contract_template ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view system templates" ON public.contract_template;
CREATE POLICY "Users can view system templates"
  ON public.contract_template FOR SELECT
  USING (is_system = true);

DROP POLICY IF EXISTS "Users can view workspace templates" ON public.contract_template;
CREATE POLICY "Users can view workspace templates"
  ON public.contract_template FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "Admins can manage workspace templates" ON public.contract_template;
CREATE POLICY "Admins can manage workspace templates"
  ON public.contract_template FOR ALL
  USING (is_admin_in_workspace(workspace_id, auth.uid()));

-- contract: workspace-scoped
ALTER TABLE public.contract ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view workspace contracts" ON public.contract;
CREATE POLICY "Users can view workspace contracts"
  ON public.contract FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "Admins can manage workspace contracts" ON public.contract;
CREATE POLICY "Admins can manage workspace contracts"
  ON public.contract FOR ALL
  USING (is_admin_in_workspace(workspace_id, auth.uid()));

-- contract_event: read-only via contract access
ALTER TABLE public.contract_event ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view events for accessible contracts" ON public.contract_event;
CREATE POLICY "Users can view events for accessible contracts"
  ON public.contract_event FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.contract c
      WHERE c.contract_id = contract_event.contract_id
      AND c.workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    )
  );

-- contract_reminder: admin only
ALTER TABLE public.contract_reminder ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view workspace reminders" ON public.contract_reminder;
CREATE POLICY "Admins can view workspace reminders"
  ON public.contract_reminder FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- clause_library: read-only for all authenticated users
ALTER TABLE public.clause_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view clauses" ON public.clause_library;
CREATE POLICY "Authenticated users can view clauses"
  ON public.clause_library FOR SELECT
  TO authenticated
  USING (is_active = true);

-- message_template: no RLS (system table, service role only)
-- Intentionally NOT enabling RLS on message_template

-- ─── 10. Contract number sequence ───────────────────────────────
CREATE SEQUENCE IF NOT EXISTS contract_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS text AS $$
BEGIN
  RETURN 'KONTRAKT-' || EXTRACT(YEAR FROM now())::text || '-' ||
         LPAD(nextval('contract_number_seq')::text, 3, '0');
END;
$$ LANGUAGE plpgsql;
