SET search_path TO public, extensions;

-- ============================================
-- 20260417122044_usage_snapshot_table.sql
-- Billing Engine Fase 1 — Task 1.6
-- Reproducible usage snapshot per (company × workspace × period).
-- Per ADR-0119: stores counted_profile_ids (audit trail) + source_query_hash
-- (SHA-256 for reproducibility).
-- workspace_id NOT NULL per H6 (company aggregates via SUM at read time).
-- Also adds the deferred FK on invoice_line_item.usage_snapshot_id.
-- ============================================

CREATE TABLE public.usage_snapshot (
  usage_snapshot_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid NOT NULL REFERENCES public.company(company_id),
  workspace_id            uuid NOT NULL REFERENCES public.workspace(workspace_id),
  period_from             date NOT NULL,
  period_to               date NOT NULL,

  active_users            int NOT NULL,
  free_users_applied      int NOT NULL,
  billable_users          int NOT NULL,

  counted_profile_ids     jsonb NOT NULL,
  source_query_hash       text NOT NULL,

  computed_at             timestamptz NOT NULL DEFAULT now(),
  computed_by             text,

  UNIQUE (company_id, workspace_id, period_from, period_to)
);

CREATE INDEX idx_snapshot_company_period
  ON public.usage_snapshot(company_id, period_from, period_to);

-- ── Deferred FK on invoice_line_item.usage_snapshot_id ───────
-- invoice_line_item was created in Task 1.5 without this FK (usage_snapshot
-- didn't exist yet). Add it now.
ALTER TABLE public.invoice_line_item
  ADD CONSTRAINT fk_line_item_usage_snapshot
  FOREIGN KEY (usage_snapshot_id)
  REFERENCES public.usage_snapshot(usage_snapshot_id);

COMMENT ON TABLE public.usage_snapshot IS
  'Reproducible usage snapshot per (company, workspace, period). Per ADR-0119. workspace_id NOT NULL (H6) — company aggregates via SUM at read time.';

COMMENT ON COLUMN public.usage_snapshot.counted_profile_ids IS
  'jsonb array of profile_id UUIDs that were counted as active users in this period. Audit trail for dispute resolution.';

COMMENT ON COLUMN public.usage_snapshot.source_query_hash IS
  'SHA-256 hash of the SQL query + bound parameters that produced this snapshot. For exact reproducibility per ADR-0119.';
