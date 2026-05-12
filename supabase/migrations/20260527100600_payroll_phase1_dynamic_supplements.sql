-- 20260527100600_payroll_phase1_dynamic_supplements.sql
-- T1.4 — (a) CREATE TABLE public.supplement_rule + public.supplement_rule_match
--          (b) INSERT 6 platform-level Riksavtalen rules (workspace_id=NULL)
--
-- DESIGN NOTE: The existing payroll.supplement_rule table (workspace_id NOT NULL)
-- is the workspace-specific table for admin-authored rules. It cannot hold
-- platform-level rows (workspace_id=NULL).
--
-- This migration creates a SEPARATE public.supplement_rule table that:
--   - Allows workspace_id=NULL for platform-level Riksavtalen template rules
--   - Is copied into workspace-specific payroll.supplement_rule rows at
--     workspace bootstrap time (I1 layer)
--   - Calc engine reads platform rows + workspace rows at evaluation time
--
-- The 6 platform rows are CONFIG DATA, not code. The calc engine reads them
-- at runtime via supplement_rule.workspace_id IS NULL OR workspace_id=$ws_id.
--
-- Source authority: SORTIE-PHASE-1.md T1.4, DYNAMIC-SUPPLEMENTS.md §9.
-- Locked rule: "Motoren er 100% dynamisk" (Pontus 2026-05-06).
-- Rate source: task spec (verified Riksavtalen 2025-satser fra 1. april 2025).

SET search_path TO public, extensions;

