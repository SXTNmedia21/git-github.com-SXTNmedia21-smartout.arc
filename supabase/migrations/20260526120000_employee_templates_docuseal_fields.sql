-- ============================================
-- 20260526120000_employee_templates_docuseal_fields.sql
-- SMA-305 follow-up · 2026-05-06
--
-- Update K1a employee contract templates so they:
--   (1) Include DocuSeal signature-field tags so dispatch creates a real
--       signing flow (was failing 502 "Template does not contain fields").
--   (2) Use proper §14-6 structure with consistent section ordering.
--   (3) Use Norwegian placeholder keys that match buildEmployeePlaceholderMap.
--
-- Templates affected (3): Fast ansatt, Deltid, Tilkallingsvikar. All K1a
-- (workspace_id IS NULL, is_system = true).
--
-- DocuSeal transform happens in services/contract-service/src/routes/contracts.ts
-- (lines ~218-233): <div data-type="signature-field" data-role="sender"> →
-- <signature-field name="Signatur Smartout" role="Leverandør">. Date-fields:
-- <span data-type="date-field" data-label="..."> → <date-field name="...">.
--
-- Note: server still uses "Leverandør"/"Kunde" labels — separate sortie can
-- localize these to "Arbeidsgiver"/"Arbeidstaker" for employment contracts.
-- ============================================

-- Fast ansatt (permanent employment)
UPDATE public.contract_template
SET content_html = $$<h1>Arbeidsavtale — Fast ansatt</h1>
<section data-clause-id="parties">
<h2>1. Partene</h2>
<p>Denne arbeidsavtalen er inngått mellom:</p>
<p><strong>Arbeidsgiver:</strong> {{arbeidsgiver_navn}}, organisasjonsnummer {{arbeidsgiver_org_nr}}, {{arbeidsgiver_adresse}}.</p>
<p><strong>Arbeidstaker:</strong> {{ansatt_navn}}, fødselsnummer {{ansatt_personnummer}}, {{ansatt_adresse}}.</p>
</section>
<section data-clause-id="position">
<h2>2. Stilling og arbeidssted</h2>
<p>Arbeidstaker tiltrer stillingen som <strong>{{stilling}}</strong> i avdeling <strong>{{avdeling}}</strong> ved <strong>{{arbeidssted}}</strong>.</p>
<p><strong>Tiltredelsesdato:</strong> {{startdato}}.</p>
<p>Arbeidsforholdet er fast. Eventuelt arbeidsstedsbytte avklares skriftlig.</p>
</section>
<section data-clause-id="working-hours">
<h2>3. Arbeidstid</h2>
<p>Avtalt ukentlig arbeidstid er <strong>{{avtalt_timer_uke}}</strong> timer, tilsvarende <strong>{{stillingsprosent}}%</strong> stilling.</p>
<p>Ordinær arbeidstid følger gjeldende vaktplan og tariffavtale, innenfor rammene av arbeidsmiljøloven.</p>
</section>
<section data-clause-id="compensation">
<h2>4. Lønn</h2>
<p><strong>Månedslønn:</strong> {{maanedslonn}} NOK (brutto).</p>
<p><strong>Timelønn:</strong> {{timelonn}} NOK (brutto).</p>
<p>Lønn utbetales den 15. i hver måned. Tillegg, overtidsbetaling og helgetillegg følger tariffavtalen.</p>
</section>
<section data-clause-id="probation">
<h2>5. Prøvetid</h2>
<p>Det avtales prøvetid i 6 måneder fra tiltredelse. I prøvetiden gjelder gjensidig oppsigelsesfrist på 14 dager.</p>
</section>
<section data-clause-id="termination">
<h2>6. Oppsigelse</h2>
<p>Etter prøvetid gjelder gjensidig oppsigelsesfrist iht. arbeidsmiljølovens regler og ansettelsestid.</p>
</section>
<section data-clause-id="vacation">
<h2>7. Ferie og feriepenger</h2>
<p>Ferie tas i henhold til ferieloven. Feriepenger beregnes etter gjeldende sats (minimum 12,0 % – 14,3 % ved tariffbinding).</p>
</section>
<section data-clause-id="other">
<h2>8. Øvrige vilkår</h2>
<p>For øvrig gjelder bestemmelsene i arbeidsmiljøloven, ferieloven, gjeldende tariffavtale og arbeidsgivers ordensregler.</p>
<p>Personopplysninger behandles i tråd med personopplysningsloven og GDPR. Se personvernerklæring for detaljer.</p>
</section>
<section data-clause-id="signature">
<h2>9. Signering</h2>
<p>Ved å signere bekrefter partene at de har lest og forstått innholdet i avtalen.</p>
<p><strong>Sted og dato:</strong> <span data-type="date-field" data-label="Dato"></span></p>
<p><strong>Arbeidsgiver:</strong></p>
<div data-type="signature-field" data-role="sender"></div>
<p><strong>Arbeidstaker:</strong></p>
<div data-type="signature-field" data-role="recipient"></div>
</section>$$,
    updated_at = now()
WHERE name = 'Arbeidsavtale — Fast ansatt' AND is_system = true;

