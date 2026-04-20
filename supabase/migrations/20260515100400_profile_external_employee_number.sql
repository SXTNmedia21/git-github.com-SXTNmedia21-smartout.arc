-- 20260515100400_profile_external_employee_number.sql
-- M4: stable external employee number on profile (Tripletex requires stable ID).
-- Partial UNIQUE per workspace so multiple profiles without external ID can coexist.

ALTER TABLE public.profile
  ADD COLUMN IF NOT EXISTS external_employee_number text;

CREATE UNIQUE INDEX IF NOT EXISTS ux_profile_external_employee_number
  ON public.profile (workspace_id, external_employee_number)
  WHERE external_employee_number IS NOT NULL;

COMMENT ON COLUMN public.profile.external_employee_number IS
  'Stable external identifier (Tripletex employee number, Bubble record_id, etc). Unique per workspace when set. Nullable — profile can exist before external system assigns ID.';
