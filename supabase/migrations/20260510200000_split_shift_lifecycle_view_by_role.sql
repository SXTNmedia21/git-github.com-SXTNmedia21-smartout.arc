-- =====================================================================
-- 20260510200000_split_shift_lifecycle_view_by_role.sql
--
-- F8 (PLAN-secure-shift-lifecycle) + ADR-0077 + Council R2.
--
-- Purpose:
--   Prevent employee-role actors from reading `gross_cost` (C3 Commercial
--   PII) through the `v_shift_lifecycle` read surface. The previous
--   implementation relied on the agent tool `get_shift_lifecycle` omitting
--   `gross_cost` from its select list while using `ctx.supabaseAdmin`
--   (service-role, RLS bypass). "Polite suggestion" — one stray select
--   list change re-exposes the column.
--
-- Approach (Council R2 recommendation — Approach A, two views):
--   1. `v_shift_lifecycle` keeps ALL columns including `gross_cost`, but
--      becomes admin/manager/owner-only by wrapping access behind a
--      SECURITY DEFINER helper `can_read_shift_cost(workspace_id)` that
--      enforces role membership. Employees SELECTing from this view get
--      zero rows.
--   2. `v_shift_lifecycle_employee` is a new view that projects every
--      column EXCEPT `gross_cost` (and cost_snapshot_id, the derivation
--      pointer to the cost row). Any authenticated workspace member can
--      read it — workspace scoping is inherited from `security_invoker`
--      and underlying table RLS.
--   3. The `shift_cost_snapshot` SELECT policy is widened from
--      admin/owner to manager/admin/owner to match the view gate.
--      Council R2 treats gross_cost as an operational metric that
--      managers need; employees remain blocked at table level too.
--
-- Rationale:
--   - Defence at the lowest layer (per ADR-0077). Column physically
--     absent from the employee view → impossible to leak by select-list
--     mistake.
--   - Managers see gross_cost because it is an operational metric they
--     own (budget adherence, overtime checks).
--   - Workspace isolation continues to flow from underlying table RLS
--     through `security_invoker = true`.
--
-- Consumers at time of writing: ZERO (per Agent-coord Phase 2.5 trace —
-- the `get_shift_lifecycle` agent tool lives on PR #197
-- `feat/shift-lifecycle-capability-wiring` and is NOT yet merged to
-- development). Refactoring the view shape is therefore safe.
--
-- TODO when PR #197 merges:
--   The `get_shift_lifecycle` tool (packages/ai/.../tools) must branch
--   on caller role:
--     - admin | manager | owner → SELECT FROM public.v_shift_lifecycle
--     - employee                → SELECT FROM public.v_shift_lifecycle_employee
--   Drop `ctx.supabaseAdmin` in favour of `ctx.supabase` (JWT-scoped) so
--   RLS is the enforcement, not the select list. DO NOT reintroduce
--   `gross_cost` to the employee code path.
-- =====================================================================

SET search_path TO public, extensions;

-- ── Helper: manager-or-above role check ────────────────────────────
-- Returns true when the caller has a role in workspace that is cleared
-- to see C3 Commercial numbers (gross_cost). Owner ≥ admin ≥ manager.
-- Mirrors the pattern of `is_admin_in_workspace` but extends to manager.
CREATE OR REPLACE FUNCTION public.can_read_shift_cost(wid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  -- Non-end-user contexts bypass the role gate. The view is still
  -- useful to backend jobs, migrations, pgTAP fixtures, and the
  -- service_role client — those operate outside user-facing RLS.
  -- Guard: `auth.uid() IS NULL` covers the postgres/superuser case
  -- where no JWT is attached; `auth.role() = 'service_role'` covers
  -- Supabase service-role clients that run with a specific GUC.
  SELECT (
    auth.uid() IS NULL
    OR auth.role() = 'service_role'
  ) OR EXISTS (
    SELECT 1
    FROM public.profile
    WHERE user_id      = auth.uid()
      AND workspace_id = wid
      AND role         IN ('manager', 'admin', 'owner')
      AND is_active    = true
  );
$$;

COMMENT ON FUNCTION public.can_read_shift_cost(uuid) IS
  'ADR-0077 / F8. True when caller has manager/admin/owner role in the '
  'target workspace. Used to gate `gross_cost` exposure in '
  'v_shift_lifecycle. Employees always return false.';

GRANT EXECUTE ON FUNCTION public.can_read_shift_cost(uuid) TO authenticated, service_role;

-- ── Extend shift_cost_snapshot SELECT to managers ─────────────────
-- The derivation layer migration (20260506100000) restricted reads to
-- admin/owner via `admin_select_cost_snapshot`. Council R2 requires
-- managers to see gross_cost as an operational metric. Replace the
-- policy with a manager-inclusive version that mirrors the gate used
-- by v_shift_lifecycle. Employees still cannot read the table.
DROP POLICY IF EXISTS "admin_select_cost_snapshot" ON public.shift_cost_snapshot;
CREATE POLICY "manager_select_cost_snapshot" ON public.shift_cost_snapshot
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profile
       WHERE user_id      = auth.uid()
         AND workspace_id = shift_cost_snapshot.workspace_id
         AND role         IN ('manager', 'admin', 'owner')
         AND is_active    = true
    )
  );

