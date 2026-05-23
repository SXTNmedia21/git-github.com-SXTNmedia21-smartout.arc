-- ============================================================
-- 20260625120000_workspace_bootstrap_gate.sql
-- Bootstrap Gate Schema — Phase 1
--
-- ADR: ADR-0407 (bootstrap-coordinator orchestrator + workspace_bootstrap_gate schema)
-- Author: 2026-05-23
--
-- Creates the `workspace_bootstrap_gate` table for tracking workspace
-- bootstrap completeness state. Each gate represents one business-level
-- readiness requirement sourced from the K1a industry-package
-- (hospitality: 11 gates, default: 6 gates).
--
-- Writes go ONLY through SECURITY DEFINER RPCs:
--   fn_list_open_bootstrap_gates(workspace_id)
--   fn_close_bootstrap_gate(workspace_id, gate_slug, via, profile_id)
--   fn_skip_bootstrap_gate(workspace_id, gate_slug, reason, profile_id)
--
-- RLS: jwt_read (workspace members) + api_key_read (API key scoped)
--      No direct INSERT/UPDATE/DELETE from client.
--
-- Dependencies (all strictly < 20260625120000):
--   workspace table:   20260302000000 (creation)
--   profile table:     20260302000001 (creation)
--   set_updated_at():  20260302000000 (function)
--   is_admin_in_workspace(): 20260302000000
--   get_workspace_ids_for_user(): 20260302000000
--   get_api_workspace_id(): 20260302000000
-- ============================================================

SET search_path TO public, extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Enum: bootstrap_gate_status
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TYPE bootstrap_gate_status AS ENUM (
  'open',          -- not yet addressed
  'in_progress',   -- admin started; partial
  'closed',        -- completed
  'skipped',       -- admin explicitly skipped (skip_reason required)
  'blocked'        -- depends_on dependency not yet closed
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Table: workspace_bootstrap_gate
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE workspace_bootstrap_gate (
  workspace_bootstrap_gate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  gate_slug text NOT NULL,                              -- e.g. 'department_exists'
  status bootstrap_gate_status NOT NULL DEFAULT 'open',
  industry_source text NOT NULL,                        -- 'hospitality' | 'default' | ...
  display_label_no text NOT NULL,                       -- Norwegian label
  display_label_en text NOT NULL,                       -- English label
  description text,                                     -- agent-readable rationale
  required boolean NOT NULL DEFAULT true,
  depends_on jsonb NOT NULL DEFAULT '[]'::jsonb,        -- array<gate_slug>
  capability_slug text,                                 -- which capability closes this
  suggested_day smallint,                               -- 1..7 (week-1 hint, nullable)
  closed_at timestamptz,
  closed_by uuid REFERENCES profile(profile_id),
  closed_via text,                                      -- 'botsson' | 'manual_wizard' | 'auto' | 'admin_skip'
  skip_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, gate_slug)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_workspace_bootstrap_gate_workspace_status
  ON workspace_bootstrap_gate(workspace_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. updated_at trigger
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TRIGGER set_workspace_bootstrap_gate_updated_at
  BEFORE UPDATE ON workspace_bootstrap_gate
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS — dual-auth (JWT + API key, no direct writes)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE workspace_bootstrap_gate ENABLE ROW LEVEL SECURITY;

-- JWT READ: workspace members
CREATE POLICY "jwt_read_workspace_bootstrap_gate" ON workspace_bootstrap_gate
  FOR SELECT TO authenticated USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

-- API key READ: workspace-scoped
CREATE POLICY "api_key_read_workspace_bootstrap_gate" ON workspace_bootstrap_gate
  FOR SELECT TO anon USING (
    workspace_id = get_api_workspace_id()
  );

-- NO direct INSERT/UPDATE/DELETE — all writes go through SECURITY DEFINER RPCs below
-- (admin role enforced inside RPC body per ADR-0204)

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RPC: fn_list_open_bootstrap_gates
--    READ — returns gates where status IN ('open', 'in_progress', 'blocked')
--    Re-evaluates blocked status by checking depends_on against closed gates.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION fn_list_open_bootstrap_gates(p_workspace_id uuid)
RETURNS SETOF workspace_bootstrap_gate
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Auth: caller must be member of workspace
  IF NOT (p_workspace_id = ANY(SELECT get_workspace_ids_for_user(auth.uid()))) THEN
    RAISE EXCEPTION 'Forbidden: not a member of workspace %', p_workspace_id;
  END IF;

  -- Re-evaluate blocked status before returning (depends_on may have closed)
  -- A gate transitions from blocked → open when ALL its depends_on gates are closed.
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RPC: fn_close_bootstrap_gate
--    WRITE — mark a gate closed. Admin role required. closed_by = p_profile_id.
--    closed_via MUST be one of ('botsson', 'manual_wizard', 'auto', 'admin_skip').
-- ─────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION fn_close_bootstrap_gate(
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
  -- Auth: caller must be admin in workspace (ADR-0151 — profile_id supplied by server)
  IF NOT is_admin_in_workspace(auth.uid(), p_workspace_id) THEN
    RAISE EXCEPTION 'Forbidden: admin role required in workspace %', p_workspace_id;
  END IF;

  -- Validate closed_via enum value
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RPC: fn_skip_bootstrap_gate
--    WRITE — mark a gate skipped with mandatory reason.
--    Admin role required. Required gates CANNOT be skipped (data integrity).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION fn_skip_bootstrap_gate(
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
  -- Auth: caller must be admin in workspace
  IF NOT is_admin_in_workspace(auth.uid(), p_workspace_id) THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  -- Validate non-empty reason
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'skip_reason is required — cannot skip a gate without a reason';
  END IF;

  -- Read the gate to check required flag
  SELECT required INTO v_required FROM workspace_bootstrap_gate
   WHERE workspace_id = p_workspace_id AND gate_slug = p_gate_slug;

  IF v_required IS NULL THEN
    RAISE EXCEPTION 'Gate not found: %', p_gate_slug;
  END IF;

  -- Required gates cannot be skipped (enforced at data layer, not just application)
  IF v_required THEN
    RAISE EXCEPTION 'Required gate cannot be skipped: %', p_gate_slug;
  END IF;

  UPDATE workspace_bootstrap_gate
     SET status = 'skipped',
         skip_reason = p_reason,
         closed_at = now(),
         closed_by = p_profile_id,
         closed_via = 'admin_skip',
         updated_at = now()
   WHERE workspace_id = p_workspace_id AND gate_slug = p_gate_slug
   RETURNING workspace_bootstrap_gate_id INTO v_gate_id;

  RETURN v_gate_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTE on engine_authority_config
-- workspace_bootstrap_gate capability slugs (list_bootstrap_gates, close_bootstrap_gate,
-- skip_bootstrap_gate) are seeded per-workspace by bootstrap-cascade EF Step 10, NOT
-- here. engine_authority_config has workspace_id NOT NULL (FK to workspace) — there
-- are no platform-level rows. All three bootstrap slugs were added to the Step 10
-- capabilities array in bootstrap-cascade/index.ts (ADR-0407).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (manual, for reference)
-- DROP FUNCTION IF EXISTS fn_skip_bootstrap_gate(uuid, text, text, uuid);
-- DROP FUNCTION IF EXISTS fn_close_bootstrap_gate(uuid, text, text, uuid);
-- DROP FUNCTION IF EXISTS fn_list_open_bootstrap_gates(uuid);
-- DROP TABLE IF EXISTS workspace_bootstrap_gate;
-- DROP TYPE IF EXISTS bootstrap_gate_status;
-- ─────────────────────────────────────────────────────────────────────────────
