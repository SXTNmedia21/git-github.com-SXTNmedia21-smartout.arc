-- 20260620141000_celebration_publication_table.sql
--
-- WHY: Idempotency guard for birthday auto-publish pipe (ADR-0372 Q9).
--   The hourly pg_cron + Edge Function can fire multiple times per day.
--   UNIQUE(workspace_id, profile_id, celebration_kind, celebration_date) prevents
--   double-posting at the persistence layer — no app-layer deduplication needed.
--
-- Write path: SECURITY DEFINER publish_announcement_atomic RPC only (via celebration branch).
-- No app INSERT/UPDATE/DELETE policies — RPC writes directly as service_role.
-- Read path: manager+ can audit which celebrations have fired (manager-read policy).
--
-- Also updates the meta_kind_link_consistent CHECK to include celebration and system_message
-- branches (celebration links to profile | NULL; system_message allows NULL).
--
-- ADR-0372 (bursdag auto-publish pipe), ADR-0369 (RPC atomicity), ADR-0371 (schema contract).

-- ── 1. celebration_publication table ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.celebration_publication (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid        NOT NULL
                                  REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  profile_id          uuid        NOT NULL
                                  REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  celebration_kind    text        NOT NULL CHECK (celebration_kind IN ('birthday', 'work_anniversary')),
  celebration_date    date        NOT NULL,
  message_id          uuid        REFERENCES public.channel_message(id) ON DELETE SET NULL,
  published_at        timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT celebration_publication_unique
    UNIQUE (workspace_id, profile_id, celebration_kind, celebration_date)
);

COMMENT ON TABLE public.celebration_publication IS
  'Idempotency guard for birthday/anniversary auto-publish pipe (ADR-0372). '
  'One row per workspace+profile+kind+date combination. UNIQUE constraint prevents '
  'double-posting under pg_cron retry. Write path is publish_announcement_atomic SECURITY '
  'DEFINER RPC only. manager+ can read for audit; no app-layer INSERT/UPDATE/DELETE.';

-- ── 2. Indexes ────────────────────────────────────────────────────────────────

-- Primary lookup: "has this person already been celebrated today in this workspace?"
CREATE INDEX IF NOT EXISTS idx_celeb_pub_workspace_date
  ON public.celebration_publication (workspace_id, celebration_date, celebration_kind);

-- Profile-level audit: "when was this person last celebrated?"
CREATE INDEX IF NOT EXISTS idx_celeb_pub_profile
  ON public.celebration_publication (profile_id, celebration_kind, celebration_date DESC);

-- ── 3. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.celebration_publication ENABLE ROW LEVEL SECURITY;

-- Manager+ can read celebration audit log for their workspace.
-- Employees cannot see who was celebrated (privacy: celebration is public post, not HR record).
CREATE POLICY "celeb_pub_manager_select" ON public.celebration_publication
  FOR SELECT TO authenticated
  USING (
    public.is_manager_in_workspace(auth.uid(), workspace_id)
  );

-- No INSERT/UPDATE/DELETE policies — SECURITY DEFINER RPC is sole write path.
-- service_role bypasses RLS entirely (Supabase default behavior).

-- API key read (dual-auth convention per smartout-database-guide).
CREATE POLICY "celeb_pub_api_select" ON public.celebration_publication
  FOR SELECT
  USING (workspace_id = public.get_api_workspace_id());

-- ── 4. Patch meta_kind_link_consistent CHECK to include new enum values ──────
--
-- celebration: links to profile (whose birthday it is) OR NULL.
-- system_message: no entity link (pure text operational message).
-- Both values were added to announcement_kind in 20260620140700.
-- The CHECK constraint must be updated before publish_announcement_atomic can use them.

ALTER TABLE public.announcement_meta
  DROP CONSTRAINT IF EXISTS meta_kind_link_consistent;

ALTER TABLE public.announcement_meta
  ADD CONSTRAINT meta_kind_link_consistent CHECK (
    CASE kind
      WHEN 'general'         THEN linked_entity_type IS NULL
      WHEN 'staff_event'     THEN linked_entity_type IS NULL OR linked_entity_type = 'staff_event'
      WHEN 'new_hire'        THEN linked_entity_type IS NULL OR linked_entity_type = 'profile'
      WHEN 'policy_update'   THEN linked_entity_type = 'policy'
      WHEN 'schedule_change' THEN linked_entity_type IS NULL OR linked_entity_type = 'schedule_shift'
      WHEN 'new_menu'        THEN linked_entity_type IS NULL OR linked_entity_type IN ('menu_document', 'external_url')
      WHEN 'external'        THEN linked_entity_type IS NULL OR linked_entity_type = 'external_url'
      WHEN 'celebration'     THEN linked_entity_type IS NULL OR linked_entity_type = 'profile'
      WHEN 'system_message'  THEN linked_entity_type IS NULL
      ELSE false
    END
  );

COMMENT ON CONSTRAINT meta_kind_link_consistent ON public.announcement_meta IS
  'Enforces coherent (kind, linked_entity_type) pairs. celebration links to profile | NULL. '
  'system_message allows NULL only. policy_update requires policy link. All other kinds allow '
  'NULL or the appropriate link type. Updated by 20260620141000 to include celebration + system_message.';