-- Deltid (part-time)
UPDATE public.contract_template
SET content_html = $$<h1>Arbeidsavtale — Deltid</h1>
<section data-clause-id="parties">
<h2>1. Partene</h2>
<p>Denne arbeidsavtalen er inngått mellom:</p>
<p><strong>Arbeidsgiver:</strong> {{arbeidsgiver_navn}}, organisasjonsnummer {{arbeidsgiver_org_nr}}, {{arbeidsgiver_adresse}}.</p>
<p><strong>Arbeidstaker:</strong> {{ansatt_navn}}, fødselsnummer {{ansatt_personnummer}}, {{ansatt_adresse}}.</p>
</section>
<section data-clause-id="position">
<h2>2. Stilling og arbeidssted</h2>
<p>Arbeidstaker tiltrer deltidsstillingen som <strong>{{stilling}}</strong> i avdeling <strong>{{avdeling}}</strong> ved <strong>{{arbeidssted}}</strong>.</p>
<p><strong>Tiltredelsesdato:</strong> {{startdato}}.</p>
</section>
<section data-clause-id="working-hours">
<h2>3. Arbeidstid</h2>
<p>Avtalt ukentlig arbeidstid er <strong>{{avtalt_timer_uke}}</strong> timer ({{stillingsprosent}}% stilling). Vakter avtales etter vaktplan.</p>
</section>
<section data-clause-id="compensation">
<h2>4. Lønn</h2>
<p><strong>Timelønn:</strong> {{timelonn}} NOK (brutto). Tillegg følger tariffavtale.</p>
<p>Lønn utbetales den 15. i hver måned.</p>
</section>
<section data-clause-id="termination">
<h2>5. Oppsigelse</h2>
<p>Gjensidig oppsigelsesfrist iht. arbeidsmiljølovens regler. Prøvetid 6 måneder med 14 dagers oppsigelsesfrist.</p>
</section>
<section data-clause-id="vacation">
<h2>6. Ferie og feriepenger</h2>
<p>Ferie og feriepenger iht. ferieloven og tariffavtale.</p>
</section>
<section data-clause-id="other">
<h2>7. Øvrige vilkår</h2>
<p>Arbeidsmiljøloven, ferieloven, gjeldende tariffavtale og arbeidsgivers ordensregler gjelder.</p>
</section>
<section data-clause-id="signature">
<h2>8. Signering</h2>
<p><strong>Sted og dato:</strong> <span data-type="date-field" data-label="Dato"></span></p>
<p><strong>Arbeidsgiver:</strong></p>
<div data-type="signature-field" data-role="sender"></div>
<p><strong>Arbeidstaker:</strong></p>
<div data-type="signature-field" data-role="recipient"></div>
</section>$$,
    updated_at = now()
WHERE name = 'Arbeidsavtale — Deltid' AND is_system = true;

-- Tilkallingsvikar (on-call)
UPDATE public.contract_template
SET content_html = $$<h1>Arbeidsavtale — Tilkallingsvikar</h1>
<section data-clause-id="parties">
<h2>1. Partene</h2>
<p>Denne arbeidsavtalen er inngått mellom:</p>
<p><strong>Arbeidsgiver:</strong> {{arbeidsgiver_navn}}, organisasjonsnummer {{arbeidsgiver_org_nr}}, {{arbeidsgiver_adresse}}.</p>
<p><strong>Arbeidstaker:</strong> {{ansatt_navn}}, fødselsnummer {{ansatt_personnummer}}, {{ansatt_adresse}}.</p>
</section>
<section data-clause-id="position">
<h2>2. Stilling</h2>
<p>Arbeidstaker tiltrer tilkallingsstillingen som <strong>{{stilling}}</strong> ved <strong>{{arbeidssted}}</strong>.</p>
<p><strong>Tiltredelsesdato:</strong> {{startdato}}. Arbeidsforholdet løper inntil oppsigelse.</p>
</section>
<section data-clause-id="working-hours">
<h2>3. Arbeidstid</h2>
<p>Tilkallingsvikar har ingen avtalt fast arbeidstid. Vakter tilbys etter behov; arbeidstaker står fritt til å takke ja eller nei til hver enkelt vakt.</p>
</section>
<section data-clause-id="compensation">
<h2>4. Lønn</h2>
<p><strong>Timelønn:</strong> {{timelonn}} NOK (brutto). Helgetillegg, kveldstillegg og overtidsbetaling iht. tariffavtale.</p>
<p>Lønn utbetales den 15. i hver måned for foregående periode.</p>
</section>
<section data-clause-id="termination">
<h2>5. Oppsigelse</h2>
<p>Gjensidig oppsigelsesfrist 14 dager. Arbeidsforholdet kan også avsluttes ved manglende vakttilbud over 90 dager.</p>
</section>
<section data-clause-id="other">
<h2>6. Øvrige vilkår</h2>
<p>Arbeidsmiljøloven, ferieloven, gjeldende tariffavtale og arbeidsgivers ordensregler gjelder så langt de passer for tilkallingsforhold.</p>
</section>
<section data-clause-id="signature">
<h2>7. Signering</h2>
<p><strong>Sted og dato:</strong> <span data-type="date-field" data-label="Dato"></span></p>
<p><strong>Arbeidsgiver:</strong></p>
<div data-type="signature-field" data-role="sender"></div>
<p><strong>Arbeidstaker:</strong></p>
<div data-type="signature-field" data-role="recipient"></div>
</section>$$,
    updated_at = now()
WHERE name = 'Arbeidsavtale — Tilkallingsvikar' AND is_system = true;

-- Verify
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.contract_template
  WHERE name LIKE 'Arbeidsavtale —%'
    AND is_system = true
    AND content_html LIKE '%data-type="signature-field"%';

  IF v_count < 3 THEN
    RAISE EXCEPTION 'Expected 3 employee templates with signature-fields, got %', v_count;
  END IF;

  RAISE NOTICE 'employee_templates_docuseal_fields: % templates updated with signature-fields', v_count;
END $$;
