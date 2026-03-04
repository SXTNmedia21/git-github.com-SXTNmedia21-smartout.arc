SET search_path TO public, extensions;

-- ═══════════════════════════════════════════════════════════════
-- Migration 20260228120000: Platform Communication System
-- Module 17 — Super Admin Backoffice
-- No RLS — service role only (same as other platform-admin tables)
-- ═══════════════════════════════════════════════════════════════

-- ─── Job-Level Communication Log ───────────────────────────────
-- Tracks each broadcast/targeted send initiated by a super admin
CREATE TABLE IF NOT EXISTS public.platform_communication_log (
  communication_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id      uuid NOT NULL REFERENCES public.user_identity(user_id),
  subject             text NOT NULL,
  message_body        text NOT NULL,
  template            text NOT NULL,
  classification      text NOT NULL DEFAULT 'broadcast',   -- 'broadcast', 'targeted', 'workspace'
  audience_filter     jsonb,                               -- filter criteria used to build recipient list
  workspace_id        uuid REFERENCES public.workspace(workspace_id),  -- nullable: workspace-scoped sends
  idempotency_key     text,                               -- prevents duplicate sends
  recipient_count     integer NOT NULL DEFAULT 0,
  sent_count          integer NOT NULL DEFAULT 0,
  failed_count        integer NOT NULL DEFAULT 0,
  status              text NOT NULL DEFAULT 'queued',      -- 'queued', 'sending', 'sent', 'failed', 'cancelled'
  provider            text DEFAULT 'sendgrid',
  provider_batch_id   text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_admin ON public.platform_communication_log (super_admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_time ON public.platform_communication_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_status ON public.platform_communication_log (status);
CREATE INDEX IF NOT EXISTS idx_comm_workspace ON public.platform_communication_log (workspace_id) WHERE workspace_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_comm_idempotency ON public.platform_communication_log (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ─── Per-Recipient Delivery Tracking ───────────────────────────
-- One row per recipient per communication job
CREATE TABLE IF NOT EXISTS public.platform_communication_recipient (
  recipient_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id    uuid NOT NULL REFERENCES public.platform_communication_log(communication_id) ON DELETE CASCADE,
  user_id             uuid REFERENCES public.user_identity(user_id),
  email               text NOT NULL,
  name                text,
  status              text NOT NULL DEFAULT 'pending',    -- 'pending', 'sent', 'delivered', 'bounced', 'failed'
  error_message       text,
  sent_at             timestamptz,
  delivered_at        timestamptz,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipient_comm ON public.platform_communication_recipient (communication_id);
CREATE INDEX IF NOT EXISTS idx_recipient_user ON public.platform_communication_recipient (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recipient_status ON public.platform_communication_recipient (status);

-- ─── Email Suppression List ─────────────────────────────────────
-- Hard bounces and unsubscribes — checked before every send
CREATE TABLE IF NOT EXISTS public.platform_email_suppression (
  suppression_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text NOT NULL,
  reason              text NOT NULL,                      -- 'bounce', 'unsubscribe', 'complaint', 'manual'
  source              text,                              -- communication_id or 'sendgrid_webhook'
  created_at          timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppression_email ON public.platform_email_suppression (email);
