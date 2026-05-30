-- ============ DEMO RESTAURANT CANONICAL ID MAP (do not edit per-file) ============
-- COMPANY        a0000000-0000-0000-0000-000000000000  Smartout AS
-- WORKSPACE      b0000000-0000-0000-0000-000000000000  "Demo Restaurant"
-- LOCATION       c0000000-0000-0000-0000-000000000000  Oslo Downtown Hub
-- ZONE Hovedsal  d1000000-0000-0000-0000-000000000001  | Terrasse d1…2 | Bar d1…3 | Privat d1…4
-- DEPT Operations d0000000-0000-0000-0000-000000000000 | Kitchen d0…1 | Service d0…2 | Bar d0…3
-- PROFILES f0000000-…-{0..9} + new {a..d}; AUTH e0000000-…-{0..9} + new {a..d}
-- LOCAL ONLY — never prod. Idempotent (upsert). password = password123
-- =================================================================================
--
-- FILE: 50-communication.sql
-- PURPOSE: Internal comms layer — channels + group chat + messages.
--   comm_channel_type enum: {department,team,session,custom,direct,news,skill,desk,query_thread,ai}
--   chat_conversation_type enum: {group,dm,ai}
--   channel.created_by → profile(profile_id)
--   chat_message.sender_id → profile(profile_id)
--   UNIQUE: one active channel per department_id, one per team_id
-- =================================================================================

SET search_path = public, extensions, pg_catalog;

-- ============================================================
-- PROBE: tables that are expected absent — log, do not fail
-- ============================================================
DO $$ BEGIN
  IF to_regclass('public.desk') IS NOT NULL THEN
    RAISE NOTICE 'desk exists — consider seeding';
  ELSE
    RAISE NOTICE 'SKIP desk: absent (deferred)';
  END IF;

  IF to_regclass('public.announcement') IS NOT NULL THEN
    RAISE NOTICE 'announcement table exists — consider seeding';
  ELSE
    RAISE NOTICE 'SKIP announcement: only announcement_meta exists (deferred — requires channel_message FK)';
  END IF;
END $$;

-- ============================================================
-- IDEMPOTENCY TEARDOWN (chat_message → chat_participant → chat_conversation → channel)
-- Use literal IDs so cascade deletes are predictable.
-- ============================================================
BEGIN;

-- chat_message is deleted via CASCADE from chat_conversation, but we delete explicitly
-- in case FK is NO ACTION in some migration variant.
DELETE FROM public.chat_message
  WHERE conversation_id IN (
    SELECT id FROM public.chat_conversation
    WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
  );

DELETE FROM public.chat_participant
  WHERE conversation_id IN (
    SELECT id FROM public.chat_conversation
    WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
  );

DELETE FROM public.chat_conversation
  WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- channel dependents: channel_member, channel_message (used by announcement_meta), etc.
-- Delete in dependency order before removing channels.
DELETE FROM public.channel_member
  WHERE channel_id IN (
    SELECT id FROM public.channel
    WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
  );

-- channel_message (+ announcement_meta cascades from it) if present
DO $$ BEGIN
  IF to_regclass('public.channel_message') IS NOT NULL THEN
    DELETE FROM public.channel_message
      WHERE channel_id IN (
        SELECT id FROM public.channel
        WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000'
      );
  END IF;
END $$;

DELETE FROM public.channel
  WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';

-- ============================================================
-- CHANNELS
-- Literal UUIDs so later files (e.g. announcements) can reference by ID.
--
-- c0000010-… = Generelt (custom, workspace-wide)
-- c0000011-… = Kjøkken (department, Kitchen d0…1)
-- c0000012-… = Service (department, Service d0…2)
-- c0000013-… = Bar (department, Bar d0…3)
--
-- NOTE: UNIQUE(department_id) WHERE is_archived=false — one channel per dept.
-- ============================================================
INSERT INTO public.channel
  (id, workspace_id, channel_type, name, description, created_by,
   department_id, team_id, is_read_only, is_archived, is_active)
