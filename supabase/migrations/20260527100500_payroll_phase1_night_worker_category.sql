-- 20260527100500_payroll_phase1_night_worker_category.sql
-- T1.5 — CREATE TYPE payroll.night_worker_category; ALTER payroll.shift_type.
--
-- O16 resolution: nattillegg per Riksavtalen §6 depends on which category
-- the shift_type belongs to (night_watch / manual / ordinary). This enum
-- drives supplement evaluation — same shift_type can map to different rates.
--
-- night_watch = fast nattevakt (42.41 kr/t)
-- manual      = manuelt nattarbeid (24.01 kr/t per time + 144.06 kr/vakt flat)
-- ordinary    = øvrige (56.02 kr/t)
-- NULL        = no night category (no nattillegg applies)
--
-- Source authority: SORTIE-PHASE-1.md §4.2, O16 resolution.

SET search_path TO payroll, public, extensions;

-- Create enum in payroll schema
CREATE TYPE payroll.night_worker_category AS ENUM ('night_watch', 'manual', 'ordinary');

-- Add column to payroll.shift_type
ALTER TABLE payroll.shift_type
  ADD COLUMN IF NOT EXISTS night_worker_category payroll.night_worker_category;

COMMENT ON COLUMN payroll.shift_type.night_worker_category IS
  'Riksavtalen §6 nattillegg category. NULL = no nattillegg. '
  'night_watch = 42.41 kr/t, manual = 24.01 kr/t + 144.06 kr/vakt, ordinary = 56.02 kr/t. '
  'Drives supplement_rule evaluation in calc-engine (O16 resolution).';
