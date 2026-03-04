-- ═══════════════════════════════════════════════════════════════
-- Migration 00013: Platform Administration Tables
-- Module 17 — Super Admin Backoffice
-- ═══════════════════════════════════════════════════════════════

-- ─── Super-Admin Flag on user_identity ─────────────────────────
-- user_identity is the GDPR PII vault (00001_identity_tables.sql)
-- is_super_admin is platform-level, NOT a workspace role
ALTER TABLE public.user_identity
  ADD COLUMN is_super_admin boolean NOT NULL DEFAULT false;

-- ─── Platform Audit Log ────────────────────────────────────────
-- No RLS — only accessible via service role in platform-admin routes
CREATE TABLE public.platform_audit_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id    uuid NOT NULL REFERENCES public.user_identity(user_id),
  action            text NOT NULL,
  entity_type       text NOT NULL,       -- 'workspace', 'subscription', 'contract', 'user', 'config'
  entity_id         uuid,
  details           jsonb DEFAULT '{}',
  ip_address        inet,
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_platform_audit_admin ON public.platform_audit_log (super_admin_id, created_at DESC);
CREATE INDEX idx_platform_audit_entity ON public.platform_audit_log (entity_type, entity_id);
CREATE INDEX idx_platform_audit_time ON public.platform_audit_log (created_at DESC);

