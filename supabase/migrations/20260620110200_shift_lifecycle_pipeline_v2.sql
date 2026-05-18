-- ============================================================
-- 20260620110200_shift_lifecycle_pipeline_v2.sql
-- Shift Lifecycle Pipeline V2 — ADR-0340 T0 implementation
-- (Timestamp bumped 110000 → 120000 → 20260617110100 → 20260620110200 to clear
-- collision with 20260616120000_seed_channel_admin_authority.sql,
-- 20260617100000_payroll_period_locked_notifier_process.sql, and
-- dev tip 20260619100000_payroll_tariff_tools_authority_seed.sql.
-- B1 R1-fixup, council ref campaign-ui-shell-shippability-r1)
--
-- WHAT THIS MIGRATION DOES
-- ------------------------
-- 1. Seeds two engine_process blueprints:
--      shift_swap_lifecycle    — 3-stage mutual swap (propose → consent → approve)
--      marketplace_lifecycle   — 3-stage open-shift (post → claim → approve)
--    Both restricted to ARRAY['chat'] per ADR-0340 §Q5 + ADR-0288.
--
-- 2. Creates engine_authority_pipeline workflow-DEFINITION table.
--    NOT an instance table — that role is already played by engine_state (ADR-0067,
--    ADR-0340 Q1). This table is the blueprint store: per-(workspace, capability,
--    action_type, stage_index) configuration.
--
-- 3. Adds schedule_shift.pipeline_lock_state_id UUID column (FK → engine_state).
--    Acquire: CAS-style UPDATE WHERE pipeline_lock_state_id IS NULL.
--    Release: SET NULL on terminal state. ON DELETE SET NULL for test cleanup.
--    Per ADR-0340 P0.6 design.
--
-- 4. Extends enforce_schedule_shift_temporal_lock() trigger to permit
--    pipeline_lock_state_id writes within temporal window.
--    The column is NOT a planning field — it is a pipeline-orchestration field.
--    Explicit carve-out prevents future maintainers from accidentally adding it
--    to the immutable planning-field block.
--
-- 5. Seeds engine_authority_pipeline default stage rows for 6 stages:
--      shift_swap_lifecycle   × stage_0 / stage_1 / stage_2
--      marketplace_lifecycle  × stage_0 / stage_1 / stage_2
--    Seeded per-workspace (FK is NOT NULL). ON CONFLICT DO NOTHING.
--
-- REFERENCES
-- ----------
-- ADR-0340 (this sortie's canonical authority)
-- ADR-0321 §V2 Schema Sketch (retained blueprint-only fields — instance superseded)
-- ADR-0067 (engine_state is canonical pipeline instance store)
-- ADR-0099 (gate_action atomic write)
-- ADR-0288 (chat-only for irreversible C4 acts — pending acceptance, guards stay)
-- ADR-0192 (two-part capability seed pattern)
-- L-0177   (silent workspace fallback = bug — FK NOT NULL enforces)
--
-- IDEMPOTENCY
-- -----------
-- INSERT ... ON CONFLICT DO NOTHING throughout.
-- ADD COLUMN IF NOT EXISTS for schedule_shift alteration.
-- CREATE TABLE / CREATE INDEX / CREATE TRIGGER use IF NOT EXISTS or REPLACE.
-- Safe under db reset + replay.
-- ============================================================

SET search_path TO public, extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- §1. ENGINE_PROCESS BLUEPRINTS
-- Two new pipeline blueprints. allowed_channels = ARRAY['chat'] only per ADR-0340 §Q5.
-- Description encodes stage summary for engine introspection.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.engine_process (id, name, description, is_active, max_steps, allowed_channels)
VALUES
  (
    'shift_swap_lifecycle',
    'Shift Swap Lifecycle',
    'ADR-0340: 3-stage mutual shift exchange pipeline. '
    'stage_0_propose (employee proposes swap to peer) → '
    'stage_1_consent (peer employee accepts or rejects) → '
    'stage_2_approve (manager approves or rejects). '
    'Each stage is a separate gate_action call (per-stage atomic write, ADR-0099). '
    'Chat-only (ADR-0288 / ADR-0340 §Q5). '
    'Wraps existing shift-swap capability tools — does NOT write to swap tables directly (ADR-0240). '
    'Supersedes monolithic shift_swap process for pipeline-orchestrated flows.',
    true,
    6,
    ARRAY['chat']
  ),
  (
    'marketplace_lifecycle',
    'Marketplace Lifecycle',
    'ADR-0340: 3-stage open-shift marketplace pipeline. '
    'stage_0_post (manager posts open shift) → '
    'stage_1_claim (employee claims open shift) → '
    'stage_2_approve (manager approves or rejects claim). '
    'Each stage is a separate gate_action call (per-stage atomic write, ADR-0099). '
    'Chat-only (ADR-0288 / ADR-0340 §Q5). '
    'Wraps existing shift_marketplace capability tools — does NOT write to offer tables directly (ADR-0240). '
    'Complements existing marketplace_lifecycle V1 flows.',
    true,
    6,
    ARRAY['chat']
  )
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.engine_process IS
  'Domain process definitions. NOT the same as engine_missions (AI conversations). '
  'Pipeline blueprints: shift_swap_lifecycle (ADR-0340), marketplace_lifecycle (ADR-0340). '
  'allowed_channels restricts gate_action channel check at dispatch time.';

-- ─────────────────────────────────────────────────────────────────────────────
-- §2. ENGINE_AUTHORITY_PIPELINE TABLE
-- Workflow DEFINITION table. Per ADR-0321 §V2 Schema Sketch (blueprint-only fields,
-- NOT superseded — only the _instance variant is superseded by engine_state reuse).
-- One row per (workspace_id, capability, action_type, stage_index).
-- Workspace bootstrap hook seeds default rows; workspace admin may override (future UI).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.engine_authority_pipeline (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id      UUID        NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  capability        TEXT        NOT NULL,
  action_type       TEXT        NOT NULL,
  stage_index       INTEGER     NOT NULL,
  required_role     TEXT        NOT NULL,
  max_wait_minutes  INTEGER     NULL,
  escalation_action TEXT        NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One stage definition per (workspace, capability, action, stage).
  -- workspace_id NOT NULL: no platform-default rows — always workspace-scoped (L-0177, ADR-0151).
  CONSTRAINT engine_authority_pipeline_stage_unique
    UNIQUE (workspace_id, capability, action_type, stage_index)
);

ALTER TABLE public.engine_authority_pipeline ENABLE ROW LEVEL SECURITY;

-- Mirrors engine_authority_config RLS: admin read+write, API key read, service_role full.
DROP POLICY IF EXISTS "admin_manage_engine_authority_pipeline" ON public.engine_authority_pipeline;
CREATE POLICY "admin_manage_engine_authority_pipeline"
  ON public.engine_authority_pipeline
  FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.profile
      WHERE user_id = auth.uid()
        AND is_active = true
        AND role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.profile
      WHERE user_id = auth.uid()
        AND is_active = true
        AND role IN ('admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "api_key_read_engine_authority_pipeline" ON public.engine_authority_pipeline;
CREATE POLICY "api_key_read_engine_authority_pipeline"
  ON public.engine_authority_pipeline
  FOR SELECT
  USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
  );

DROP POLICY IF EXISTS "service_manage_engine_authority_pipeline" ON public.engine_authority_pipeline;
CREATE POLICY "service_manage_engine_authority_pipeline"
  ON public.engine_authority_pipeline
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Performance: workspace-scoped capability lookups (T1/T2 pipeline engine reads per stage)
CREATE INDEX IF NOT EXISTS idx_engine_authority_pipeline_workspace_cap
  ON public.engine_authority_pipeline (workspace_id, capability, stage_index);

-- Updated_at automation — uses project canonical helper (set_updated_at, not moddatetime).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_engine_authority_pipeline'
      AND tgrelid = 'public.engine_authority_pipeline'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_engine_authority_pipeline
      BEFORE UPDATE ON public.engine_authority_pipeline
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;

COMMENT ON TABLE public.engine_authority_pipeline IS
  'ADR-0340 + ADR-0321 §V2 Schema Sketch (blueprint-only — _instance superseded by engine_state). '
  'Per-(workspace, capability, action_type, stage_index) authority pipeline definition. '
  'NOT an instance table: active pipeline state lives in engine_state (ADR-0067). '
  'Reusable across capabilities: contracts.sign, payroll.lock_period, deviation.approve can all '
  'insert rows for their own stage chains without adding tables. '
  'workspace_id NOT NULL (L-0177: no silent JWT-default workspace fallback). '
  'RLS: admin_manage (admin+owner), api_key_read, service_manage. '
  'Seed: default rows for all workspaces seeded below; workspace admin may override via future UI.';

COMMENT ON COLUMN public.engine_authority_pipeline.capability IS
  'Capability name — must match engine_authority_config.capability for gate_action lookup. '
  'Examples: ''shift_swap_lifecycle'', ''marketplace_lifecycle'', ''contracts'', ''payroll''.';

COMMENT ON COLUMN public.engine_authority_pipeline.action_type IS
  'Stage action type passed to gate_action(p_action_type). '
  'Convention: <blueprint_id>.<stage_name> matching engine_process.id — '
  'e.g. ''shift_swap_lifecycle.stage_0_propose'', ''marketplace_lifecycle.stage_1_claim''. '
  'NOT future-merged capability name (ADR-0340 Q4=B preserves V1 capability names; '
  'blueprint-id is the stable identifier across V1/V2).';

COMMENT ON COLUMN public.engine_authority_pipeline.stage_index IS
  '0-based stage index. stage_0 = initiating action, stage_N = final approval. '
  'Must match engine_process stage ordering.';

COMMENT ON COLUMN public.engine_authority_pipeline.required_role IS
  'Minimum role required to perform this stage action. '
  'One of: employee, manager, admin, owner. '
  'Evaluated against profile.role at gate_action time.';

COMMENT ON COLUMN public.engine_authority_pipeline.max_wait_minutes IS
  'Optional: maximum minutes to wait for stage completion before escalation fires. '
  'NULL = no timeout (manual escalation only). '
  'Consumed by T1 pipeline engine — not enforced by this table.';

COMMENT ON COLUMN public.engine_authority_pipeline.escalation_action IS
  'Optional: action to take if max_wait_minutes elapses without stage completion. '
  'Examples: ''auto_cancel'', ''escalate_to_manager'', ''auto_approve''. '
  'Consumed by T1 pipeline engine. NULL = no escalation defined.';


-- ─────────────────────────────────────────────────────────────────────────────
-- §3. SCHEDULE_SHIFT.PIPELINE_LOCK_STATE_ID COLUMN
-- FK → engine_state(id). CAS-style acquire (WHERE IS NULL). ON DELETE SET NULL
-- for safe test cleanup without cascade-deleting shifts.
-- Per ADR-0340 P0.6 design.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.schedule_shift
  ADD COLUMN IF NOT EXISTS pipeline_lock_state_id UUID NULL
    REFERENCES public.engine_state(id) ON DELETE SET NULL;

-- Partial index: queries for "shifts currently in a pipeline" are always filtered
-- WHERE pipeline_lock_state_id IS NOT NULL. Sparse index (most shifts are NULL).
CREATE INDEX IF NOT EXISTS idx_schedule_shift_pipeline_lock
  ON public.schedule_shift (pipeline_lock_state_id)
  WHERE pipeline_lock_state_id IS NOT NULL;

COMMENT ON COLUMN public.schedule_shift.pipeline_lock_state_id IS
  'ADR-0340 P0.6: Points to the engine_state row owning the pipeline lock for this shift. '
  'NULL = shift is not locked by any pipeline. '
  'Acquire: CAS UPDATE WHERE pipeline_lock_state_id IS NULL (returns 0 rows → 409 Conflict). '
  'Release: SET NULL in terminal-state exec callback (status IN complete|failed|cancelled|escalated). '
  'ON DELETE SET NULL: hard-deleting engine_state (tests only) self-heals the lock reference. '
  'Coexists with schedule_shift_offer UNIQUE partial: that prevents double-claim within marketplace; '
  'this prevents concurrent pipeline entry across capabilities. '
  'RLS: no change — locked shift readable by workspace members; 409 from application layer, NOT trigger.';


-- ─────────────────────────────────────────────────────────────────────────────
-- §4. EXTEND enforce_schedule_shift_temporal_lock() — PIPELINE LOCK CARVE-OUT
--
-- PROBLEM: pipeline_lock_state_id is NOT a planning field. Setting it within the
-- temporal window (shift started or past) must be permitted — pipeline acquire and
-- release operations both write this column on in-progress and past shifts.
--
-- CURRENT BEHAVIOR: The trigger only raises on specific planning fields + invalid
-- status transitions. pipeline_lock_state_id changes fall through without error
-- today. This is correct and must be PRESERVED.
--
-- WHY EXPLICIT CARVE-OUT: Without an explicit guard, future maintainers seeing the
-- large planning-field block (shift_date, start_time, end_time, role, ...) may
-- reasonably add pipeline_lock_state_id to it, breaking pipeline acquire/release
-- on in-progress shifts. An explicit carve-out makes the intent unambiguous.
--
-- APPROACH: Add early-return guard BEFORE the planning-field check. If the UPDATE
-- changes ONLY pipeline_lock_state_id (and no other fields differ), return NEW
-- immediately without reaching the planning-field block. If pipeline_lock_state_id
-- changes alongside a planning field, the planning-field block still fires.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_schedule_shift_temporal_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_is_locked                  boolean;
  v_allow_adhoc_assignment     boolean := false;
  v_status_changed             boolean := false;
  v_only_pipeline_lock_changed boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_is_locked := public.schedule_shift_is_temporally_locked(
      OLD.workspace_id,
      OLD.shift_date,
      OLD.start_time
    );

    IF v_is_locked THEN
      PERFORM public.handle_schedule_shift_lock_violation(
        OLD.workspace_id,
        OLD.schedule_shift_id,
        'delete',
        'cannot_delete_started_or_past_shift',
        OLD.shift_date,
        OLD.start_time,
        to_jsonb(OLD),
        NULL
      );
    END IF;

    RETURN OLD;
  END IF;

  -- UPDATE path.
  v_is_locked := public.schedule_shift_is_temporally_locked(
    OLD.workspace_id,
    OLD.shift_date,
    OLD.start_time
  );

  -- If shift is NOT in temporal window: all mutations allowed.
  IF NOT v_is_locked THEN
    RETURN NEW;
  END IF;

  -- ── PIPELINE LOCK CARVE-OUT (ADR-0340 T0) ──────────────────────────────────
  -- pipeline_lock_state_id is a pipeline-orchestration field, NOT a planning field.
  -- Pipeline acquire (NULL → state_id) and release (state_id → NULL) must be
  -- permitted on temporally-locked shifts so that in-progress and past shifts can
  -- be enrolled in or released from the authority pipeline.
  --
  -- Early-return when pipeline_lock_state_id is the ONLY changed column.
  -- If pipeline_lock_state_id changes alongside any planning field, the planning-field
  -- check below fires normally (pipeline tool must not bundle planning mutations).
  --
  -- NOTE: Do NOT add pipeline_lock_state_id to the planning-field block below.
  -- ─────────────────────────────────────────────────────────────────────────────
  v_only_pipeline_lock_changed :=
    -- pipeline_lock_state_id changed
    (OLD.pipeline_lock_state_id IS DISTINCT FROM NEW.pipeline_lock_state_id)
    -- and every other column is identical (planning fields + status + all others)
    AND (OLD.shift_date IS NOT DISTINCT FROM NEW.shift_date)
    AND (OLD.start_time IS NOT DISTINCT FROM NEW.start_time)
    AND (OLD.end_time IS NOT DISTINCT FROM NEW.end_time)
    AND (OLD.role IS NOT DISTINCT FROM NEW.role)
    AND (OLD.day_category IS NOT DISTINCT FROM NEW.day_category)
    AND (OLD.department_id IS NOT DISTINCT FROM NEW.department_id)
    AND (OLD.location_id IS NOT DISTINCT FROM NEW.location_id)
    AND (OLD.position_id IS NOT DISTINCT FROM NEW.position_id)
    AND (OLD.team_id IS NOT DISTINCT FROM NEW.team_id)
    AND (OLD.zone IS NOT DISTINCT FROM NEW.zone)
    AND (OLD.indicator IS NOT DISTINCT FROM NEW.indicator)
    AND (OLD.breaks IS NOT DISTINCT FROM NEW.breaks)
    AND (OLD.work_hours IS NOT DISTINCT FROM NEW.work_hours)
    AND (OLD.is_published IS NOT DISTINCT FROM NEW.is_published)
    AND (OLD.template_shift_id IS NOT DISTINCT FROM NEW.template_shift_id)
    AND (OLD.is_adhoc IS NOT DISTINCT FROM NEW.is_adhoc)
    AND (OLD.notes IS NOT DISTINCT FROM NEW.notes)
    AND (OLD.employee_id IS NOT DISTINCT FROM NEW.employee_id)
    AND (OLD.status IS NOT DISTINCT FROM NEW.status);

  IF v_only_pipeline_lock_changed THEN
    -- Pipeline acquire/release on a temporally-locked shift: explicitly permitted.
    RETURN NEW;
  END IF;

  -- ── EXISTING PLANNING-FIELD IMMUTABILITY CHECK ─────────────────────────────
  -- Special operational carve-out:
  -- Ad-hoc shift can bind employee when starting active.
  v_allow_adhoc_assignment :=
    COALESCE(OLD.is_adhoc, false) = true
    AND OLD.employee_id IS NULL
    AND NEW.employee_id IS NOT NULL
    AND OLD.status IN ('created', 'assigned', 'published')
    AND NEW.status = 'active';

  -- Planning fields are immutable after temporal lock.
  IF (OLD.shift_date IS DISTINCT FROM NEW.shift_date)
    OR (OLD.start_time IS DISTINCT FROM NEW.start_time)
    OR (OLD.end_time IS DISTINCT FROM NEW.end_time)
    OR (OLD.role IS DISTINCT FROM NEW.role)
    OR (OLD.day_category IS DISTINCT FROM NEW.day_category)
    OR (OLD.department_id IS DISTINCT FROM NEW.department_id)
    OR (OLD.location_id IS DISTINCT FROM NEW.location_id)
    OR (OLD.position_id IS DISTINCT FROM NEW.position_id)
    OR (OLD.team_id IS DISTINCT FROM NEW.team_id)
    OR (OLD.zone IS DISTINCT FROM NEW.zone)
    OR (OLD.indicator IS DISTINCT FROM NEW.indicator)
    OR (OLD.breaks IS DISTINCT FROM NEW.breaks)
    OR (OLD.work_hours IS DISTINCT FROM NEW.work_hours)
    OR (OLD.is_published IS DISTINCT FROM NEW.is_published)
    OR (OLD.template_shift_id IS DISTINCT FROM NEW.template_shift_id)
    OR (OLD.is_adhoc IS DISTINCT FROM NEW.is_adhoc)
    OR (OLD.notes IS DISTINCT FROM NEW.notes)
    OR (
      OLD.employee_id IS DISTINCT FROM NEW.employee_id
      AND NOT v_allow_adhoc_assignment
    )
  THEN
    PERFORM public.handle_schedule_shift_lock_violation(
      OLD.workspace_id,
      OLD.schedule_shift_id,
      'update',
      'planning_fields_immutable_after_start_or_past_date',
      OLD.shift_date,
      OLD.start_time,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
  END IF;

  v_status_changed := OLD.status IS DISTINCT FROM NEW.status;

  IF v_status_changed THEN
    -- Allowed status transitions in locked window:
    -- published -> active, active -> completed
    IF NOT (
      (OLD.status = 'published' AND NEW.status = 'active')
      OR (OLD.status = 'active' AND NEW.status = 'completed')
    ) THEN
      PERFORM public.handle_schedule_shift_lock_violation(
        OLD.workspace_id,
        OLD.schedule_shift_id,
        'update',
        'invalid_status_transition_for_locked_shift',
        OLD.shift_date,
        OLD.start_time,
        to_jsonb(OLD),
        to_jsonb(NEW)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_schedule_shift_temporal_lock()
IS 'Blocks schedule planning mutations after shift start/past date; keeps narrow operational exceptions. '
   'ADR-0340 T0: pipeline_lock_state_id (pipeline-orchestration field) is explicitly permitted '
   'in temporal window via early-return carve-out. Do NOT add pipeline_lock_state_id to the '
   'planning-field block below the carve-out. '
   'Rollout mode (enforce/shadow/off) controlled by schedule_shift_lock_policy per workspace.';


-- ─────────────────────────────────────────────────────────────────────────────
-- §5. SEED ENGINE_AUTHORITY_PIPELINE DEFAULT STAGE ROWS
--
-- 6 rows per workspace (3 stages × 2 capabilities).
-- Per-workspace only (FK NOT NULL — no platform-default rows, per L-0177).
-- action_type convention: <capability>.<stage_name> matching gate_action call sites.
-- required_role: stage_0_propose = employee; stage_1_consent = employee;
--                stage_2_approve = manager (both capabilities).
-- marketplace stage_0_post = manager (managers post open shifts).
-- max_wait_minutes: reasonable defaults matching ADR-0306 + ADR-0321 intent.
-- escalation_action: NULL for V2 — T1 pipeline engine will evaluate at runtime.
-- ON CONFLICT DO NOTHING: idempotent, safe under db reset + replay.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.engine_authority_pipeline (
  workspace_id,
  capability,
  action_type,
  stage_index,
  required_role,
  max_wait_minutes,
  escalation_action
)
SELECT
  w.workspace_id,
  stages.capability,
  stages.action_type,
  stages.stage_index,
  stages.required_role,
  stages.max_wait_minutes,
  stages.escalation_action
FROM public.workspace w
CROSS JOIN (VALUES
  -- shift_swap_lifecycle: 3-stage mutual swap
  -- action_type encodes blueprint-id + stage (NOT future-merged capability name —
  -- ADR-0340 Q4=B preserves V1 capability names; blueprint-id matches engine_process.id)
  -- stage_0: employee proposes swap to peer
  (
    'shift_swap_lifecycle',
    'shift_swap_lifecycle.stage_0_propose',
    0,
    'employee',
    2880,    -- 48h: employee initiates, peer has 2 days to respond
    NULL::text
  ),
  -- stage_1: peer employee consents or rejects
  (
    'shift_swap_lifecycle',
    'shift_swap_lifecycle.stage_1_consent',
    1,
    'employee',
    2880,    -- 48h: peer response window
    NULL::text
  ),
  -- stage_2: manager approves or rejects the consented swap
  (
    'shift_swap_lifecycle',
    'shift_swap_lifecycle.stage_2_approve',
    2,
    'manager',
    1440,    -- 24h: manager decision window
    NULL::text
  ),

  -- marketplace_lifecycle: 3-stage open-shift
  -- stage_0: manager posts open shift
  (
    'marketplace_lifecycle',
    'marketplace_lifecycle.stage_0_post',
    0,
    'manager',
    NULL::integer,   -- no timeout on posting — valid until expires_at on offer row
    NULL::text
  ),
  -- stage_1: employee claims open shift
  (
    'marketplace_lifecycle',
    'marketplace_lifecycle.stage_1_claim',
    1,
    'employee',
    4320,    -- 72h: claim window (aligns with shift_marketplace V1 default)
    NULL::text
  ),
  -- stage_2: manager approves or rejects claim
  (
    'marketplace_lifecycle',
    'marketplace_lifecycle.stage_2_approve',
    2,
    'manager',
    720,     -- 12h: manager approval window (production staffing impact)
    NULL::text
  )
) AS stages(capability, action_type, stage_index, required_role, max_wait_minutes, escalation_action)
ON CONFLICT (workspace_id, capability, action_type, stage_index) DO NOTHING;

-- Summary comment for introspection
COMMENT ON INDEX public.idx_engine_authority_pipeline_workspace_cap IS
  'Performance index for T1 pipeline engine stage lookups: (workspace_id, capability, stage_index).';
