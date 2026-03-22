-- Channel Communications — Seed Data
-- Creates channels, members, messages, reactions for development/demo

DO $$
DECLARE
  ws_id uuid := 'b0000000-0000-0000-0000-000000000000';

  -- Departments
  dept_kitchen uuid := 'd0000000-0000-0000-0000-000000000001';
  dept_service uuid := 'd0000000-0000-0000-0000-000000000002';
  dept_bar uuid := 'd0000000-0000-0000-0000-000000000003';

  -- Teams
  team_kitchen uuid := 'aa000000-0000-0000-0000-000000000001';
  team_service uuid := 'aa000000-0000-0000-0000-000000000002';
  team_bar uuid := 'aa000000-0000-0000-0000-000000000003';

  -- Profiles
  p_admin uuid := 'f0000000-0000-0000-0000-000000000000';   -- Local Admin (owner)
  p_anna uuid := 'f0000000-0000-0000-0000-000000000001';    -- Anna Olsen (employee, Kitchen)
  p_erik uuid := 'f0000000-0000-0000-0000-000000000002';    -- Erik Pedersen (manager, Kitchen)
  p_lise uuid := 'f0000000-0000-0000-0000-000000000003';    -- Lise Markussen (employee, Service)
  p_ole uuid := 'f0000000-0000-0000-0000-000000000004';     -- Ole Torp (employee, Bar)
  p_kari uuid := 'f0000000-0000-0000-0000-000000000005';    -- Kari Nilsen (employee, Service)
  p_jon uuid := 'f0000000-0000-0000-0000-000000000006';     -- Jon Doe (employee, Kitchen)
  p_sara uuid := 'f0000000-0000-0000-0000-000000000007';    -- Sara Lee (manager, Service)
  p_jonas uuid := 'f0000000-0000-0000-0000-000000000008';   -- Jonas Bakken (employee, Kitchen)
  p_silje uuid := 'f0000000-0000-0000-0000-000000000009';   -- Silje Ruud (employee, Service)

  -- Channel IDs
  ch_kitchen uuid := 'c0000000-0000-0000-0000-000000000001';
  ch_service uuid := 'c0000000-0000-0000-0000-000000000002';
  ch_bar uuid := 'c0000000-0000-0000-0000-000000000003';
  ch_team_kitchen uuid := 'c0000000-0000-0000-0000-000000000004';
  ch_team_service uuid := 'c0000000-0000-0000-0000-000000000005';
  ch_general uuid := 'c0000000-0000-0000-0000-000000000006';
  ch_news uuid := 'c0000000-0000-0000-0000-000000000007';
  ch_dm_anna_erik uuid := 'c0000000-0000-0000-0000-000000000008';
  ch_dm_admin_sara uuid := 'c0000000-0000-0000-0000-000000000009';

  -- Message IDs (for reactions/read pointers)
  m1 uuid; m2 uuid; m3 uuid; m4 uuid; m5 uuid;
  m6 uuid; m7 uuid; m8 uuid; m9 uuid; m10 uuid;
  m11 uuid; m12 uuid; m13 uuid; m14 uuid; m15 uuid;

