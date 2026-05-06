-- =============================================================================
-- 08 — contract_obligation (ny)
-- =============================================================================
-- Operasjonelle forpliktelser per kontrakt (lag 2 i 3-lagsmodellen).
-- Snapshot ved kontrakt-opprettelse — IKKE live-link til mal.
-- Endring i mal = amendment-tilbud, ikke automatisk overskriving.

CREATE TABLE contract_obligation (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id         uuid NOT NULL
                        REFERENCES employment_contract(id) ON DELETE CASCADE,
  obligation_type     obligation_type NOT NULL,
  policy_id           uuid REFERENCES policy(id) ON DELETE SET NULL,
  protocol_id         uuid REFERENCES protocol(id) ON DELETE SET NULL,
  due_within_days     smallint,
  due_at              date GENERATED ALWAYS AS (
                        CASE
                          WHEN due_within_days IS NULL THEN NULL
                          ELSE NULL  -- beregnes av app-lag fra contract.start_date + due_within_days
                        END
                      ) STORED,
  is_blocker          boolean NOT NULL DEFAULT false,
  reference_text      text NOT NULL,
  status              obligation_status NOT NULL DEFAULT 'pending',
  started_at          timestamptz,
  completed_at        timestamptz,
  waived_at           timestamptz,
  waived_reason       text,
  waived_by_user_id   uuid REFERENCES "user"(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- waive må ha begrunnelse og bruker
  CONSTRAINT contract_obligation_waive_consistent
    CHECK (
      (status = 'waived' AND waived_at IS NOT NULL AND waived_reason IS NOT NULL AND waived_by_user_id IS NOT NULL)
      OR (status != 'waived' AND waived_at IS NULL)
    ),

  -- completed må ha completed_at
  CONSTRAINT contract_obligation_completed_consistent
    CHECK (
      (status = 'completed' AND completed_at IS NOT NULL)
      OR (status != 'completed' AND completed_at IS NULL)
    ),

  -- Minst én av policy/protocol må peke et sted (ellers er det meningsløs obligation)
  CONSTRAINT contract_obligation_has_target
    CHECK (policy_id IS NOT NULL OR protocol_id IS NOT NULL)
);

-- due_at som GENERATED COLUMN er tricky pga referanse til annen tabell.
-- I praksis: app beregner due_at og skriver til en faktisk kolonne.
-- Drop GENERATED og bruk concrete column:
ALTER TABLE contract_obligation
  DROP COLUMN due_at;

ALTER TABLE contract_obligation
  ADD COLUMN due_at date;

CREATE OR REPLACE FUNCTION compute_obligation_due_at()
RETURNS trigger AS $$
DECLARE
  contract_start_date date;
BEGIN
  IF NEW.due_within_days IS NULL THEN
    NEW.due_at := NULL;
  ELSE
    SELECT start_date INTO contract_start_date
    FROM employment_contract
    WHERE id = NEW.contract_id;
    NEW.due_at := contract_start_date + NEW.due_within_days;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contract_obligation_compute_due_at
  BEFORE INSERT OR UPDATE OF due_within_days, contract_id ON contract_obligation
  FOR EACH ROW
  EXECUTE FUNCTION compute_obligation_due_at();

-- =============================================================================
-- Indekser (architecture §10 — blocker-sjekk må være < 100ms)
-- =============================================================================

-- Primær blocker-sjekk: "har denne ansatte aktive blocker-obligations?"
CREATE INDEX contract_obligation_blocker_lookup
  ON contract_obligation (contract_id, status)
  WHERE is_blocker = true AND status IN ('pending', 'in_progress', 'overdue');

-- Cross-profile blocker-sjekk via JOIN
CREATE INDEX contract_obligation_status_due
  ON contract_obligation (status, due_at)
  WHERE status IN ('pending', 'in_progress');

-- Frist-evaluering (cron)
CREATE INDEX contract_obligation_due_at
  ON contract_obligation (due_at)
  WHERE status = 'pending' AND due_at IS NOT NULL;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE contract_obligation IS
  'Operasjonelle forpliktelser per kontrakt. Snapshot ved opprettelse, ikke live-link. '
  'Aktivitetskrav som "logge inn 2 ganger/uke" hører IKKE hjemme her — det er KPI, ikke '
  'juridisk forpliktelse. Bruk separat expectation-tabell hvis behov oppstår.';

COMMENT ON COLUMN contract_obligation.is_blocker IS
  'True = kan ikke jobbe shift før fullført. Sjekkes av shift-engine ved tildeling.';

COMMENT ON COLUMN contract_obligation.reference_text IS
  'Norsk klartekst som vises til ansatt og brukes i Botsson-svar. '
  'Eksempel: "Ifølge §3 i kontrakt skal du fullføre HMS-opplæring innen 14 dager"';

COMMENT ON COLUMN contract_obligation.due_at IS
  'Beregnet fra contract.start_date + due_within_days via trigger. '
  'NULL hvis ingen frist (frivillig sertifisering).';

COMMENT ON COLUMN contract_obligation.waived_reason IS
  'Påkrevd ved status=waived. Audit-trail for hvorfor forpliktelse ble fritatt.';
