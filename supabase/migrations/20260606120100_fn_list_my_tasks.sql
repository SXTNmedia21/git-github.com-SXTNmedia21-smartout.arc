-- migrations/20260606120100_fn_list_my_tasks.sql
-- ADR-0298 Sortie 2 — single read surface for all task types.
-- SECURITY DEFINER: reads personal_task rows past owner-RLS using caller's auth.uid().
-- Caller identity is NEVER a parameter — always derived from auth.uid() internally.
-- engine_state_step is explicitly EXCLUDED (ADR-0298 R2 — workflow runtime, not a task).
--
-- Forward note (ADR-0298 R7): packages/ai/src/context/collector.ts wire deferred to Sortie 3.
-- Sources: session_task, schedule_day_task, personal_task, emma_task (4 arms).

CREATE OR REPLACE FUNCTION public.fn_list_my_tasks(
  p_window_start TIMESTAMPTZ DEFAULT (now() - INTERVAL '1 day'),
  p_window_end   TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days')
)
RETURNS TABLE (
  id            UUID,
  source        TEXT,
  raw_status    TEXT,
  status        TEXT,
  title         TEXT,
  description   TEXT,
  due_at        TIMESTAMPTZ,
  priority      TEXT,
  assigned_to   UUID,
  workspace_id  UUID,
  session_id    UUID,
  hook_id       UUID,
  compliance    BOOLEAN,
  created_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  origin_actor  TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Resolve all active profiles for the calling user.
  -- Multi-workspace users receive tasks from all their workspaces (ADR-0298 R8).
  -- Single CTE avoids repeated auth.uid() calls across the four UNION arms.
  WITH caller_profiles AS (
    SELECT profile_id, workspace_id
    FROM public.profile
    WHERE user_id = auth.uid()
      AND is_active = true
  )

  -- ── ARM 1: session_task ────────────────────────────────────────────────────
  -- Operational tasks spawned inside a department_session (from hooks or ad-hoc).
  -- Includes unassigned tasks (assigned_to IS NULL) — pickup-eligible for any
  -- workspace member. Window filter is on the session date, not created_at.
  -- priority synthesized from is_compliance_required (no priority column).
  -- origin_actor distinguishes cascade-cron-spawned vs human-created tasks.
  SELECT
    st.id,
    'session'::text                                                     AS source,
    st.status::text                                                     AS raw_status,
    public.fn_normalize_session_task_status(st.status::text)            AS status,
    st.title,
    st.description,
    ds.session_date::timestamptz                                        AS due_at,
    CASE WHEN st.is_compliance_required THEN 'high' ELSE 'normal' END  AS priority,
    st.assigned_to,
    st.workspace_id,
    st.department_session_id                                            AS session_id,
    st.session_hook_id                                                  AS hook_id,
    st.is_compliance_required                                           AS compliance,
    st.created_at,
    st.completed_at,
    CASE WHEN st.session_hook_id IS NOT NULL
         THEN 'cascade_cron'
         ELSE 'human'
    END                                                                 AS origin_actor
  FROM public.session_task st
  JOIN public.department_session ds
    ON ds.department_session_id = st.department_session_id
  WHERE st.workspace_id IN (SELECT workspace_id FROM caller_profiles)
    AND (
      st.assigned_to IN (SELECT profile_id FROM caller_profiles)
      OR st.assigned_to IS NULL
    )
    AND ds.session_date::timestamptz BETWEEN p_window_start AND p_window_end

  UNION ALL

  -- ── ARM 2: schedule_day_task ───────────────────────────────────────────────
  -- Ad-hoc daily operational tasks from the schedule day view.
  -- No priority column — synthesized from highlight boolean.
  -- task_status is free-text (no CHECK), normalized inline rather than via helper
  -- because the source vocabulary is small and stable.
  SELECT
    sdt.schedule_day_task_id                                            AS id,
    'day_ad_hoc'::text                                                  AS source,
    sdt.task_status                                                     AS raw_status,
    CASE sdt.task_status
      WHEN 'pending'   THEN 'pending'
      WHEN 'completed' THEN 'done'
      WHEN 'done'      THEN 'done'
      WHEN 'cancelled' THEN 'cancelled'
      ELSE 'pending'
    END                                                                 AS status,
    sdt.label                                                           AS title,
    NULL::text                                                          AS description,
    sdt.shift_date::timestamptz                                         AS due_at,
    CASE WHEN sdt.highlight THEN 'high' ELSE 'normal' END              AS priority,
    sdt.assigned_to,
    sdt.workspace_id,
    NULL::uuid                                                          AS session_id,
    NULL::uuid                                                          AS hook_id,
    false                                                               AS compliance,
    sdt.created_at,
    sdt.completed_at,
    'human'::text                                                       AS origin_actor
  FROM public.schedule_day_task sdt
  WHERE sdt.workspace_id IN (SELECT workspace_id FROM caller_profiles)
    AND (
      sdt.assigned_to IN (SELECT profile_id FROM caller_profiles)
      OR sdt.assigned_to IS NULL
    )
    AND sdt.shift_date::timestamptz BETWEEN p_window_start AND p_window_end

  UNION ALL

  -- ── ARM 3: personal_task ──────────────────────────────────────────────────
  -- Owner-only tasks. No assigned_to — profile_id is both owner and assignee.
  -- SECURITY DEFINER is required here: RLS on personal_task is owner-scoped
  -- (profile_id = auth.uid()-derived), so the function reads through RLS on
  -- behalf of the caller, but self-gates via caller_profiles CTE.
  -- Window filter: include tasks with no due_at (open backlog) + those in window.
  -- priority: fn_normalize_priority maps urgent→critical.
  -- status: open→pending normalization per ADR-0298 §3.3 divergence 1.
  SELECT
    pt.id,
    'personal'::text                                                    AS source,
    pt.status                                                           AS raw_status,
    CASE pt.status
      WHEN 'open'      THEN 'pending'
      WHEN 'done'      THEN 'done'
      WHEN 'cancelled' THEN 'cancelled'
      ELSE 'pending'
    END                                                                 AS status,
    pt.title,
    NULL::text                                                          AS description,
    pt.due_at,
    public.fn_normalize_priority(pt.priority)                           AS priority,
    pt.profile_id                                                       AS assigned_to,
    pt.workspace_id,
    NULL::uuid                                                          AS session_id,
    NULL::uuid                                                          AS hook_id,
    false                                                               AS compliance,
    pt.created_at,
    NULL::timestamptz                                                   AS completed_at,
    'human'::text                                                       AS origin_actor
  FROM public.personal_task pt
  WHERE pt.profile_id IN (SELECT profile_id FROM caller_profiles)
    AND (
      pt.due_at IS NULL
      OR pt.due_at BETWEEN p_window_start AND p_window_end
    )

  UNION ALL

  -- ── ARM 4: emma_task ──────────────────────────────────────────────────────
  -- AI-scheduled tasks created by Emma. profile_id = owner.
  -- No priority column — constant 'normal' per ADR-0298 §3.3 divergence 5.
  -- triggered_at maps to completed_at (transition from pending to triggered
  -- is the closest lifecycle milestone emma_task exposes).
  -- origin_actor = 'agent_auto' — always system-originated.
  SELECT
    et.id,
    'emma'::text                                                        AS source,
    et.status                                                           AS raw_status,
    CASE et.status
      WHEN 'pending'   THEN 'pending'
      WHEN 'triggered' THEN 'triggered'
      WHEN 'done'      THEN 'done'
      WHEN 'dismissed' THEN 'cancelled'
      ELSE 'pending'
    END                                                                 AS status,
    et.title,
    et.description,
    et.due_at,
    'normal'::text                                                      AS priority,
    et.profile_id                                                       AS assigned_to,
    et.workspace_id,
    NULL::uuid                                                          AS session_id,
    NULL::uuid                                                          AS hook_id,
    false                                                               AS compliance,
    et.created_at,
    et.triggered_at                                                     AS completed_at,
    'agent_auto'::text                                                  AS origin_actor
  FROM public.emma_task et
  WHERE et.profile_id IN (SELECT profile_id FROM caller_profiles)
    AND (
      et.due_at IS NULL
      OR et.due_at BETWEEN p_window_start AND p_window_end
    );
$$;

-- ── Permissions ───────────────────────────────────────────────────────────────
-- NOT granted to service_role: internal callers (stage-engine, edge functions)
-- read the four tables directly per ADR-0298 R4. The RPC is the mobile/web
-- client surface only. service_role bypasses RLS anyway and should use direct
-- table reads to avoid the SECURITY DEFINER overhead.
REVOKE ALL ON FUNCTION public.fn_list_my_tasks(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_list_my_tasks(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION public.fn_list_my_tasks IS
  'ADR-0298 Sortie 2 read surface. UNION ALL across session_task (ARM 1), '
  'schedule_day_task (ARM 2), personal_task (ARM 3), emma_task (ARM 4). '
  'engine_state_step EXCLUDED per R2 (workflow runtime, not a task). '
  'Caller identity derived from auth.uid() — never a parameter (ADR-0298 R6). '
  'Multi-workspace profiles receive UNION across all active workspaces (R8). '
  'Forward note: ADR-0298 R7 collector.ts wire deferred to Sortie 3 '
  '(packages/ai/src/context/collector.ts).';
