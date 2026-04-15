-- 20260505110000_unified_authority_gate.sql
-- ADR-0099: Unified authority gate across agent-router and engine-dispatch.
-- Postgres RPC as single gate. Both Node (stage-engine) and Deno (engine-dispatch)
-- call public.gate_action(...) before any mutation or dispatch.
--
-- Writes audit to gate_evaluation table. Emits telemetry via caller on denial.

SET search_path TO public, extensions;

-- ──────────────────────────────────────────────
-- 1. Add 'blocked' to engine_state status
-- ──────────────────────────────────────────────
-- ADR-0099 §3: gate denial transitions engine_state to 'blocked' pending manual resolution.
ALTER TABLE public.engine_state
  DROP CONSTRAINT IF EXISTS engine_state_status_check;

ALTER TABLE public.engine_state
  ADD CONSTRAINT engine_state_status_check
  CHECK (status IN ('pending', 'active', 'waiting', 'complete', 'failed', 'escalated', 'blocked'));

-- ──────────────────────────────────────────────
-- 2. gate_evaluation audit table
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gate_evaluation (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id),
  capability          TEXT NOT NULL,
  action_type         TEXT NOT NULL,
  channel             TEXT NOT NULL,
  actor_profile_id    UUID REFERENCES profile(profile_id),
  engine_process_id   TEXT REFERENCES engine_process(id),
  engine_state_id     UUID REFERENCES engine_state(id),
  allow               BOOLEAN NOT NULL,
  downgrade_to        TEXT,
  min_role_required   TEXT,
  channel_allowed     BOOLEAN NOT NULL,
  reason              TEXT,
  evaluated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gate_evaluation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_manage_gate_evaluation" ON public.gate_evaluation;
CREATE POLICY "service_manage_gate_evaluation" ON public.gate_evaluation
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "admin_read_gate_evaluation" ON public.gate_evaluation;
CREATE POLICY "admin_read_gate_evaluation" ON public.gate_evaluation
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.profile
      WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'owner')
    )
  );

CREATE INDEX IF NOT EXISTS idx_gate_evaluation_workspace_time
  ON public.gate_evaluation (workspace_id, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS idx_gate_evaluation_denied
  ON public.gate_evaluation (workspace_id, evaluated_at DESC)
  WHERE allow = false;

COMMENT ON TABLE public.gate_evaluation IS
  'ADR-0099: audit log of every authority-gate evaluation (allow + downgrade + channel).';

-- ──────────────────────────────────────────────
-- 3. Helper: role rank for min_role comparison
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._role_rank(p_role TEXT)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE p_role
    WHEN 'employee' THEN 1
    WHEN 'manager'  THEN 2
    WHEN 'admin'    THEN 3
    WHEN 'owner'    THEN 4
    WHEN 'system'   THEN 4
    ELSE 0
  END;
$$;

-- ──────────────────────────────────────────────
-- 4. public.gate_action RPC
-- ──────────────────────────────────────────────
-- Single authority + channel gate. Returns jsonb:
--   { allow, downgrade_to, min_role_required, channel_allowed, reason, gate_evaluation_id }
--
-- Rules (ADR-0099 §5):
--   - No engine_authority_config row for (workspace, capability) → allow=true (default-allow).
--   - Row exists with level='disabled' → allow=false, reason='capability_disabled'.
--   - Role below min_role → allow=true but downgrade_to='suggest'.
--   - engine_process_id provided and channel not in engine_process.allowed_channels → allow=false,
--     reason='channel_not_permitted'.
--   - Otherwise → allow=true.
CREATE OR REPLACE FUNCTION public.gate_action(
  p_workspace_id       UUID,
  p_capability         TEXT,
  p_channel            TEXT,
  p_actor_profile_id   UUID,
  p_action_type        TEXT,
  p_engine_process_id  TEXT DEFAULT NULL,
  p_engine_state_id    UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_level               TEXT;
  v_min_role            TEXT;
  v_caller_role         TEXT;
  v_allow               BOOLEAN := true;
  v_downgrade_to        TEXT    := NULL;
  v_channel_allowed     BOOLEAN := true;
  v_reason              TEXT    := NULL;
  v_allowed_channels    TEXT[];
  v_gate_evaluation_id  UUID;
  v_channel             TEXT    := COALESCE(NULLIF(p_channel, ''), 'system');
BEGIN
  -- Look up authority config for (workspace, capability).
  SELECT level, min_role
    INTO v_level, v_min_role
    FROM public.engine_authority_config
   WHERE workspace_id = p_workspace_id
     AND capability   = p_capability;

  -- Look up caller role (NULL-safe: system callers may omit actor).
  IF p_actor_profile_id IS NOT NULL THEN
    SELECT role::TEXT
      INTO v_caller_role
      FROM public.profile
     WHERE profile_id = p_actor_profile_id;
  END IF;

  -- Channel check against engine_process.allowed_channels (only when engine step).
  IF p_engine_process_id IS NOT NULL THEN
    SELECT allowed_channels
      INTO v_allowed_channels
      FROM public.engine_process
     WHERE id = p_engine_process_id;

    IF v_allowed_channels IS NOT NULL
       AND NOT (v_channel = ANY(v_allowed_channels)) THEN
      v_allow           := false;
      v_channel_allowed := false;
      v_reason          := 'channel_not_permitted';
    END IF;
  END IF;

  -- Authority level check (only if not already denied on channel).
  IF v_allow THEN
    IF v_level IS NULL THEN
      -- Default-allow when no authority row (preserves status quo).
      v_allow := true;
    ELSIF v_level = 'disabled' THEN
      v_allow  := false;
      v_reason := 'capability_disabled';
    ELSIF v_min_role IS NOT NULL
          AND v_caller_role IS NOT NULL
          AND public._role_rank(v_caller_role) < public._role_rank(v_min_role) THEN
      -- Role below floor: allow but force suggest (no autonomous/confirm execution).
      v_downgrade_to := 'suggest';
    END IF;
  END IF;

  -- Audit row (one per call).
  INSERT INTO public.gate_evaluation (
    workspace_id, capability, action_type, channel, actor_profile_id,
    engine_process_id, engine_state_id, allow, downgrade_to, min_role_required,
    channel_allowed, reason
  ) VALUES (
    p_workspace_id, p_capability, p_action_type, v_channel, p_actor_profile_id,
    p_engine_process_id, p_engine_state_id, v_allow, v_downgrade_to, v_min_role,
    v_channel_allowed, v_reason
  )
  RETURNING id INTO v_gate_evaluation_id;

  RETURN jsonb_build_object(
    'allow',               v_allow,
    'downgrade_to',        v_downgrade_to,
    'min_role_required',   v_min_role,
    'channel_allowed',     v_channel_allowed,
    'reason',              v_reason,
    'gate_evaluation_id',  v_gate_evaluation_id
  );
END;
$$;

COMMENT ON FUNCTION public.gate_action IS
  'ADR-0099: unified authority gate. Called by agent-router and engine-dispatch before any mutation.';

GRANT EXECUTE ON FUNCTION public.gate_action(
  UUID, TEXT, TEXT, UUID, TEXT, TEXT, UUID
) TO service_role, authenticated;

-- ──────────────────────────────────────────────
-- 5. Backfill originating_channel on in-flight engine_state rows
-- ──────────────────────────────────────────────
UPDATE public.engine_state
   SET context = jsonb_set(
     COALESCE(context, '{}'::jsonb),
     '{originating_channel}',
     '"system"'::jsonb,
     true
   )
 WHERE (context->>'originating_channel') IS NULL;
