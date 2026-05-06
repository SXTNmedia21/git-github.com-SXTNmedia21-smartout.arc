-- =============================================================================
-- 02 — pension_scheme (ny)
-- =============================================================================
-- Workspace-level pensjonsordninger. Refereres av employee_payroll_profile.

CREATE TABLE pension_scheme (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                uuid NOT NULL REFERENCES workspace(id) ON DELETE RESTRICT,
  name                        text NOT NULL,
  provider                    text,
  scheme_type                 text NOT NULL,                   -- 'OTP', 'innskudd', 'ytelse', etc.
  employer_contribution_pct   numeric(4,2) NOT NULL,
  employee_contribution_pct   numeric(4,2) NOT NULL DEFAULT 0,
  is_default                  boolean NOT NULL DEFAULT false,
  is_active                   boolean NOT NULL DEFAULT true,
  effective_from              date NOT NULL,
  effective_until             date,
  notes                       text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  -- OTP-loven minimum 2.0% arbeidsgiver-bidrag
  CONSTRAINT pension_employer_min_otp
    CHECK (employer_contribution_pct >= 2.00),

  CONSTRAINT pension_pct_range
    CHECK (employer_contribution_pct <= 100.00
       AND employee_contribution_pct >= 0
       AND employee_contribution_pct <= 100.00)
);

COMMENT ON TABLE pension_scheme IS
  'Pensjonsordninger per workspace. OTP-lovens minimumskrav (2.0%) håndheves som CHECK.';

-- Maks én default per workspace ad gangen
CREATE UNIQUE INDEX pension_scheme_one_default_per_workspace
  ON pension_scheme (workspace_id)
  WHERE is_default = true AND is_active = true;

CREATE INDEX pension_scheme_workspace_active
  ON pension_scheme (workspace_id, is_active);
