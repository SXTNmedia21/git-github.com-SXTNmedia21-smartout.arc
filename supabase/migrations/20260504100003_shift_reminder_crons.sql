-- Migration: shift_reminder_crons
-- Adds two pg_cron jobs for shift-related reminders:
--   1. Confirmation reminders — nudge employees with unconfirmed shifts (1-3 days out)
--   2. Pre-shift reminders — 24h, 4h, 2h before shift start
--
-- Both jobs insert into notification_outbox with idempotent guards
-- (check metadata->>'event_key' + recipient + shift combo before inserting).
-- pg_cron is only available on Supabase Cloud, not local dev.

-- ── Job 1: Confirmation Reminder (every 30 min) ────────────────────────────
-- Finds published, unconfirmed shifts 1-3 days away and sends a nudge.

DO $cmd$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
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
  END IF;
END
$cmd$;

-- ── Job 2: Pre-Shift Reminder (every 15 min) ───────────────────────────────
-- Three reminder windows: 24h, 4h, 2h before shift start.
-- Each window checks a 30-minute band around the target time.

DO $cmd$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
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
  END IF;
END
$cmd$;
