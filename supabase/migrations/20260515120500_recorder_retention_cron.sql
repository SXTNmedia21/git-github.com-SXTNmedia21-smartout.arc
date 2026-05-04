-- 20260515120500_recorder_retention_cron.sql
-- ADR-0184 § Tiered Retention
-- Metadata permanent; redacted-content 90d; envelope 30d; flagged 1y
--
-- L-0042 timestamp verified: tip 20260515120400, depends on:
--   - agent_session_recording (20260515120100)
--   - agent_session_envelope (20260515120200)
--
-- Wraps cron.schedule calls in a pg_cron guard so environments without the
-- extension (e.g. plain Supabase local without cron) still apply cleanly
-- (same pattern as 20260414231000_ops_predict_learn_cron.sql).

SET search_path TO public, extensions;

-- Purge redacted content payload after 90d, keep metadata
DO $cmd$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge_recorder_redacted_content',
      '0 3 * * *',  -- 03:00 daily
      $sql$
        UPDATE public.agent_session_recording
        SET content_redacted = '{"_retention_purged": true}'::jsonb
        WHERE created_at < now() - interval '90 days'
          AND is_flagged = false
          AND (content_redacted ? '_retention_purged') = false;
      $sql$
    );
  END IF;
END $cmd$;

-- Purge envelope (encrypted payload) after TTL
DO $cmd$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge_recorder_envelopes',
      '15 3 * * *',  -- 03:15 daily
      $sql$
        DELETE FROM public.agent_session_envelope
        WHERE redact_after < now();
      $sql$
    );
  END IF;
END $cmd$;

-- Purge flagged sessions after 1 year (metadata retained, payload + envelope cleared)
DO $cmd$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'purge_flagged_sessions',
      '30 3 * * *',  -- 03:30 daily
      $sql$
        UPDATE public.agent_session_recording
        SET content_redacted = '{"_retention_purged": true}'::jsonb,
            content_envelope_id = NULL
        WHERE is_flagged = true
          AND created_at < now() - interval '365 days';
      $sql$
    );
  END IF;
END $cmd$;
