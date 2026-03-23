-- RLS policies for websites.* schema
-- All reads and writes restricted to workspace admins/owners only.
-- Public reads go through SECURITY DEFINER RPC functions.

BEGIN;

-- ============================================================
-- websites.website
-- ============================================================
CREATE POLICY "admins_read_website"
  ON websites.website FOR SELECT
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );

CREATE POLICY "admins_write_website"
  ON websites.website FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );

CREATE POLICY "admins_update_website"
  ON websites.website FOR UPDATE
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );

CREATE POLICY "admins_delete_website"
  ON websites.website FOR DELETE
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- website_page
CREATE POLICY "admins_select_website_page" ON websites.website_page FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_insert_website_page" ON websites.website_page FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_update_website_page" ON websites.website_page FOR UPDATE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_delete_website_page" ON websites.website_page FOR DELETE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));

-- website_section
CREATE POLICY "admins_select_website_section" ON websites.website_section FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_insert_website_section" ON websites.website_section FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_update_website_section" ON websites.website_section FOR UPDATE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_delete_website_section" ON websites.website_section FOR DELETE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));

-- website_menu
CREATE POLICY "admins_select_website_menu" ON websites.website_menu FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_insert_website_menu" ON websites.website_menu FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_update_website_menu" ON websites.website_menu FOR UPDATE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_delete_website_menu" ON websites.website_menu FOR DELETE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));

-- website_menu_category
CREATE POLICY "admins_select_website_menu_category" ON websites.website_menu_category FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_insert_website_menu_category" ON websites.website_menu_category FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_update_website_menu_category" ON websites.website_menu_category FOR UPDATE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_delete_website_menu_category" ON websites.website_menu_category FOR DELETE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));

-- website_menu_item
CREATE POLICY "admins_select_website_menu_item" ON websites.website_menu_item FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_insert_website_menu_item" ON websites.website_menu_item FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_update_website_menu_item" ON websites.website_menu_item FOR UPDATE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_delete_website_menu_item" ON websites.website_menu_item FOR DELETE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));

-- website_asset
CREATE POLICY "admins_select_website_asset" ON websites.website_asset FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_insert_website_asset" ON websites.website_asset FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_update_website_asset" ON websites.website_asset FOR UPDATE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_delete_website_asset" ON websites.website_asset FOR DELETE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));

-- website_published_snapshot
CREATE POLICY "admins_select_website_snapshot" ON websites.website_published_snapshot FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_insert_website_snapshot" ON websites.website_published_snapshot FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_update_website_snapshot" ON websites.website_published_snapshot FOR UPDATE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));

-- website_draft_revision
CREATE POLICY "admins_select_website_revision" ON websites.website_draft_revision FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_insert_website_revision" ON websites.website_draft_revision FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));

-- website_domain
CREATE POLICY "admins_select_website_domain" ON websites.website_domain FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_insert_website_domain" ON websites.website_domain FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_update_website_domain" ON websites.website_domain FOR UPDATE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));

-- website_preview_session
CREATE POLICY "admins_select_website_preview" ON websites.website_preview_session FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_insert_website_preview" ON websites.website_preview_session FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_update_website_preview" ON websites.website_preview_session FOR UPDATE
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));

-- website_publish_event
CREATE POLICY "admins_select_website_publish_event" ON websites.website_publish_event FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));
CREATE POLICY "admins_insert_website_publish_event" ON websites.website_publish_event FOR INSERT
  WITH CHECK (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND public.is_admin_in_workspace(auth.uid(), workspace_id));

COMMIT;
