-- ============================================
-- 20260515170200_contract_template_lineage_columns.sql
--
-- Council 2026-04-22, Gate G5: lineage + lifecycle schema for contract_template.
--
-- Purpose
--   Introduces K1a→K1b provenance (source_template_id/version + forked_at)
--   and a full lifecycle (published_at, deprecated_at) so the contract hub
--   can express fork / publish / deprecate flows without destroying history
--   for contracts already signed against retired templates.
--
-- Columns added (all nullable — backfill is implicit via future forks):
--   source_template_id       uuid   — FK to contract_template(template_id)
--                                     ON DELETE SET NULL so deleting a K1a
--                                     system template never cascades to a
--                                     workspace's K1b fork.
--   source_template_version  text   — snapshot of source.version at fork time
--   forked_at                timestamptz — when the fork happened
--   published_at             timestamptz — when the template became bindable
--   deprecated_at            timestamptz — soft-retire marker
--
-- Constraint
--   source_implies_forked: if source_template_id is set, forked_at must be
--   set too (derived rows carry a timestamp of their derivation).
--
-- Indexes
--   - source_template_id partial (for "what forks exist of this template?")
--   - (workspace_id, published_at) partial active — resolver for
--     "active binding candidates in workspace".
-- ============================================

BEGIN;

ALTER TABLE public.contract_template
  ADD COLUMN source_template_id uuid NULL,
  ADD COLUMN source_template_version text NULL,
  ADD COLUMN forked_at timestamptz NULL,
  ADD COLUMN published_at timestamptz NULL,
  ADD COLUMN deprecated_at timestamptz NULL;

-- Lineage integrity — a derived row must record when it was derived.
ALTER TABLE public.contract_template
  ADD CONSTRAINT contract_template_source_implies_forked
  CHECK (source_template_id IS NULL OR forked_at IS NOT NULL);

-- FK to self. ON DELETE SET NULL: keep the workspace fork usable even if a
-- platform-level K1a template is retired from the catalog.
ALTER TABLE public.contract_template
  ADD CONSTRAINT contract_template_source_fk
  FOREIGN KEY (source_template_id)
  REFERENCES public.contract_template(template_id)
  ON DELETE SET NULL;

-- Reverse-lineage lookup ("what forks exist of this template?").
CREATE INDEX idx_contract_template_source
  ON public.contract_template(source_template_id)
  WHERE source_template_id IS NOT NULL;

-- Active-binding resolver — "which published, non-deprecated templates
-- belong to this workspace?".
CREATE INDEX idx_contract_template_active_binding
  ON public.contract_template(workspace_id, published_at)
  WHERE deprecated_at IS NULL;

COMMIT;
