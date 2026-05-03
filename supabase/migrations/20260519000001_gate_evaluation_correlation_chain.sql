-- 20260519000000_gate_evaluation_correlation_chain.sql
--
-- ADR-0204 §2 — add correlation_id + parent_evaluation_id to gate_evaluation so
-- the composition orchestrator (packages/ai/src/gate/gatedMutation.ts) can
-- write a causally linked audit chain across Pathway A (gate_action, ADR-0099)
-- and Pathway B (cascade_gate_write, ADR-0091) for a single mutation attempt.
--
-- Why two columns (not one)?
--   * correlation_id      — flat join key. Group the two rows (authority +
--                           data-rule) a single orchestrator call produces.
--                           Cheap dashboard queries: GROUP BY correlation_id.
--   * parent_evaluation_id — causal link. Row 2 only exists because row 1
--                           allowed. Future chains (four-eyes handoff,
--                           multi-step escalation) extend the tree without
--                           widening correlation_id semantics.
--
-- Both columns are nullable so existing single-gate rows (written by the RPCs
-- directly, without the orchestrator) continue to work unchanged. When the
-- orchestrator runs, it invokes gate_action / cascade_gate_write as-is (the
-- RPCs still return gate_evaluation_id) and then UPDATEs those rows to stamp
-- correlation_id + parent_evaluation_id in a follow-up statement. No RPC
-- body changes — brief explicitly forbids it, and ADR-0204 §3 allows the
-- orchestrator and gate-client.ts as the only legal write sites.
--
-- Index: correlation_id lookup for audit dashboards (ADR-0190 Control 3a
-- tech-debt note — a future UI will GROUP BY correlation_id to reconstruct
-- the two-row composition chain in one query). Partial WHERE keeps the
-- index small by excluding legacy single-gate rows.
--
-- Idempotency: ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS. Safe
-- to re-run.

SET search_path TO public, extensions;

-- 1. Columns -------------------------------------------------------------
ALTER TABLE public.gate_evaluation
  ADD COLUMN IF NOT EXISTS correlation_id        UUID;

ALTER TABLE public.gate_evaluation
  ADD COLUMN IF NOT EXISTS parent_evaluation_id  UUID
    REFERENCES public.gate_evaluation(id);

-- 2. Index ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS gate_evaluation_correlation_id_idx
  ON public.gate_evaluation (correlation_id)
  WHERE correlation_id IS NOT NULL;

-- 3. Documentation -------------------------------------------------------
COMMENT ON COLUMN public.gate_evaluation.correlation_id IS
  'ADR-0204: groups gate_evaluation rows written by one gatedMutation() call. '
  'One orchestrator call produces up to two rows (authority + data-rule) sharing '
  'the same correlation_id. NULL on legacy rows written before the orchestrator '
  'landed, and on any row written via a direct RPC call that bypasses the '
  'orchestrator.';

COMMENT ON COLUMN public.gate_evaluation.parent_evaluation_id IS
  'ADR-0204: self-FK to the authority (row 1) evaluation that allowed this '
  'data-rule (row 2) evaluation to run. NULL on row 1 of a chain and on legacy '
  'rows. Reading left-to-right: actor was allowed (row 1) -> diff was evaluated '
  '(row 2). Future multi-step chains (four-eyes handoff) extend the tree via '
  'this column without widening correlation_id semantics.';
