-- 20260519201000_seed_botsson_direct_channels.sql
--
-- Reuses the existing per-workspace channel_type='ai' channel (already seeded
-- elsewhere as "Botsson") and ensures the @smartout/botsson-sdk voice token
-- BFF can pass channel-membership checks in the existing livekit-token Edge
-- Function:
--   1) channel_ai_policy row — text='proactive', voice='interactive'.
--      text uses channel_ai_text_mode enum {disabled, mention_only, proactive};
--      voice uses channel_ai_voice_mode enum {disabled, listen_only, interactive}.
--   2) channel_member rows for every active+trainee profile in the workspace
--
-- Idempotent: re-running creates no duplicates.
--
-- Rationale: a unique partial index `idx_channel_one_ai_per_workspace` enforces
-- one AI channel per workspace, so this migration does NOT insert a new one.
-- Adoption flow: SDK looks up the workspace's `channel_type='ai'` channel by
-- workspace_id and uses its UUID when minting LiveKit tokens.

DO $$
DECLARE
  ws RECORD;
  ch_id UUID;
BEGIN
  FOR ws IN SELECT workspace_id FROM workspace LOOP
    SELECT id INTO ch_id
    FROM channel
    WHERE workspace_id = ws.workspace_id
      AND channel_type = 'ai'
    LIMIT 1;

    IF ch_id IS NULL THEN
      CONTINUE;
    END IF;

    -- 1. AI policy — text proactive, voice interactive. Each enum has different
    --    value space (text lacks 'interactive'). Upsert so re-running migration
    --    or downstream policy edits stay idempotent.
    INSERT INTO channel_ai_policy (
      channel_id,
      workspace_id,
      text_participation,
      voice_participation,
      auto_summarize,
      auto_shift_prep,
      auto_reminders
    ) VALUES (
      ch_id,
      ws.workspace_id,
      'proactive',
      'interactive',
      false,
      false,
      false
    )
    ON CONFLICT (channel_id) DO UPDATE SET
      text_participation = EXCLUDED.text_participation,
      voice_participation = EXCLUDED.voice_participation,
      updated_at = now();

    -- 2. Members — every active/trainee profile in the workspace gets auto-added.
    --    AI participants (the voice-agent worker) join via LiveKit Cloud and
    --    are not represented in channel_member.
    INSERT INTO channel_member (
      channel_id,
      workspace_id,
      profile_id,
      role,
      is_ai
    )
    SELECT
      ch_id,
      ws.workspace_id,
      p.profile_id,
      'member'::channel_member_role,
      false
    FROM profile p
    WHERE p.workspace_id = ws.workspace_id
      AND p.status IN ('active', 'trainee')
    ON CONFLICT (channel_id, profile_id) DO NOTHING;
  END LOOP;
END $$;
