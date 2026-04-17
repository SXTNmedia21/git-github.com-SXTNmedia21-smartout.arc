SET search_path TO public, extensions;

-- ============================================
-- 20260511200007_billing_dispatch_rule_evaluation.sql
-- Billing Engine Fase 2 — B1 Migration H
--
-- Implements the ADR-0127 rule-evaluation algorithm:
--   1. canonical_json(jsonb) -> jsonb
--      Recursively sorts keys so two jsonb values with identical contents
--      but different key orders produce the same canonical form. IMMUTABLE
--      so it can be used in indexes.
--   2. effective_dispatch_rules(invoice_id, trigger_event) -> SETOF rule
--      Returns the active dispatch rules for the invoice + event, after
--      applying workspace overrides and suppressions keyed on
--      canonical_json(channel || trigger_event || target).
--
-- Ref: ADR-0127 "Billing Dispatch Rule 2-Level Evaluation with Suppress
--      Semantics".
-- ============================================

-- ═══════════════════════════════════════════════════════════════
-- canonical_json — recursive key-sort + array element-wise normalisation
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.canonical_json(input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  v_key     text;
  v_keys    text[];
  v_result  jsonb;
  v_array   jsonb;
  v_element jsonb;
BEGIN
  IF input IS NULL THEN
    RETURN NULL;
  END IF;

  -- Object: sort keys, recurse on values.
  IF jsonb_typeof(input) = 'object' THEN
    v_result := '{}'::jsonb;
    SELECT array_agg(k ORDER BY k)
      INTO v_keys
      FROM jsonb_object_keys(input) AS k;

    IF v_keys IS NULL THEN
      RETURN v_result;
    END IF;

    FOREACH v_key IN ARRAY v_keys LOOP
      v_result := v_result || jsonb_build_object(
        v_key,
        public.canonical_json(input -> v_key)
      );
    END LOOP;
    RETURN v_result;
  END IF;

  -- Array: preserve order (arrays are ordered by semantics), recurse
  -- element-wise. Arrays inside objects are thus normalised recursively
  -- without reordering.
  IF jsonb_typeof(input) = 'array' THEN
    v_array := '[]'::jsonb;
    FOR v_element IN SELECT * FROM jsonb_array_elements(input) LOOP
      v_array := v_array || jsonb_build_array(public.canonical_json(v_element));
    END LOOP;
    RETURN v_array;
  END IF;

  -- Scalars: return as-is.
  RETURN input;
END;
$$;

COMMENT ON FUNCTION public.canonical_json(jsonb) IS
  'ADR-0127: recursively sort object keys so jsonb equality survives key-order drift. Arrays preserved element-wise. IMMUTABLE for index use.';

-- ═══════════════════════════════════════════════════════════════
-- effective_dispatch_rules — 7-step evaluation per ADR-0127
-- ═══════════════════════════════════════════════════════════════
-- Returns the set of rules that should fire for a given (invoice, event),
-- with workspace override/suppress semantics applied.
--
-- Return columns mirror billing_dispatch_rule so callers can treat this as
-- a view over the active rule set.
CREATE OR REPLACE FUNCTION public.effective_dispatch_rules(
  p_invoice_id   uuid,
  p_trigger_event text
)
RETURNS TABLE (
  dispatch_rule_id  uuid,
  workspace_id      uuid,
  company_id        uuid,
  channel           billing_dispatch_channel,
  trigger_event     text,
  target            jsonb,
  template_id       uuid,
  action            dispatch_rule_action,
  is_enabled        boolean,
  rule_source       text  -- 'platform' | 'workspace'
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_workspace_id  uuid;
  v_company_id    uuid;
BEGIN
  -- Resolve the invoice's workspace + company. workspace_id flows from
  -- company → workspace via ownership. Fase 1 invoices are company-scoped
  -- (ADR-0118) — we join to find the invoice's workspace via company.
  -- If a company spans multiple workspaces, we return rules from any
  -- workspace the company belongs to.
  SELECT i.company_id INTO v_company_id
  FROM public.invoice i
  WHERE i.invoice_id = p_invoice_id;

  IF v_company_id IS NULL THEN
    RETURN;  -- invoice not found → empty result
  END IF;

  -- Try to resolve a workspace via workspace.company_id FK. If company is
  -- attached to multiple workspaces, the first match wins (rare, per
  -- ADR-0118 companies are 1-to-many with workspaces but each invoice
  -- originates in one company's billing scope).
  SELECT w.workspace_id INTO v_workspace_id
  FROM public.workspace w
  WHERE w.company_id = v_company_id
  LIMIT 1;

  RETURN QUERY
  WITH
    platform_rules AS (
      SELECT r.*
      FROM public.billing_dispatch_rule r
      WHERE r.workspace_id IS NULL
        AND r.is_enabled = true
        AND r.trigger_event = p_trigger_event
        -- platform rules can never be company-scoped (enforced by CHECK
        -- constraint, but re-stated here for clarity of the algorithm).
        AND r.company_id IS NULL
    ),
    workspace_rules AS (
      SELECT r.*
      FROM public.billing_dispatch_rule r
      WHERE r.workspace_id IS NOT NULL
        AND r.workspace_id = v_workspace_id
        AND r.is_enabled = true
        AND r.trigger_event = p_trigger_event
        AND (r.company_id IS NULL OR r.company_id = v_company_id)
    ),
    dedup_workspace AS (
      SELECT
        r.*,
        public.canonical_json(jsonb_build_object(
          'channel', r.channel::text,
          'trigger_event', r.trigger_event,
          'target', r.target
        )) AS dedup_key
      FROM workspace_rules r
    ),
    dedup_platform AS (
      SELECT
        r.*,
        public.canonical_json(jsonb_build_object(
          'channel', r.channel::text,
          'trigger_event', r.trigger_event,
          'target', r.target
        )) AS dedup_key
      FROM platform_rules r
    ),
    suppressed_keys AS (
      SELECT dw.dedup_key
      FROM dedup_workspace dw
      WHERE dw.action = 'suppress'
    ),
    -- Platform rules that survive suppression AND are not overridden by
    -- a workspace 'send' rule with the same dedup_key.
    platform_active AS (
      SELECT dp.*
      FROM dedup_platform dp
      WHERE dp.dedup_key NOT IN (SELECT dedup_key FROM suppressed_keys)
        AND dp.dedup_key NOT IN (
          SELECT dw.dedup_key
          FROM dedup_workspace dw
          WHERE dw.action = 'send'
        )
    ),
    workspace_active AS (
      SELECT dw.*
      FROM dedup_workspace dw
      WHERE dw.action = 'send'
    )
  SELECT
    p.dispatch_rule_id,
    p.workspace_id,
    p.company_id,
    p.channel,
    p.trigger_event,
    p.target,
    p.template_id,
    p.action,
    p.is_enabled,
    'platform'::text AS rule_source
  FROM platform_active p
  UNION ALL
  SELECT
    w.dispatch_rule_id,
    w.workspace_id,
    w.company_id,
    w.channel,
    w.trigger_event,
    w.target,
    w.template_id,
    w.action,
    w.is_enabled,
    'workspace'::text AS rule_source
  FROM workspace_active w;
END;
$$;

COMMENT ON FUNCTION public.effective_dispatch_rules(uuid, text) IS
  'ADR-0127: returns active dispatch rules for (invoice, event) with workspace suppress/override semantics. Server Actions MUST call this — no ad-hoc UNION queries.';
