-- Migration: 20260602000400_payroll_holiday_allowance_pct.sql
--
-- WHAT: Add holiday_allowance_pct to employee_payroll_profile.
--
-- WHY: ADR-0295 — Smartout exposes feriepenger BASIS per period.
--      Basis = sum(holiday_eligible_pay) × holiday_allowance_pct / 100.
--      Default 12.00 per Riksavtalen (voksen ufaglært).
--      Higher values: 14.3 for over-60 employees (Ferieloven §10 third paragraph),
--      10.2 for 4-week FF/NHO agreements.
--      Per L-0202: ADD COLUMN beats sibling-table for 1:1 attributes without
--      lifecycle independence — this is a per-employee config value, not a
--      temporally independent entity.
--
-- References: ADR-0295, SMA-346.

ALTER TABLE public.employee_payroll_profile
  ADD COLUMN IF NOT EXISTS holiday_allowance_pct NUMERIC(4,2)
    DEFAULT 12.00
    CHECK (holiday_allowance_pct >= 0 AND holiday_allowance_pct <= 25);

COMMENT ON COLUMN public.employee_payroll_profile.holiday_allowance_pct IS
  'Per-employee override of feriepenger basis percentage. Default 12.00 (Riksavtalen). '
  'Higher values typical for ekstra ferie (5. ferieuke, 14.3%) or seniorferie. '
  'Range 0–25 covers all known Norwegian tariff tiers.';
