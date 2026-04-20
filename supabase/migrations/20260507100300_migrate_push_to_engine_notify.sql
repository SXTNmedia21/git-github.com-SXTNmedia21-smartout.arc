SET search_path TO public, extensions;

-- ============================================================
-- 20260507100300_migrate_push_to_engine_notify.sql
--
-- Migrates the "shift published" push path from the pg_net direct
-- HTTP call (20260418120000_push_dispatch_triggers.sql) to an
-- engine-driven notification.
--
-- Per SHIFT_LIFECYCLE_MAP target: push notifications should flow
-- through the Event Engine's `send_notification` step (which writes
-- to `notification_outbox` — the outbox then delivers via push,
-- email, sms, etc., respecting allowed_channels per ADR-0077/0078).
--
-- Scope:
--   - Replace trg_push_shift_published's AFTER INSERT body with an
--     emission into `engine_event` for a small notify process
--     (`shift_published_notify_v1`). That process has one step:
--     `send_notification`.
--   - Leave the legacy `push-dispatch` Edge Function intact — it
--     is still invoked by other triggers (shift_updated,
--     task_assigned, chat_message, deviation_reported, join_request).
--     Phasing those out is a separate migration.
--
-- Safety:
--   - The old function dispatch_push_notification() is NOT dropped;
--     other triggers still reference it.
--   - trg_push_shift_updated is left untouched — its dual-write
--     behaviour is acceptable for now (shift time-changes are a
--     narrower path and will be migrated in a follow-up).
-- ============================================================

-- ── 1. Notify process ─────────────────────────────────────────

INSERT INTO engine_process (id, name, description, is_active, max_steps) VALUES
  (
    'shift_published_notify_v1',
    'Shift Published — Notify Employee',
    'Single-step notify process; replaces pg_net direct push path from migration 20260418120000.',
    true,
    5
  )
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      is_active = EXCLUDED.is_active,
      updated_at = now();

UPDATE engine_process
   SET allowed_channels = ARRAY['push', 'in_app']::TEXT[],
       updated_at = now()
 WHERE id = 'shift_published_notify_v1';

INSERT INTO engine_step (process_id, step_order, step_group, action_type, action_payload, assignee_rule) VALUES
  (
    'shift_published_notify_v1',
    1,
    NULL,
    'send_notification',
    jsonb_build_object(
      'template', 'shift_published',
      'description', 'Notify assigned employee of new published shift'
    ),
    NULL
  )
ON CONFLICT (process_id, step_order) DO UPDATE
  SET action_type = EXCLUDED.action_type,
      action_payload = EXCLUDED.action_payload;

INSERT INTO engine_trigger (event_type, process_id, condition, is_active)
SELECT 'shift.publish_notify', 'shift_published_notify_v1', NULL, true
WHERE NOT EXISTS (
  SELECT 1 FROM engine_trigger
  WHERE event_type = 'shift.publish_notify'
    AND process_id = 'shift_published_notify_v1'
);

-- ── 2. Replace the trigger body ───────────────────────────────
-- Instead of calling dispatch_push_notification (pg_net), insert an
-- engine_event row. A pg_cron / realtime worker observing
-- engine_event will pick this up via the standard dispatcher.
-- Inserting into engine_event here is fine: it is the canonical
-- ingress for the Event Engine.

CREATE OR REPLACE FUNCTION public.trigger_push_shift_published()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.is_published = TRUE AND NEW.employee_id IS NOT NULL THEN
    INSERT INTO public.engine_event (
      event_type, workspace_id, payload
    ) VALUES (
      'shift.publish_notify',
      NEW.workspace_id,
      jsonb_build_object(
        'entity_type', 'schedule_shift',
        'entity_id',   NEW.schedule_shift_id,
        'shift_id',    NEW.schedule_shift_id,
        'employee_id', NEW.employee_id,
        'shift_date',  NEW.shift_date,
        'start_time',  NEW.start_time,
        'end_time',    NEW.end_time,
        -- ADR-0099 integration: system-originated events flow through
        -- the authority gate as 'system' channel. Not chat/voice.
        'originating_channel', 'system',
        -- Keep recipient for send_notification to resolve.
        'recipient_id', NEW.employee_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_push_shift_published IS
  'Per migration 20260507100300: emits shift.publish_notify into engine_event '
  'instead of calling push-dispatch via pg_net. Engine dispatcher handles the '
  'send_notification step (which writes to notification_outbox).';
