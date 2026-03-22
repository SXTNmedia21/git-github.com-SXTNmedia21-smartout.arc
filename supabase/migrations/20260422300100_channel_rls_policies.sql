-- Channel Communications — RLS Policies
-- Child tables authorize via channel membership, not generic workspace membership.
-- Admin/config tables use workspace-scoped policies.

--------------------------------------------------------------------------------
-- Helper subquery (used throughout):
-- SELECT profile_id FROM profile WHERE user_id = auth.uid()
--------------------------------------------------------------------------------

--------------------------------------------------------------------------------
-- channel
--------------------------------------------------------------------------------

-- SELECT: active member of the channel
CREATE POLICY "channel_jwt_select" ON channel FOR SELECT USING (
  id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND left_at IS NULL
  )
);

-- INSERT: only custom/direct types, must be workspace member
CREATE POLICY "channel_jwt_insert" ON channel FOR INSERT WITH CHECK (
  channel_type IN ('custom', 'direct')
  AND workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);

-- UPDATE: channel admin only
CREATE POLICY "channel_jwt_update" ON channel FOR UPDATE USING (
  id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND role = 'admin'
    AND left_at IS NULL
  )
);

-- API key: workspace-scoped read
CREATE POLICY "channel_api_select" ON channel FOR SELECT
  USING (workspace_id = get_api_workspace_id());

--------------------------------------------------------------------------------
-- channel_member
--------------------------------------------------------------------------------

-- SELECT: members of channels you belong to
CREATE POLICY "channel_member_jwt_select" ON channel_member FOR SELECT USING (
  channel_id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND left_at IS NULL
  )
);

-- INSERT: channel admin can add members
CREATE POLICY "channel_member_jwt_insert" ON channel_member FOR INSERT WITH CHECK (
  channel_id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND role = 'admin'
    AND left_at IS NULL
  )
);

-- UPDATE: own record only (mute, read pointer)
CREATE POLICY "channel_member_jwt_update" ON channel_member FOR UPDATE USING (
  profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);

-- DELETE: self or admin
CREATE POLICY "channel_member_jwt_delete" ON channel_member FOR DELETE USING (
  profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
  OR channel_id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND role = 'admin'
    AND left_at IS NULL
  )
);

-- API key: workspace-scoped
CREATE POLICY "channel_member_api_select" ON channel_member FOR SELECT
  USING (workspace_id = get_api_workspace_id());

--------------------------------------------------------------------------------
-- channel_message
--------------------------------------------------------------------------------

-- SELECT: channel member + visibility scope check
CREATE POLICY "channel_message_jwt_select" ON channel_message FOR SELECT USING (
  channel_id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND left_at IS NULL
  )
  AND (
    visibility_scope = 'all_members'
    OR (visibility_scope = 'admins' AND channel_id IN (
      SELECT channel_id FROM channel_member
      WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
      AND role = 'admin' AND left_at IS NULL
    ))
    OR (visibility_scope = 'targeted_members' AND (
      sender_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
      OR target_profile_ids && ARRAY(SELECT profile_id FROM profile WHERE user_id = auth.uid())
    ))
  )
);

-- INSERT: membership + sender = self
CREATE POLICY "channel_message_jwt_insert" ON channel_message FOR INSERT WITH CHECK (
  channel_id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND left_at IS NULL
  )
  AND sender_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);

-- UPDATE: own messages only
CREATE POLICY "channel_message_jwt_update" ON channel_message FOR UPDATE USING (
  sender_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);

-- DELETE: own messages only (soft delete via deleted_at)
CREATE POLICY "channel_message_jwt_delete" ON channel_message FOR DELETE USING (
  sender_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);

-- API key: workspace-scoped
CREATE POLICY "channel_message_api_select" ON channel_message FOR SELECT
  USING (workspace_id = get_api_workspace_id());

--------------------------------------------------------------------------------
-- channel_event
--------------------------------------------------------------------------------

-- SELECT: channel member
CREATE POLICY "channel_event_jwt_select" ON channel_event FOR SELECT USING (
  channel_id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND left_at IS NULL
  )
);

-- INSERT: service role only (no JWT insert policy)

-- API key: workspace-scoped
CREATE POLICY "channel_event_api_select" ON channel_event FOR SELECT
  USING (workspace_id = get_api_workspace_id());

--------------------------------------------------------------------------------
-- channel_message_reaction (membership-scoped)
--------------------------------------------------------------------------------

CREATE POLICY "reaction_jwt_select" ON channel_message_reaction FOR SELECT USING (
  channel_id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND left_at IS NULL
  )
);

CREATE POLICY "reaction_jwt_insert" ON channel_message_reaction FOR INSERT WITH CHECK (
  channel_id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND left_at IS NULL
  )
  AND profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);

