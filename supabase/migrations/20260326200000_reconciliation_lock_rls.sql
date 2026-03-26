-- 20260326200000_reconciliation_lock_rls.sql
--
-- Split the existing FOR ALL jwt_manage policy into separate command policies
-- so we can add lock enforcement on UPDATE only.
-- The USING clause on UPDATE checks that locked_at IS NULL (old row).
-- This allows the lock action itself (setting locked_at on an unlocked row)
-- but prevents any further edits after lock.

-- Step 1: Drop the existing FOR ALL policy
DROP POLICY IF EXISTS "jwt_manage_daily_reconciliation" ON daily_reconciliation;

-- Step 2: Re-create as separate command policies with lock enforcement on UPDATE

-- INSERT: admin/owner/manager can create reconciliation records
CREATE POLICY "jwt_insert_daily_reconciliation" ON daily_reconciliation
FOR INSERT WITH CHECK (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM public.profile
    WHERE user_id = auth.uid() AND workspace_id = daily_reconciliation.workspace_id
    AND role IN ('admin', 'owner', 'manager')
  )
);

-- UPDATE: admin/owner/manager can update ONLY if day is not locked
CREATE POLICY "jwt_update_daily_reconciliation" ON daily_reconciliation
FOR UPDATE USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM public.profile
    WHERE user_id = auth.uid() AND workspace_id = daily_reconciliation.workspace_id
    AND role IN ('admin', 'owner', 'manager')
  )
  AND locked_at IS NULL
);

-- DELETE: admin/owner/manager can delete reconciliation records
CREATE POLICY "jwt_delete_daily_reconciliation" ON daily_reconciliation
FOR DELETE USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM public.profile
    WHERE user_id = auth.uid() AND workspace_id = daily_reconciliation.workspace_id
    AND role IN ('admin', 'owner', 'manager')
  )
);
