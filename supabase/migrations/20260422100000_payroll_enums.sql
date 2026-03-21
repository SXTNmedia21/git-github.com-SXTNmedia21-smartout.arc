-- ============================================
-- 20260422100000_payroll_enums.sql
-- Payroll: 12 payroll-specific enums
-- Spec: Sections 1.1-1.7, 4.4, 5.1-5.3
-- ============================================

-- 1. Wage type for employee group membership
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_wage_type') THEN
    CREATE TYPE public.payroll_wage_type AS ENUM ('hourly', 'per_shift', 'monthly');
  END IF;
END $$;;

-- 2. Rate adjustment method for shift types
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_rate_adjustment_type') THEN
    CREATE TYPE public.payroll_rate_adjustment_type AS ENUM ('none', 'replace', 'add', 'percentage');
  END IF;
END $$;;

-- 3. Salary code classification
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_salary_code_category') THEN
    CREATE TYPE public.payroll_salary_code_category AS ENUM (
      'worked_hours', 'supplement', 'overtime', 'absence', 'deduction', 'monthly_salary'
    );
  END IF;
END $$;;

-- 4. Supplement rule type (6 types per spec Section 1.4)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_supplement_type') THEN
    CREATE TYPE public.payroll_supplement_type AS ENUM (
      'normal', 'week_based', 'day_based', 'manual', 'holiday', 'contract_rule'
    );
  END IF;
END $$;;

-- 5. How supplement rate is calculated
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_supplement_rate_type') THEN
    CREATE TYPE public.payroll_supplement_rate_type AS ENUM ('fixed_per_hour', 'percentage', 'fixed_per_shift');
  END IF;
END $$;;

-- 6. When a normal supplement triggers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_supplement_start_type') THEN
    CREATE TYPE public.payroll_supplement_start_type AS ENUM ('time_of_day', 'after_shift_start');
  END IF;
END $$;;

-- 7. What triggers a break
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_break_trigger_type') THEN
    CREATE TYPE public.payroll_break_trigger_type AS ENUM ('after_duration', 'time_of_day');
  END IF;
END $$;;

-- 8. Meal rule direction
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_meal_rule_type') THEN
    CREATE TYPE public.payroll_meal_rule_type AS ENUM ('deduction', 'contribution');
  END IF;
END $$;;

-- 9. Payroll period lifecycle
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_period_status') THEN
    CREATE TYPE public.payroll_period_status AS ENUM ('open', 'locked', 'approved', 'exported');
  END IF;
END $$;;

-- 10. Payroll deviation severity (different from deviation_severity which is low/medium/high/critical)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_deviation_severity') THEN
    CREATE TYPE public.payroll_deviation_severity AS ENUM ('error', 'warning', 'info');
  END IF;
END $$;;

-- 11. Working time rule enforcement level
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_rule_severity') THEN
    CREATE TYPE public.payroll_rule_severity AS ENUM ('block', 'warn');
  END IF;
END $$;;

-- 12. Custom rate type on shift override
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_custom_rate_type') THEN
    CREATE TYPE public.payroll_custom_rate_type AS ENUM ('per_hour', 'per_shift');
  END IF;
END $$;;

-- Comments
COMMENT ON TYPE public.payroll_wage_type IS 'Payroll: employee compensation basis — hourly/per_shift/monthly';
COMMENT ON TYPE public.payroll_rate_adjustment_type IS 'Payroll: how shift type adjusts base rate — none/replace/add/percentage';
COMMENT ON TYPE public.payroll_salary_code_category IS 'Payroll: salary code classification for reporting and export';
COMMENT ON TYPE public.payroll_supplement_type IS 'Payroll: 6 supplement rule types — normal/week_based/day_based/manual/holiday/contract_rule';
COMMENT ON TYPE public.payroll_supplement_rate_type IS 'Payroll: how supplement amount is calculated — fixed_per_hour/percentage/fixed_per_shift';
COMMENT ON TYPE public.payroll_supplement_start_type IS 'Payroll: when normal supplement triggers — time_of_day/after_shift_start';
COMMENT ON TYPE public.payroll_break_trigger_type IS 'Payroll: what triggers automatic break — after_duration/time_of_day';
COMMENT ON TYPE public.payroll_meal_rule_type IS 'Payroll: meal rule direction — deduction/contribution';
COMMENT ON TYPE public.payroll_period_status IS 'Payroll: period lifecycle — open/locked/approved/exported';
COMMENT ON TYPE public.payroll_deviation_severity IS 'Payroll: deviation severity — error (blocks approval)/warning/info';
COMMENT ON TYPE public.payroll_rule_severity IS 'Payroll: working time rule enforcement — block (prevents save)/warn (allows with flag)';
COMMENT ON TYPE public.payroll_custom_rate_type IS 'Payroll: custom rate override type on shift — per_hour/per_shift';
