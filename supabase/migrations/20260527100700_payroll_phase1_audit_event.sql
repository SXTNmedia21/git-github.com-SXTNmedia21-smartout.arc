-- 20260527100700_payroll_phase1_audit_event.sql
-- T1.6 — CREATE TABLE public.shift_pay_calculation_event (ADR-0251).
--
-- Append-only audit table per shift × per pay-rule.
-- RLS BLOCKS UPDATE + DELETE for everyone except service_role (supersession only).
-- 5-year retention per Bokføringsloven §13 anchored on shift_period_end_date.
--
-- Column design per task spec T1.6 (minimum set):
--   id, workspace_id, payroll_period_id, shift_id, profile_id,
--   rule_id (FK supplement_rule, nullable), tariff_rate_table_id (FK, nullable),
--   amount_nok, provenance JSONB, derivation_version INT,
--   superseded_by_event_id UUID NULL, created_at.
--
-- Additional columns per ADR-0251 for full audit trail:
--   contract_pay_rule_id, rule_type, rate_value_applied, rate_type,
--   source_text_applied, quantity_value, subtotal, calculated_by,
--   shift_period_end_date.
--
-- Source authority: ADR-0251, SORTIE-PHASE-1.md T1.6.

SET search_path TO public, extensions;

CREATE TABLE IF NOT EXISTS public.shift_pay_calculation_event (
  -- Identity
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Workspace scope (denormalized for RLS performance)
  workspace_id            UUID NOT NULL
                            REFERENCES public.workspace(workspace_id)
                            ON DELETE RESTRICT,   -- accounting records outlive workspace soft-close

  -- What period
  payroll_period_id       UUID,
  -- FK to payroll.period — deferred nullable because event may be written before period row
  -- Application layer sets this at period-close. Not a hard FK to avoid cross-schema cycles.

  -- What shift
  shift_id                UUID NOT NULL
                            REFERENCES public.schedule_shift(schedule_shift_id)
                            ON DELETE RESTRICT,   -- audit must outlive shift

  -- Who
  profile_id              UUID NOT NULL
                            REFERENCES public.profile(profile_id)
                            ON DELETE RESTRICT,

  -- What rule fired (either supplement_rule OR contract_pay_rule — at least one must be set)
  rule_id                 UUID REFERENCES public.supplement_rule(id) ON DELETE RESTRICT,
  -- nullable: NULL for base pay rows that don't reference a supplement_rule

  contract_pay_rule_id    UUID REFERENCES public.contract_pay_rule(id) ON DELETE RESTRICT,
  -- nullable: NULL for supplement-only rows without a contract_pay_rule link

  tariff_rate_table_id    UUID REFERENCES public.tariff_rate_table(id) ON DELETE RESTRICT,
  -- nullable: NULL when rate was percentage-of-base (not a direct tariff lookup)

  -- Snapshotted values at calculation time (immutable — ADR-0076 snapshot-and-forward)
  rule_type               TEXT NOT NULL,
  -- e.g. 'base_pay', 'supplement_rule:Kveldstillegg', 'manual_supplement'

  rate_value_applied      NUMERIC(10,4) NOT NULL,
  rate_type               TEXT NOT NULL,
  -- 'fixed_per_hour' | 'percentage' | 'fixed_per_shift'

  source_text_applied     TEXT,
  -- Riksavtalen §X.Y text at calc-time; shown to employee in "Hvorfor fikk jeg …?"

  quantity_value          NUMERIC(10,4) NOT NULL DEFAULT 0,
  -- hours worked, shift count, or dimensionless multiplier

  subtotal                NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- rate_value_applied × quantity_value (after rounding). Redundant but immutable.

  amount_nok              NUMERIC(12,2) NOT NULL,
  -- Final NOK amount (may differ from subtotal if stacking policy applied)

  -- Provenance (ADR-0076 minimum shape)
  provenance              JSONB NOT NULL DEFAULT '{}',

  -- Calculation context
  derivation_version      INT NOT NULL DEFAULT 1,
  calculated_by           TEXT NOT NULL DEFAULT 'system',
  -- 'system', 'engine_state:<uuid>', 'manual_recalc:<profile_id>'

  -- Bokføringsloven §13 retention anchor (5-year clock from regnskapsår end)
  shift_period_end_date   DATE NOT NULL,

  -- Supersession chain (recalculation — never deletes, only appends)
  superseded_by_event_id  UUID REFERENCES public.shift_pay_calculation_event(id) ON DELETE RESTRICT,
  superseded_at           TIMESTAMPTZ,

  -- Audit timestamp (NO updated_at — append-only)
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
-- Primary read: Botsson salary_query per period + profile
CREATE INDEX shift_pay_calc_period_profile_idx
  ON public.shift_pay_calculation_event (payroll_period_id, profile_id);

-- Retention scan: archival eligibility
CREATE INDEX shift_pay_calc_period_end_idx
  ON public.shift_pay_calculation_event (shift_period_end_date);

-- Active (non-superseded) rows per shift
CREATE INDEX shift_pay_calc_active_idx
  ON public.shift_pay_calculation_event (shift_id)
  WHERE superseded_by_event_id IS NULL;

-- Workspace-scoped queries (RLS filter support)
CREATE INDEX shift_pay_calc_workspace_idx
  ON public.shift_pay_calculation_event (workspace_id, created_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.shift_pay_calculation_event ENABLE ROW LEVEL SECURITY;

-- SELECT: workspace members can read their own workspace events
CREATE POLICY "jwt_read_shift_pay_calc_event" ON public.shift_pay_calculation_event
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- API key read
CREATE POLICY "api_key_read_shift_pay_calc_event" ON public.shift_pay_calculation_event
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- INSERT: service_role only (calc engine). No JWT insert (ADR-0251 §B).
-- Calc engine uses service_role client. Application layer never inserts directly.
CREATE POLICY "service_role_insert_shift_pay_calc_event" ON public.shift_pay_calculation_event
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- UPDATE: BLOCKED for all regular users (ADR-0251 §B append-only invariant)
CREATE POLICY "no_update_shift_pay_calc_event" ON public.shift_pay_calculation_event
  FOR UPDATE USING (false);

-- Service role narrow UPDATE for supersession chain only
CREATE POLICY "service_role_supersede_shift_pay_calc_event" ON public.shift_pay_calculation_event
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
-- Application layer must enforce: only superseded_by_event_id + superseded_at changed.

-- DELETE: BLOCKED for all (Bokføringsloven §13 — 5-year retention)
CREATE POLICY "no_delete_shift_pay_calc_event" ON public.shift_pay_calculation_event
  FOR DELETE USING (false);

COMMENT ON TABLE public.shift_pay_calculation_event IS
  'Append-only audit: one row per pay rule application per shift per derivation_version. '
  'Bokføringsloven §13 5-year retention anchored on shift_period_end_date. '
  'UPDATE blocked (append-only). DELETE blocked (retention). '
  'Supersession via superseded_by_event_id. ADR-0251.';