VALUES
  -- Workspace-wide general channel
  ('c0000010-0000-0000-0000-000000000000',
   'b0000000-0000-0000-0000-000000000000',
   'custom',
   'Generelt',
   'Nyheter og meldinger for hele restauranten',
   'f0000000-0000-0000-0000-000000000000', -- Local Admin
   NULL, NULL, false, false, true),

  -- Kitchen department channel
  ('c0000011-0000-0000-0000-000000000000',
   'b0000000-0000-0000-0000-000000000000',
   'department',
   'Kjøkken',
   'Intern kanal for kjøkkenteamet',
   'f0000000-0000-0000-0000-000000000000', -- Local Admin
   'd0000000-0000-0000-0000-000000000001', -- Kitchen dept
   NULL, false, false, true),

  -- Service department channel
  ('c0000012-0000-0000-0000-000000000000',
   'b0000000-0000-0000-0000-000000000000',
   'department',
   'Service',
   'Intern kanal for serveringsteamet',
   'f0000000-0000-0000-0000-000000000000', -- Local Admin
   'd0000000-0000-0000-0000-000000000002', -- Service dept
   NULL, false, false, true),

  -- Bar department channel
  ('c0000013-0000-0000-0000-000000000000',
   'b0000000-0000-0000-0000-000000000000',
   'department',
   'Bar',
   'Intern kanal for barteamet',
   'f0000000-0000-0000-0000-000000000000', -- Local Admin
   'd0000000-0000-0000-0000-000000000003', -- Bar dept
   NULL, false, false, true)

ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  is_archived = EXCLUDED.is_archived,
  is_active   = EXCLUDED.is_active;

-- ============================================================
-- CHAT CONVERSATION
-- Literal UUID: cc000001-… = Lederteam
-- ============================================================
INSERT INTO public.chat_conversation
  (id, workspace_id, type, name, description, created_by, is_archived, is_featured)
VALUES
  ('cc000001-0000-0000-0000-000000000000',
   'b0000000-0000-0000-0000-000000000000',
   'group',
   'Lederteam',
   'Koordinering mellom admin og ledere',
   'f0000000-0000-0000-0000-000000000000', -- Local Admin
   false, true)

ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  is_archived = EXCLUDED.is_archived,
  is_featured = EXCLUDED.is_featured;

-- ============================================================
-- CHAT PARTICIPANTS (required for RLS — members who can read/write)
-- ============================================================
INSERT INTO public.chat_participant
  (conversation_id, profile_id, role, joined_at)
VALUES
  ('cc000001-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000000', 'admin',  now() - interval '7 days'),
  ('cc000001-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', 'member', now() - interval '7 days'),
  ('cc000001-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000002', 'member', now() - interval '7 days')

ON CONFLICT DO NOTHING;

-- ============================================================
-- CHAT MESSAGES  (no workspace_id column — scoped via conversation_id)
-- Sender IDs: f0…0 = Admin, f0…1 = Anna, f0…2 = Erik
-- Date-dynamic: now() - interval 'N hours'
-- ============================================================
INSERT INTO public.chat_message
  (id, conversation_id, sender_id, content, is_system, reactions, attachments, created_at)
VALUES
  -- Conversation thread: Lederteam
  ('dd000001-0000-0000-0000-000000000001',
   'cc000001-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000000', -- Admin
   'God morgen alle! Husk briefing kl. 10 i dag.',
   false, '{}', '[]',
   now() - interval '26 hours'),

  ('dd000002-0000-0000-0000-000000000001',
   'cc000001-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', -- Anna
   'Takk! Jeg har sett over onboardingsstatus — Jonas er klar til godkjenning.',
   false, '{}', '[]',
   now() - interval '25 hours'),

  ('dd000003-0000-0000-0000-000000000001',
   'cc000001-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000002', -- Erik
   'Kjøkkenet er bemannet. Vi mangler én på kvelds — kan noen sjekke ledige vakter?',
   false, '{}', '[]',
   now() - interval '24 hours'),

  ('dd000004-0000-0000-0000-000000000001',
   'cc000001-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000000', -- Admin
   'Sjekket — Mats kan ta kvelden. Sender ham en forespørsel nå.',
   false, '{"👍": ["f0000000-0000-0000-0000-000000000001"]}', '[]',
   now() - interval '23 hours'),

  ('dd000005-0000-0000-0000-000000000001',
   'cc000001-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000001', -- Anna
   'Perfekt. Da er vi oppe i full styrke til helgen. 🎉',
   false, '{}', '[]',
   now() - interval '22 hours'),

  ('dd000006-0000-0000-0000-000000000001',
   'cc000001-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000002', -- Erik
   'God plan. Jeg passer på at kjøkkenrutinene er oppdatert innen i morgen.',
   false, '{}', '[]',
   now() - interval '6 hours'),

  ('dd000007-0000-0000-0000-000000000001',
   'cc000001-0000-0000-0000-000000000000',
   'f0000000-0000-0000-0000-000000000000', -- Admin
   'Super. Vi ses på briefing kl. 10. Ha en god service!',
   false, '{"🙌": ["f0000000-0000-0000-0000-000000000001", "f0000000-0000-0000-0000-000000000002"]}', '[]',
   now() - interval '1 hour')

ON CONFLICT (id) DO NOTHING;

COMMIT;