CREATE POLICY "reaction_jwt_delete" ON channel_message_reaction FOR DELETE USING (
  profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);

CREATE POLICY "reaction_api_select" ON channel_message_reaction FOR SELECT
  USING (workspace_id = get_api_workspace_id());

--------------------------------------------------------------------------------
-- channel_message_attachment (membership-scoped)
--------------------------------------------------------------------------------

CREATE POLICY "attachment_jwt_select" ON channel_message_attachment FOR SELECT USING (
  channel_id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND left_at IS NULL
  )
);

CREATE POLICY "attachment_jwt_insert" ON channel_message_attachment FOR INSERT WITH CHECK (
  channel_id IN (
    SELECT channel_id FROM channel_member
    WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
    AND left_at IS NULL
  )
);

CREATE POLICY "attachment_api_select" ON channel_message_attachment FOR SELECT
  USING (workspace_id = get_api_workspace_id());

--------------------------------------------------------------------------------
-- channel_message_read (membership-scoped)
--------------------------------------------------------------------------------

CREATE POLICY "read_jwt_select" ON channel_message_read FOR SELECT USING (
  message_id IN (
    SELECT id FROM channel_message
    WHERE channel_id IN (
      SELECT channel_id FROM channel_member
      WHERE profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
      AND left_at IS NULL
    )
  )
);

CREATE POLICY "read_jwt_insert" ON channel_message_read FOR INSERT WITH CHECK (
  profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);

CREATE POLICY "read_api_select" ON channel_message_read FOR SELECT
  USING (workspace_id = get_api_workspace_id());

--------------------------------------------------------------------------------
-- Admin/config tables (workspace-scoped)
-- channel_integration, channel_notification_policy, channel_ai_policy, channel_retention_policy
--------------------------------------------------------------------------------

-- channel_integration
CREATE POLICY "integration_jwt_select" ON channel_integration FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "integration_jwt_insert" ON channel_integration FOR INSERT
  WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (SELECT 1 FROM profile WHERE user_id = auth.uid() AND workspace_id = channel_integration.workspace_id AND role IN ('admin', 'owner')));
CREATE POLICY "integration_jwt_update" ON channel_integration FOR UPDATE
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (SELECT 1 FROM profile WHERE user_id = auth.uid() AND workspace_id = channel_integration.workspace_id AND role IN ('admin', 'owner')));
CREATE POLICY "integration_api_select" ON channel_integration FOR SELECT
  USING (workspace_id = get_api_workspace_id());

-- channel_notification_policy
CREATE POLICY "notification_policy_jwt_select" ON channel_notification_policy FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "notification_policy_jwt_insert" ON channel_notification_policy FOR INSERT
  WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (SELECT 1 FROM profile WHERE user_id = auth.uid() AND workspace_id = channel_notification_policy.workspace_id AND role IN ('admin', 'owner')));
CREATE POLICY "notification_policy_jwt_update" ON channel_notification_policy FOR UPDATE
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (SELECT 1 FROM profile WHERE user_id = auth.uid() AND workspace_id = channel_notification_policy.workspace_id AND role IN ('admin', 'owner')));
CREATE POLICY "notification_policy_api_select" ON channel_notification_policy FOR SELECT
  USING (workspace_id = get_api_workspace_id());

-- channel_ai_policy
CREATE POLICY "ai_policy_jwt_select" ON channel_ai_policy FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "ai_policy_jwt_insert" ON channel_ai_policy FOR INSERT
  WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (SELECT 1 FROM profile WHERE user_id = auth.uid() AND workspace_id = channel_ai_policy.workspace_id AND role IN ('admin', 'owner')));
CREATE POLICY "ai_policy_jwt_update" ON channel_ai_policy FOR UPDATE
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (SELECT 1 FROM profile WHERE user_id = auth.uid() AND workspace_id = channel_ai_policy.workspace_id AND role IN ('admin', 'owner')));
CREATE POLICY "ai_policy_api_select" ON channel_ai_policy FOR SELECT
  USING (workspace_id = get_api_workspace_id());

-- channel_retention_policy
CREATE POLICY "retention_policy_jwt_select" ON channel_retention_policy FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));
CREATE POLICY "retention_policy_jwt_insert" ON channel_retention_policy FOR INSERT
  WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (SELECT 1 FROM profile WHERE user_id = auth.uid() AND workspace_id = channel_retention_policy.workspace_id AND role IN ('admin', 'owner')));
CREATE POLICY "retention_policy_jwt_update" ON channel_retention_policy FOR UPDATE
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (SELECT 1 FROM profile WHERE user_id = auth.uid() AND workspace_id = channel_retention_policy.workspace_id AND role IN ('admin', 'owner')));
CREATE POLICY "retention_policy_api_select" ON channel_retention_policy FOR SELECT
  USING (workspace_id = get_api_workspace_id());