BEGIN
  -- ============================================================
  -- CHANNELS
  -- ============================================================

  -- Department channels
  INSERT INTO channel (id, workspace_id, channel_type, name, department_id) VALUES
    (ch_kitchen, ws_id, 'department', '#kjøkkenet', dept_kitchen),
    (ch_service, ws_id, 'department', '#service', dept_service),
    (ch_bar, ws_id, 'department', '#bar', dept_bar)
  ON CONFLICT (id) DO NOTHING;

  -- Team channels
  INSERT INTO channel (id, workspace_id, channel_type, name, team_id) VALUES
    (ch_team_kitchen, ws_id, 'team', '#kitchen-a-team', team_kitchen),
    (ch_team_service, ws_id, 'team', '#service-kveld', team_service)
  ON CONFLICT (id) DO NOTHING;

  -- Custom channel
  INSERT INTO channel (id, workspace_id, channel_type, name, created_by) VALUES
    (ch_general, ws_id, 'custom', '#generelt', p_admin)
  ON CONFLICT (id) DO NOTHING;

  -- News channel (read-only)
  INSERT INTO channel (id, workspace_id, channel_type, name, created_by, is_read_only) VALUES
    (ch_news, ws_id, 'news', '#nyheter', p_admin, true)
  ON CONFLICT (id) DO NOTHING;

  -- Direct message channels
  INSERT INTO channel (id, workspace_id, channel_type, name, direct_pair_hash) VALUES
    (ch_dm_anna_erik, ws_id, 'direct', NULL,
     LEAST(p_anna::text, p_erik::text) || ':' || GREATEST(p_anna::text, p_erik::text)),
    (ch_dm_admin_sara, ws_id, 'direct', NULL,
     LEAST(p_admin::text, p_sara::text) || ':' || GREATEST(p_admin::text, p_sara::text))
  ON CONFLICT (id) DO NOTHING;

  -- ============================================================
  -- CHANNEL MEMBERS
  -- ============================================================

  -- Kitchen department: Anna, Erik, Jon, Jonas
  INSERT INTO channel_member (channel_id, workspace_id, profile_id, role) VALUES
    (ch_kitchen, ws_id, p_anna, 'member'),
    (ch_kitchen, ws_id, p_erik, 'admin'),
    (ch_kitchen, ws_id, p_jon, 'member'),
    (ch_kitchen, ws_id, p_jonas, 'member')
  ON CONFLICT (channel_id, profile_id) DO NOTHING;

  -- Service department: Lise, Kari, Sara, Silje
  INSERT INTO channel_member (channel_id, workspace_id, profile_id, role) VALUES
    (ch_service, ws_id, p_lise, 'member'),
    (ch_service, ws_id, p_kari, 'member'),
    (ch_service, ws_id, p_sara, 'admin'),
    (ch_service, ws_id, p_silje, 'member')
  ON CONFLICT (channel_id, profile_id) DO NOTHING;

  -- Bar department: Ole
  INSERT INTO channel_member (channel_id, workspace_id, profile_id, role) VALUES
    (ch_bar, ws_id, p_ole, 'member'),
    (ch_bar, ws_id, p_admin, 'admin')
  ON CONFLICT (channel_id, profile_id) DO NOTHING;

  -- Team channels
  INSERT INTO channel_member (channel_id, workspace_id, profile_id, role) VALUES
    (ch_team_kitchen, ws_id, p_anna, 'member'),
    (ch_team_kitchen, ws_id, p_erik, 'admin'),
    (ch_team_kitchen, ws_id, p_jon, 'member'),
    (ch_team_service, ws_id, p_sara, 'admin'),
    (ch_team_service, ws_id, p_lise, 'member'),
    (ch_team_service, ws_id, p_kari, 'member'),
    (ch_team_service, ws_id, p_silje, 'member')
  ON CONFLICT (channel_id, profile_id) DO NOTHING;

  -- General: everyone
  INSERT INTO channel_member (channel_id, workspace_id, profile_id, role) VALUES
    (ch_general, ws_id, p_admin, 'admin'),
    (ch_general, ws_id, p_anna, 'member'),
    (ch_general, ws_id, p_erik, 'member'),
    (ch_general, ws_id, p_lise, 'member'),
    (ch_general, ws_id, p_ole, 'member'),
    (ch_general, ws_id, p_kari, 'member'),
    (ch_general, ws_id, p_jon, 'member'),
    (ch_general, ws_id, p_sara, 'member'),
    (ch_general, ws_id, p_jonas, 'member'),
    (ch_general, ws_id, p_silje, 'member')
  ON CONFLICT (channel_id, profile_id) DO NOTHING;

  -- News: everyone (read-only, admin posts)
  INSERT INTO channel_member (channel_id, workspace_id, profile_id, role) VALUES
    (ch_news, ws_id, p_admin, 'admin'),
    (ch_news, ws_id, p_anna, 'member'),
    (ch_news, ws_id, p_erik, 'member'),
    (ch_news, ws_id, p_lise, 'member'),
    (ch_news, ws_id, p_ole, 'member'),
    (ch_news, ws_id, p_kari, 'member'),
    (ch_news, ws_id, p_sara, 'member')
  ON CONFLICT (channel_id, profile_id) DO NOTHING;

  -- DMs
  INSERT INTO channel_member (channel_id, workspace_id, profile_id, role) VALUES
    (ch_dm_anna_erik, ws_id, p_anna, 'member'),
    (ch_dm_anna_erik, ws_id, p_erik, 'member'),
    (ch_dm_admin_sara, ws_id, p_admin, 'member'),
    (ch_dm_admin_sara, ws_id, p_sara, 'member')
  ON CONFLICT (channel_id, profile_id) DO NOTHING;

  -- ============================================================
  -- MESSAGES
  -- ============================================================

  -- #kjøkkenet — busy kitchen conversation
  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, created_at) VALUES
    (gen_random_uuid(), ch_kitchen, ws_id, p_erik, 'God morgen alle! Husk at vi har ny meny i dag. Sjekk briefingen.', now() - interval '3 hours')
  RETURNING id INTO m1;

  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, created_at) VALUES
    (gen_random_uuid(), ch_kitchen, ws_id, p_anna, 'Mottatt! Har vi fått inn laksen?', now() - interval '2 hours 50 minutes')
  RETURNING id INTO m2;

  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, created_at) VALUES
    (gen_random_uuid(), ch_kitchen, ws_id, p_erik, 'Ja, leveransen kom kl 07. Alt er på plass i kjølerommet.', now() - interval '2 hours 45 minutes')
  RETURNING id INTO m3;

  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, reply_to_id, created_at) VALUES
    (gen_random_uuid(), ch_kitchen, ws_id, p_jon, 'Bra! Jeg starter med forrettene nå.', m2, now() - interval '2 hours 30 minutes')
  RETURNING id INTO m4;

  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, created_at) VALUES
    (gen_random_uuid(), ch_kitchen, ws_id, p_jonas, 'Trenger hjelp med dessertene — noen ledig om 30 min?', now() - interval '1 hour')
  RETURNING id INTO m5;

  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, reply_to_id, created_at) VALUES
    (gen_random_uuid(), ch_kitchen, ws_id, p_anna, 'Jeg kan hjelpe etter at hovedrettene er klare 👍', m5, now() - interval '50 minutes');

  -- #service — service team chat
  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, created_at) VALUES
    (gen_random_uuid(), ch_service, ws_id, p_sara, 'Bordplan for i kveld er oppdatert. Sjekk tavlen.', now() - interval '4 hours')
  RETURNING id INTO m6;

  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, created_at) VALUES
    (gen_random_uuid(), ch_service, ws_id, p_lise, 'Topp! Har vi noen reservasjoner med allergier i dag?', now() - interval '3 hours 45 minutes')
  RETURNING id INTO m7;

  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, created_at) VALUES
    (gen_random_uuid(), ch_service, ws_id, p_sara, 'Bord 7 har glutenfri, og bord 12 har nøtteallergi. Markert på reservasjonslisten.', now() - interval '3 hours 40 minutes');

  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, created_at) VALUES
    (gen_random_uuid(), ch_service, ws_id, p_kari, 'Husker! Jeg tar bord 7 og 8 i kveld.', now() - interval '3 hours 30 minutes');

  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, created_at) VALUES
    (gen_random_uuid(), ch_service, ws_id, p_silje, 'Jeg tar 10-14. Er det noen som bytter fredag?', now() - interval '2 hours');

  -- #bar
  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, created_at) VALUES
    (gen_random_uuid(), ch_bar, ws_id, p_ole, 'Vi er tom for Aperol. Bestilt mer, men kommer tidligst i morgen.', now() - interval '5 hours')
  RETURNING id INTO m8;

  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, created_at) VALUES
    (gen_random_uuid(), ch_bar, ws_id, p_admin, 'Ok, sett opp alternativ forslag til Aperol Spritz da. Campari?', now() - interval '4 hours 50 minutes');

  -- #generelt — all-hands channel
  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, message_type, created_at) VALUES
    (gen_random_uuid(), ch_general, ws_id, p_admin, 'Velkommen til den nye kanalen for alle ansatte! Her deler vi generell info.', 'announcement', now() - interval '1 day')
  RETURNING id INTO m9;

  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, created_at) VALUES
    (gen_random_uuid(), ch_general, ws_id, p_admin, 'Påminnelse: Personalmøte torsdag kl 14:00 i personalrommet.', now() - interval '6 hours')
  RETURNING id INTO m10;

  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, created_at) VALUES
    (gen_random_uuid(), ch_general, ws_id, p_erik, 'Kommer! Har vi en agenda?', now() - interval '5 hours 30 minutes');

  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, created_at) VALUES
    (gen_random_uuid(), ch_general, ws_id, p_admin, 'Ja, sender ut agenda i morgen. Hovedpunkter: ny meny, sommersesong, og ferieavvikling.', now() - interval '5 hours');

  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, created_at) VALUES
    (gen_random_uuid(), ch_general, ws_id, p_sara, 'Flott! Gleder meg 😊', now() - interval '4 hours 30 minutes');

  -- #nyheter — news (read-only, system announcements)
  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, message_type, origin_type, created_at) VALUES
    (gen_random_uuid(), ch_news, ws_id, p_admin, 'Ny sommermeny lanseres 1. april! Alle må fullføre opplæringen innen 28. mars.', 'announcement', 'system', now() - interval '2 days')
  RETURNING id INTO m11;

  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, message_type, origin_type, created_at) VALUES
    (gen_random_uuid(), ch_news, ws_id, p_admin, 'Gratulerer til Service-teamet som fikk beste kundetilfredshet denne uken! 🎉', 'announcement', 'system', now() - interval '1 day');

  -- DM: Anna <-> Erik
  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, created_at) VALUES
    (gen_random_uuid(), ch_dm_anna_erik, ws_id, p_anna, 'Hei Erik, kan jeg bytte vakt på lørdag?', now() - interval '6 hours')
  RETURNING id INTO m12;

  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, created_at) VALUES
    (gen_random_uuid(), ch_dm_anna_erik, ws_id, p_erik, 'Hei Anna! Ja, det kan vi ordne. Hvilken vakt vil du ha i stedet?', now() - interval '5 hours 45 minutes')
  RETURNING id INTO m13;

  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, created_at) VALUES
    (gen_random_uuid(), ch_dm_anna_erik, ws_id, p_anna, 'Søndag formiddag hadde passet best, hvis det er ledig.', now() - interval '5 hours 30 minutes');

  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, created_at) VALUES
    (gen_random_uuid(), ch_dm_anna_erik, ws_id, p_erik, 'Sjekker og kommer tilbake til deg! 👍', now() - interval '5 hours');

  -- DM: Admin <-> Sara
  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, created_at) VALUES
    (gen_random_uuid(), ch_dm_admin_sara, ws_id, p_admin, 'Sara, har du tid til et kort møte i morgen om sommersesongen?', now() - interval '3 hours')
  RETURNING id INTO m14;

  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, created_at) VALUES
    (gen_random_uuid(), ch_dm_admin_sara, ws_id, p_sara, 'Ja, det passer fint! Kl 10 eller 11?', now() - interval '2 hours 30 minutes')
  RETURNING id INTO m15;

  INSERT INTO channel_message (id, channel_id, workspace_id, sender_id, content, created_at) VALUES
    (gen_random_uuid(), ch_dm_admin_sara, ws_id, p_admin, 'Kl 10 er perfekt. Ses da!', now() - interval '2 hours');

  -- Team channel messages
  INSERT INTO channel_message (channel_id, workspace_id, sender_id, content, created_at) VALUES
    (ch_team_kitchen, ws_id, p_erik, 'A-team: Vi har mise en place-sjekk kl 15:00 i dag.', now() - interval '4 hours'),
    (ch_team_kitchen, ws_id, p_anna, 'Notert! Alle stasjoner klare.', now() - interval '3 hours 30 minutes'),
    (ch_team_kitchen, ws_id, p_jon, '👨‍🍳 Klar som et egg!', now() - interval '3 hours');

  INSERT INTO channel_message (channel_id, workspace_id, sender_id, content, created_at) VALUES
    (ch_team_service, ws_id, p_sara, 'Kveldsvakt: Husk å sjekke vinkartet — vi har 3 nye viner denne uken.', now() - interval '5 hours'),
    (ch_team_service, ws_id, p_lise, 'Spennende! Hvilke?', now() - interval '4 hours 45 minutes'),
    (ch_team_service, ws_id, p_sara, 'En Barolo, en Sancerre, og en Riesling. Notater ligger i vinboka.', now() - interval '4 hours 30 minutes'),
    (ch_team_service, ws_id, p_kari, 'Topp, tar en titt før vakten starter.', now() - interval '4 hours');

  -- ============================================================
  -- REACTIONS
  -- ============================================================

  INSERT INTO channel_message_reaction (message_id, channel_id, workspace_id, profile_id, emoji) VALUES
    (m1, ch_kitchen, ws_id, p_anna, '👍'),
    (m1, ch_kitchen, ws_id, p_jon, '👍'),
    (m1, ch_kitchen, ws_id, p_jonas, '✅'),
    (m3, ch_kitchen, ws_id, p_anna, '🙏'),
    (m5, ch_kitchen, ws_id, p_erik, '👀'),
    (m6, ch_service, ws_id, p_lise, '👍'),
    (m6, ch_service, ws_id, p_kari, '👍'),
    (m6, ch_service, ws_id, p_silje, '✅'),
    (m8, ch_bar, ws_id, p_admin, '👀'),
    (m9, ch_general, ws_id, p_erik, '🎉'),
    (m9, ch_general, ws_id, p_anna, '👋'),
    (m9, ch_general, ws_id, p_sara, '🎉'),
    (m9, ch_general, ws_id, p_lise, '❤️'),
    (m10, ch_general, ws_id, p_sara, '👍'),
    (m10, ch_general, ws_id, p_erik, '👍'),
    (m11, ch_news, ws_id, p_anna, '🎉'),
    (m11, ch_news, ws_id, p_sara, '🔥'),
    (m12, ch_dm_anna_erik, ws_id, p_erik, '👋');

  -- ============================================================
  -- UPDATE READ POINTERS (simulate some unread state)
  -- Admin has read everything except last messages
  -- Others have some unread
  -- ============================================================

  UPDATE channel_member SET last_read_message_id = m9
    WHERE channel_id = ch_general AND profile_id = p_admin;

  UPDATE channel_member SET last_read_message_id = m1
    WHERE channel_id = ch_kitchen AND profile_id = p_anna;

  UPDATE channel_member SET last_read_message_id = m6
    WHERE channel_id = ch_service AND profile_id = p_sara;

  RAISE NOTICE 'Channel seed data inserted successfully';
END $$;