-- ─── Platform Impersonation Log ────────────────────────────────
CREATE TABLE public.platform_impersonation_log (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id        uuid NOT NULL REFERENCES public.user_identity(user_id),
  target_user_id        uuid NOT NULL REFERENCES public.user_identity(user_id),
  target_workspace_id   uuid NOT NULL REFERENCES public.workspace(workspace_id),
  reason                text NOT NULL,
  started_at            timestamptz DEFAULT now() NOT NULL,
  ended_at              timestamptz,
  actions_taken         jsonb DEFAULT '[]',
  created_at            timestamptz DEFAULT now() NOT NULL,
  updated_at            timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_impersonation_admin ON public.platform_impersonation_log (super_admin_id, started_at DESC);

-- ─── Landing Config ────────────────────────────────────────────
CREATE TABLE public.landing_config (
  config_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text UNIQUE NOT NULL,
  name              text NOT NULL,
  locale            text NOT NULL DEFAULT 'no',
  status            text NOT NULL DEFAULT 'draft',    -- 'draft', 'published', 'archived'
  config_json       jsonb NOT NULL,
  published_json    jsonb,
  version           integer NOT NULL DEFAULT 1,
  created_by        uuid REFERENCES public.user_identity(user_id),
  updated_by        uuid REFERENCES public.user_identity(user_id),
  published_at      timestamptz,
  published_by      uuid REFERENCES public.user_identity(user_id),
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL
);
CREATE TRIGGER set_landing_config_updated_at BEFORE UPDATE ON public.landing_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.landing_config_version (
  version_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id         uuid NOT NULL REFERENCES public.landing_config(config_id),
  version           integer NOT NULL,
  config_json       jsonb NOT NULL,
  change_notes      text,
  created_by        uuid REFERENCES public.user_identity(user_id),
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_landing_config_slug ON public.landing_config (slug);
CREATE INDEX idx_landing_config_status ON public.landing_config (status);
CREATE INDEX idx_landing_config_version ON public.landing_config_version (config_id, version DESC);

-- ─── Platform Contract Template ────────────────────────────────
-- NOTE: Uses text for status, NOT the existing contract_status enum
-- (that enum belongs to employment_contract from migration 00012)
CREATE TABLE public.platform_contract_template (
  template_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  description       text,
  docuseal_template_id text,
  template_type     text NOT NULL,        -- 'saas_agreement', 'dpa', 'sla', 'custom'
  locale            text NOT NULL DEFAULT 'no',
  status            text NOT NULL DEFAULT 'active',  -- 'draft', 'active', 'archived'
  variable_fields   jsonb NOT NULL DEFAULT '[]',     -- [{name, label, type, required}]
  created_by        uuid REFERENCES public.user_identity(user_id),
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL
);
CREATE TRIGGER set_platform_contract_template_updated_at BEFORE UPDATE ON public.platform_contract_template FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Platform Contract Instance ────────────────────────────────
-- Company-level contracts (SaaS agreements, DPAs) — NOT employment contracts
CREATE TABLE public.platform_contract_instance (
  contract_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id       uuid REFERENCES public.platform_contract_template(template_id),
  company_id        uuid NOT NULL REFERENCES public.company(company_id),
  workspace_id      uuid REFERENCES public.workspace(workspace_id),  -- nullable: can be company-level
  title             text NOT NULL,
  status            text NOT NULL DEFAULT 'draft',  -- 'draft', 'sent', 'viewed', 'signed', 'expired', 'cancelled'
  docuseal_submission_id text,
  field_values      jsonb DEFAULT '{}',
  signatories       jsonb NOT NULL DEFAULT '[]',     -- [{name, email, role, signed_at}]
  sent_at           timestamptz,
  signed_at         timestamptz,
  expires_at        timestamptz,
  document_url      text,
  created_by        uuid REFERENCES public.user_identity(user_id),
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL
);
CREATE TRIGGER set_platform_contract_instance_updated_at BEFORE UPDATE ON public.platform_contract_instance FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_platform_contract_company ON public.platform_contract_instance (company_id);
CREATE INDEX idx_platform_contract_workspace ON public.platform_contract_instance (workspace_id);
CREATE INDEX idx_platform_contract_status ON public.platform_contract_instance (status);
CREATE INDEX idx_platform_contract_template ON public.platform_contract_instance (template_id);

-- ─── Platform Metrics (Daily Snapshot) ─────────────────────────
CREATE TABLE public.platform_metrics_daily (
  date                    date PRIMARY KEY,
  total_users             integer NOT NULL DEFAULT 0,
  total_companies         integer NOT NULL DEFAULT 0,
  total_workspaces        integer NOT NULL DEFAULT 0,
  total_profiles          integer NOT NULL DEFAULT 0,
  new_users_today         integer NOT NULL DEFAULT 0,
  new_workspaces_today    integer NOT NULL DEFAULT 0,
  -- Subscription data from company table (subscription_status column)
  subscriptions_trial     integer NOT NULL DEFAULT 0,
  subscriptions_active    integer NOT NULL DEFAULT 0,
  subscriptions_paused    integer NOT NULL DEFAULT 0,
  subscriptions_past_due  integer NOT NULL DEFAULT 0,
  subscriptions_cancelled integer NOT NULL DEFAULT 0,
  mrr_nok                 decimal(12,2) NOT NULL DEFAULT 0,
  active_workspaces_24h   integer NOT NULL DEFAULT 0,
  sessions_created_24h    integer NOT NULL DEFAULT 0,
  tasks_completed_24h     integer NOT NULL DEFAULT 0,
  signups_to_workspace    decimal(5,2),
  workspace_to_invite     decimal(5,2),
  invite_to_session       decimal(5,2),
  computed_at             timestamptz DEFAULT now() NOT NULL,
  created_at              timestamptz DEFAULT now() NOT NULL,
  updated_at              timestamptz DEFAULT now() NOT NULL
);

-- ─── Metrics Computation Function ──────────────────────────────
-- Reads from company.subscription_status (NOT a separate stripe table)
CREATE OR REPLACE FUNCTION public.compute_platform_metrics()
RETURNS void AS $$
INSERT INTO platform_metrics_daily (
  date,
  total_users,
  total_companies,
  total_workspaces,
  total_profiles,
  new_users_today,
  new_workspaces_today,
  subscriptions_trial,
  subscriptions_active,
  subscriptions_paused,
  subscriptions_past_due,
  subscriptions_cancelled,
  active_workspaces_24h,
  mrr_nok
)
SELECT
  CURRENT_DATE,
  (SELECT count(*) FROM public.user_identity),
  (SELECT count(*) FROM public.company),
  (SELECT count(*) FROM public.workspace),
  (SELECT count(*) FROM public.profile WHERE status = 'active'),
  (SELECT count(*) FROM public.user_identity WHERE created_at >= CURRENT_DATE),
  (SELECT count(*) FROM public.workspace WHERE created_at >= CURRENT_DATE),
  (SELECT count(*) FROM public.company WHERE subscription_status = 'trial'),
  (SELECT count(*) FROM public.company WHERE subscription_status = 'active'),
  (SELECT count(*) FROM public.company WHERE subscription_status = 'paused'),
  (SELECT count(*) FROM public.company WHERE subscription_status = 'past_due'),
  (SELECT count(*) FROM public.company WHERE subscription_status = 'cancelled'),
  (SELECT count(DISTINCT workspace_id) FROM public.profile WHERE updated_at >= now() - interval '24 hours'),
  0 -- MRR placeholder — real values come from Stripe API in production
ON CONFLICT (date) DO UPDATE SET
  total_users = EXCLUDED.total_users,
  total_companies = EXCLUDED.total_companies,
  total_workspaces = EXCLUDED.total_workspaces,
  total_profiles = EXCLUDED.total_profiles,
  new_users_today = EXCLUDED.new_users_today,
  new_workspaces_today = EXCLUDED.new_workspaces_today,
  subscriptions_trial = EXCLUDED.subscriptions_trial,
  subscriptions_active = EXCLUDED.subscriptions_active,
  subscriptions_paused = EXCLUDED.subscriptions_paused,
  subscriptions_past_due = EXCLUDED.subscriptions_past_due,
  subscriptions_cancelled = EXCLUDED.subscriptions_cancelled,
  active_workspaces_24h = EXCLUDED.active_workspaces_24h,
  mrr_nok = EXCLUDED.mrr_nok,
  computed_at = now();
$$ LANGUAGE sql
SECURITY DEFINER
SET search_path = public;

-- Only service role should call this function
REVOKE ALL ON FUNCTION compute_platform_metrics() FROM PUBLIC;
