-- 20260527100200_payroll_phase1_workspace_policies.sql
-- T1.2 — Add 19 policy columns + is_tariff_bound to payroll.workspace_settings.
--
-- Columns mirror HOSPITALITY_PAYROLL_WORKSPACE_SETTINGS_DEFAULTS in hospitality.ts.
-- Defensive defaults: no rounding, no OT pre-approval, category_exclusive stacking.
-- No breaking changes — ADD COLUMN with defaults only.
--
-- Source authority: SORTIE-PHASE-1.md §3, docs/modules/payroll/WORKSPACE-POLICIES.md.
-- References: ADR-0259, HOSPITALITY_PAYROLL_WORKSPACE_SETTINGS_DEFAULTS (hospitality.ts).

SET search_path TO payroll, public, extensions;

-- ─── Time-banks ──────────────────────────────────────────────────────────────
ALTER TABLE payroll.workspace_settings
  ADD COLUMN IF NOT EXISTS toil_default_max_banked_hours    NUMERIC(5,2) NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS wellness_days_per_year_default   INT NOT NULL DEFAULT 0;

-- ─── Dynamic supplements ─────────────────────────────────────────────────────
ALTER TABLE payroll.workspace_settings
  ADD COLUMN IF NOT EXISTS supplement_stacking_policy       TEXT NOT NULL DEFAULT 'category_exclusive'
    CHECK (supplement_stacking_policy IN ('all_stack', 'highest_only', 'category_exclusive'));

-- ─── Delt vakt ───────────────────────────────────────────────────────────────
ALTER TABLE payroll.workspace_settings
  ADD COLUMN IF NOT EXISTS split_shift_threshold_minutes    INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS split_shift_allowance_amount     NUMERIC(8,2) NOT NULL DEFAULT 0;

-- ─── OT authorization ────────────────────────────────────────────────────────
-- soft warn, never block punch-out (Aml. §10-6 forbids blocking)
ALTER TABLE payroll.workspace_settings
  ADD COLUMN IF NOT EXISTS overtime_requires_pre_approval   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS overtime_warn_threshold_minutes  INT NOT NULL DEFAULT 30;

-- ─── Time rounding (Aml. §10-7 — actual time recording) ──────────────────────
ALTER TABLE payroll.workspace_settings
  ADD COLUMN IF NOT EXISTS punch_rounding_minutes           INT NOT NULL DEFAULT 0
    CHECK (punch_rounding_minutes IN (0, 5, 10, 15, 20, 30, 60)),
  ADD COLUMN IF NOT EXISTS punch_rounding_direction         TEXT NOT NULL DEFAULT 'toward_employee'
    CHECK (punch_rounding_direction IN ('toward_employee', 'snap_to_scheduled', 'half_up')),
  ADD COLUMN IF NOT EXISTS punch_rounding_snap_window_minutes INT NOT NULL DEFAULT 10;

-- ─── Punch buffers ───────────────────────────────────────────────────────────
ALTER TABLE payroll.workspace_settings
  ADD COLUMN IF NOT EXISTS punch_window_early_minutes           INT NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS punch_window_late_minutes            INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS punch_grace_after_scheduled_minutes  INT NOT NULL DEFAULT 60;

-- ─── Adhoc shifts ────────────────────────────────────────────────────────────
-- NOTE: adhoc_default_position_id and adhoc_default_department_id are nullable FKs.
-- No CHECK constraint — NULL means "no default set" (admin must pick at punch-time).
ALTER TABLE payroll.workspace_settings
  ADD COLUMN IF NOT EXISTS adhoc_default_position_id        UUID REFERENCES public.position(position_id),
  ADD COLUMN IF NOT EXISTS adhoc_default_department_id      UUID REFERENCES public.department(department_id);

-- ─── Forced break reminder ───────────────────────────────────────────────────
-- 300 min = 5h (Aml. §10-9 mandates break after 5.5h — remind before the limit)
ALTER TABLE payroll.workspace_settings
  ADD COLUMN IF NOT EXISTS forced_break_reminder_minutes    INT NOT NULL DEFAULT 300;

-- ─── Period approval ─────────────────────────────────────────────────────────
ALTER TABLE payroll.workspace_settings
  ADD COLUMN IF NOT EXISTS requires_four_eyes_for_period_approval BOOLEAN NOT NULL DEFAULT false;

-- ─── Manager edit policy ─────────────────────────────────────────────────────
ALTER TABLE payroll.workspace_settings
  ADD COLUMN IF NOT EXISTS manager_punch_edit_requires_reason    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS manager_punch_edit_notifies_employee  BOOLEAN NOT NULL DEFAULT true;

-- ─── Employee dispute policy ─────────────────────────────────────────────────
ALTER TABLE payroll.workspace_settings
  ADD COLUMN IF NOT EXISTS employee_can_dispute_punch        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS employee_dispute_window_days      INT NOT NULL DEFAULT 7;

-- ─── Tariff binding ──────────────────────────────────────────────────────────
-- false by default: unorganised workspaces get tariff as guidance, not enforcement.
-- Admin opts in per workspace when NHO Reiseliv membership is confirmed.
ALTER TABLE payroll.workspace_settings
  ADD COLUMN IF NOT EXISTS is_tariff_bound                  BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN payroll.workspace_settings.is_tariff_bound IS
  'true = workspace is NHO Reiseliv member bound by Riksavtalen. '
  'Calc engine enforces tariff supplements as mandatory. '
  'false = supplements used as guidance defaults only. ADR-0259.';

COMMENT ON COLUMN payroll.workspace_settings.supplement_stacking_policy IS
  'category_exclusive = Riksavtalen-safe default: within a supplement category, '
  'only highest rate applies. all_stack = all rules stack. highest_only = only highest '
  'rate across all categories. ADR-0250.';

COMMENT ON COLUMN payroll.workspace_settings.punch_rounding_minutes IS
  '0 = no rounding (Aml. §10-7 requires actual time recording). '
  'Non-zero rounding requires toward_employee direction to be lawful.';
