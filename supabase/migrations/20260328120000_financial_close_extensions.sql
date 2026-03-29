-- Financial Close Extensions
-- Extends daily_reconciliation and settlement_image for Module 4.5 employee-initiated settlement.
-- See spec: docs/superpowers/specs/2026-03-28-financial-esp-alignment-design.md

-- 1. Extend daily_reconciliation with cash handling columns
ALTER TABLE daily_reconciliation ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES profile(profile_id);
ALTER TABLE daily_reconciliation ADD COLUMN IF NOT EXISTS cash_counted numeric(12,2);
ALTER TABLE daily_reconciliation ADD COLUMN IF NOT EXISTS cash_expected numeric(12,2);
ALTER TABLE daily_reconciliation ADD COLUMN IF NOT EXISTS cash_difference numeric(12,2);

-- 2. Add image classification to settlement_image
DO $$ BEGIN
  CREATE TYPE close_image_type AS ENUM (
    'isettle_settlement', 'pos_closing_screen', 'z_report',
    'cash_drawer', 'receipt_bundle', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE settlement_image ADD COLUMN IF NOT EXISTS image_type close_image_type DEFAULT 'other';
ALTER TABLE settlement_image ADD COLUMN IF NOT EXISTS captured_by uuid REFERENCES profile(profile_id);
ALTER TABLE settlement_image ADD COLUMN IF NOT EXISTS parse_status text DEFAULT 'pending';

-- 3. Unique constraint for upsert support
-- Already exists as uq_recon_date(workspace_id, department_id, reconciliation_date) — skip.

-- 4. RLS: allow on-shift employees to submit reconciliation
CREATE POLICY "shift_employee_can_settle"
  ON daily_reconciliation FOR UPDATE
  USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM schedule_shift ss
      JOIN profile p ON p.profile_id = ss.employee_id
      WHERE ss.shift_date = daily_reconciliation.reconciliation_date
        AND ss.workspace_id = daily_reconciliation.workspace_id
        AND p.user_id = auth.uid()
        AND ss.status IN ('published', 'active', 'completed')
    )
  );

-- 5. RLS: allow on-shift employees to insert reconciliation
CREATE POLICY "shift_employee_can_create_settlement"
  ON daily_reconciliation FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM schedule_shift ss
      JOIN profile p ON p.profile_id = ss.employee_id
      WHERE ss.shift_date = reconciliation_date
        AND ss.workspace_id = daily_reconciliation.workspace_id
        AND p.user_id = auth.uid()
        AND ss.status IN ('published', 'active', 'completed')
    )
  );