-- ─── Part A: CREATE TABLE public.supplement_rule ──────────────────────────────
-- Platform-level rules: workspace_id IS NULL.
-- Workspace-specific overrides: workspace_id = workspace UUID.
-- Complement to existing payroll.supplement_rule (workspace-scoped, NOT NULL).
CREATE TABLE public.supplement_rule (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- NULL for platform-level Riksavtalen template rules.
  -- Non-NULL for workspace-specific copies bootstrapped from platform rules.
  workspace_id    UUID REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,

  name            TEXT NOT NULL,
  supplement_type TEXT NOT NULL
    CHECK (supplement_type IN ('normal', 'week_based', 'day_based', 'manual', 'holiday', 'contract_rule')),
  is_active       BOOLEAN NOT NULL DEFAULT true,

  -- Rate
  rate_type       TEXT NOT NULL DEFAULT 'fixed_per_hour'
    CHECK (rate_type IN ('fixed_per_hour', 'percentage', 'fixed_per_shift')),
  rate_value      NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Links to tariff_rate_table for snapshotted rate resolution
  tariff_rate_table_id UUID REFERENCES public.tariff_rate_table(id) ON DELETE SET NULL,

  -- Match predicates (JSON DSL — evaluated by evaluateSupplements())
  -- Shape: { weekdays: int[], time_from: "HH:MM", time_to: "HH:MM",
  --          night_worker_category: str | null, ... }
  match_predicate JSONB NOT NULL DEFAULT '{}',

  -- Riksavtalen paragraph reference for audit display
  paragraf_ref    TEXT,

  -- Version hash for provenance (trigger-maintained)
  version_hash    TEXT GENERATED ALWAYS AS (
    md5(name || supplement_type || rate_type || rate_value::text)
  ) STORED,

  -- Soft validity window
  valid_from      DATE,
  valid_until     DATE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: Platform rows (workspace_id IS NULL) readable by all authenticated users.
-- Workspace rows readable by workspace members.
ALTER TABLE public.supplement_rule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_supplement_rule" ON public.supplement_rule
  FOR SELECT USING (
    workspace_id IS NULL
    OR workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

CREATE POLICY "jwt_insert_supplement_rule" ON public.supplement_rule
  FOR INSERT WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

CREATE POLICY "jwt_update_supplement_rule" ON public.supplement_rule
  FOR UPDATE USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

CREATE POLICY "jwt_delete_supplement_rule" ON public.supplement_rule
  FOR DELETE USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

CREATE POLICY "api_key_read_supplement_rule" ON public.supplement_rule
  FOR SELECT USING (
    workspace_id IS NULL
    OR workspace_id = get_api_workspace_id()
  );

CREATE POLICY "service_role_supplement_rule" ON public.supplement_rule
  FOR ALL USING (auth.role() = 'service_role');

-- Platform rows are immutable except by service_role (calc engine)
-- Workspace rows managed by admins via supplement-rules-settings UI.

CREATE TRIGGER set_supplement_rule_updated_at
  BEFORE UPDATE ON public.supplement_rule
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_supplement_rule_workspace ON public.supplement_rule (workspace_id)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX idx_supplement_rule_platform ON public.supplement_rule (supplement_type, is_active)
  WHERE workspace_id IS NULL;

COMMENT ON TABLE public.supplement_rule IS
  'Platform-level (workspace_id=NULL) and workspace-specific supplement rules. '
  'Platform rows = Riksavtalen template rules; workspace rows = admin-authored overrides. '
  'Calc engine evaluates both at runtime. DYNAMIC-SUPPLEMENTS.md. ADR-0250.';

-- ─── Part B: CREATE TABLE public.supplement_rule_match ───────────────────────
-- Audit: one row per rule-firing per shift (per DYNAMIC-SUPPLEMENTS.md §5).
-- This is a lightweight companion to shift_pay_calculation_event (full audit).
CREATE TABLE public.supplement_rule_match (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplement_rule_id          UUID NOT NULL REFERENCES public.supplement_rule(id) ON DELETE RESTRICT,
  workspace_id                UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE RESTRICT,
  schedule_shift_id           UUID NOT NULL REFERENCES public.schedule_shift(schedule_shift_id) ON DELETE RESTRICT,
  profile_id                  UUID NOT NULL REFERENCES public.profile(profile_id) ON DELETE RESTRICT,

  -- Snapshotted at match time (immutable per ADR-0076)
  rule_version_hash           TEXT NOT NULL,  -- supplement_rule.version_hash at evaluation time
  applied_rate_type           TEXT NOT NULL,
  applied_rate_value          NUMERIC(10,2) NOT NULL,
  applied_to_minutes          INT NOT NULL,
  amount_nok                  NUMERIC(12,2) NOT NULL,

  -- Provenance per DYNAMIC-SUPPLEMENTS.md §2.1
  matched_predicates          JSONB NOT NULL DEFAULT '[]',
  applied_to_window           JSONB NOT NULL DEFAULT '{}',  -- { from: "ISO", to: "ISO" }
  source_text                 TEXT,

  -- Calculation linkage
  derivation_version          INT NOT NULL DEFAULT 1,
  payroll_period_id           UUID,  -- nullable; linked at period-close

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
  -- No updated_at: append-only
);

ALTER TABLE public.supplement_rule_match ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_supplement_rule_match" ON public.supplement_rule_match
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "no_update_supplement_rule_match" ON public.supplement_rule_match
  FOR UPDATE USING (false);  -- append-only

CREATE POLICY "no_delete_supplement_rule_match" ON public.supplement_rule_match
  FOR DELETE USING (false);  -- append-only

CREATE POLICY "service_role_supplement_rule_match" ON public.supplement_rule_match
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_supp_rule_match_shift ON public.supplement_rule_match (schedule_shift_id);
CREATE INDEX idx_supp_rule_match_profile ON public.supplement_rule_match (workspace_id, profile_id);

COMMENT ON TABLE public.supplement_rule_match IS
  'Append-only audit: one row per supplement_rule firing per shift. '
  'Lightweight companion to shift_pay_calculation_event (full audit). '
  'DYNAMIC-SUPPLEMENTS.md §5. ADR-0250.';

-- ─── Part C: INSERT 6 platform-level Riksavtalen rules (workspace_id=NULL) ────
-- These 6 rows are CONFIG DATA, not code.
-- Rates sourced from task spec (verified from Riksavtalen 2025-satser fra 1. april 2025).
-- tariff_rate_table_id populated AFTER tariff seed migration (20260527100700).
-- Using NULL for tariff_rate_table_id here; T1.9 migration updates these FKs.
-- match_predicate is the DSL consumed by evaluateSupplements() in calc-engine.

INSERT INTO public.supplement_rule (
  name, supplement_type, is_active, rate_type, rate_value,
  tariff_rate_table_id, match_predicate, paragraf_ref,
  valid_from, workspace_id
) VALUES
  -- Rule 1: Kveldstillegg (weekday evenings 21:00-24:00)
  (
    'Kveldstillegg',
    'normal', true, 'fixed_per_hour', 16.01,
    NULL,
    '{"weekdays": [1, 2, 3, 4, 5], "time_from": "21:00", "time_to": "24:00"}'::jsonb,
    'Riksavtalen §4.3-3.2',
    '2025-04-01', NULL
  ),
  -- Rule 2: Helgetillegg (Saturday from 14:00, Sunday from 06:00)
  (
    'Helgetillegg',
    'normal', true, 'fixed_per_hour', 30.42,
    NULL,
    '{"conditions": [{"weekdays": [6], "time_from": "14:00", "time_to": "24:00"}, {"weekdays": [7], "time_from": "06:00", "time_to": "24:00"}]}'::jsonb,
    'Riksavtalen §4.3-3.1',
    '2025-04-01', NULL
  ),
  -- Rule 3: Nattillegg — nattevakter (night_watch category)
  (
    'Nattillegg nattevakter',
    'normal', true, 'fixed_per_hour', 42.41,
    NULL,
    '{"night_worker_category": "night_watch"}'::jsonb,
    'Riksavtalen §4.3-3.3',
    '2025-04-01', NULL
  ),
  -- Rule 4: Nattillegg manuelt per time
  (
    'Nattillegg manuelt arbeid per time',
    'normal', true, 'fixed_per_hour', 24.01,
    NULL,
    '{"night_worker_category": "manual"}'::jsonb,
    'Riksavtalen §4.3-3.5',
    '2025-04-01', NULL
  ),
  -- Rule 5: Nattillegg manuelt per vakt (flat rate per shift)
  (
    'Nattillegg manuelt arbeid per vakt',
    'normal', true, 'fixed_per_shift', 144.06,
    NULL,
    '{"night_worker_category": "manual"}'::jsonb,
    'Riksavtalen §4.3-3.5',
    '2025-04-01', NULL
  ),
  -- Rule 6: Nattillegg ordinær (øvrige arbeidstakere)
  (
    'Nattillegg ordinær',
    'normal', true, 'fixed_per_hour', 56.02,
    NULL,
    '{"night_worker_category": "ordinary"}'::jsonb,
    'Riksavtalen §4.3-3.3',
    '2025-04-01', NULL
  )
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.supplement_rule IS
  'Platform rules (workspace_id=NULL) seeded above reference tariff_rate_table via FK. '
  'FK populated by migration 20260527100700_payroll_phase1_tariff_seed.sql '
  'using UPDATE ... SET tariff_rate_table_id = (SELECT id FROM tariff_rate_table WHERE ...).';
