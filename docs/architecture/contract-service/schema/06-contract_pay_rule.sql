-- =============================================================================
-- 06 — contract_pay_rule (ny)
-- =============================================================================
-- Lønns-regler per kontrakt. Tripletex salaryType-aligned.
-- Refereres av shift-engine ved lønns-evaluering.

CREATE TABLE contract_pay_rule (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id         uuid NOT NULL
                        REFERENCES employment_contract(id) ON DELETE CASCADE,
  rule_type           pay_rule_type NOT NULL,
  salary_type_code    text NOT NULL
                        REFERENCES salary_type(code) ON DELETE RESTRICT,
  trigger_condition   jsonb NOT NULL DEFAULT '{}'::jsonb,
  rate_type           rate_type NOT NULL,
  rate_value          numeric(10,4) NOT NULL,
  source_text         text,                          -- "Riksavtalen §3.2"
  framework_rule_id   uuid,                          -- FK → framework_rule (eksisterer)
  effective_from      date NOT NULL,
  effective_until     date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- Trigger-condition må være JSON-objekt
  CONSTRAINT contract_pay_rule_trigger_is_object
    CHECK (jsonb_typeof(trigger_condition) = 'object'),

  -- Rate-verdi rimelig
  CONSTRAINT contract_pay_rule_rate_value_range
    CHECK (rate_value >= 0 AND rate_value <= 1000000),

  -- Effective-vindu konsistent
  CONSTRAINT contract_pay_rule_effective_order
    CHECK (effective_until IS NULL OR effective_until > effective_from),

  -- Salary-type-kode-konsistens med rule_type
  -- (lookup-tabell vil håndheve dette via CHECK ved app-lag pga FK)
  CONSTRAINT contract_pay_rule_percent_only_for_percent_type
    CHECK (
      rate_type != 'percent_of_base'
      OR (rate_value >= 0 AND rate_value <= 1000)  -- 0–1000% rimelig
    )
);

-- FK til framework_rule lagt til separat for å håndtere at den kanskje ikke finnes ennå
-- ALTER TABLE contract_pay_rule
--   ADD CONSTRAINT contract_pay_rule_framework_rule_fk
--     FOREIGN KEY (framework_rule_id) REFERENCES framework_rule(id) ON DELETE SET NULL;

COMMENT ON TABLE contract_pay_rule IS
  'Lønns-regler per kontrakt. Hver regel evalueres ved shift; matchende regler stackes '
  'iht. trigger_condition.stacks_with.';

COMMENT ON COLUMN contract_pay_rule.trigger_condition IS
  'JSONB med versjonering. Eksempel: '
  '{"version":1,"time_range":"18:00-22:00","day_type":["weekday"],'
  '"min_shift_hours":4,"stacks_with":["weekend_supplement"]}';

COMMENT ON COLUMN contract_pay_rule.framework_rule_id IS
  'Snapshot-peker til versjonert framework_rule (Riksavtalen-versjon, lokal avtale). '
  'NULL hvis ren custom-regel uten tariff-grunnlag.';

COMMENT ON COLUMN contract_pay_rule.source_text IS
  'Menneskelesbar kilde, vist til ansatt. Eksempel: "Riksavtalen §3.2 (versjon 2024)"';

-- =============================================================================
-- Indekser (architecture §10 — shift-evaluering må være rask)
-- =============================================================================

-- Primær lookup ved shift-evaluering
CREATE INDEX contract_pay_rule_contract_type_effective
  ON contract_pay_rule (contract_id, rule_type, effective_from);

-- Aktiv regel-vindu
CREATE INDEX contract_pay_rule_active_window
  ON contract_pay_rule (contract_id, effective_from, effective_until);

-- Reverse lookup fra framework_rule (når tariff-revisjon trigger amendments)
CREATE INDEX contract_pay_rule_framework
  ON contract_pay_rule (framework_rule_id)
  WHERE framework_rule_id IS NOT NULL;
