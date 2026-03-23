-- ============================================
-- 20260422100700_payroll_schema.sql
-- Move all payroll objects from public to dedicated payroll schema.
-- Drop the payroll_ prefix — the schema provides the namespace.
-- ADR-0055: Payroll schema separation
-- ============================================

-- 1. Create schema
CREATE SCHEMA IF NOT EXISTS payroll;

-- 2. Grant access to Supabase roles (RLS still controls row-level access)
GRANT USAGE ON SCHEMA payroll TO authenticated;
GRANT USAGE ON SCHEMA payroll TO anon;
GRANT USAGE ON SCHEMA payroll TO service_role;

-- Grant table-level access (existing tables)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA payroll TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA payroll TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA payroll TO service_role;

-- Grant for future tables created in this schema
ALTER DEFAULT PRIVILEGES IN SCHEMA payroll GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA payroll GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA payroll GRANT ALL ON TABLES TO service_role;

-- ============================================
-- 3. Move enums (16 total) — SET SCHEMA then RENAME
-- ============================================

-- Track 1 enums (12)
ALTER TYPE public.payroll_wage_type SET SCHEMA payroll;
ALTER TYPE payroll.payroll_wage_type RENAME TO wage_type;

ALTER TYPE public.payroll_rate_adjustment_type SET SCHEMA payroll;
ALTER TYPE payroll.payroll_rate_adjustment_type RENAME TO rate_adjustment_type;

ALTER TYPE public.payroll_salary_code_category SET SCHEMA payroll;
ALTER TYPE payroll.payroll_salary_code_category RENAME TO salary_code_category;

ALTER TYPE public.payroll_supplement_type SET SCHEMA payroll;
ALTER TYPE payroll.payroll_supplement_type RENAME TO supplement_type;

ALTER TYPE public.payroll_supplement_rate_type SET SCHEMA payroll;
ALTER TYPE payroll.payroll_supplement_rate_type RENAME TO supplement_rate_type;

ALTER TYPE public.payroll_supplement_start_type SET SCHEMA payroll;
ALTER TYPE payroll.payroll_supplement_start_type RENAME TO supplement_start_type;

ALTER TYPE public.payroll_break_trigger_type SET SCHEMA payroll;
ALTER TYPE payroll.payroll_break_trigger_type RENAME TO break_trigger_type;

ALTER TYPE public.payroll_meal_rule_type SET SCHEMA payroll;
ALTER TYPE payroll.payroll_meal_rule_type RENAME TO meal_rule_type;

ALTER TYPE public.payroll_period_status SET SCHEMA payroll;
ALTER TYPE payroll.payroll_period_status RENAME TO period_status;

ALTER TYPE public.payroll_deviation_severity SET SCHEMA payroll;
ALTER TYPE payroll.payroll_deviation_severity RENAME TO deviation_severity;

ALTER TYPE public.payroll_rule_severity SET SCHEMA payroll;
ALTER TYPE payroll.payroll_rule_severity RENAME TO rule_severity;

ALTER TYPE public.payroll_custom_rate_type SET SCHEMA payroll;
ALTER TYPE payroll.payroll_custom_rate_type RENAME TO custom_rate_type;

-- Track 6 enums (4)
ALTER TYPE public.payroll_absence_category SET SCHEMA payroll;
ALTER TYPE payroll.payroll_absence_category RENAME TO absence_category;

ALTER TYPE public.payroll_absence_ledger_type SET SCHEMA payroll;
ALTER TYPE payroll.payroll_absence_ledger_type RENAME TO absence_ledger_type;

ALTER TYPE public.payroll_timebank_entry_type SET SCHEMA payroll;
ALTER TYPE payroll.payroll_timebank_entry_type RENAME TO timebank_entry_type;

ALTER TYPE public.payroll_sick_leave_grade SET SCHEMA payroll;
ALTER TYPE payroll.payroll_sick_leave_grade RENAME TO sick_leave_grade;

-- ============================================
-- 4. Move tables (23 total) — SET SCHEMA then RENAME
--    Order: leaf tables first to avoid FK conflicts
-- ============================================

