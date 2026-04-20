-- Compliance drift detection: compares framework_snapshot on signed contracts
-- against current framework_rule rows to surface regulatory drift.

-- 1. Function: compute_compliance_diff
-- Compares a snapshot (JSONB object with "rules" array) against current framework_rule rows.
-- The snapshot shape is: { framework_id, framework_name, snapshot_date, rules: [{rule_id, rule_type, description, enforcement_level}] }
-- Returns JSONB array of diffs with drift_type: rule_deleted, rule_modified, rule_added.
CREATE OR REPLACE FUNCTION public.compute_compliance_diff(
  p_snapshot JSONB,
  p_framework_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result JSONB := '[]'::jsonb;
  v_snap_rule JSONB;
  v_current RECORD;
  v_snap_rules JSONB;
  v_snap_rule_id TEXT;
BEGIN
  -- Extract the rules array from the snapshot object
  v_snap_rules := COALESCE(p_snapshot -> 'rules', '[]'::jsonb);

  -- Check each snapshot rule against current rules
  FOR v_snap_rule IN SELECT jsonb_array_elements(v_snap_rules)
  LOOP
    v_snap_rule_id := v_snap_rule ->> 'rule_id';

    SELECT * INTO v_current
    FROM public.framework_rule
    WHERE framework_id = p_framework_id AND rule_id = v_snap_rule_id::uuid;

    IF NOT FOUND THEN
      -- Rule existed at snapshot time but has been deleted
      v_result := v_result || jsonb_build_object(
        'drift_type', 'rule_deleted',
        'rule_id', v_snap_rule_id,
        'snapshot', v_snap_rule
      );
    ELSE
      -- Compare key fields for modifications
      -- Snapshot stores enforcement_level; framework_rule stores severity
      IF (v_snap_rule ->> 'description') IS DISTINCT FROM v_current.description
        OR (v_snap_rule ->> 'enforcement_level') IS DISTINCT FROM v_current.severity
      THEN
        v_result := v_result || jsonb_build_object(
          'drift_type', 'rule_modified',
          'rule_id', v_snap_rule_id,
          'snapshot', v_snap_rule,
          'current_description', v_current.description,
          'current_severity', v_current.severity
        );
      END IF;
    END IF;
  END LOOP;

  -- Check for new rules added after the snapshot
  FOR v_current IN
    SELECT fr.rule_id, fr.description, fr.severity
    FROM public.framework_rule fr
    WHERE fr.framework_id = p_framework_id
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(v_snap_rules) AS s
        WHERE (s ->> 'rule_id')::uuid = fr.rule_id
      )
  LOOP
    v_result := v_result || jsonb_build_object(
      'drift_type', 'rule_added',
      'rule_id', v_current.rule_id,
      'current_description', v_current.description,
      'current_severity', v_current.severity
    );
  END LOOP;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.compute_compliance_diff(JSONB, UUID) IS
  'Compares a framework_snapshot against current framework_rule rows. Returns JSONB array of drifts.';

-- 2. Materialized view: compliance_drift
-- Pre-computes drift for all signed contracts that have a framework_snapshot.
-- framework_id is resolved from the snapshot metadata (first rule's framework_id).
CREATE MATERIALIZED VIEW IF NOT EXISTS public.compliance_drift AS
SELECT
  ec.contract_id,
  ec.workspace_id,
  ec.profile_id,
  ec.framework_snapshot,
  -- Extract framework_id from the snapshot object (not array)
  (ec.framework_snapshot ->> 'framework_id')::uuid AS framework_id,
  public.compute_compliance_diff(
    ec.framework_snapshot,
    (ec.framework_snapshot ->> 'framework_id')::uuid
  ) AS drift,
  now() AS computed_at
FROM public.employment_contract ec
WHERE ec.status = 'signed'
  AND ec.framework_snapshot IS NOT NULL
  AND ec.framework_snapshot ->> 'framework_id' IS NOT NULL;

-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_drift_contract
  ON public.compliance_drift(contract_id);

-- Index for workspace-scoped queries
CREATE INDEX IF NOT EXISTS idx_compliance_drift_workspace
  ON public.compliance_drift(workspace_id);

-- Index for finding contracts with actual drift
CREATE INDEX IF NOT EXISTS idx_compliance_drift_has_drift
  ON public.compliance_drift(contract_id)
  WHERE jsonb_array_length(drift) > 0;

-- 3. Trigger function: refresh compliance_drift when framework_rule changes
CREATE OR REPLACE FUNCTION public.refresh_compliance_drift()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.compliance_drift;
  RETURN NULL;
END;
$$;

-- 4. Trigger: refresh drift view on framework_rule changes
DROP TRIGGER IF EXISTS framework_rule_refresh_drift ON public.framework_rule;
CREATE TRIGGER framework_rule_refresh_drift
  AFTER INSERT OR UPDATE OR DELETE ON public.framework_rule
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.refresh_compliance_drift();
