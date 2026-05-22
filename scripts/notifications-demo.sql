-- Notification orchestration demo (local dev)
-- Enqueues a staff-relevant notification bundle into notification_outbox for one
-- recipient. Run, then invoke process-notifications to fan out → in_app (bell) +
-- email (Inbucket/Mailpit :54324). Push (OneSignal) is deployed-origin only.
--
-- Recipient: anna (seed). Channels: in_app + email (push omitted on localhost).
-- Usage:
--   docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < scripts/notifications-demo.sql
--
-- Idempotency: clears prior demo rows for this recipient first (status reset).

\set recipient '''f0000000-0000-0000-0000-000000000001'''
\set workspace '''b0000000-0000-0000-0000-000000000000'''

BEGIN;

-- Clean prior demo runs for a repeatable demo
DELETE FROM public.notification_outbox
WHERE recipient_id = :recipient::uuid
  AND (metadata->>'demo') = 'true';

-- Staff shift bundle + task due/overdue. allowed_channels = in_app + email.
INSERT INTO public.notification_outbox
  (workspace_id, recipient_id, mode, priority, title, body, action_url, allowed_channels, status, metadata)
VALUES
  (:workspace::uuid, :recipient::uuid, 'work', 0,
   'Ny vakt publisert', 'Du har fått en ny vakt fredag 09:00–17:00.',
   '/dashboard/my-schedule', ARRAY['in_app','email']::notification_channel[], 'pending',
   jsonb_build_object('demo','true','event_key','shift.published')),

  (:workspace::uuid, :recipient::uuid, 'work', 1,
   'Vakt om 2 timer', 'Vakten din starter 15:00. Husk å bekrefte oppmøte.',
   '/dashboard/shift-clock', ARRAY['in_app','email']::notification_channel[], 'pending',
   jsonb_build_object('demo','true','event_key','shift.reminder_2h')),

  (:workspace::uuid, :recipient::uuid, 'work', 1,
   'Bekreft vakten din', 'Bekreft at du kan ta vakten lørdag.',
   '/dashboard/my-schedule', ARRAY['in_app','email']::notification_channel[], 'pending',
   jsonb_build_object('demo','true','event_key','shift.confirmation_reminder')),

  (:workspace::uuid, :recipient::uuid, 'work', 1,
   'Vaktbytte foreslått', 'Erik vil bytte vakt med deg søndag.',
   '/dashboard/my-schedule', ARRAY['in_app','email']::notification_channel[], 'pending',
   jsonb_build_object('demo','true','event_key','shift.swap_initiated')),

  (:workspace::uuid, :recipient::uuid, 'work', 1,
   'Oppgave forfaller snart', 'Temperaturkontroll kjøl forfaller om 30 minutter.',
   '/dashboard/operations', ARRAY['in_app','email']::notification_channel[], 'pending',
   jsonb_build_object('demo','true','event_key','task.due_soon')),

  (:workspace::uuid, :recipient::uuid, 'work', 2,
   'Oppgave er forfalt', 'Lukkerutine bar er forfalt — fullfør snarest.',
   '/dashboard/operations', ARRAY['in_app','email']::notification_channel[], 'pending',
   jsonb_build_object('demo','true','event_key','task.overdue'));

COMMIT;

SELECT count(*) AS demo_rows_enqueued
FROM public.notification_outbox
WHERE recipient_id = :recipient::uuid AND (metadata->>'demo') = 'true' AND status = 'pending';
