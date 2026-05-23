-- ==========================================================================
-- Re-register pg_cron jobs to read secrets from Vault (not GUCs)
-- ==========================================================================
--
-- WHY: Supabase managed Postgres restricts ALTER ROLE/DATABASE SET to the
-- supabase_admin superuser. The `postgres` role (used by migrations, the MCP,
-- and pooler connections) gets `42501 permission denied to set parameter` for
-- every app.* GUC — confirmed via MCP, psql-as-postgres, ALTER ROLE, ALTER
-- DATABASE, and the dashboard SQL Editor. So current_setting('app.*') can
-- NEVER be populated by us. supabase_vault IS writable by postgres.
--
-- Re-registers all 27 cron jobs (idempotent unschedule-then-schedule) with
-- every current_setting('app.X') swapped for public.get_secret('X').
--
-- public.get_secret(secret_name) ALREADY EXISTS (20260228230000_api_key_
-- management.sql) — SECURITY DEFINER reader of vault.decrypted_secrets. We
-- reuse it; do NOT redefine (CREATE OR REPLACE would fail on the differing
-- input-parameter name).
--
-- Vault secret names (seeded out-of-band from 1Password / CI from GH secrets):
--   supabase_url, service_role_key, watchdog_cron_secret,
--   process_notifications_secret, morning_digest_secret
--
-- On local dev (no vault / no secrets) get_secret returns NULL and the
-- pg_cron guard skips scheduling — so this migration is a clean no-op there.
--
-- Supersedes the GUC approach in 20260621201500 (same jobs, unsettable GUCs).
-- See ADR-0388.
-- ==========================================================================

