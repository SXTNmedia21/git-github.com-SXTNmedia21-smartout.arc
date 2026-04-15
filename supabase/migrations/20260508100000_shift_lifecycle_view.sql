-- =====================================================================
-- 20260508100000_shift_lifecycle_view.sql
-- Phase 5 per ADR-0095: Aggregate read view across the five layers.
--
-- Layers (ADR-0095):
--   Execution   → schedule_shift, department_session
--   Reality     → timesheet.time_entry
--   Interpretation → shift_hour_interpretation (latest per shift)
--   Derivation  → shift_cost_snapshot (latest per shift)
--   Decision    → shift_approval, daily_reconciliation
--
-- The view computes a phenomenological `phase` (per Frontend Designer R2):
--   planlegges — published but no punch yet (or pre-publish)
--   pagar      — punched in, not yet out
--   oppgjor    — punched out; awaiting interpretation/settlement/approval
--   avsluttet  — daily_reconciliation is approved or locked
--
-- Read-only; RLS-enforced. Workspace members may read the view (RLS on
-- underlying tables already restricts rows). No aggregate view on top
-- of it ships until ADR-0095 layers are complete (they now are).
-- =====================================================================

SET search_path TO public, extensions;

-- Drop and recreate so column additions on underlying tables are picked
-- up on re-deploy without a manual CASCADE.
DROP VIEW IF EXISTS public.v_shift_lifecycle CASCADE;

CREATE VIEW public.v_shift_lifecycle
WITH (security_invoker = true)
AS
WITH latest_time_entry AS (
  SELECT DISTINCT ON (shift_id)
    shift_id,
    time_entry_id,
    workspace_id,
    punch_in,
    punch_out,
    status AS time_entry_status,
    updated_at
  FROM timesheet.time_entry
  ORDER BY shift_id, punch_in DESC NULLS LAST, updated_at DESC
),
latest_interpretation AS (
  SELECT DISTINCT ON (shift_id)
    shift_id,
    interpretation_id,
    derivation_version,
    total_interpreted_hours AS interpreted_hours,
    derived_at
  FROM public.shift_hour_interpretation
  ORDER BY shift_id, derivation_version DESC
),
latest_cost AS (
  SELECT DISTINCT ON (schedule_shift_id)
    schedule_shift_id,
    id AS cost_snapshot_id,
    gross_cost,
    calculated_at
  FROM public.shift_cost_snapshot
  ORDER BY schedule_shift_id, calculation_version DESC
),
latest_approval AS (
  SELECT DISTINCT ON (shift_id)
    shift_id,
    approval_id,
    reconciliation_id,
    status AS approval_status,
    approved_hours,
    approved_at,
    updated_at
  FROM public.shift_approval
  ORDER BY shift_id, created_at DESC
),
shift_deviation AS (
  -- Any deviation linked to a shift via its session counts as "has_deviation".
  -- Blocking deviations are those still open/acknowledged/escalated (not resolved).
  SELECT
    ds.schedule_shift_id AS shift_id,
    bool_or(true) AS has_deviation,
    bool_or(d.status IN ('open', 'acknowledged', 'escalated')) AS has_blocking_deviation
  FROM public.schedule_shift ds
  JOIN public.department_session sess
    ON sess.workspace_id = ds.workspace_id
   AND sess.department_id = ds.department_id
   AND sess.session_date = ds.shift_date
  JOIN public.deviation d
    ON d.session_id = sess.department_session_id
  GROUP BY ds.schedule_shift_id
)
SELECT
  ss.schedule_shift_id                                        AS shift_id,
  ss.workspace_id,
  ss.department_id,
  ss.employee_id,
  ss.shift_date,

  -- Raw enums (for UI that wants them)
  ss.status                                                   AS shift_status,
  sess.status                                                 AS session_status,
  la.approval_status                                          AS approval_status,
  dr.status                                                   AS reconciliation_status,

  -- Phenomenological phase (ADR-0095 R2, maps five enums → four phases)
  CASE
    WHEN dr.status IN ('approved', 'locked')                  THEN 'avsluttet'
    WHEN lte.punch_out IS NOT NULL                            THEN 'oppgjor'
    WHEN lte.punch_in IS NOT NULL AND lte.punch_out IS NULL   THEN 'pagar'
    ELSE 'planlegges'
  END                                                         AS phase,

  -- Hours per layer
  ss.work_hours                                               AS scheduled_hours,
  li.interpreted_hours                                        AS interpreted_hours,
  la.approved_hours                                           AS approved_hours,
  lc.gross_cost                                               AS gross_cost,

  -- Reality pointers
  lte.punch_in                                                AS last_punch_in,
  lte.punch_out                                               AS last_punch_out,
  lte.time_entry_status,

  -- Decision pointers
  la.approval_id,
  la.reconciliation_id,

  -- Derivation pointers
  li.interpretation_id,
  lc.cost_snapshot_id,

  -- Deviations
  COALESCE(sd.has_deviation, false)                           AS has_deviation,
  COALESCE(sd.has_blocking_deviation, false)                  AS has_blocking_deviation

FROM public.schedule_shift           ss
LEFT JOIN public.department_session  sess ON sess.workspace_id = ss.workspace_id
                                         AND sess.department_id = ss.department_id
                                         AND sess.session_date = ss.shift_date
LEFT JOIN latest_time_entry          lte  ON lte.shift_id = ss.schedule_shift_id
LEFT JOIN latest_interpretation      li   ON li.shift_id = ss.schedule_shift_id
LEFT JOIN latest_cost                lc   ON lc.schedule_shift_id = ss.schedule_shift_id
LEFT JOIN latest_approval            la   ON la.shift_id = ss.schedule_shift_id
LEFT JOIN public.daily_reconciliation dr  ON dr.reconciliation_id = la.reconciliation_id
LEFT JOIN shift_deviation            sd   ON sd.shift_id = ss.schedule_shift_id;

COMMENT ON VIEW public.v_shift_lifecycle IS
  'ADR-0095 Phase 5. Aggregate read across Execution / Reality / Interpretation / '
  'Derivation / Decision layers for a shift. `phase` maps five status enums to the '
  'four-phase UI vocabulary (planlegges/pagar/oppgjor/avsluttet). security_invoker '
  'so RLS on underlying tables restricts rows per caller.';

GRANT SELECT ON public.v_shift_lifecycle TO authenticated, service_role;
