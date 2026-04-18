-- 20260515100000_employee_type_k1a.sql
-- M1: employee_type as K1a platform-level reference (Tripletex/STYRK-aligned taxonomy)
-- Council 2026-04-15 verdict: platform rows with nullable workspace_id (matches tariff_rate_table).
-- Seed derived from Wrightegaarden live inspection: Månedslønn / Timelønn sesongmedarbeider / Frivillig.

-- ── Table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_type (
  employee_type_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id              uuid REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  title                     text NOT NULL,
  employment_form_derived   text CHECK (employment_form_derived IN ('permanent','temporary') OR employment_form_derived IS NULL),
  fixed_salary              boolean,
  max_hours_week            numeric(5,2),
  accounting_account_code   text,
  color_pallet              text,
  max_vacation_days         integer,
  days_trial_period         integer,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.employee_type IS
  'K1a/K1b: Platform-defined employment type taxonomy. NULL workspace_id = platform baseline (industry-generic). Workspace rows override platform rows for tenant-specific variants. Drives Tripletex employment_form + remuneration_type mapping.';

-- ── RLS (matches tariff_rate_table K1a pattern) ─────────────────
ALTER TABLE public.employee_type ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_select_employee_type" ON public.employee_type
  FOR SELECT USING (
    workspace_id IS NULL
    OR workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

CREATE POLICY "api_key_read_employee_type" ON public.employee_type
  FOR SELECT USING (
    workspace_id IS NULL
    OR workspace_id = get_api_workspace_id()
  );

CREATE POLICY "service_role_employee_type" ON public.employee_type
  FOR ALL USING (auth.role() = 'service_role');

-- ── Indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_employee_type_workspace
  ON public.employee_type (workspace_id) WHERE workspace_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_employee_type_platform_title
  ON public.employee_type (title) WHERE workspace_id IS NULL;

-- ── updated_at trigger ──────────────────────────────────────────
CREATE TRIGGER set_employee_type_updated_at
  BEFORE UPDATE ON public.employee_type
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Platform seed (3 rows from Wrightegaarden live inspection) ──
INSERT INTO public.employee_type
  (workspace_id, title, employment_form_derived, fixed_salary, max_hours_week, accounting_account_code)
VALUES
  (NULL, 'Månedslønn',                  'permanent', true,  37.5, '2000'),
  (NULL, 'Timelønn sesongmedarbeider',  'temporary', false, 37.5, '2001'),
  (NULL, 'Frivillig',                    NULL,       false, NULL, NULL)
ON CONFLICT DO NOTHING;
