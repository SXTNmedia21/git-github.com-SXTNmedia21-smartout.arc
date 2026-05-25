-- ============================================================
-- 20260626100000_bootstrap_capability_authority_seed_and_service_role.sql
--
-- Bootstrap capability fix-forward — ADR-0407 follow-up
--
-- Problem A (capability tool exposure):
--   `bootstrap` capability has no row in `engine_authority_config`. The
--   `gate_action` RPC returns `unseeded=true, downgrade_to=null`. The tool
--   selector then falls back to `read_only`, hiding the two `suggest`-tier
--   tools (`close_bootstrap_gate`, `skip_bootstrap_gate`) from the LLM.
--   Only `list_bootstrap_gates` (read_only tier) reaches the model.
--
--   Fix: register `bootstrap` in `capability_default_registry` (Part A —
--   auto-seeds new workspaces via the ADR-0192 trigger) and backfill
--   `engine_authority_config` for every existing workspace (Part B).
--
--   Level chosen: `suggest`. Rationale: highest tier present in the
--   capability is `suggest` (close + skip). `list_bootstrap_gates` is
--   read_only, still surfaced because `suggest` unlocks read_only too.
--   No `confirm`-tier tools — no need for `confirm` at capability level.
--
-- Problem B (RPC auth via service_role):
--   The three RPCs check `auth.uid()` / `is_admin_in_workspace(auth.uid(), …)`.
--   When stage-engine calls them via the service_role client (the
--   `direct_admin` toolAuthPattern per `packages/ai/src/capabilities/bootstrap/index.ts`),
--   `auth.uid()` is NULL → membership check fails → 'Forbidden'.
--
--   ADR-0151 design: workspace_id + profile_id are derived server-side by
--   stage-engine BEFORE the tool call; the RPC is invoked through a
--   service-role context. The RPC must trust that path.
--
--   Fix: short-circuit the membership / admin check when `auth.role() =
--   'service_role'`. For JWT callers (direct PostgREST), the existing check
--   still holds — defence-in-depth is preserved for the non-trusted path.
--
-- Idempotent. No data loss. Forward-only.
-- ============================================================

SET search_path TO public, extensions;

-- ─────────────────────────────────────────────────────────────────────
-- Part A — capability_default_registry: platform-wide default
-- ─────────────────────────────────────────────────────────────────────
-- Adding the row is sufficient to auto-seed all new workspaces (ADR-0192
-- trigger workspace_seed_authority_defaults_trg consumes this registry).

INSERT INTO public.capability_default_registry
  (capability, level, min_role, requires_four_eyes, observer_escalation_hours, notes)
VALUES
  (
    'bootstrap',
    'suggest',
    'admin',
    false,
    72,
    'ADR-0407 Phase 1. Workspace bootstrap gates: list (read_only), close+skip (suggest). '
    'Admin-only. suggest tier matches highest tool tier present. 2026-05-23.'
  )
ON CONFLICT (capability) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- Part B — engine_authority_config: backfill for all existing workspaces
-- ─────────────────────────────────────────────────────────────────────
-- COALESCE chain matches the onboarding-capability backfill pattern.

INSERT INTO public.engine_authority_config (
  workspace_id,
  capability,
  level,
  min_role,
  requires_four_eyes,
  observer_escalation_hours,
  updated_by
)
SELECT
  w.workspace_id,
  'bootstrap',
  'suggest',
  'admin',
  false,
  72,
  COALESCE(
    (
      SELECT cm.user_id
      FROM public.company_member cm
      WHERE cm.company_id = w.company_id
        AND cm.role IN ('owner', 'admin')
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      SELECT cm.user_id
      FROM public.company_member cm
      WHERE cm.company_id = w.company_id
      ORDER BY cm.created_at
      LIMIT 1
    ),
    (
      SELECT ui.user_id FROM public.user_identity ui ORDER BY ui.created_at LIMIT 1
    )
  )
FROM public.workspace w
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- Part C — RPC auth: trust service_role path (ADR-0151)
-- ─────────────────────────────────────────────────────────────────────
-- Stage-engine derives workspace_id + profile_id server-side per ADR-0151
-- and invokes RPCs via service_role. The auth.uid()-based check rejected
-- those calls because service_role has no JWT context. Short-circuit when
-- the call is on the trusted server path; preserve the check for direct
-- JWT callers.

