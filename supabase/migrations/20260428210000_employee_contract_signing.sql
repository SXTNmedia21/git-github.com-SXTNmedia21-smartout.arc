-- Migration: employee_contract_signing
-- Purpose: Links employment_contract HR records to DocuSeal signing entities,
-- adds employee-scoped RLS policies on contract table, and seeds Norwegian
-- standard employee contract templates.

-- 1. Add signing_contract_id FK to employment_contract
ALTER TABLE employment_contract
  ADD COLUMN signing_contract_id UUID REFERENCES contract(contract_id);

CREATE INDEX idx_employment_contract_signing
  ON employment_contract(signing_contract_id)
  WHERE signing_contract_id IS NOT NULL;

COMMENT ON COLUMN employment_contract.signing_contract_id IS
  'FK to contract table — links this HR record to the DocuSeal signing entity';

-- 2. RLS policies for workspace-scoped contract access
-- Admin read
CREATE POLICY "workspace_admin_read_employee_contracts"
  ON contract FOR SELECT
  USING (
    workspace_id IS NOT NULL
    AND contract_type = 'employee'
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- Admin insert
CREATE POLICY "workspace_admin_insert_employee_contracts"
  ON contract FOR INSERT
  WITH CHECK (
    workspace_id IS NOT NULL
    AND contract_type = 'employee'
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- Admin update drafts
CREATE POLICY "workspace_admin_update_employee_contracts"
  ON contract FOR UPDATE
  USING (
    workspace_id IS NOT NULL
    AND contract_type = 'employee'
    AND status = 'draft'
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- Employee read own contracts via FK join
CREATE POLICY "employee_read_own_contracts"
  ON contract FOR SELECT
  USING (
    contract_type = 'employee'
    AND contract_id IN (
      SELECT signing_contract_id FROM employment_contract ec
      JOIN profile p ON p.profile_id = ec.profile_id
      WHERE p.user_id = auth.uid()
      AND ec.signing_contract_id IS NOT NULL
    )
  );

-- 3. Seed standard employee contract templates
-- contract_template inherited a legacy NOT NULL `template_type` column from the
-- pre-rename `platform_contract_template` table. The new wider `contract_type`
-- supersedes it, so loosen the constraint before seeding employee templates.
ALTER TABLE public.contract_template
  ALTER COLUMN template_type DROP NOT NULL;

INSERT INTO contract_template (
  template_id, name, description, contract_type, language,
  content_html, placeholders, is_system, is_active, workspace_id
) VALUES
(
  gen_random_uuid(),
  'Arbeidsavtale — Fast ansatt',
  'Standard arbeidsavtale for fast ansatte med månedslønn',
  'employee', 'no',
  '<h1>Arbeidsavtale</h1>
<section data-clause-id="parties">
<h2>Parter</h2>
<p>Denne avtalen er inngått mellom:</p>
<p><strong>Arbeidsgiver:</strong> {{arbeidsgiver_navn}}, org.nr. {{arbeidsgiver_org_nr}}, {{arbeidsgiver_adresse}}</p>
<p><strong>Arbeidstaker:</strong> {{ansatt_navn}}, personnr. {{ansatt_personnummer}}, {{ansatt_adresse}}</p>
</section>
<section data-clause-id="position">
<h2>Stilling og arbeidssted</h2>
<p>Arbeidstaker tiltrer stillingen som <strong>{{stilling}}</strong> i avdeling <strong>{{avdeling}}</strong> ved <strong>{{arbeidssted}}</strong>.</p>
<p>Tiltredelsesdato: {{startdato}}</p>
</section>
<section data-clause-id="compensation">
<h2>Lønn</h2>
<p>Månedslønn: <strong>{{maanedslonn}} NOK</strong> (brutto)</p>
<p>Stillingsprosent: <strong>{{stillingsprosent}}%</strong></p>
<p>Lønn utbetales den 15. hver måned.</p>
</section>
<section data-clause-id="hours">
<h2>Arbeidstid</h2>
<p>Normal arbeidstid er i henhold til gjeldende tariffavtale og arbeidsmiljøloven.</p>
</section>
<section data-clause-id="termination">
<h2>Oppsigelse</h2>
<p>Gjensidig oppsigelsestid er 1 måned i prøvetiden, deretter 3 måneder.</p>
</section>
<section data-clause-id="gdpr">
<h2>Personvern</h2>
<p>Arbeidsgiver behandler personopplysninger i henhold til personopplysningsloven og GDPR. Se personvernerklæring for detaljer.</p>
</section>
<section data-clause-id="signature">
<h2>Underskrift</h2>
<p>Sted og dato: {{kontraktdato}}</p>
<p>Arbeidsgiver: ____________________</p>
<p>Arbeidstaker: ____________________</p>
</section>',
  '[
    {"key":"arbeidsgiver_navn","label":"Arbeidsgiver","source":"company","required":true},
    {"key":"arbeidsgiver_org_nr","label":"Org.nr.","source":"company","required":true},
    {"key":"arbeidsgiver_adresse","label":"Adresse arbeidsgiver","source":"workspace","required":true},
    {"key":"ansatt_navn","label":"Ansatt navn","source":"profile","required":true},
    {"key":"ansatt_personnummer","label":"Personnummer","source":"profile","required":true},
    {"key":"ansatt_adresse","label":"Adresse ansatt","source":"profile","required":false},
    {"key":"stilling","label":"Stilling","source":"employment_contract","required":true},
    {"key":"avdeling","label":"Avdeling","source":"department","required":false},
    {"key":"arbeidssted","label":"Arbeidssted","source":"workspace","required":true},
    {"key":"startdato","label":"Startdato","source":"employment_contract","required":true},
    {"key":"maanedslonn","label":"Månedslønn","source":"employment_contract","required":true},
    {"key":"stillingsprosent","label":"Stillingsprosent","source":"employment_contract","required":true},
    {"key":"kontraktdato","label":"Dato","source":"auto","required":true}
  ]'::jsonb,
  true, true, NULL
),
(
  gen_random_uuid(),
  'Arbeidsavtale — Deltid',
  'Standard arbeidsavtale for deltidsansatte med timelønn',
  'employee', 'no',
  '<h1>Arbeidsavtale — Deltid</h1>
<section data-clause-id="parties">
<h2>Parter</h2>
<p><strong>Arbeidsgiver:</strong> {{arbeidsgiver_navn}}, org.nr. {{arbeidsgiver_org_nr}}</p>
<p><strong>Arbeidstaker:</strong> {{ansatt_navn}}, personnr. {{ansatt_personnummer}}</p>
</section>
<section data-clause-id="position">
<h2>Stilling</h2>
<p>Stilling: <strong>{{stilling}}</strong>, avdeling: <strong>{{avdeling}}</strong></p>
<p>Tiltredelse: {{startdato}}</p>
</section>
<section data-clause-id="compensation">
<h2>Lønn og arbeidstid</h2>
<p>Timelønn: <strong>{{timelonn}} NOK</strong> (brutto)</p>
<p>Stillingsprosent: <strong>{{stillingsprosent}}%</strong></p>
<p>Avtalt ukentlig arbeidstid: <strong>{{avtalt_timer_uke}} timer</strong></p>
</section>
<section data-clause-id="termination">
<h2>Oppsigelse</h2>
<p>Gjensidig oppsigelsestid: 1 måned.</p>
</section>
<section data-clause-id="signature">
<h2>Underskrift</h2>
<p>Dato: {{kontraktdato}}</p>
</section>',
  '[
    {"key":"arbeidsgiver_navn","label":"Arbeidsgiver","source":"company","required":true},
    {"key":"arbeidsgiver_org_nr","label":"Org.nr.","source":"company","required":true},
    {"key":"ansatt_navn","label":"Ansatt navn","source":"profile","required":true},
    {"key":"ansatt_personnummer","label":"Personnummer","source":"profile","required":true},
    {"key":"stilling","label":"Stilling","source":"employment_contract","required":true},
    {"key":"avdeling","label":"Avdeling","source":"department","required":false},
    {"key":"startdato","label":"Startdato","source":"employment_contract","required":true},
    {"key":"timelonn","label":"Timelønn","source":"employment_contract","required":true},
    {"key":"stillingsprosent","label":"Stillingsprosent","source":"employment_contract","required":true},
    {"key":"avtalt_timer_uke","label":"Timer per uke","source":"employment_contract","required":true},
    {"key":"kontraktdato","label":"Dato","source":"auto","required":true}
  ]'::jsonb,
  true, true, NULL
),
(
  gen_random_uuid(),
  'Arbeidsavtale — Tilkallingsvikar',
  'Avtale for tilkallingsvikarer uten fast arbeidstid',
  'employee', 'no',
  '<h1>Tilkallingsavtale</h1>
<section data-clause-id="parties">
<h2>Parter</h2>
<p><strong>Arbeidsgiver:</strong> {{arbeidsgiver_navn}}, org.nr. {{arbeidsgiver_org_nr}}</p>
<p><strong>Arbeidstaker:</strong> {{ansatt_navn}}, personnr. {{ansatt_personnummer}}</p>
</section>
<section data-clause-id="position">
<h2>Stilling</h2>
<p>Stilling: <strong>{{stilling}}</strong>, avdeling: <strong>{{avdeling}}</strong></p>
<p>Tilgjengelig fra: {{startdato}}</p>
</section>
<section data-clause-id="compensation">
<h2>Lønn</h2>
<p>Timelønn: <strong>{{timelonn}} NOK</strong> (brutto)</p>
<p>Arbeidstaker tilkalles etter behov og er ikke garantert et minimum antall timer.</p>
</section>
<section data-clause-id="signature">
<h2>Underskrift</h2>
<p>Dato: {{kontraktdato}}</p>
</section>',
  '[
    {"key":"arbeidsgiver_navn","label":"Arbeidsgiver","source":"company","required":true},
    {"key":"arbeidsgiver_org_nr","label":"Org.nr.","source":"company","required":true},
    {"key":"ansatt_navn","label":"Ansatt navn","source":"profile","required":true},
    {"key":"ansatt_personnummer","label":"Personnummer","source":"profile","required":true},
    {"key":"stilling","label":"Stilling","source":"employment_contract","required":true},
    {"key":"avdeling","label":"Avdeling","source":"department","required":false},
    {"key":"startdato","label":"Startdato","source":"employment_contract","required":true},
    {"key":"timelonn","label":"Timelønn","source":"employment_contract","required":true},
    {"key":"kontraktdato","label":"Dato","source":"auto","required":true}
  ]'::jsonb,
  true, true, NULL
);