COMMENT ON POLICY "manager_select_cost_snapshot" ON public.shift_cost_snapshot IS
  'ADR-0077 / F8 (Council R2). Managers, admins, owners can read cost '
  'snapshots as an operational metric. Employees are blocked. Mirrors '
  'the can_read_shift_cost gate used by v_shift_lifecycle.';

-- ── Drop the existing view so we can reshape it with role-gating ───
-- No consumers on development (verified Council R2 Phase 2.5). CASCADE
-- would only take out dependent views/types — none exist beyond the
-- generated type references in database.types.ts which get regenerated.
DROP VIEW IF EXISTS public.v_shift_lifecycle CASCADE;

-- ── v_shift_lifecycle: full view, MANAGER+ ONLY ────────────────────
-- Identical projection to the previous definition, but the outer WHERE
-- clause requires the caller to be manager/admin/owner in the row's
-- workspace. Employees get zero rows from this view.
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

  ss.status                                                   AS shift_status,
  sess.status                                                 AS session_status,
  la.approval_status                                          AS approval_status,
  dr.status                                                   AS reconciliation_status,

  CASE
    WHEN dr.status IN ('approved', 'locked')                  THEN 'avsluttet'
    WHEN lte.punch_out IS NOT NULL                            THEN 'oppgjor'
    WHEN lte.punch_in IS NOT NULL AND lte.punch_out IS NULL   THEN 'pagar'
    ELSE 'planlegges'
  END                                                         AS phase,

  ss.work_hours                                               AS scheduled_hours,
  li.interpreted_hours                                        AS interpreted_hours,
  la.approved_hours                                           AS approved_hours,
  lc.gross_cost                                               AS gross_cost,

  lte.punch_in                                                AS last_punch_in,
  lte.punch_out                                               AS last_punch_out,
  lte.time_entry_status,

  la.approval_id,
  la.reconciliation_id,

  li.interpretation_id,
  lc.cost_snapshot_id,

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
LEFT JOIN shift_deviation            sd   ON sd.shift_id = ss.schedule_shift_id
WHERE public.can_read_shift_cost(ss.workspace_id);

COMMENT ON VIEW public.v_shift_lifecycle IS
  'ADR-0095 Phase 5 + ADR-0077 / F8. Full lifecycle read including '
  'gross_cost. ROLE-GATED: caller must be manager/admin/owner in the '
  'workspace (WHERE public.can_read_shift_cost). Employees get zero '
  'rows — they must query v_shift_lifecycle_employee instead. '
  'security_invoker preserves workspace scoping from underlying tables.';

GRANT SELECT ON public.v_shift_lifecycle TO authenticated, service_role;

-- ── v_shift_lifecycle_employee: C3-redacted view for any member ────
-- Drops `gross_cost` and `cost_snapshot_id` (the pointer to the cost
-- row) entirely. Everything else is identical. Any authenticated
-- workspace member can read — workspace scoping flows from underlying
-- table RLS via security_invoker.
CREATE VIEW public.v_shift_lifecycle_employee
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

  ss.status                                                   AS shift_status,
  sess.status                                                 AS session_status,
  la.approval_status                                          AS approval_status,
  dr.status                                                   AS reconciliation_status,

  CASE
    WHEN dr.status IN ('approved', 'locked')                  THEN 'avsluttet'
    WHEN lte.punch_out IS NOT NULL                            THEN 'oppgjor'
    WHEN lte.punch_in IS NOT NULL AND lte.punch_out IS NULL   THEN 'pagar'
    ELSE 'planlegges'
  END                                                         AS phase,

  ss.work_hours                                               AS scheduled_hours,
  li.interpreted_hours                                        AS interpreted_hours,
  la.approved_hours                                           AS approved_hours,
  -- gross_cost intentionally omitted (C3 Commercial, manager+ only)

  lte.punch_in                                                AS last_punch_in,
  lte.punch_out                                               AS last_punch_out,
  lte.time_entry_status,

  la.approval_id,
  la.reconciliation_id,

  li.interpretation_id,
  -- cost_snapshot_id intentionally omitted (points to C3 row)

  COALESCE(sd.has_deviation, false)                           AS has_deviation,
  COALESCE(sd.has_blocking_deviation, false)                  AS has_blocking_deviation

FROM public.schedule_shift           ss
LEFT JOIN public.department_session  sess ON sess.workspace_id = ss.workspace_id
                                         AND sess.department_id = ss.department_id
                                         AND sess.session_date = ss.shift_date
LEFT JOIN latest_time_entry          lte  ON lte.shift_id = ss.schedule_shift_id
LEFT JOIN latest_interpretation      li   ON li.shift_id = ss.schedule_shift_id
LEFT JOIN latest_approval            la   ON la.shift_id = ss.schedule_shift_id
LEFT JOIN public.daily_reconciliation dr  ON dr.reconciliation_id = la.reconciliation_id
LEFT JOIN shift_deviation            sd   ON sd.shift_id = ss.schedule_shift_id;

COMMENT ON VIEW public.v_shift_lifecycle_employee IS
  'ADR-0095 Phase 5 + ADR-0077 / F8. C3-redacted lifecycle read for '
  'employees: projects every column of v_shift_lifecycle EXCEPT '
  'gross_cost and cost_snapshot_id. Workspace scoping inherited from '
  'underlying tables via security_invoker. Any authenticated workspace '
  'member may SELECT.';

GRANT SELECT ON public.v_shift_lifecycle_employee TO authenticated, service_role;
