-- ============================================
-- 20260616110000_timeline_template.sql
--
-- What:  Introduces the `timeline_template` table — a workspace-scoped
--        companion to D6 Production. Stores named, scope-filtered authoring
--        canvases that managers can save from TimelineTab and apply to any
--        future date.
--
-- Why:   Enables the Timeline Templates feature (spec: docs/superpowers/specs/
--        2026-05-16-timeline-templates-design.md). No cross-cascade-role
--        dependency — template is a workspace-level snapshot of D6 authoring
--        intent. D6 rows are instantiated on apply (T2 capability tools).
--
-- Cascade dimension: workspace-scoped companion (no cascade-role). D6 rows
--   (session_hook, session_task, session_note, deviation, schedule_shift) are
--   written at apply time, not stored here.
--
-- Polymorphic scope_id: no FK enforced at DB layer (scope_type = team |
--   department | location | shift). T2 validates app-side per scope_type.
--   A future heartbeat sortie will mark orphaned templates is_archived=true
--   when scope entity disappears.
--
-- Soft-delete: hard DELETE is intentionally policy-less. Archive via
--   UPDATE SET is_archived = true (T2 archive_template tool).
--
-- ADR ref: ADR-0335 (Timeline Templates — D6 authoring + filter+save+apply)
-- ============================================

CREATE TABLE IF NOT EXISTS public.timeline_template (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID          NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  name            TEXT          NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  scope_type      TEXT          NOT NULL CHECK (scope_type IN ('team', 'department', 'location', 'shift')),
  scope_id        UUID          NOT NULL,
  items_json      JSONB         NOT NULL,
  notes           TEXT,
  created_by      UUID          NOT NULL REFERENCES public.profile(profile_id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  is_archived     BOOLEAN       NOT NULL DEFAULT false
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- Primary access pattern: list active templates within a workspace for a given scope
CREATE INDEX IF NOT EXISTS idx_timeline_template_workspace_scope
  ON public.timeline_template (workspace_id, scope_type, scope_id)
  WHERE NOT is_archived;

-- Secondary access pattern: list all active templates in a workspace (dropdown)
CREATE INDEX IF NOT EXISTS idx_timeline_template_workspace_active
  ON public.timeline_template (workspace_id)
  WHERE NOT is_archived;

-- Prevent duplicate template names within the same scope (case-insensitive).
-- Partial index excludes archived rows so an archived name can be reused.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_timeline_template_name_per_scope
  ON public.timeline_template (workspace_id, scope_type, scope_id, lower(name))
  WHERE NOT is_archived;

-- ── updated_at trigger ────────────────────────────────────────────────────────

-- Uses the shared public.set_updated_at() trigger function defined in
-- 00001_identity_tables.sql. No new helper function needed.
CREATE TRIGGER set_timeline_template_updated_at
  BEFORE UPDATE ON public.timeline_template
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Row-Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.timeline_template ENABLE ROW LEVEL SECURITY;

-- jwt SELECT — any workspace member may read templates in their workspace
CREATE POLICY jwt_select_timeline_template ON public.timeline_template
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
  );

-- jwt INSERT — manager/admin/owner only (is_admin_in_workspace covers admin+owner).
-- WITH CHECK enforces:
--   1. caller belongs to the target workspace
--   2. caller holds admin or owner role in that workspace
--   3. created_by must equal the authenticated user's UID (no impersonation)
-- Note: is_admin_in_workspace(uid, wid) checks role IN ('admin','owner').
-- The spec names manager/admin/owner but uses is_admin_in_workspace — matching
-- spec verbatim. If manager-level access is needed in future, a separate migration
-- expands the role gate.
CREATE POLICY jwt_insert_timeline_template ON public.timeline_template
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
    AND created_by = auth.uid()
  );

-- jwt UPDATE — creator OR workspace admin/owner may update (used for archive flag).
-- USING: row is visible to the caller (they belong to workspace AND are creator or admin).
-- WITH CHECK: post-update workspace_id stays within caller's workspaces (blocks flip).
CREATE POLICY jwt_update_timeline_template ON public.timeline_template
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND (
      created_by = auth.uid()
      OR public.is_admin_in_workspace(auth.uid(), workspace_id)
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
  );

-- No DELETE policy. Soft-delete only via UPDATE SET is_archived = true.
-- Service role bypass is implicit (service_role bypasses all RLS by default in Supabase).

COMMENT ON TABLE public.timeline_template IS
  'Workspace-scoped TimelineTab authoring canvas snapshots. '
  'Managers save a scope-filtered view of D6 items as a named template; '
  'apply materialises real D6 rows (schedule_shift, session_hook, session_task, '
  'session_note, deviation) in a single transaction for a target date. '
  'Soft-delete only via is_archived. ADR-0335.';
