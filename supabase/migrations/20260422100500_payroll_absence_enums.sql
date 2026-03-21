-- ============================================
-- 20260422100500_payroll_absence_enums.sql
-- Payroll: 4 absence/leave/timebank enums
-- Covers: Module 7 (Absence) payroll integration + Module 8 (Timebank/TOIL)
-- ============================================

-- 1. Absence type categories (Norwegian labor law classification)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_absence_category') THEN
    CREATE TYPE public.payroll_absence_category AS ENUM (
      'vacation',           -- Ferie (Ferieloven, 25 days statutory)
      'sick_self',          -- Egenmelding (self-reported, max 3 days/instance)
      'sick_doctor',        -- Sykemelding (doctor's note, employer 16 days then NAV)
      'parental',           -- Foreldrepermisjon (NAV coverage)
      'care_of_child',      -- Omsorgsdager (sick child, 10 days/year)
      'military',           -- Militaertjeneste
      'training',           -- Utdanningspermisjon (AML 12-11)
      'welfare',            -- Velferdspermisjon (tariff-based)
      'toil',               -- Avspasering (time off in lieu of overtime pay)
      'unpaid',             -- Uloennet permisjon
      'other'               -- Annet
    );
  END IF;
END $$;;

-- 2. Absence ledger transaction types
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_absence_ledger_type') THEN
    CREATE TYPE public.payroll_absence_ledger_type AS ENUM (
      'entitlement',    -- Annual quota grant (e.g., 25 vacation days on Jan 1)
      'carry_over',     -- Days carried from previous year
      'usage',          -- Days consumed (linked to schedule_absence)
      'adjustment',     -- Manual admin adjustment (+/-)
      'expiry',         -- Expired unused days
      'payout'          -- Vacation days paid out instead of taken
    );
  END IF;
END $$;;

-- 3. Timebank entry types (overtime account transactions)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_timebank_entry_type') THEN
    CREATE TYPE public.payroll_timebank_entry_type AS ENUM (
      'accrual',        -- Overtime hours banked (from payroll calculation)
      'withdrawal',     -- TOIL taken (linked to schedule_absence with type=toil)
      'adjustment',     -- Manual admin adjustment
      'expiry',         -- Hours expired (configurable expiry period)
      'carry_over',     -- Hours carried to next period
      'payout'          -- Hours paid out as overtime instead of TOIL
    );
  END IF;
END $$;;

-- 4. Sick leave grade (graded return to work)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_sick_leave_grade') THEN
    CREATE TYPE public.payroll_sick_leave_grade AS ENUM (
      'full',           -- 100% sick (fully absent)
      'graded_75',      -- 75% sick (works 25%)
      'graded_50',      -- 50% sick (works 50%)
      'graded_25',      -- 25% sick (works 75%)
      'graded_custom'   -- Custom percentage
    );
  END IF;
END $$;;

-- Comments
COMMENT ON TYPE public.payroll_absence_category IS 'Payroll: Norwegian labor law absence classification — vacation/sick/parental/toil/etc.';
COMMENT ON TYPE public.payroll_absence_ledger_type IS 'Payroll: absence ledger transaction type — entitlement/carry_over/usage/adjustment/expiry/payout';
COMMENT ON TYPE public.payroll_timebank_entry_type IS 'Payroll: overtime timebank transaction type — accrual/withdrawal/adjustment/expiry/carry_over/payout';
COMMENT ON TYPE public.payroll_sick_leave_grade IS 'Payroll: graded sick leave — full/graded_75/graded_50/graded_25/graded_custom';
