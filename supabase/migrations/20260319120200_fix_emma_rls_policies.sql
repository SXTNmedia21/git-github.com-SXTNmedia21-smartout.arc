-- Fix RLS gaps in emma_task and emma_note tables.
--
-- 1. emma_task: write policy allows any workspace member to modify any other
--    member's tasks. Fix: scope writes to own profile_id.
-- 2. emma_note: missing DELETE policy — users can't delete their own notes.

-- ── emma_task: replace broad write policy with profile-scoped one ──

DROP POLICY IF EXISTS "emma_task_jwt_write" ON emma_task;

-- INSERT: must be own profile within workspace
CREATE POLICY "emma_task_jwt_insert" ON emma_task
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND profile_id IN (
      SELECT p.profile_id FROM profile p
      WHERE p.user_id = auth.uid() AND p.is_active = true
    )
  );

-- UPDATE: can only update own tasks
CREATE POLICY "emma_task_jwt_update" ON emma_task
  FOR UPDATE USING (
    profile_id IN (
      SELECT p.profile_id FROM profile p
      WHERE p.user_id = auth.uid() AND p.is_active = true
    )
  );

-- DELETE: can only delete own tasks
CREATE POLICY "emma_task_jwt_delete" ON emma_task
  FOR DELETE USING (
    profile_id IN (
      SELECT p.profile_id FROM profile p
      WHERE p.user_id = auth.uid() AND p.is_active = true
    )
  );

-- ── emma_note: add missing DELETE policy ──

CREATE POLICY "emma_note_delete_own" ON emma_note
  FOR DELETE USING (
    profile_id IN (
      SELECT p.profile_id FROM profile p
      WHERE p.user_id = auth.uid() AND p.is_active = true
    )
  );
