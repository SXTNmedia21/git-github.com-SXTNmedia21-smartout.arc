-- Notification System — Seed Data
-- Creates notifications, outbox entries, and preferences for development/demo
-- Depends on: seed.sql (users, profiles, workspace, departments)

DO $$
DECLARE
  ws_id uuid := 'b0000000-0000-0000-0000-000000000000';

  -- Auth user IDs (for notification_preference, keyed by user_id)
  u_admin uuid := 'e0000000-0000-0000-0000-000000000000';
  u_anna  uuid := 'e0000000-0000-0000-0000-000000000001';
  u_erik  uuid := 'e0000000-0000-0000-0000-000000000002';
  u_lise  uuid := 'e0000000-0000-0000-0000-000000000003';
  u_ole   uuid := 'e0000000-0000-0000-0000-000000000004';
  u_kari  uuid := 'e0000000-0000-0000-0000-000000000005';
  u_sara  uuid := 'e0000000-0000-0000-0000-000000000007';

  -- Profile IDs (for notification table, keyed by recipient_id)
  p_admin uuid := 'f0000000-0000-0000-0000-000000000000';
  p_anna  uuid := 'f0000000-0000-0000-0000-000000000001';
  p_erik  uuid := 'f0000000-0000-0000-0000-000000000002';
  p_lise  uuid := 'f0000000-0000-0000-0000-000000000003';
  p_ole   uuid := 'f0000000-0000-0000-0000-000000000004';
  p_kari  uuid := 'f0000000-0000-0000-0000-000000000005';
  p_jon   uuid := 'f0000000-0000-0000-0000-000000000006';
  p_sara  uuid := 'f0000000-0000-0000-0000-000000000007';
  p_jonas uuid := 'f0000000-0000-0000-0000-000000000008';
  p_silje uuid := 'f0000000-0000-0000-0000-000000000009';

