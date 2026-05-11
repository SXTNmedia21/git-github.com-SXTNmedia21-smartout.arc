-- 20260601000100_payroll_sync_trigger_rate_columns.sql
--
-- Update sync_payroll_on_contract_signed() to persist rate columns
-- added in 20260601000000.
--
-- Before: trigger UPDATEs only agreed_weekly_hours; rate values logged
-- to activity_trail but never written to employee_payroll_profile.
--
-- After: trigger UPDATEs all 5 columns from contract on signed transition.
--
-- Deviations from plan (schema-verified before writing):
--   1. employment_contract has NO currency column → defaults to 'NOK'.
--   2. employment_contract.remuneration_type is remuneration_type_enum
--      (monthlyWage/hourlyWage/commissionOnly) — mapped to employee_payroll_profile
--      TEXT values (monthly/hourly/mixed) via CASE expression.
--   3. activity_trail uses columns: event, action_verb, category, entity_type,
--      entity_id, actor_id, workspace_id, data — NOT action_type/metadata.
--   4. Original trigger finds payroll profile by employment_contract_id.
--      New trigger adds profile_id+workspace_id fallback for profiles without
--      employment_contract_id FK set (seed-migrated profiles).

CREATE OR REPLACE FUNCTION public.sync_payroll_on_contract_signed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, payroll, extensions
AS $$
DECLARE
  v_payroll_profile_id UUID;
  v_mapped_remuneration_type TEXT;
BEGIN
  -- Only fire on transition INTO 'signed' status
  IF NEW.status = 'signed' AND (OLD.status IS NULL OR OLD.status != 'signed') THEN

    -- Map employment_contract.remuneration_type_enum to employee_payroll_profile TEXT values.
    -- hourlyWage → hourly | monthlyWage → monthly | commissionOnly → mixed | NULL → NULL
    v_mapped_remuneration_type := CASE NEW.remuneration_type::text
      WHEN 'hourlyWage'      THEN 'hourly'
      WHEN 'monthlyWage'     THEN 'monthly'
      WHEN 'commissionOnly'  THEN 'mixed'
      ELSE NULL
    END;

    -- Audit log entry (activity_trail schema: event, action_verb, category, data)
    INSERT INTO public.activity_trail (
      workspace_id,
      actor_id,
      event,
      action_verb,
      category,
      entity_type,
      entity_id,
      data
    ) VALUES (
      NEW.workspace_id,
      NEW.profile_id,
      'payroll.sync_from_contract',
      'sync',
      'payroll',
      'employment_contract',
      NEW.contract_id,
      jsonb_build_object(
        'contract_id', NEW.contract_id,
        'profile_id', NEW.profile_id,
        'synced', jsonb_build_object(
          'hourly_rate', NEW.hourly_rate,
          'monthly_salary', NEW.monthly_salary,
          'remuneration_type', v_mapped_remuneration_type,
          'agreed_weekly_hours', NEW.agreed_weekly_hours,
          'currency', 'NOK'
        )
      )
    );

    -- Try to sync by employment_contract_id (direct FK — covers DocuSeal-signed contracts)
    UPDATE public.employee_payroll_profile
    SET
      agreed_weekly_hours = COALESCE(NEW.agreed_weekly_hours, agreed_weekly_hours),
      hourly_rate = NEW.hourly_rate,
      monthly_salary = NEW.monthly_salary,
      remuneration_type = v_mapped_remuneration_type,
      currency = 'NOK',
      updated_at = NOW()
    WHERE employment_contract_id = NEW.contract_id
    RETURNING id INTO v_payroll_profile_id;

    -- Fallback: match by profile_id + workspace_id (seed-migrated profiles without FK)
    IF v_payroll_profile_id IS NULL THEN
      UPDATE public.employee_payroll_profile
      SET
        agreed_weekly_hours = COALESCE(NEW.agreed_weekly_hours, agreed_weekly_hours),
        hourly_rate = NEW.hourly_rate,
        monthly_salary = NEW.monthly_salary,
        remuneration_type = v_mapped_remuneration_type,
        currency = 'NOK',
        updated_at = NOW()
      WHERE profile_id = NEW.profile_id
        AND workspace_id = NEW.workspace_id
      RETURNING id INTO v_payroll_profile_id;
    END IF;

    -- Insert if no payroll profile exists yet (upsert path)
    IF v_payroll_profile_id IS NULL THEN
      INSERT INTO public.employee_payroll_profile (
        workspace_id, profile_id,
        employment_contract_id,
        agreed_weekly_hours,
        hourly_rate, monthly_salary, remuneration_type, currency,
        -- Required NOT NULL fields — use safe defaults
        salary_type, tariff_category, seniority_start_date, valid_from
      ) VALUES (
        NEW.workspace_id, NEW.profile_id,
        NEW.contract_id,
        COALESCE(NEW.agreed_weekly_hours, 0),
        NEW.hourly_rate, NEW.monthly_salary, v_mapped_remuneration_type, 'NOK',
        COALESCE(v_mapped_remuneration_type, 'hourly'),
        'standard',
        COALESCE(NEW.start_date, CURRENT_DATE),
        COALESCE(NEW.start_date, CURRENT_DATE)
      );
    END IF;

  END IF;

  RETURN NEW;
END;
$$;
