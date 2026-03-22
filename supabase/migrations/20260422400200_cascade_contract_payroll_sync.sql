-- Cascade: Sync payroll profile when employment contract status changes to 'signed'
-- When a contract is signed, its finalized values (hourly_rate, agreed_weekly_hours,
-- employment_category) overwrite the seed/draft values on the linked payroll profile.
-- Previous values are logged in activity_trail for audit.

CREATE OR REPLACE FUNCTION sync_payroll_on_contract_signed()
RETURNS TRIGGER AS $$
DECLARE
  v_payroll_id UUID;
  v_old_rate NUMERIC;
  v_old_hours NUMERIC;
  v_old_category TEXT;
BEGIN
  -- Only fire when status transitions TO 'signed'
  IF NEW.status != 'signed' OR OLD.status = 'signed' THEN
    RETURN NEW;
  END IF;

  -- Find the linked payroll profile
  SELECT id, agreed_weekly_hours, tariff_category
  INTO v_payroll_id, v_old_hours, v_old_category
  FROM employee_payroll_profile
  WHERE employment_contract_id = NEW.contract_id
  LIMIT 1;

  IF v_payroll_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Log previous values in activity_trail
  INSERT INTO activity_trail (workspace_id, actor_id, event_type, entity_type, entity_id, metadata)
  VALUES (
    NEW.workspace_id,
    NEW.profile_id,
    'payroll_sync_from_contract',
    'employee_payroll_profile',
    v_payroll_id,
    jsonb_build_object(
      'contract_id', NEW.contract_id,
      'previous', jsonb_build_object(
        'agreed_weekly_hours', v_old_hours,
        'tariff_category', v_old_category
      ),
      'new', jsonb_build_object(
        'hourly_rate', NEW.hourly_rate,
        'agreed_weekly_hours', NEW.agreed_weekly_hours,
        'employment_category', NEW.employment_category
      )
    )
  );

  -- Update payroll profile with finalized contract values
  UPDATE employee_payroll_profile
  SET
    agreed_weekly_hours = COALESCE(NEW.agreed_weekly_hours, agreed_weekly_hours),
    updated_at = now()
  WHERE id = v_payroll_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to employment_contract
DROP TRIGGER IF EXISTS trg_sync_payroll_on_signed ON employment_contract;
CREATE TRIGGER trg_sync_payroll_on_signed
  AFTER UPDATE ON employment_contract
  FOR EACH ROW
  WHEN (NEW.status = 'signed' AND OLD.status IS DISTINCT FROM 'signed')
  EXECUTE FUNCTION sync_payroll_on_contract_signed();
