-- M2: announcement_meta sidecar table + RLS.
-- 1:1 with channel_message via PK FK ON DELETE CASCADE.
-- Write path is SECURITY DEFINER RPC only (publish_announcement_atomic).
-- ADR-0369, ADR-0370, ADR-0371.

CREATE TABLE public.announcement_meta (
  message_id              uuid        PRIMARY KEY
                                      REFERENCES public.channel_message(id) ON DELETE CASCADE,
  workspace_id            uuid        NOT NULL
                                      REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  kind                    public.announcement_kind    NOT NULL,
  tier                    public.announcement_tier    NOT NULL DEFAULT 'work',
  tags                    text[]      NOT NULL DEFAULT '{}',
  linked_entity_type      public.announcement_link_type,
  linked_entity_id        uuid,
  tier_overridden         boolean     NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),

  -- Constraint: policy_update always links to policy, other kinds allow optional link.
  -- external/new_hire/new_menu/staff_event/schedule_change all allow NULL or specific type.
  CONSTRAINT meta_kind_link_consistent CHECK (
    CASE kind
      WHEN 'general'         THEN linked_entity_type IS NULL
      WHEN 'staff_event'     THEN linked_entity_type IS NULL OR linked_entity_type = 'staff_event'
      WHEN 'new_hire'        THEN linked_entity_type IS NULL OR linked_entity_type = 'profile'
      WHEN 'policy_update'   THEN linked_entity_type = 'policy'
      WHEN 'schedule_change' THEN linked_entity_type IS NULL OR linked_entity_type = 'schedule_shift'
      WHEN 'new_menu'        THEN linked_entity_type IS NULL OR linked_entity_type IN ('menu_document', 'external_url')
      WHEN 'external'        THEN linked_entity_type IS NULL OR linked_entity_type = 'external_url'
      ELSE false
    END
  ),

  -- Constraint: link pair must both be NULL or both be non-NULL (no orphan type or id).
  CONSTRAINT meta_link_pair_consistent CHECK (
    (linked_entity_type IS NULL AND linked_entity_id IS NULL) OR
    (linked_entity_type IS NOT NULL AND linked_entity_id IS NOT NULL)
  )
);

COMMENT ON TABLE public.announcement_meta IS
  'Sidecar for channel_message rows with message_type=''announcement''. Carries kind/tier/tags/entity-link classification. Write path is exclusively publish_announcement_atomic SECURITY DEFINER RPC (ADR-0369). Deleted automatically via ON DELETE CASCADE when parent channel_message is deleted.';

-- Indexes
CREATE INDEX idx_meta_workspace_kind ON public.announcement_meta (workspace_id, kind);
CREATE INDEX idx_meta_workspace_tier ON public.announcement_meta (workspace_id, tier);
CREATE INDEX idx_meta_tags_gin       ON public.announcement_meta USING GIN (tags);
CREATE INDEX idx_meta_link           ON public.announcement_meta (linked_entity_type, linked_entity_id)
                                     WHERE linked_entity_id IS NOT NULL;

-- updated_at trigger (reuse existing set_updated_at if available, else define inline)
-- announcement_meta is effectively immutable after publish; trigger added for future
-- edit-after-publish sortie compatibility.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'set_updated_at'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    EXECUTE $q$
      CREATE TRIGGER set_announcement_meta_updated_at
        BEFORE UPDATE ON public.announcement_meta
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    $q$;
  END IF;
END;
$$;

-- RLS
ALTER TABLE public.announcement_meta ENABLE ROW LEVEL SECURITY;

-- JWT SELECT: member of parent channel who can see the message.
-- Scope: authenticated user must be a non-departed member of the channel,
-- and message must be visible (all_members OR targeted at caller).
CREATE POLICY "meta_jwt_select" ON public.announcement_meta
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.channel_message cm
      JOIN public.channel_member cmem
        ON cmem.channel_id = cm.channel_id
       AND cmem.profile_id = auth.uid()
       AND cmem.left_at IS NULL
      WHERE cm.id = announcement_meta.message_id
        AND (
          cm.visibility_scope = 'all_members'
          OR cm.target_profile_ids @> ARRAY[auth.uid()]
        )
    )
  );

-- JWT UPDATE: own message sender + manager+ in workspace.
-- Future edit-after-publish path (no application code uses this yet).
CREATE POLICY "meta_jwt_update" ON public.announcement_meta
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.channel_message cm
      WHERE cm.id = announcement_meta.message_id
        AND cm.sender_id = auth.uid()
    )
    AND public.is_manager_in_workspace(auth.uid(), workspace_id)
  );

-- No INSERT policy: SECURITY DEFINER RPC is the sole write path.
-- RLS blocks direct INSERT attempts from authenticated clients.
-- No DELETE policy: cascade from parent channel_message (ON DELETE CASCADE).

-- API key SELECT: workspace-scoped integrations per dual-auth convention.
-- smartout-database-guide: every workspace-scoped table needs JWT + API key policy.
CREATE POLICY "meta_api_select" ON public.announcement_meta
  FOR SELECT
  USING (workspace_id = public.get_api_workspace_id());
