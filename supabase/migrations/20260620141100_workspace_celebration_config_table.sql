-- 20260620141100_workspace_celebration_config_table.sql
--
-- WHY: Per-workspace opt-out for birthday auto-publish pipe (ADR-0372 Q5).
--   1 row per workspace. admin can disable auto-celebration or redirect to a
--   different target channel. Pattern mirrors tips_workspace_settings.
--
-- Auto-created via AFTER INSERT trigger on workspace so new workspaces are
-- immediately enrolled (auto_celebrate_birthdays=true, target_channel_id=first news channel).
-- NULL-safe: target_channel_id left NULL if no news channel exists at trigger time.
--
-- Admin can reassign target_channel_id; FK + workspace-match trigger enforces coherence.
--
-- ADR-0372 (bursdag auto-publish pipe), Q5 + Q6.

-- ── 1. workspace_celebration_config table ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workspace_celebration_config (
  workspace_id              uuid        PRIMARY KEY
                                        REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  auto_celebrate_birthdays  boolean     NOT NULL DEFAULT true,
  target_channel_id         uuid        REFERENCES public.channel(id) ON DELETE SET NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workspace_celebration_config IS
  'Per-workspace configuration for the birthday auto-publish pipe (ADR-0372). '
  'auto_celebrate_birthdays=false disables the entire pipe for this workspace. '
  'target_channel_id is the channel where birthday announcements are posted; defaults to '
  'the first news channel at workspace creation. Admin can reassign. Pattern mirrors '
  'tips_workspace_settings.';

COMMENT ON COLUMN public.workspace_celebration_config.target_channel_id IS
  'The channel where birthday announcements are posted. NULL means "no channel configured yet" '
  '— the Edge Function skips workspaces with NULL target_channel_id rather than silently '
  'posting to an arbitrary channel (L-0177 fail-fast). Admin must configure if left NULL.';

-- ── 2. updated_at trigger ────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'set_updated_at'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    EXECUTE $q$
      CREATE TRIGGER set_workspace_celebration_config_updated_at
        BEFORE UPDATE ON public.workspace_celebration_config
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    $q$;
  END IF;
END $$;

-- ── 3. FK coherence: target_channel must belong to same workspace ────────────

CREATE OR REPLACE FUNCTION public.fn_check_celebration_channel_workspace()
RETURNS trigger
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  -- NULL target_channel_id is allowed (no channel configured yet).
  IF NEW.target_channel_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.channel
    WHERE id = NEW.target_channel_id
      AND workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'CELEBRATION_CHANNEL_MISMATCH: channel % does not belong to workspace %',
      NEW.target_channel_id, NEW.workspace_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_celebration_channel_workspace
  BEFORE INSERT OR UPDATE OF target_channel_id ON public.workspace_celebration_config
  FOR EACH ROW EXECUTE FUNCTION public.fn_check_celebration_channel_workspace();

-- ── 4. Auto-bootstrap trigger on new workspace ───────────────────────────────
--
-- Fires AFTER INSERT on workspace. Inserts config row with target_channel_id
-- set to the workspace's first news channel (LIMIT 1 ORDER BY created_at).
-- NULL-safe: leaves target_channel_id NULL if no news channel exists yet.

CREATE OR REPLACE FUNCTION public.fn_bootstrap_workspace_celebration_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_news_channel_id uuid;
BEGIN
  -- Find first news channel for this workspace (may not exist yet at workspace creation).
  SELECT id INTO v_news_channel_id
  FROM public.channel
  WHERE workspace_id = NEW.workspace_id
    AND channel_type = 'news'
  ORDER BY created_at
  LIMIT 1;

  -- Insert config row. ON CONFLICT DO NOTHING is idempotent if workspace is backfilled.
  INSERT INTO public.workspace_celebration_config (workspace_id, target_channel_id)
  VALUES (NEW.workspace_id, v_news_channel_id)
  ON CONFLICT (workspace_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bootstrap_workspace_celebration_config
  AFTER INSERT ON public.workspace
  FOR EACH ROW EXECUTE FUNCTION public.fn_bootstrap_workspace_celebration_config();

-- ── 5. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.workspace_celebration_config ENABLE ROW LEVEL SECURITY;

-- Authenticated members can read their workspace config (channel routing is not sensitive).
CREATE POLICY "wcc_jwt_select" ON public.workspace_celebration_config
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.workspace_id = workspace_celebration_config.workspace_id
        AND p.status IN ('active', 'trainee')
    )
  );

-- Admin+ can update their workspace config.
CREATE POLICY "wcc_jwt_update" ON public.workspace_celebration_config
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.workspace_id = workspace_celebration_config.workspace_id
        AND p.role IN ('admin', 'owner')
        AND p.status IN ('active', 'trainee')
    )
  );

-- API key read (dual-auth convention).
CREATE POLICY "wcc_api_select" ON public.workspace_celebration_config
  FOR SELECT
  USING (workspace_id = public.get_api_workspace_id());

-- No INSERT policy: auto-created via trigger + backfill migration.
-- No DELETE policy: workspace CASCADE removes automatically.
