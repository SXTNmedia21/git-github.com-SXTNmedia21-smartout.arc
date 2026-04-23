-- ADR-0189 runtime warning — surface default-allow branch hits in activity_trail
-- Council 2 verdict 2026-04-22
-- Makes any CI-gate escape visible in production (reconciliation.override was
-- the canonical example before Phase 0b seed landed).
--
-- ============================================
-- 20260516130000_gate_action_unseeded_warning.sql
--
-- Amends public.gate_action so that every invocation that hits the
-- DEFAULT-ALLOW branch — i.e. no engine_authority_config row exists for
-- (workspace_id, capability) — emits a warning row into public.activity_trail
-- BEFORE returning allow=true.
--
-- Canonical source of the function body is 20260509100000_gate_action_four_eyes_history.sql
-- (9-arg signature, ADR-0099 + ADR-0101). We CREATE OR REPLACE with that
-- exact 9-arg signature so no new overload is introduced. The only behavioral
-- change is:
--   1. Capture whether a config row was found (v_config_found).
--   2. On the default-allow branch, INSERT a warning into activity_trail
--      (wrapped in an exception-swallow block so a broken trail insert can
--      NEVER break the authority decision).
--   3. Add `unseeded` boolean to the returned jsonb so callers can surface
--      a dashboard warning without re-scanning activity_trail.
--
-- This is the runtime compensating control for ADR-0189:
--   * CI (scripts/authority-seed-parity.ts) catches drift on every PR.
--   * If a drift slips past CI (dynamic capability, hotfix, manual merge)
--     it surfaces in activity_trail as event='gate.unseeded_capability_invoked'
--     and can be picked up by admin dashboards / alerting.
--
-- Column mapping (verified against packages/supabase/src/database.types.ts):
--   activity_trail NOT NULLs: workspace_id, actor_id, category, entity_id,
--                             entity_type, event, action_verb, ip_address.
--   Task spec used the older 2025 schema shape (actor_profile_id,
--   event_type, source_type, source_id). We map to the current canonical
--   columns and fill NOT NULL placeholders where the gate doesn't carry
--   a value:
--     workspace_id   ← p_workspace_id
--     actor_id       ← p_actor_profile_id (falls back to a system profile
--                      on the same workspace if the caller is system-initiated;
--                      if no system profile exists we SKIP the trail row
--                      entirely — the FK to profile must be honored)
--     category       ← 'authority'
--     entity_id      ← p_workspace_id (entity on which the gate decision
--                      was made — workspace is the closest concrete subject)
--     entity_type    ← 'engine_authority_config'
--     event          ← 'gate.unseeded_capability_invoked'
--     action_verb    ← 'warn'
--     ip_address     ← '0.0.0.0'::inet (gate runs server-side; no request IP)
--     data           ← {capability, severity:'warning', channel, action_type,
--                       engine_process_id, engine_state_id}
--     source         ← 'gate_action'
--
-- Idempotency: CREATE OR REPLACE FUNCTION. Re-running this migration is safe
-- and has no destructive effect. The signature exactly matches the function
-- from 20260509100000, so the CREATE OR REPLACE updates in-place.
-- ============================================

SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION public.gate_action(
  p_workspace_id       UUID,
  p_capability         TEXT,
  p_channel            TEXT,
  p_actor_profile_id   UUID,
  p_action_type        TEXT,
  p_engine_process_id  TEXT DEFAULT NULL,
  p_engine_state_id    UUID DEFAULT NULL,
  p_approvers_present  UUID[] DEFAULT ARRAY[]::UUID[],
  p_entity_id          UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_level                 TEXT;
  v_min_role              TEXT;
  v_requires_four_eyes    BOOLEAN := false;
  v_caller_role           TEXT;
  v_allow                 BOOLEAN := true;
  v_downgrade_to          TEXT    := NULL;
  v_channel_allowed       BOOLEAN := true;
  v_reason                TEXT    := NULL;
  v_allowed_channels      TEXT[];
  v_gate_evaluation_id    UUID;
  v_channel               TEXT    := COALESCE(NULLIF(p_channel, ''), 'system');
  v_four_eyes_required    BOOLEAN := false;
  v_approvers_needed      INTEGER := 0;
  v_prior_distinct_actor  BOOLEAN := false;
  v_config_found          BOOLEAN := false;
  v_actor_for_trail       UUID;
BEGIN
  -- Look up authority config for (workspace, capability).
  SELECT level, min_role, requires_four_eyes
    INTO v_level, v_min_role, v_requires_four_eyes
    FROM public.engine_authority_config
   WHERE workspace_id = p_workspace_id
     AND capability   = p_capability;

  v_config_found := FOUND;

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
      -- Default-allow when no authority row (preserves status quo from ADR-0099).
      --
      -- ADR-0189 runtime warning: emit an activity_trail row so that a CI
      -- escape becomes observable in production. The CI gate
      -- (scripts/authority-seed-parity.ts) is the primary control; this
      -- trail row is the compensating control.
      --
      -- Wrapped in a sub-block with EXCEPTION WHEN OTHERS to guarantee the
      -- gate itself never fails on an audit-log insertion error (a broken
      -- activity_trail must never break authority decisions).
      BEGIN
        v_actor_for_trail := p_actor_profile_id;
        IF v_actor_for_trail IS NULL THEN
          -- Fall back to a system profile on the same workspace. If none
          -- exists we skip the trail row rather than insert a fabricated
          -- one — activity_trail.actor_id is NOT NULL and FK-constrained.
          SELECT profile_id
            INTO v_actor_for_trail
            FROM public.profile
           WHERE workspace_id = p_workspace_id
             AND role::TEXT = 'system'
           ORDER BY created_at ASC
           LIMIT 1;
        END IF;

        IF v_actor_for_trail IS NOT NULL THEN
          INSERT INTO public.activity_trail (
            workspace_id,
            actor_id,
            category,
            entity_id,
            entity_type,
            event,
            action_verb,
            ip_address,
            data,
            source
          ) VALUES (
            p_workspace_id,
            v_actor_for_trail,
            'authority',
            p_workspace_id,
            'engine_authority_config',
            'gate.unseeded_capability_invoked',
            'warn',
            '0.0.0.0'::inet,
            jsonb_build_object(
              'capability',        p_capability,
              'severity',          'warning',
              'channel',           v_channel,
              'action_type',       p_action_type,
              'engine_process_id', p_engine_process_id,
              'engine_state_id',   p_engine_state_id
            ),
            'gate_action'
          );
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Defensive: never let a trail insert break the gate.
        NULL;
      END;

      v_allow := true;
    ELSIF v_level = 'disabled' THEN
      v_allow  := false;
      v_reason := 'capability_disabled';
    ELSIF v_min_role IS NOT NULL
          AND v_caller_role IS NOT NULL
          AND public._role_rank(v_caller_role) < public._role_rank(v_min_role) THEN
      v_downgrade_to := 'suggest';
      IF v_reason IS NULL THEN
        v_reason := 'role_below_min';
      END IF;
    END IF;
  END IF;

  -- Four-eyes check (history-based, per ADR-0101). Only evaluated when the
  -- gate would otherwise allow. Requires p_entity_id to be scoped; without
  -- it the request is denied (fail-closed) to prevent accidental bypass.
  IF v_allow AND COALESCE(v_requires_four_eyes, false) THEN
    v_approvers_needed := 2;

    IF p_entity_id IS NULL THEN
      v_allow              := false;
      v_four_eyes_required := true;
      v_reason             := 'four_eyes_required';
    ELSE
      -- Does a prior evaluation by a DIFFERENT actor exist for this entity?
      SELECT EXISTS (
        SELECT 1
          FROM public.gate_evaluation
         WHERE workspace_id   = p_workspace_id
           AND capability     = p_capability
           AND entity_id      = p_entity_id
           AND actor_profile_id IS NOT NULL
           AND actor_profile_id <> p_actor_profile_id
      )
      INTO v_prior_distinct_actor;

      IF NOT v_prior_distinct_actor THEN
        v_allow              := false;
        v_four_eyes_required := true;
        v_reason             := 'four_eyes_required';
      END IF;
      -- else: allow stays true — this is the second eye.
    END IF;
  END IF;

  -- Audit row (one per call). entity_id recorded so future calls can see it.
  INSERT INTO public.gate_evaluation (
    workspace_id, capability, action_type, channel, actor_profile_id,
    engine_process_id, engine_state_id, allow, downgrade_to, min_role_required,
    channel_allowed, reason, entity_id
  ) VALUES (
    p_workspace_id, p_capability, p_action_type, v_channel, p_actor_profile_id,
    p_engine_process_id, p_engine_state_id, v_allow, v_downgrade_to, v_min_role,
    v_channel_allowed, v_reason, p_entity_id
  )
  RETURNING id INTO v_gate_evaluation_id;

  RETURN jsonb_build_object(
    'allow',                v_allow,
    'downgrade_to',         v_downgrade_to,
    'min_role_required',    v_min_role,
    'channel_allowed',      v_channel_allowed,
    'reason',               v_reason,
    'gate_evaluation_id',   v_gate_evaluation_id,
    'four_eyes_required',   v_four_eyes_required,
    'approvers_needed',     v_approvers_needed,
    'approvers_present',    COALESCE(p_approvers_present, ARRAY[]::UUID[]),
    'entity_id',            p_entity_id,
    'unseeded',             NOT v_config_found
  );
END;
$$;

COMMENT ON FUNCTION public.gate_action IS
  'Unified authority gate across agent-router and engine-dispatch '
  '(ADR-0099 + ADR-0101 + ADR-0189). Four-eyes is history-based: queries '
  'gate_evaluation for a prior distinct actor on '
  '(workspace_id, capability, entity_id). When no engine_authority_config '
  'row exists for (workspace, capability) the RPC still default-allows '
  '(status quo from ADR-0099), but emits an activity_trail row with '
  'event=gate.unseeded_capability_invoked. The return jsonb includes an '
  '`unseeded` boolean so callers can surface a warning to dashboards '
  'without rescanning activity_trail.';

GRANT EXECUTE ON FUNCTION public.gate_action(
  UUID, TEXT, TEXT, UUID, TEXT, TEXT, UUID, UUID[], UUID
) TO authenticated, service_role;
