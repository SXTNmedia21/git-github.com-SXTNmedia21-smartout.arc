-- =============================================================================
-- 20260519100000_profile_botsson_channel_bootstrap.sql
-- C1.d — Botsson channel bootstrap + profile.botsson_channel_id
--
-- Closes the Jarvis demo blocker identified in HANDOFF-c1b-botsson-voice-session.md §S1.
-- `useBotssonVoiceSession` short-circuits on MISSING_IDS until this migration lands.
--
-- What this migration does (in order):
--   1. Add `comm_channel_type` enum value 'ai' (idempotent ADD VALUE IF NOT EXISTS)
--   2. Add `profile.botsson_channel_id uuid NULL` FK → channel(id) ON DELETE SET NULL
--   3. Create workspace-bootstrap function `bootstrap_botsson_channel(p_workspace_id)`
--      - Inserts 1 channel row (type='ai', name='Botsson') per workspace (idempotent)
--      - Inserts 1 channel_ai_policy row (voice_participation='interactive',
--        helpdesk_enabled=false) per channel (idempotent)
--   4. Backfill all existing workspaces (call bootstrap fn for each)
--   5. Backfill profile.botsson_channel_id → workspace's Botsson channel (where NULL)
--   6. Trigger: auto-bootstrap Botsson channel on new workspace INSERT
--   7. Falsifiable SQL self-test assertions (fail fast)
-- =============================================================================

SET search_path TO public, extensions;

-- ── 1. Enum extension ─────────────────────────────────────────────────────────
-- 'ai' is the canonical type for the workspace-wide Botsson voice channel.
-- Separate migration so this commit can work before the type is usable in DDL
-- (Postgres requires ALTER TYPE ADD VALUE to commit before referencing the new
-- value in DEFAULT expressions or CHECK constraints in the same transaction).
-- We use a DO $$ block to make it transactionally safe with the rest.

-- enum value 'ai' added in 20260519095959_botsson_channel_enum_value.sql

-- Commit the enum extension so subsequent DDL can reference it.
-- (This is safe inside a migration file that runs as its own transaction.)


-- ── 2. profile.botsson_channel_id column ─────────────────────────────────────

