-- Migration: channel access scope model
-- Replaces the implicit binary Åpen/Privat model with an explicit 4-scope enum.
--
-- Scopes:
--   workspace    → auto-populate channel_member for all workspace profiles (resolved at runtime)
--   departments  → channel_department_access rows determine which members see the channel
--   teams        → channel_team_access rows determine which members see the channel
--   invite_only  → manual channel_member rows only (today's "private" behaviour)
--
-- NOTE: This migration has NOT been applied. Review the RLS policy TODO comments
-- below before applying. The `access_scope` column defaults to 'workspace' so
-- existing channels are unaffected until explicitly updated.
--
-- Depends on: supabase/migrations/20260519190000_channel_settings_columns.sql

-- ── Enum ─────────────────────────────────────────────────────────────────────

CREATE TYPE channel_access_scope AS ENUM ('workspace', 'departments', 'teams', 'invite_only');

-- ── Add column to channel ─────────────────────────────────────────────────────

ALTER TABLE public.channel
  ADD COLUMN IF NOT EXISTS access_scope channel_access_scope NOT NULL DEFAULT 'workspace';

COMMENT ON COLUMN public.channel.access_scope IS
  'Visibility scope. workspace=auto-all-members, departments=resolved via channel_department_access, '
  'teams=resolved via channel_team_access, invite_only=manual channel_member rows.';

-- ── Department access mapping ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.channel_department_access (
  channel_id    UUID        NOT NULL REFERENCES public.channel(id) ON DELETE CASCADE,
  department_id UUID        NOT NULL REFERENCES public.department(department_id) ON DELETE CASCADE,
  workspace_id  UUID        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_department_access_workspace
  ON public.channel_department_access(workspace_id, channel_id);

COMMENT ON TABLE public.channel_department_access IS
  'Links channels with access_scope=departments to specific departments. '
  'All profiles in any listed department automatically see the channel.';

-- ── Team access mapping ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.channel_team_access (
  channel_id   UUID        NOT NULL REFERENCES public.channel(id) ON DELETE CASCADE,
  team_id      UUID        NOT NULL REFERENCES public.team(team_id) ON DELETE CASCADE,
  workspace_id UUID        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_team_access_workspace
  ON public.channel_team_access(workspace_id, channel_id);

COMMENT ON TABLE public.channel_team_access IS
  'Links channels with access_scope=teams to specific teams. '
  'All members of any listed team automatically see the channel.';

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.channel_department_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_team_access ENABLE ROW LEVEL SECURITY;

-- TODO: Design the scope-resolution function before applying these policies.
-- Two approaches to evaluate:
--   A. Resolve at query time: policy uses get_workspace_ids_for_user() + JOIN dept/team
--   B. Materialise: a trigger denormalises resolved profile_ids into channel_member
--      on INSERT/DELETE of channel_department_access / channel_team_access rows.
-- Approach B is safer for large workspaces (no N+1 at policy evaluation).
-- For now, policies are intentionally incomplete — add them after the design pass.

-- Placeholder: admins can read/write; regular members cannot read directly
-- (channel visibility is derived from channel_member rows, not these tables).
-- POLICY PLACEHOLDER — do not apply without completing design:
-- CREATE POLICY "admin_manage_dept_access" ON public.channel_department_access
--   FOR ALL USING (is_admin_in_workspace(workspace_id)) WITH CHECK (is_admin_in_workspace(workspace_id));
-- CREATE POLICY "admin_manage_team_access" ON public.channel_team_access
--   FOR ALL USING (is_admin_in_workspace(workspace_id)) WITH CHECK (is_admin_in_workspace(workspace_id));
