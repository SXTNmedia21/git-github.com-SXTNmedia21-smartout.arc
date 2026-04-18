-- 20260515100300_employment_contract_detail.sql
-- M3: append-only versioning of Tripletex-canonical contract fields.
-- Per ADR-0111 Clause A (schema), Clause B (5-column insertion rule),
-- Clause C (coexists with ADR-0082 lineage), Clause G (RLS).
-- Surrogate PK + UNIQUE(contract, effective_date) matches shift_cost_snapshot
-- precedent (20260506100000_shift_derivation_layer.sql:132-133).

CREATE TABLE IF NOT EXISTS public.employment_contract_detail (
  detail_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employment_contract_id uuid NOT NULL REFERENCES public.employment_contract(contract_id) ON DELETE CASCADE,
  workspace_id           uuid NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  effective_date         date NOT NULL,

  -- Tripletex-canonical columns (mirror M2 additions ONLY — HR fields stay on parent)
  occupation_code        text CHECK (occupation_code IS NULL OR occupation_code ~ '^[0-9]{7}$'),
  employment_form        text CHECK (employment_form IS NULL OR employment_form IN ('permanent','temporary')),
  remuneration_type      text CHECK (remuneration_type IS NULL OR remuneration_type IN ('monthly','hourly','commission')),
  working_hours_scheme   text,
  employee_type_id       uuid REFERENCES public.employee_type(employee_type_id),

  -- Provenance (ADR-0108)
  source                 text NOT NULL DEFAULT 'operational'
                         CHECK (source IN ('operational','bubble_migration','v3_engine')),

  created_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ux_contract_detail_effective UNIQUE (employment_contract_id, effective_date)
);

COMMENT ON TABLE public.employment_contract_detail IS
  'Append-only versioning of Tripletex-canonical employment_contract fields per effective_date. Surrogate PK + UNIQUE(contract_id, effective_date). Coexists with ADR-0082 parent_contract_id (inter-contract lineage) — this is intra-contract state versioning. Runtime insertion mechanism deferred per ADR-0111 Clause F.';

COMMENT ON COLUMN public.employment_contract_detail.effective_date IS
  'Business date the state change takes effect. Distinct from created_at (DB write time).';

-- ── Indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_employment_contract_detail_contract
  ON public.employment_contract_detail (employment_contract_id, effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_employment_contract_detail_workspace
  ON public.employment_contract_detail (workspace_id);

CREATE INDEX IF NOT EXISTS idx_employment_contract_detail_employee_type
  ON public.employment_contract_detail (employee_type_id) WHERE employee_type_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employment_contract_detail_source
  ON public.employment_contract_detail (source) WHERE source <> 'operational';

-- ── RLS (per ADR-0111 Clause G) ─────────────────────────────────
ALTER TABLE public.employment_contract_detail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_employment_contract_detail"
  ON public.employment_contract_detail FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "admin_insert_employment_contract_detail"
  ON public.employment_contract_detail FOR INSERT
  WITH CHECK (public.is_admin_in_workspace(auth.uid(), workspace_id));

CREATE POLICY "service_role_employment_contract_detail"
  ON public.employment_contract_detail FOR ALL
  USING (auth.role() = 'service_role');

-- Append-only enforcement for non-service-role paths
CREATE POLICY "no_update_employment_contract_detail"
  ON public.employment_contract_detail FOR UPDATE USING (false);

CREATE POLICY "no_delete_employment_contract_detail"
  ON public.employment_contract_detail FOR DELETE USING (false);