ALTER TABLE public.profile
  ADD COLUMN IF NOT EXISTS botsson_channel_id uuid
    REFERENCES public.channel(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profile.botsson_channel_id IS
  'FK to the workspace-wide Botsson AI voice channel. NULL until the workspace is bootstrapped '
  '(migration 20260519100000). Used by useBotssonVoiceSession (C1.b) to derive the LiveKit room '
  'name without an extra DB round-trip at call time. ON DELETE SET NULL is correct: if the '
  'channel is archived or deleted the profile loses voice access gracefully.';

CREATE INDEX IF NOT EXISTS idx_profile_botsson_channel_id
  ON public.profile(botsson_channel_id)
  WHERE botsson_channel_id IS NOT NULL;


-- ── 3. Bootstrap function ─────────────────────────────────────────────────────
-- Called once per workspace: creates the singleton Botsson channel + AI policy.
-- Idempotent: uses ON CONFLICT DO NOTHING + WHERE NOT EXISTS guards.
-- Returns the channel id so callers can chain further inserts.

CREATE OR REPLACE FUNCTION public.bootstrap_botsson_channel(
  p_workspace_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel_id uuid;
BEGIN
  -- Guard: only one non-archived 'ai' channel per workspace (singleton constraint).
  -- We use a unique partial index (added below) but also guard here for clarity.
  SELECT id INTO v_channel_id
  FROM public.channel
  WHERE workspace_id = p_workspace_id
    AND channel_type = 'ai'
    AND is_archived = false
  LIMIT 1;

  IF v_channel_id IS NULL THEN
    INSERT INTO public.channel (
      workspace_id,
      channel_type,
      name,
      description,
      ai_voice_policy,
      audio_policy,
      is_read_only
    )
    VALUES (
      p_workspace_id,
      'ai',
      'Botsson',
      'Workspace-wide Botsson AI voice channel (C1.d, ADR-0135)',
      'interactive',   -- ai_voice_policy: Botsson can speak
      'open_mic',      -- audio_policy: LiveKit open_mic (matches default since 20260515100800)
      false
    )
    RETURNING id INTO v_channel_id;
  END IF;

  -- Ensure channel_ai_policy row exists (UNIQUE(channel_id) enforced by table DDL)
  INSERT INTO public.channel_ai_policy (
    channel_id,
    workspace_id,
    voice_participation,
    text_participation
  )
  VALUES (
    v_channel_id,
    p_workspace_id,
    'interactive',   -- Botsson participates in voice
    'proactive'      -- Botsson can respond to text too (future-proof)
  )
  ON CONFLICT (channel_id) DO NOTHING;

  RETURN v_channel_id;
END;
$$;

COMMENT ON FUNCTION public.bootstrap_botsson_channel(uuid) IS
  'Idempotent: creates the workspace Botsson AI channel + channel_ai_policy if they do not '
  'exist. Called by migration seed (below) and the workspace-INSERT trigger. Returns the '
  'channel id so callers can backfill profile.botsson_channel_id.';


-- ── Partial unique index: one non-archived 'ai' channel per workspace ─────────
-- Prevents duplicate Botsson channels per workspace (bootstrap fn + direct inserts).

CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_one_ai_per_workspace
  ON public.channel(workspace_id)
  WHERE channel_type = 'ai' AND is_archived = false;


-- ── 4. Backfill existing workspaces ──────────────────────────────────────────

DO $$
DECLARE
  ws RECORD;
  v_channel_id uuid;
BEGIN
  FOR ws IN
    SELECT workspace_id FROM public.workspace
  LOOP
    v_channel_id := public.bootstrap_botsson_channel(ws.workspace_id);
    RAISE NOTICE 'Bootstrapped Botsson channel % for workspace %', v_channel_id, ws.workspace_id;
  END LOOP;
END $$;


-- ── 5. Backfill profile.botsson_channel_id ───────────────────────────────────
-- For every profile that does not yet have a botsson_channel_id, wire it to
-- the workspace's Botsson channel.

UPDATE public.profile p
SET botsson_channel_id = c.id
FROM public.channel c
WHERE c.workspace_id = p.workspace_id
  AND c.channel_type = 'ai'
  AND c.is_archived = false
  AND p.botsson_channel_id IS NULL;


-- ── 6. Auto-bootstrap trigger on new workspace ───────────────────────────────
-- New workspaces created after this migration also get a Botsson channel.
-- Profile backfill for new profiles happens via the step-5 pattern in
-- workspace-bootstrap Server Actions (future — channel id available from
-- the bootstrap fn return value).

CREATE OR REPLACE FUNCTION public.auto_bootstrap_botsson_channel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.bootstrap_botsson_channel(NEW.workspace_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_botsson_channel_on_workspace ON public.workspace;

CREATE TRIGGER trg_botsson_channel_on_workspace
  AFTER INSERT ON public.workspace
  FOR EACH ROW EXECUTE FUNCTION public.auto_bootstrap_botsson_channel();

COMMENT ON TRIGGER trg_botsson_channel_on_workspace ON public.workspace IS
  'Auto-creates the Botsson AI voice channel + channel_ai_policy for every new workspace. '
  'Mirrors the department/team auto-create pattern (20260422300400). C1.d (ADR-0135).';


-- ── 7. Falsifiable self-test assertions (fail-fast) ──────────────────────────

DO $$
DECLARE
  v_workspaces_without_botsson int;
  v_profiles_without_channel   int;
  v_policies_missing           int;
  v_policies_wrong_voice       int;
BEGIN
  -- Assertion 3: every workspace has exactly one non-archived Botsson channel
  SELECT count(*) INTO v_workspaces_without_botsson
  FROM public.workspace w
  WHERE NOT EXISTS (
    SELECT 1 FROM public.channel c
    WHERE c.workspace_id = w.workspace_id
      AND c.channel_type = 'ai'
      AND c.is_archived = false
  );

  IF v_workspaces_without_botsson > 0 THEN
    RAISE EXCEPTION
      'Self-test FAIL (A3): % workspace(s) have no Botsson channel after bootstrap.',
      v_workspaces_without_botsson;
  END IF;

  -- Assertion 4: every non-system profile has botsson_channel_id set
  -- (system profiles like Mr. Botsson himself are excluded — they have role='system')
  SELECT count(*) INTO v_profiles_without_channel
  FROM public.profile
  WHERE botsson_channel_id IS NULL
    AND role != 'system';

  IF v_profiles_without_channel > 0 THEN
    RAISE EXCEPTION
      'Self-test FAIL (A4): % non-system profile(s) still have NULL botsson_channel_id.',
      v_profiles_without_channel;
  END IF;

  -- Assertion 5: every Botsson channel has a channel_ai_policy with voice_participation='interactive'
  SELECT count(*) INTO v_policies_missing
  FROM public.channel c
  WHERE c.channel_type = 'ai'
    AND c.is_archived = false
    AND NOT EXISTS (
      SELECT 1 FROM public.channel_ai_policy cap
      WHERE cap.channel_id = c.id
    );

  IF v_policies_missing > 0 THEN
    RAISE EXCEPTION
      'Self-test FAIL (A5): % Botsson channel(s) have no channel_ai_policy row.',
      v_policies_missing;
  END IF;

  SELECT count(*) INTO v_policies_wrong_voice
  FROM public.channel_ai_policy cap
  JOIN public.channel c ON c.id = cap.channel_id
  WHERE c.channel_type = 'ai'
    AND c.is_archived = false
    AND cap.voice_participation != 'interactive';

  IF v_policies_wrong_voice > 0 THEN
    RAISE EXCEPTION
      'Self-test FAIL (A5b): % Botsson channel_ai_policy row(s) have voice_participation != ''interactive''.',
      v_policies_wrong_voice;
  END IF;

  RAISE NOTICE 'C1.d self-test PASS: all assertions green.';
END $$;