CREATE OR REPLACE FUNCTION public.fn_list_open_bootstrap_gates(p_workspace_id uuid)
RETURNS SETOF workspace_bootstrap_gate
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Auth: service_role (stage-engine, ADR-0151) bypasses; JWT callers
  -- must be a member of the workspace.
  IF auth.role() <> 'service_role'
     AND NOT (p_workspace_id = ANY(SELECT get_workspace_ids_for_user(auth.uid()))) THEN
    RAISE EXCEPTION 'Forbidden: not a member of workspace %', p_workspace_id;
  END IF;

  -- Re-evaluate blocked status (depends_on may have closed)
  UPDATE workspace_bootstrap_gate g SET status = 'open'
   WHERE g.workspace_id = p_workspace_id
     AND g.status = 'blocked'
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements_text(g.depends_on) AS dep_slug
        WHERE NOT EXISTS (
          SELECT 1 FROM workspace_bootstrap_gate dep
           WHERE dep.workspace_id = p_workspace_id
             AND dep.gate_slug = dep_slug
             AND dep.status = 'closed'
        )
     );

  RETURN QUERY
  SELECT *
    FROM workspace_bootstrap_gate g
   WHERE g.workspace_id = p_workspace_id
     AND g.status IN ('open', 'in_progress', 'blocked')
   ORDER BY g.required DESC, g.suggested_day NULLS LAST, g.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_close_bootstrap_gate(
  p_workspace_id uuid,
  p_gate_slug text,
  p_via text,
  p_profile_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gate_id uuid;
BEGIN
  -- Auth: service_role (ADR-0151) bypasses; JWT callers must be admin.
  IF auth.role() <> 'service_role'
     AND NOT is_admin_in_workspace(auth.uid(), p_workspace_id) THEN
    RAISE EXCEPTION 'Forbidden: admin role required in workspace %', p_workspace_id;
  END IF;

  IF p_via NOT IN ('botsson', 'manual_wizard', 'auto', 'admin_skip') THEN
    RAISE EXCEPTION 'Invalid closed_via value: %. Must be botsson|manual_wizard|auto|admin_skip', p_via;
  END IF;

  UPDATE workspace_bootstrap_gate
     SET status = 'closed',
         closed_at = now(),
         closed_by = p_profile_id,
         closed_via = p_via,
         updated_at = now()
   WHERE workspace_id = p_workspace_id
     AND gate_slug = p_gate_slug
     AND status <> 'closed'
   RETURNING workspace_bootstrap_gate_id INTO v_gate_id;

  IF v_gate_id IS NULL THEN
    RAISE EXCEPTION 'Gate not found or already closed: %', p_gate_slug;
  END IF;

  RETURN v_gate_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_skip_bootstrap_gate(
  p_workspace_id uuid,
  p_gate_slug text,
  p_reason text,
  p_profile_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gate_id uuid;
  v_required boolean;
BEGIN
  -- Auth: service_role (ADR-0151) bypasses; JWT callers must be admin.
  IF auth.role() <> 'service_role'
     AND NOT is_admin_in_workspace(auth.uid(), p_workspace_id) THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'skip_reason is required — cannot skip a gate without a reason';
  END IF;

  SELECT required INTO v_required FROM workspace_bootstrap_gate
   WHERE workspace_id = p_workspace_id AND gate_slug = p_gate_slug;

  IF v_required IS NULL THEN
    RAISE EXCEPTION 'Gate not found: %', p_gate_slug;
  END IF;

  IF v_required THEN
    RAISE EXCEPTION 'Cannot skip required gate: %', p_gate_slug;
  END IF;

  UPDATE workspace_bootstrap_gate
     SET status = 'skipped',
         closed_at = now(),
         closed_by = p_profile_id,
         closed_via = 'admin_skip',
         skip_reason = p_reason,
         updated_at = now()
   WHERE workspace_id = p_workspace_id
     AND gate_slug = p_gate_slug
     AND status <> 'closed'
     AND status <> 'skipped'
   RETURNING workspace_bootstrap_gate_id INTO v_gate_id;

  IF v_gate_id IS NULL THEN
    RAISE EXCEPTION 'Gate not found or already closed: %', p_gate_slug;
  END IF;

  RETURN v_gate_id;
END;
$$;

COMMENT ON FUNCTION public.fn_list_open_bootstrap_gates(uuid) IS
  'ADR-0407 read RPC. Bypasses membership check when called via service_role '
  '(stage-engine, ADR-0151 server-side derivation). JWT callers still gated.';

COMMENT ON FUNCTION public.fn_close_bootstrap_gate(uuid, text, text, uuid) IS
  'ADR-0407 close RPC. Bypasses admin check when called via service_role '
  '(stage-engine, ADR-0151). JWT callers still gated. Per-call audit via '
  'p_profile_id (closed_by) + emit() in capability tool wrapper.';

COMMENT ON FUNCTION public.fn_skip_bootstrap_gate(uuid, text, text, uuid) IS
  'ADR-0407 skip RPC. Bypasses admin check when called via service_role '
  '(stage-engine, ADR-0151). JWT callers still gated. Required gates cannot '
  'be skipped regardless of caller.';