BEGIN
  -- ============================================================
  -- NOTIFICATION PREFERENCES
  -- ============================================================

  INSERT INTO notification_preference (user_id, push_enabled, email_enabled, sms_enabled, training_enabled, work_enabled, community_enabled, quiet_hours_start, quiet_hours_end) VALUES
    -- Admin: all channels on, no quiet hours
    (u_admin, true, true, false, true, true, true, NULL, NULL),
    -- Anna: push + email, quiet hours 22:00-07:00
    (u_anna, true, true, false, true, true, true, '22:00', '07:00'),
    -- Erik (manager): all on including SMS
    (u_erik, true, true, true, true, true, true, NULL, NULL),
    -- Lise: push only, community off
    (u_lise, true, false, false, true, true, false, '23:00', '06:00'),
    -- Ole: defaults (push + email)
    (u_ole, true, true, false, true, true, true, NULL, NULL),
    -- Kari: email only
    (u_kari, false, true, false, true, true, true, '22:00', '07:00'),
    -- Sara (manager): all on
    (u_sara, true, true, true, true, true, true, NULL, NULL)
  ON CONFLICT (user_id) DO NOTHING;

  -- ============================================================
  -- NOTIFICATIONS — Admin (mix of read and unread)
  -- ============================================================

  INSERT INTO notification (workspace_id, recipient_id, title, body, icon_type, action_url, is_read, read_at, created_at) VALUES
    -- Read notifications (older)
    (ws_id, p_admin, 'Ny ansatt registrert', 'Anna Olsen har fullfort registreringen og er klar for onboarding.', 'info', '/dashboard/team', true, now() - interval '2 days', now() - interval '3 days'),
    (ws_id, p_admin, 'Avvik rapportert', 'Temperaturavvik i kjolerommet — kjokken. Loggfort av Erik Pedersen.', 'deviation', '/dashboard/deviations', true, now() - interval '1 day', now() - interval '2 days'),
    (ws_id, p_admin, 'Vaktbytte godkjent', 'Anna Olsen og Jon Doe har byttet vakt lordag 29. mars.', 'shift', '/dashboard/schedule', true, now() - interval '12 hours', now() - interval '1 day'),
    (ws_id, p_admin, 'Oppgave fullfort', 'Erik Pedersen har fullfort "Mise en place-sjekk" for kjokken.', 'task', '/dashboard/operations', true, now() - interval '6 hours', now() - interval '8 hours'),

    -- Unread notifications (recent)
    (ws_id, p_admin, 'Godkjenning venter', 'Sara Lee har sendt timeliste for uke 13 til godkjenning.', 'approval', '/dashboard/approvals', false, NULL, now() - interval '2 hours'),
    (ws_id, p_admin, 'Ny melding i #generelt', 'Erik Pedersen: "Har vi fatt inn leveransen?"', 'chat', '/dashboard/channels', false, NULL, now() - interval '1 hour'),
    (ws_id, p_admin, 'Opplaering fullfort', 'Silje Ruud har fullfort alle protokoller i "Servering Grunnkurs".', 'training', '/dashboard/training', false, NULL, now() - interval '30 minutes'),
    (ws_id, p_admin, 'Vaktendring i morgen', '2 vakter er ubemannet for lordag 29. mars. Trenger dekning.', 'shift', '/dashboard/schedule', false, NULL, now() - interval '15 minutes');

  -- ============================================================
  -- NOTIFICATIONS — Anna (employee, Kitchen)
  -- ============================================================

  INSERT INTO notification (workspace_id, recipient_id, title, body, icon_type, action_url, is_read, read_at, created_at) VALUES
    (ws_id, p_anna, 'Velkommen til Smartout!', 'Din konto er klar. Start med onboarding-opplaeringen.', 'info', '/dashboard/training', true, now() - interval '5 days', now() - interval '6 days'),
    (ws_id, p_anna, 'Ny protokoll tildelt', '"Allergenhandtering" er tildelt deg. Frist: 1. april.', 'training', '/dashboard/training', true, now() - interval '2 days', now() - interval '3 days'),
    (ws_id, p_anna, 'Vaktbytte bekreftet', 'Ditt bytte med Jon Doe lordag 29. mars er godkjent.', 'shift', '/dashboard/schedule', true, now() - interval '12 hours', now() - interval '1 day'),
    (ws_id, p_anna, 'Ny oppgave', 'Du er tildelt "Forbered dessertstasjonen" for kveldens okt.', 'task', '/dashboard/tasks', false, NULL, now() - interval '45 minutes'),
    (ws_id, p_anna, 'Melding fra Erik', 'Erik Pedersen sendte deg en direktemelding.', 'chat', '/dashboard/channels', false, NULL, now() - interval '20 minutes');

  -- ============================================================
  -- NOTIFICATIONS — Erik (manager, Kitchen)
  -- ============================================================

  INSERT INTO notification (workspace_id, recipient_id, title, body, icon_type, action_url, is_read, read_at, created_at) VALUES
    (ws_id, p_erik, 'Vaktbytte-forespørsel', 'Anna Olsen ber om a bytte vakt lordag 29. mars.', 'approval', '/dashboard/approvals', true, now() - interval '1 day', now() - interval '2 days'),
    (ws_id, p_erik, 'Ukentlig rapport klar', 'Kjokkenets ytelsesrapport for uke 12 er tilgjengelig.', 'info', '/dashboard/reports', true, now() - interval '10 hours', now() - interval '12 hours'),
    (ws_id, p_erik, 'Avvik krever oppfolging', 'Temperaturavvik fra i gar er ikke lukket. Frist: i dag kl 14:00.', 'deviation', '/dashboard/deviations', false, NULL, now() - interval '3 hours'),
    (ws_id, p_erik, 'Ny trainee starter', 'Jonas Bakken starter opplaering i morgen. Sjekk at alt er klart.', 'info', '/dashboard/team', false, NULL, now() - interval '1 hour');

  -- ============================================================
  -- NOTIFICATIONS — Sara (manager, Service)
  -- ============================================================

  INSERT INTO notification (workspace_id, recipient_id, title, body, icon_type, action_url, is_read, read_at, created_at) VALUES
    (ws_id, p_sara, 'Timeliste avvist', 'Admin har bedt om korrigering pa timeliste uke 12.', 'approval', '/dashboard/approvals', true, now() - interval '3 days', now() - interval '4 days'),
    (ws_id, p_sara, 'Opplaering: Ny modul', '"Vinsmaking Sommermeny" er tilgjengelig for service-teamet.', 'training', '/dashboard/training', false, NULL, now() - interval '4 hours'),
    (ws_id, p_sara, 'Bemanningsvarsling', 'Søndag kveldsvakt mangler 1 person. Vil du publisere ledig vakt?', 'shift', '/dashboard/schedule', false, NULL, now() - interval '2 hours');

  -- ============================================================
  -- NOTIFICATIONS — Employees (Lise, Ole, Kari, Jon, Jonas, Silje)
  -- ============================================================

  -- Lise (Service)
  INSERT INTO notification (workspace_id, recipient_id, title, body, icon_type, action_url, is_read, read_at, created_at) VALUES
    (ws_id, p_lise, 'Vakt i morgen', 'Du har vakt lordag 29. mars kl 16:00-23:00 i Service.', 'shift', '/dashboard/schedule', false, NULL, now() - interval '5 hours'),
    (ws_id, p_lise, 'Protokoll fullfort!', 'Gratulerer — du har fullfort "Bordservering Avansert".', 'training', '/dashboard/training', true, now() - interval '1 day', now() - interval '2 days');

  -- Ole (Bar)
  INSERT INTO notification (workspace_id, recipient_id, title, body, icon_type, action_url, is_read, read_at, created_at) VALUES
    (ws_id, p_ole, 'Leveranse forsinket', 'Aperol-leveransen er utsatt til mandag. Oppdater barmeny.', 'info', '/dashboard/operations', false, NULL, now() - interval '4 hours'),
    (ws_id, p_ole, 'Ny oppgave', '"Klargjor bar for helgekveldsaapning" — frist kl 15:00.', 'task', '/dashboard/tasks', false, NULL, now() - interval '2 hours');

  -- Kari (Service)
  INSERT INTO notification (workspace_id, recipient_id, title, body, icon_type, action_url, is_read, read_at, created_at) VALUES
    (ws_id, p_kari, 'Allergivarsel', 'Bord 7 i kveld har glutenfri gjest. Sjekk allergenlisten.', 'deviation', '/dashboard/operations', false, NULL, now() - interval '3 hours'),
    (ws_id, p_kari, 'Vaktendring', 'Vakten din sondag er flyttet fra 12:00 til 14:00.', 'shift', '/dashboard/schedule', false, NULL, now() - interval '1 hour');

  -- Jon (Kitchen)
  INSERT INTO notification (workspace_id, recipient_id, title, body, icon_type, action_url, is_read, read_at, created_at) VALUES
    (ws_id, p_jon, 'Vaktbytte bekreftet', 'Byttet med Anna lordag er godkjent av leder.', 'shift', '/dashboard/schedule', true, now() - interval '12 hours', now() - interval '1 day'),
    (ws_id, p_jon, 'Ny opplaering tildelt', '"HACCP Grunnkurs" er tildelt deg. Start innen fredag.', 'training', '/dashboard/training', false, NULL, now() - interval '6 hours');

  -- Jonas (Kitchen, trainee)
  INSERT INTO notification (workspace_id, recipient_id, title, body, icon_type, action_url, is_read, read_at, created_at) VALUES
    (ws_id, p_jonas, 'Velkommen ombord!', 'Din opplaeringsplan er klar. Start med "Kjokkenrutiner Intro".', 'info', '/dashboard/training', false, NULL, now() - interval '1 day'),
    (ws_id, p_jonas, 'Oppgave fullfort', 'Du har fullfort "Handvask & Hygiene". Bra jobba!', 'task', '/dashboard/tasks', true, now() - interval '6 hours', now() - interval '8 hours');

  -- Silje (Service)
  INSERT INTO notification (workspace_id, recipient_id, title, body, icon_type, action_url, is_read, read_at, created_at) VALUES
    (ws_id, p_silje, 'Gratulerer!', 'Du har fullfort alle protokoller i "Servering Grunnkurs". Du er na klar!', 'training', '/dashboard/training', false, NULL, now() - interval '30 minutes'),
    (ws_id, p_silje, 'Ny melding i #service', 'Sara Lee: "Kveldsvakt: Husk a sjekke vinkartet"', 'chat', '/dashboard/channels', false, NULL, now() - interval '4 hours');

  -- ============================================================
  -- NOTIFICATION OUTBOX — Pending + processed entries
  -- ============================================================

  -- Pending (not yet processed)
  INSERT INTO notification_outbox (workspace_id, recipient_id, mode, priority, title, body, action_url, allowed_channels, status, scheduled_for) VALUES
    (ws_id, p_admin, 'work', 1, 'Daglig oppsummering', 'Gaarsdagens drift: 2 avvik, 1 ubemannet vakt, 98% opplaeringsdekning.', '/dashboard', '{push,email}', 'pending', now() + interval '8 hours'),
    (ws_id, p_anna, 'training', 0, 'Paminnelse: Allergenhåndtering', 'Frist for "Allergenhåndtering" er om 5 dager. Du er 60% ferdig.', '/dashboard/training', '{push}', 'pending', now() + interval '2 hours'),
    (ws_id, p_erik, 'work', 1, 'Temperaturavvik ulukket', 'Avviket fra i gar er fremdeles apent. Lukk innen kl 14:00.', '/dashboard/deviations', '{push,email,sms}', 'pending', now()),
    (ws_id, p_sara, 'work', 1, 'Bemanningsgap sondag', 'Kveldsvakt sondag mangler 1 person. Publiser ledig vakt?', '/dashboard/schedule', '{push,email}', 'pending', now() + interval '1 hour');

  -- Delivered (processed successfully)
  INSERT INTO notification_outbox (workspace_id, recipient_id, mode, priority, title, body, action_url, allowed_channels, status, processed_at, scheduled_for) VALUES
    (ws_id, p_admin, 'work', 0, 'Morgendigest', '3 nye varsler siden i gar. 1 godkjenning venter.', '/dashboard/notifications', '{email}', 'delivered', now() - interval '5 hours', now() - interval '5 hours'),
    (ws_id, p_lise, 'work', 0, 'Vaktpaminnelse', 'Du har vakt i morgen kl 16:00-23:00.', '/dashboard/schedule', '{push}', 'delivered', now() - interval '5 hours', now() - interval '5 hours'),
    (ws_id, p_ole, 'work', 1, 'Leveransevarsel', 'Aperol-leveranse utsatt. Oppdater barmeny.', '/dashboard/operations', '{push,email}', 'delivered', now() - interval '4 hours', now() - interval '4 hours');

  -- Failed (error example)
  INSERT INTO notification_outbox (workspace_id, recipient_id, mode, priority, title, body, allowed_channels, status, error_log, scheduled_for) VALUES
    (ws_id, p_kari, 'work', 0, 'Vaktpaminnelse', 'Vaktpaminnelse for sondag.', '{email}', 'failed', 'SendGrid 429: rate limit exceeded — will retry', now() - interval '3 hours');

  RAISE NOTICE 'Notification seed data inserted successfully';
END $$;
