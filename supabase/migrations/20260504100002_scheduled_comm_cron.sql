-- pg_cron job to process scheduled platform communications
-- Runs every minute, picks up queued communications where scheduled_for <= now()
-- pg_cron is only available on Supabase Cloud, not local dev

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'process-scheduled-communications',
      '* * * * *',
      'UPDATE platform_communication_log SET status = ''pending'', updated_at = now() WHERE status = ''queued'' AND scheduled_for IS NOT NULL AND scheduled_for <= now();'
    );
  END IF;
END
$$;