DO $migrate$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN

    -- emma_task_trigger  (origin: 20260311060000_emma_task_cron_and_limit.sql)
    BEGIN PERFORM cron.unschedule('emma_task_trigger'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'emma_task_trigger',
      '*/10 * * * *',
      'SELECT trigger_due_emma_tasks();'
    );

    -- process-notifications  (origin: 20260324220000_notification_table.sql)
    BEGIN PERFORM cron.unschedule('process-notifications'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'process-notifications',
      '30 seconds',
      $sql$SELECT net.http_post(
        url := public.get_secret('supabase_url') || '/functions/v1/process-notifications',
        headers := jsonb_build_object('Authorization', 'Bearer ' || public.get_secret('process_notifications_secret'))
      )$sql$
    );

    -- morning-digest  (origin: 20260324220000_notification_table.sql)
    BEGIN PERFORM cron.unschedule('morning-digest'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'morning-digest',
      '0 7 * * *',
      $sql$SELECT net.http_post(
        url := public.get_secret('supabase_url') || '/functions/v1/send-morning-digest',
        headers := jsonb_build_object('Authorization', 'Bearer ' || public.get_secret('morning_digest_secret'))
      )$sql$
    );

    -- journey-stuck-detector-hourly  (origin: 20260406150100_guardian_signal_push_trigger.sql)
    BEGIN PERFORM cron.unschedule('journey-stuck-detector-hourly'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'journey-stuck-detector-hourly',
      '0 * * * *',
      $cron$
        SELECT net.http_post(
          url := public.get_secret('supabase_url') || '/functions/v1/journey-stuck-detector',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            -- journey-stuck-detector EF accepts WATCHDOG_CRON_SECRET (its doc'd
            -- bearer); prior service_role_key ref was a 401 mismatch. ADR-0388.
            'Authorization', 'Bearer ' || public.get_secret('watchdog_cron_secret')
          ),
          body := '{}'::jsonb
        );
      $cron$
    );

    -- ops-day-brief  (origin: 20260414230100_ops_day_brief_cron.sql)
    BEGIN PERFORM cron.unschedule('ops-day-brief'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'ops-day-brief',
      '0 5 * * *',
      $sql$SELECT net.http_post(
        url := public.get_secret('supabase_url') || '/functions/v1/ops-day-brief',
        headers := jsonb_build_object('Authorization', 'Bearer ' || public.get_secret('watchdog_cron_secret'))
      )$sql$
    );

    -- ops-predict  (origin: 20260414231000_ops_predict_learn_cron.sql)
    BEGIN PERFORM cron.unschedule('ops-predict'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'ops-predict',
      '0 22 * * 0',
      $sql$SELECT net.http_post(
        url := public.get_secret('supabase_url') || '/functions/v1/ops-predict',
        headers := jsonb_build_object('Authorization', 'Bearer ' || public.get_secret('watchdog_cron_secret'))
      )$sql$
    );

    -- ops-learn  (origin: 20260414231000_ops_predict_learn_cron.sql)
    BEGIN PERFORM cron.unschedule('ops-learn'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'ops-learn',
      '0 1 * * 1',
      $sql$SELECT net.http_post(
        url := public.get_secret('supabase_url') || '/functions/v1/ops-learn',
        headers := jsonb_build_object('Authorization', 'Bearer ' || public.get_secret('watchdog_cron_secret'))
      )$sql$
    );

    -- ops-monitor  (origin: 20260414240000_ops_monitor_cron.sql)
    BEGIN PERFORM cron.unschedule('ops-monitor'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'ops-monitor',
      '*/15 * * * *',
      $sql$SELECT net.http_post(
        url := public.get_secret('supabase_url') || '/functions/v1/ops-monitor',
        headers := jsonb_build_object('Authorization', 'Bearer ' || public.get_secret('watchdog_cron_secret'))
      )$sql$
    );

    -- daily-session-replenish  (origin: 20260428100100_daily_session_replenish_cron.sql)
    BEGIN PERFORM cron.unschedule('daily-session-replenish'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'daily-session-replenish',
      '0 2 * * *',
      $sql$SELECT net.http_post(
        url := public.get_secret('supabase_url') || '/functions/v1/daily-session-replenish',
        headers := jsonb_build_object('Authorization', 'Bearer ' || public.get_secret('watchdog_cron_secret'))
      )$sql$
    );

    -- session-lifecycle  (origin: 20260428100200_session_lifecycle_cron.sql)
    BEGIN PERFORM cron.unschedule('session-lifecycle'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'session-lifecycle',
      '*/15 * * * *',
      $sql$SELECT net.http_post(
        url := public.get_secret('supabase_url') || '/functions/v1/session-lifecycle',
        headers := jsonb_build_object('Authorization', 'Bearer ' || public.get_secret('watchdog_cron_secret'))
      )$sql$
    );

    -- session-hook-executor  (origin: 20260428100300_session_hook_executor_cron.sql)
    BEGIN PERFORM cron.unschedule('session-hook-executor'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'session-hook-executor',
      '*/5 * * * *',
      $sql$SELECT net.http_post(
        url := public.get_secret('supabase_url') || '/functions/v1/session-hook-executor',
        headers := jsonb_build_object('Authorization', 'Bearer ' || public.get_secret('watchdog_cron_secret'))
      )$sql$
    );

    -- process-scheduled-communications  (origin: 20260504100002_scheduled_comm_cron.sql)
    BEGIN PERFORM cron.unschedule('process-scheduled-communications'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'process-scheduled-communications',
      '* * * * *',
      'UPDATE platform_communication_log SET status = ''pending'', updated_at = now() WHERE status = ''queued'' AND scheduled_for IS NOT NULL AND scheduled_for <= now();'
    );

    -- shift-confirmation-reminder  (origin: 20260504100003_shift_reminder_crons.sql)
    BEGIN PERFORM cron.unschedule('shift-confirmation-reminder'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'shift-confirmation-reminder',
      '*/30 * * * *',
      $sql$
        INSERT INTO notification_outbox (
          workspace_id, recipient_id, mode, priority,
          title, body, action_url, metadata, allowed_channels
        )
        SELECT
          ss.workspace_id,
          p.profile_id,
          'work'::notification_mode,
          1,
          'Bekreft vakt',
          'Du har en ubekreftet vakt. Bekreft at du kan jobbe.',
          '/dashboard/my-schedule',
          jsonb_build_object(
            'event_key', 'shift.confirmation_reminder',
            'shift_id', ss.schedule_shift_id
          ),
          ARRAY['push', 'in_app']::notification_channel[]
        FROM schedule_shift ss
        JOIN profile p ON p.profile_id = ss.employee_id
        WHERE ss.is_published = true
          AND ss.confirmed_at IS NULL
          AND ss.employee_id IS NOT NULL
          AND ss.shift_date BETWEEN (CURRENT_DATE + INTERVAL '1 day') AND (CURRENT_DATE + INTERVAL '3 days')
          -- Idempotent: skip if we already sent this reminder for this shift + employee
          AND NOT EXISTS (
            SELECT 1 FROM notification_outbox no
            WHERE no.metadata->>'event_key' = 'shift.confirmation_reminder'
              AND no.metadata->>'shift_id' = ss.schedule_shift_id::text
              AND no.recipient_id = p.profile_id
          );
      $sql$
    );

    -- shift-pre-shift-reminder  (origin: 20260504100003_shift_reminder_crons.sql)
    BEGIN PERFORM cron.unschedule('shift-pre-shift-reminder'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'shift-pre-shift-reminder',
      '*/15 * * * *',
      $sql$
        -- 24h reminder: shift_date = tomorrow, start_time within 30-min window
        INSERT INTO notification_outbox (
          workspace_id, recipient_id, mode, priority,
          title, body, action_url, metadata, allowed_channels
        )
        SELECT
          ss.workspace_id,
          p.profile_id,
          'work'::notification_mode,
          0,
          'Vaktpåminnelse',
          '24 timer til vakt kl ' || to_char(ss.start_time, 'HH24:MI'),
          '/dashboard/my-schedule',
          jsonb_build_object(
            'event_key', 'shift.reminder_24h',
            'shift_id', ss.schedule_shift_id
          ),
          ARRAY['push', 'in_app']::notification_channel[]
        FROM schedule_shift ss
        JOIN profile p ON p.profile_id = ss.employee_id
        WHERE ss.is_published = true
          AND ss.employee_id IS NOT NULL
          AND ss.shift_date = CURRENT_DATE + INTERVAL '1 day'
          AND (ss.shift_date + ss.start_time) BETWEEN (now() + INTERVAL '23 hours 45 minutes') AND (now() + INTERVAL '24 hours 15 minutes')
          AND NOT EXISTS (
            SELECT 1 FROM notification_outbox no
            WHERE no.metadata->>'event_key' = 'shift.reminder_24h'
              AND no.metadata->>'shift_id' = ss.schedule_shift_id::text
              AND no.recipient_id = p.profile_id
          );

        -- 4h reminder: shift_date = today, start_time within 30-min window
        INSERT INTO notification_outbox (
          workspace_id, recipient_id, mode, priority,
          title, body, action_url, metadata, allowed_channels
        )
        SELECT
          ss.workspace_id,
          p.profile_id,
          'work'::notification_mode,
          1,
          'Vaktpåminnelse',
          '4 timer til vakt',
          '/dashboard/my-schedule',
          jsonb_build_object(
            'event_key', 'shift.reminder_4h',
            'shift_id', ss.schedule_shift_id
          ),
          ARRAY['push', 'in_app']::notification_channel[]
        FROM schedule_shift ss
        JOIN profile p ON p.profile_id = ss.employee_id
        WHERE ss.is_published = true
          AND ss.employee_id IS NOT NULL
          AND ss.shift_date = CURRENT_DATE
          AND (ss.shift_date + ss.start_time) BETWEEN (now() + INTERVAL '3 hours 45 minutes') AND (now() + INTERVAL '4 hours 15 minutes')
          AND NOT EXISTS (
            SELECT 1 FROM notification_outbox no
            WHERE no.metadata->>'event_key' = 'shift.reminder_4h'
              AND no.metadata->>'shift_id' = ss.schedule_shift_id::text
              AND no.recipient_id = p.profile_id
          );

        -- 2h reminder: shift_date = today, start_time within 30-min window
        INSERT INTO notification_outbox (
          workspace_id, recipient_id, mode, priority,
          title, body, action_url, metadata, allowed_channels
        )
        SELECT
          ss.workspace_id,
          p.profile_id,
          'work'::notification_mode,
          1,
          'Vaktpåminnelse',
          '2 timer til vakt',
          '/dashboard/my-schedule',
          jsonb_build_object(
            'event_key', 'shift.reminder_2h',
            'shift_id', ss.schedule_shift_id
          ),
          ARRAY['push', 'in_app']::notification_channel[]
        FROM schedule_shift ss
        JOIN profile p ON p.profile_id = ss.employee_id
        WHERE ss.is_published = true
          AND ss.employee_id IS NOT NULL
          AND ss.shift_date = CURRENT_DATE
          AND (ss.shift_date + ss.start_time) BETWEEN (now() + INTERVAL '1 hour 45 minutes') AND (now() + INTERVAL '2 hours 15 minutes')
          AND NOT EXISTS (
            SELECT 1 FROM notification_outbox no
            WHERE no.metadata->>'event_key' = 'shift.reminder_2h'
              AND no.metadata->>'shift_id' = ss.schedule_shift_id::text
              AND no.recipient_id = p.profile_id
          );
      $sql$
    );

    -- archive_completed_engine_states_daily  (origin: 20260508100100_engine_state_archive_job.sql)
    BEGIN PERFORM cron.unschedule('archive_completed_engine_states_daily'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'archive_completed_engine_states_daily',
      '0 3 * * *',  -- 03:00 UTC daily
      $job$SELECT public.archive_completed_engine_states(30);$job$
    );

    -- smartout-dunning-daily  (origin: 20260512000008_pg_cron_dunning_tick.sql)
    BEGIN PERFORM cron.unschedule('smartout-dunning-daily'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'smartout-dunning-daily',
      '0 7 * * *',
      $sql$
        INSERT INTO public.engine_event (event_type, workspace_id, payload, idempotency_key)
        VALUES (
          'dunning_daily_tick',
          NULL,
          jsonb_build_object('tick_date', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')),
          'dunning_daily_tick_' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')
        )
        ON CONFLICT (idempotency_key) DO NOTHING
      $sql$
    );

    -- purge_recorder_redacted_content  (origin: 20260515120500_recorder_retention_cron.sql)
    BEGIN PERFORM cron.unschedule('purge_recorder_redacted_content'); EXCEPTION WHEN OTHERS THEN NULL; END;
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

    -- purge_recorder_envelopes  (origin: 20260515120500_recorder_retention_cron.sql)
    BEGIN PERFORM cron.unschedule('purge_recorder_envelopes'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'purge_recorder_envelopes',
      '15 3 * * *',  -- 03:15 daily
      $sql$
        DELETE FROM public.agent_session_envelope
        WHERE redact_after < now();
      $sql$
    );

    -- purge_flagged_sessions  (origin: 20260515120500_recorder_retention_cron.sql)
    BEGIN PERFORM cron.unschedule('purge_flagged_sessions'); EXCEPTION WHEN OTHERS THEN NULL; END;
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

    -- session-watchdog-demoter  (origin: 20260517130000_session_watchdog_demoter.sql)
    BEGIN PERFORM cron.unschedule('session-watchdog-demoter'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'session-watchdog-demoter',
      '*/15 * * * *',
      $sql$SELECT net.http_post(
        url := public.get_secret('supabase_url') || '/functions/v1/session-watchdog-demoter',
        headers := jsonb_build_object('Authorization', 'Bearer ' || public.get_secret('watchdog_cron_secret'))
      )$sql$
    );

    -- heartbeat-dispatcher  (origin: 20260520110100_heartbeat_dispatcher_cron.sql)
    BEGIN PERFORM cron.unschedule('heartbeat-dispatcher'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'heartbeat-dispatcher',
      '*/1 * * * *',
      $sql$SELECT net.http_post(
        url := public.get_secret('supabase_url') || '/functions/v1/heartbeat-dispatcher',
        headers := jsonb_build_object('Authorization', 'Bearer ' || public.get_secret('watchdog_cron_secret'))
      )$sql$
    );

    -- engine-memory-ttl-purge  (origin: 20260531000000_engine_memory_ttl_cron.sql)
    BEGIN PERFORM cron.unschedule('engine-memory-ttl-purge'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'engine-memory-ttl-purge',
      '0 3 * * *',
      $job$
        DELETE FROM engine_memory
         WHERE expires_at IS NOT NULL
           AND expires_at < now();
      $job$
    );

    -- contract-retention-anonymize  (origin: 20260615100000_gdpr_§13_retention_fix.sql)
    BEGIN PERFORM cron.unschedule('contract-retention-anonymize'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'contract-retention-anonymize',
      '0 2 1 * *',
      $cmd$SELECT anonymize_contract(NULL, false);$cmd$
    );

    -- note-fanout-scheduler  (origin: 20260616100600_note_fanout_scheduler_cron.sql)
    BEGIN PERFORM cron.unschedule('note-fanout-scheduler'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'note-fanout-scheduler',
      '*/5 * * * *',
      $sql$SELECT net.http_post(
        url     := public.get_secret('supabase_url') || '/functions/v1/note-fanout-scheduler',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || public.get_secret('watchdog_cron_secret')
        ),
        body              := '{}'::jsonb,
        timeout_milliseconds := 30000
      )$sql$
    );

    -- publish-birthday-celebrations  (origin: 20260620141500_publish_birthday_celebrations_cron.sql)
    BEGIN PERFORM cron.unschedule('publish-birthday-celebrations'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'publish-birthday-celebrations',
      '0 * * * *',
      $sql$SELECT net.http_post(
        url     := public.get_secret('supabase_url') || '/functions/v1/publish-birthday-celebrations',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || public.get_secret('watchdog_cron_secret')
        ),
        body              := '{}'::jsonb,
        timeout_milliseconds := 30000
      )$sql$
    );

    -- check-billing-run  (origin: 20260621200002_fn_check_billing_run.sql)
    BEGIN PERFORM cron.unschedule('check-billing-run'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'check-billing-run',
      '0 6 7 * *',
      $$SELECT public.fn_check_billing_run();$$
    );

    -- generate-monthly-invoices  (origin: 20260621200003_pg_cron_generate_monthly_invoices.sql)
    BEGIN PERFORM cron.unschedule('generate-monthly-invoices'); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule(
      'generate-monthly-invoices',
      '1 0 5 * *',
      $sql$SELECT net.http_post(
        url     := public.get_secret('supabase_url') || '/functions/v1/generate-monthly-invoices',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || public.get_secret('watchdog_cron_secret'),
          'Content-Type',  'application/json'
        )
      )$sql$
    );

    RAISE NOTICE 'pg_cron re-registration complete: % jobs', 27;
  ELSE
    RAISE NOTICE 'pg_cron not enabled — skipping cron re-registration (expected on local dev)';
  END IF;
END
$migrate$;