-- Track 3 leaf tables (depend on config tables)
ALTER TABLE public.payroll_export_line SET SCHEMA payroll;
ALTER TABLE payroll.payroll_export_line RENAME TO export_line;

ALTER TABLE public.payroll_export_event SET SCHEMA payroll;
ALTER TABLE payroll.payroll_export_event RENAME TO export_event;

ALTER TABLE public.payroll_manual_supplement SET SCHEMA payroll;
ALTER TABLE payroll.payroll_manual_supplement RENAME TO manual_supplement;

ALTER TABLE public.payroll_deviation SET SCHEMA payroll;
ALTER TABLE payroll.payroll_deviation RENAME TO deviation;

ALTER TABLE public.payroll_calculation_line SET SCHEMA payroll;
ALTER TABLE payroll.payroll_calculation_line RENAME TO calculation_line;

ALTER TABLE public.payroll_calculation SET SCHEMA payroll;
ALTER TABLE payroll.payroll_calculation RENAME TO calculation;

ALTER TABLE public.payroll_period SET SCHEMA payroll;
ALTER TABLE payroll.payroll_period RENAME TO period;

-- Track 6 leaf tables (absence/timebank)
ALTER TABLE public.payroll_timebank_entry SET SCHEMA payroll;
ALTER TABLE payroll.payroll_timebank_entry RENAME TO timebank_entry;

ALTER TABLE public.payroll_sick_leave_period SET SCHEMA payroll;
ALTER TABLE payroll.payroll_sick_leave_period RENAME TO sick_leave_period;

ALTER TABLE public.payroll_absence_ledger SET SCHEMA payroll;
ALTER TABLE payroll.payroll_absence_ledger RENAME TO absence_ledger;

ALTER TABLE public.payroll_absence_quota SET SCHEMA payroll;
ALTER TABLE payroll.payroll_absence_quota RENAME TO absence_quota;

ALTER TABLE public.payroll_absence_type SET SCHEMA payroll;
ALTER TABLE payroll.payroll_absence_type RENAME TO absence_type;

-- Track 2 config tables (moved after dependents)
ALTER TABLE public.payroll_working_time_rule SET SCHEMA payroll;
ALTER TABLE payroll.payroll_working_time_rule RENAME TO working_time_rule;

ALTER TABLE public.payroll_meal_rule SET SCHEMA payroll;
ALTER TABLE payroll.payroll_meal_rule RENAME TO meal_rule;

ALTER TABLE public.payroll_break_rule SET SCHEMA payroll;
ALTER TABLE payroll.payroll_break_rule RENAME TO break_rule;

ALTER TABLE public.payroll_supplement_rule SET SCHEMA payroll;
ALTER TABLE payroll.payroll_supplement_rule RENAME TO supplement_rule;

ALTER TABLE public.payroll_holiday_entry SET SCHEMA payroll;
ALTER TABLE payroll.payroll_holiday_entry RENAME TO holiday_entry;

ALTER TABLE public.payroll_holiday_calendar SET SCHEMA payroll;
ALTER TABLE payroll.payroll_holiday_calendar RENAME TO holiday_calendar;

ALTER TABLE public.payroll_salary_code SET SCHEMA payroll;
ALTER TABLE payroll.payroll_salary_code RENAME TO salary_code;

ALTER TABLE public.payroll_shift_type SET SCHEMA payroll;
ALTER TABLE payroll.payroll_shift_type RENAME TO shift_type;

ALTER TABLE public.payroll_employee_group_member SET SCHEMA payroll;
ALTER TABLE payroll.payroll_employee_group_member RENAME TO employee_group_member;

ALTER TABLE public.payroll_employee_group SET SCHEMA payroll;
ALTER TABLE payroll.payroll_employee_group RENAME TO employee_group;

ALTER TABLE public.payroll_workspace_settings SET SCHEMA payroll;
ALTER TABLE payroll.payroll_workspace_settings RENAME TO workspace_settings;

-- ============================================
-- 5. Verify
-- ============================================
-- After running: should see 0 payroll_ tables in public, 23 in payroll
-- SELECT schemaname, tablename FROM pg_tables WHERE tablename LIKE 'payroll_%' OR schemaname = 'payroll' ORDER BY schemaname, tablename;
