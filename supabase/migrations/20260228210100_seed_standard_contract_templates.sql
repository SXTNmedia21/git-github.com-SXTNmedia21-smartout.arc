SET search_path TO public, extensions;

-- Migration: Seed two standard contract templates
-- 1. Smartout Onboarding & Drift (B2B implementation agreement — like Spåtind)
-- 2. Smartout Lisens- og brukeravtale (SaaS license + DPA — like Villa Mat)

-- =============================================================================
-- Template 1: Onboarding & Drift Agreement
-- =============================================================================
INSERT INTO public.contract_template (
  template_id,
  name,
  content_html,
  contract_type,
  template_type,
  language,
  locale,
  status,
  is_active,
  is_system,
  description,
  placeholders,
  attachments,
  created_by
) VALUES (
  'c0000001-0000-0000-0000-000000000001',
  'Smartout Onboarding & Drift',
  '
<h1>Avtale – Smartout Onboarding &amp; Drift</h1>
<h2><span data-type="placeholder-field" data-key="kunde_navn" data-label="Kundenavn" data-placeholder-type="manual" data-value="">{{kunde_navn}}</span></h2>
<p><strong>Dato:</strong> <span data-type="date-field" data-key="avtale_dato" data-label="Avtaledato" data-format="dd.MM.yyyy" data-value=""></span>
<strong>Avtaleparter:</strong> Smartout AS (org.nr. 929 620 291) / <span data-type="placeholder-field" data-key="kunde_navn" data-label="Kundenavn" data-placeholder-type="manual" data-value="">{{kunde_navn}}</span> (org.nr. <span data-type="placeholder-field" data-key="kunde_org_nr" data-label="Org.nr. kunde" data-placeholder-type="manual" data-value="">{{kunde_org_nr}}</span>)</p>
<p><strong>Kontaktperson Smartout:</strong> <span data-type="placeholder-field" data-key="smartout_kontakt" data-label="Kontaktperson Smartout" data-placeholder-type="auto" data-value="">{{smartout_kontakt}}</span>, CEO
<strong>Kontaktperson kunde:</strong> <span data-type="placeholder-field" data-key="kunde_kontakt" data-label="Kontaktperson kunde" data-placeholder-type="manual" data-value="">{{kunde_kontakt}}</span></p>

<div data-type="clause-block" data-clause-id="omfang" data-title="1. Omfang" data-category="general" data-collapsed="false">
<p>Smartout AS gjennomforer implementering av Smartout Employee Readiness System for <span data-type="placeholder-field" data-key="kunde_navn" data-label="Kundenavn" data-placeholder-type="manual" data-value="">{{kunde_navn}}</span>. Implementeringen dekker oppsett, konfigurasjon og opplaering for folgende avdelinger: <span data-type="placeholder-field" data-key="avdelinger" data-label="Avdelinger" data-placeholder-type="manual" data-value="">{{avdelinger}}</span>.</p>
<p><span data-type="placeholder-field" data-key="smartout_kontakt" data-label="Kontaktperson Smartout" data-placeholder-type="auto" data-value="">{{smartout_kontakt}}</span> (Smartout) driver implementeringen personlig gjennom fysiske besok og oppfolgende digitale moter med samtlige avdelingsledere.</p>
</div>

<div data-type="clause-block" data-clause-id="leveranser" data-title="2. Leveranser" data-category="deliverables" data-collapsed="false">
<p><strong>Inkludert i onboarding-pakken:</strong></p>
<ul>
<li>Komplett workspace-oppsett (avdelinger, team, soner, assets)</li>
<li>Basisrutiner (HACCP, apne/stenge, daglig renhold)</li>
<li>Digital opplaering med avdelingsledere under hvert fysisk besok</li>
<li><span data-type="placeholder-field" data-key="antall_besok" data-label="Antall besok" data-placeholder-type="manual" data-value="">{{antall_besok}}</span> fysiske besok for implementering og oppfolging</li>
<li>Oppfolgende digitale moter med samtlige avdelingsledere mellom besok</li>
<li>Ukentlig skriftlig oppfolging gjennom <span data-type="placeholder-field" data-key="oppfolging_periode" data-label="Oppfolgingsperiode" data-placeholder-type="manual" data-value="">{{oppfolging_periode}}</span></li>
</ul>
<p><strong>Avdelinger som dekkes:</strong></p>
<p><span data-type="placeholder-field" data-key="avdelinger_detalj" data-label="Avdelingsdetaljer (tabell)" data-placeholder-type="manual" data-value="">{{avdelinger_detalj}}</span></p>
</div>

<div data-type="clause-block" data-clause-id="implementeringsplan" data-title="3. Implementeringsplan" data-category="timeline" data-collapsed="false">
<p><strong>Besok 1 – Grunnoppsett</strong></p>
<p><strong>Dato:</strong> <span data-type="placeholder-field" data-key="besok_1_dato" data-label="Besok 1 dato" data-placeholder-type="manual" data-value="">{{besok_1_dato}}</span></p>
<p>Smartout settes opp med grunnleggende struktur for samtlige avdelinger. Digital opplaering gjennomfores med avdelingsledere.</p>
<ul>
<li>Oppsett av avdelinger, team og soner</li>
<li>Registrering av assets og rutineutlosere</li>
<li>Aktivering av MVP-rutiner (HACCP, apne/stenge, renhold)</li>
<li>Opplaering med avdelingsledere</li>
<li>Verifisering av oppgaveflyt</li>
</ul>
<p><strong>Besok 2 – Generalprove</strong></p>
<p><strong>Dato:</strong> <span data-type="placeholder-field" data-key="besok_2_dato" data-label="Besok 2 dato" data-placeholder-type="manual" data-value="">{{besok_2_dato}}</span></p>
<p>Systemet valideres under reell drift.</p>
<ul>
<li>Alle ansatte registrert i systemet</li>
<li>Vaktplan aktiv</li>
<li>Rutiner brukt live</li>
<li>Avvik registrert og fulgt opp</li>
<li>Justering basert pa erfaringer fra Besok 1</li>
</ul>
<p><strong>Besok 3 – Evaluering og ferdigstilling</strong></p>
<p><strong>Dato:</strong> <span data-type="placeholder-field" data-key="besok_3_dato" data-label="Besok 3 dato" data-placeholder-type="manual" data-value="">{{besok_3_dato}}</span></p>
<p>Full produksjonsvalidering med maksimal belastning.</p>
<ul>
<li>Verifisering av systemet under hoy kapasitet</li>
<li>Optimalisering av kontrollpunkter</li>
<li>Evaluering og sluttrapport</li>
<li>Overlevering til selvstendig drift</li>
</ul>
</div>

<div data-type="clause-block" data-clause-id="digital_oppfolging" data-title="4. Digital oppfolging" data-category="support" data-collapsed="false">
<p>Mellom og etter fysiske besok gjennomfores:</p>
<ul>
<li>Digitale moter med samtlige avdelingsledere (planlegges fortlopende)</li>
<li>Ukentlig skriftlig statusoppfolging fra <span data-type="placeholder-field" data-key="oppfolging_start" data-label="Oppfolging start" data-placeholder-type="manual" data-value="">{{oppfolging_start}}</span> til og med <span data-type="placeholder-field" data-key="oppfolging_slutt" data-label="Oppfolging slutt" data-placeholder-type="manual" data-value="">{{oppfolging_slutt}}</span></li>
<li>Justeringer og optimalisering via digital support</li>
<li>Sluttevaluering etter siste besok</li>
</ul>
</div>

<div data-type="clause-block" data-clause-id="kritisk_kalender" data-title="5. Kritisk kalender" data-category="timeline" data-collapsed="false">
<p><span data-type="placeholder-field" data-key="kritisk_kalender" data-label="Kritisk kalender (tabell)" data-placeholder-type="manual" data-value="">{{kritisk_kalender}}</span></p>
</div>

<div data-type="clause-block" data-clause-id="pris_betaling" data-title="6. Pris og betaling" data-category="pricing" data-collapsed="false">
<p><strong>Onboarding-pakke:</strong></p>
<table>
<tbody>
<tr><td><strong>Post</strong></td><td><strong>Belop</strong></td></tr>
<tr><td><span data-type="placeholder-field" data-key="pakke_navn" data-label="Pakkenavn" data-placeholder-type="manual" data-value="">{{pakke_navn}}</span> (engangskostnad)</td><td><span data-type="placeholder-field" data-key="onboarding_pris" data-label="Onboarding-pris" data-placeholder-type="manual" data-value="">{{onboarding_pris}}</span> NOK eks. mva.</td></tr>
<tr><td>Arlig lisens (<span data-type="placeholder-field" data-key="lisens_beregning" data-label="Lisensberegning" data-placeholder-type="manual" data-value="">{{lisens_beregning}}</span>)</td><td><span data-type="placeholder-field" data-key="arlig_lisens" data-label="Arlig lisens" data-placeholder-type="manual" data-value="">{{arlig_lisens}}</span> NOK eks. mva.</td></tr>
<tr><td><strong>Totalt ved oppstart</strong></td><td><strong><span data-type="placeholder-field" data-key="total_pris" data-label="Totalpris" data-placeholder-type="manual" data-value="">{{total_pris}}</span> NOK eks. mva.</strong></td></tr>
</tbody>
</table>
<p>Onboarding og forste arslisens faktureres samlet ved oppstart (Besok 1).</p>
<p>Arlig lisens fornyes automatisk fra oppstartsdato med 30 dagers skriftlig oppsigelsesvarsel.</p>
</div>

<div data-type="clause-block" data-clause-id="ai_ansvarsfraskrivelse" data-title="7. AI-teknologi – Ansvarsfraskrivelse" data-category="legal" data-collapsed="false">
<p>Smartout benytter nyutviklet AI-teknologi som er under aktiv utvikling. Partene er innforstatt med folgende:</p>
<ul>
<li>AI-generert innhold kan inneholde feil, mangler eller unoyaktigheter</li>
<li>Alt materiale som AI genererer, leverer eller presenterer skal kontrolleres og bekreftes av ansvarlig person hos kunden for det tas i bruk</li>
<li>Smartout AS tar ikke ansvar for feil, brister eller konsekvenser som oppstar som folge av AI-produsert innhold som ikke er verifisert av kunden</li>
<li>Kunden har et selvstendig ansvar for a verifisere at AI-generert informasjon er korrekt for bruk i drift</li>
</ul>
</div>

<div data-type="clause-block" data-clause-id="forutsetninger" data-title="8. Forutsetninger" data-category="requirements" data-collapsed="false">
<ul>
<li><span data-type="placeholder-field" data-key="kunde_navn" data-label="Kundenavn" data-placeholder-type="manual" data-value="">{{kunde_navn}}</span> stiller med avdelingsledere til opplaering under hvert besok</li>
<li><span data-type="placeholder-field" data-key="kunde_navn" data-label="Kundenavn" data-placeholder-type="manual" data-value="">{{kunde_navn}}</span> dekker overnatting, mat og losji for Smartout ved fysiske besok</li>
<li>Ansattliste med kontaktinfo leveres senest en uke for Besok 1</li>
<li>Tilgang til relevante systemer klargjores for hvert besok</li>
</ul>
</div>

<div data-type="clause-block" data-clause-id="signatur" data-title="9. Signatur" data-category="signatures" data-collapsed="false">
<p>Denne avtalen er gyldig nar begge parter har signert.</p>
<table>
<tbody>
<tr><td></td><td><strong>Smartout AS</strong></td><td><strong><span data-type="placeholder-field" data-key="kunde_navn" data-label="Kundenavn" data-placeholder-type="manual" data-value="">{{kunde_navn}}</span></strong></td></tr>
<tr><td>Navn</td><td><span data-type="placeholder-field" data-key="smartout_kontakt" data-label="Kontaktperson Smartout" data-placeholder-type="auto" data-value="">{{smartout_kontakt}}</span></td><td><span data-type="placeholder-field" data-key="kunde_kontakt" data-label="Kontaktperson kunde" data-placeholder-type="manual" data-value="">{{kunde_kontakt}}</span></td></tr>
<tr><td>Tittel</td><td><span data-type="placeholder-field" data-key="smartout_tittel" data-label="Tittel Smartout" data-placeholder-type="auto" data-value="">{{smartout_tittel}}</span></td><td><span data-type="placeholder-field" data-key="kunde_tittel" data-label="Tittel kunde" data-placeholder-type="manual" data-value="">{{kunde_tittel}}</span></td></tr>
<tr><td>Dato</td><td colspan="2"><span data-type="date-field" data-key="signatur_dato" data-label="Signaturdato" data-format="dd.MM.yyyy" data-value=""></span></td></tr>
</tbody>
</table>
<div data-type="signature-field" data-role="sender" data-label="Signatur Smartout" data-required="true"></div>
<div data-type="signature-field" data-role="recipient" data-label="Signatur Kunde" data-required="true"></div>
</div>
',
  'client',
  'standard',
  'no',
  'nb-NO',
  'active',
  true,
  true,
  'Standard Smartout Onboarding & Drift-avtale. Dekker implementering, fysiske besok, digital oppfolging, prising og AI-ansvarsfraskrivelse. Basert pa Arbeidsmiljoloven og norsk kontraktspraksis.',
  '[
    {"key": "kunde_navn", "label": "Kundenavn", "source": "manual", "required": true},
    {"key": "kunde_org_nr", "label": "Org.nr. kunde", "source": "manual", "required": true},
    {"key": "kunde_kontakt", "label": "Kontaktperson kunde", "source": "manual", "required": true},
    {"key": "kunde_tittel", "label": "Tittel kunde", "source": "manual", "required": false},
    {"key": "smartout_kontakt", "label": "Kontaktperson Smartout", "source": "auto", "required": true, "default_value": "Pontus Lindroth"},
    {"key": "smartout_tittel", "label": "Tittel Smartout", "source": "auto", "required": false, "default_value": "CEO"},
    {"key": "avdelinger", "label": "Avdelinger", "source": "manual", "required": true},
    {"key": "avdelinger_detalj", "label": "Avdelingsdetaljer (tabell)", "source": "manual", "required": false},
    {"key": "antall_besok", "label": "Antall besok", "source": "manual", "required": true, "default_value": "3"},
    {"key": "besok_1_dato", "label": "Besok 1 dato", "source": "manual", "required": true},
    {"key": "besok_2_dato", "label": "Besok 2 dato", "source": "manual", "required": true},
    {"key": "besok_3_dato", "label": "Besok 3 dato", "source": "manual", "required": false},
    {"key": "oppfolging_periode", "label": "Oppfolgingsperiode", "source": "manual", "required": false},
    {"key": "oppfolging_start", "label": "Oppfolging start", "source": "manual", "required": false},
    {"key": "oppfolging_slutt", "label": "Oppfolging slutt", "source": "manual", "required": false},
    {"key": "kritisk_kalender", "label": "Kritisk kalender (tabell)", "source": "manual", "required": false},
    {"key": "pakke_navn", "label": "Pakkenavn", "source": "manual", "required": true, "default_value": "Onboarding Medium"},
    {"key": "onboarding_pris", "label": "Onboarding-pris", "source": "manual", "required": true},
    {"key": "lisens_beregning", "label": "Lisensberegning", "source": "manual", "required": false},
    {"key": "arlig_lisens", "label": "Arlig lisens", "source": "manual", "required": true},
    {"key": "total_pris", "label": "Totalpris", "source": "manual", "required": true}
  ]'::jsonb,
  '[]'::jsonb,
  null
)
ON CONFLICT (template_id) DO NOTHING;

-- =============================================================================
-- Template 2: Lisens- og brukeravtale (SaaS License + DPA)
-- =============================================================================
INSERT INTO public.contract_template (
  template_id,
  name,
  content_html,
  contract_type,
  template_type,
  language,
  locale,
  status,
  is_active,
  is_system,
  description,
  placeholders,
  attachments,
  created_by
) VALUES (
  'c0000002-0000-0000-0000-000000000002',
  'Smartout Lisens- og brukeravtale',
  '
<h1>KONTRAKT</h1>
<p>Avtale om kjop og bruk av Smartout mellom:</p>

<div data-type="clause-block" data-clause-id="parter" data-title="Avtaleparter" data-category="parties" data-collapsed="false">
<table>
<tbody>
<tr>
<td><strong>SELGER</strong> heretter kalt (Behandlingsansvarlig)</td>
<td><strong>KUNDE</strong> heretter kalt (LISENSINNEHAVER)</td>
</tr>
<tr>
<td>
<p>Firma: Smartout AS</p>
<p>Adresse: Europaveien 227</p>
<p>Postnr./sted: 3962, Stathelle</p>
<p>Org.nr.: 929 620 291</p>
<p>Tlf.: 31016212</p>
<p>E-post: post@smartout.no</p>
<p>Kontakt: <span data-type="placeholder-field" data-key="smartout_kontakt" data-label="Kontaktperson Smartout" data-placeholder-type="auto" data-value="">{{smartout_kontakt}}</span></p>
</td>
<td>
<p>Firma: <span data-type="placeholder-field" data-key="kunde_firma" data-label="Kundefirma" data-placeholder-type="manual" data-value="">{{kunde_firma}}</span></p>
<p>Adresse: <span data-type="placeholder-field" data-key="kunde_adresse" data-label="Kundeadresse" data-placeholder-type="manual" data-value="">{{kunde_adresse}}</span></p>
<p>Postnr./sted: <span data-type="placeholder-field" data-key="kunde_postnr_sted" data-label="Postnr./sted" data-placeholder-type="manual" data-value="">{{kunde_postnr_sted}}</span></p>
<p>Org.nr.: <span data-type="placeholder-field" data-key="kunde_org_nr" data-label="Org.nr. kunde" data-placeholder-type="manual" data-value="">{{kunde_org_nr}}</span></p>
<p>Tlf.: <span data-type="placeholder-field" data-key="kunde_tlf" data-label="Telefon kunde" data-placeholder-type="manual" data-value="">{{kunde_tlf}}</span></p>
<p>E-post: <span data-type="placeholder-field" data-key="kunde_epost" data-label="E-post kunde" data-placeholder-type="manual" data-value="">{{kunde_epost}}</span></p>
<p>Faktura e-post: <span data-type="placeholder-field" data-key="kunde_faktura_epost" data-label="Faktura e-post" data-placeholder-type="manual" data-value="">{{kunde_faktura_epost}}</span></p>
<p>Daglig leder: <span data-type="placeholder-field" data-key="kunde_daglig_leder" data-label="Daglig leder" data-placeholder-type="manual" data-value="">{{kunde_daglig_leder}}</span></p>
</td>
</tr>
</tbody>
</table>
</div>

<div data-type="clause-block" data-clause-id="priser_vilkar" data-title="Priser og vilkar" data-category="pricing" data-collapsed="false">
<table>
<tbody>
<tr><td><strong>Abonnement:</strong></td><td><span data-type="placeholder-field" data-key="abonnement_type" data-label="Abonnementstype" data-placeholder-type="manual" data-value="">{{abonnement_type}}</span></td></tr>
<tr><td><strong>Startdato:</strong></td><td><span data-type="date-field" data-key="startdato" data-label="Startdato" data-format="dd.MM.yyyy" data-value=""></span></td></tr>
<tr><td><strong>Arspris inkl. <span data-type="placeholder-field" data-key="inkl_brukere" data-label="Inkluderte brukere" data-placeholder-type="manual" data-value="">{{inkl_brukere}}</span> brukere:</strong></td><td><span data-type="placeholder-field" data-key="arspris" data-label="Arspris" data-placeholder-type="manual" data-value="">{{arspris}}</span>,-</td></tr>
<tr><td><strong>Pris per mnd. per tilleggsbruker:</strong></td><td><span data-type="placeholder-field" data-key="tilleggsbruker_pris" data-label="Tilleggsbrukerpris" data-placeholder-type="manual" data-value="">{{tilleggsbruker_pris}}</span>,-</td></tr>
</tbody>
</table>
<p><em>Alle priser er oppgitt eks. mva.</em></p>
<ul>
<li>Betalingsbetingelser: <span data-type="placeholder-field" data-key="betalingsbetingelser" data-label="Betalingsbetingelser" data-placeholder-type="manual" data-value="">{{betalingsbetingelser}}</span> dager</li>
<li>Oppsigelsestid: <span data-type="placeholder-field" data-key="oppsigelsestid" data-label="Oppsigelsestid" data-placeholder-type="manual" data-value="">{{oppsigelsestid}}</span></li>
<li>Abonnement forskudds-faktureres per ar</li>
<li>Tilleggsbrukere (utover inkluderte) etterskudds faktureres per maned</li>
</ul>
</div>

<div data-type="clause-block" data-clause-id="spesielle_vilkar" data-title="Spesielle vilkar og kommentarer" data-category="special" data-collapsed="false">
<p><strong>Avtalen kan kanselleres innen 30 dager fra startdato oppgitt ovenfor.</strong></p>
<p><span data-type="placeholder-field" data-key="oppstartshjelp" data-label="Oppstartshjelp" data-placeholder-type="manual" data-value="">{{oppstartshjelp}}</span></p>
<p><em>Innholdet i kontrakten, inkl. priser og betingelser, er a anse som konfidensielt og skal kun vaere kjent for de signerende parter.</em></p>
</div>

<div data-type="clause-block" data-clause-id="dpa" data-title="Databehandlingsavtale" data-category="legal" data-collapsed="false">
<h3>Databehandlingsavtale mellom Kjoper (LISENSINNEHAVER) og leverandor (SMARTOUT)</h3>
<h4>1. Formal, omfang og varighet</h4>
<p>Avtalen er inngatt i henhold til GDPR (EU) 2016/679 artikkel 28 og personopplysningsloven av 15. juni 2018 nr. 38. Avtalen regulerer Smartout AS'' behandling av personopplysninger pa vegne av Behandlingsansvarlig som ledd i leveranse av Smartout-plattformen (SaaS). Avtalen gjelder sa lenge lisensavtalen loper. Smartout behandler kun etter dokumenterte instrukser fra Behandlingsansvarlig.</p>
<h4>2. Behandlingen av personopplysninger</h4>
<p><strong>2.1 Tjenester/Moduler:</strong> Smartout leverer elektroniske systemer for arbeidsplanlegging, rutiner og prosedyrer, kommunikasjon, varebeholdning, opplaering og rapportering.</p>
<p><strong>2.2 Personopplysninger som behandles:</strong></p>
<ul>
<li>Fornavn og etternavn</li>
<li>Fodselsdato og fodselsnummer (kun der strengt nodvendig)</li>
<li>Ansattnummer, adresse, telefonnummer, e-postadresse</li>
<li>Stilling/tittel og ansettelsesforhold</li>
<li>Lonnstype/timesats, avdelingstilhorighet</li>
<li>Timelister, stemplinger, vaktlister og oppgaveplaner</li>
<li>Systemhendelser og meldinger</li>
</ul>
<h4>3. Roller, instruks og plikter</h4>
<p>Behandlingsansvarlig forplikter seg til a fastsette behandlingsgrunnlag, informere registrerte, ivareta dataminimering, konfigurere tilgangsstyring, og handtere henvendelser fra registrerte.</p>
<h4>4. Tekniske og organisatoriske tiltak</h4>
<p>RBAC, MFA, TLS 1.2+ i transitt, AES-256 i hvile, sikker utvikling, sarbarhetsskanning, daglig backup med 30 dagers retensjon.</p>
<h4>5. Underbehandlere</h4>
<p>Godkjente underbehandlere fremgar av Vedlegg 2. Nye underbehandlere varsles minst 30 dager for bruk.</p>
<h4>6. Varsling ved brudd</h4>
<p>Smartout varsler Behandlingsansvarlig uten ugrunnet opphold og senest innen 24 timer etter kjennskap til brudd.</p>
<h4>7. Sletting og retur ved opphor</h4>
<p>Eksport innen 30 dager, sletting innen 60 dager, sanitering av backup innen 90 dager.</p>
</div>

<div data-type="clause-block" data-clause-id="lisensavtale" data-title="Lisens- og brukeravtale" data-category="legal" data-collapsed="false">
<h4>1. Formal og bestilling</h4>
<p>Denne lisens- og brukeravtalen regulerer LISENSINNEHAVERS tilgang til og bruk av Smartout-plattformen, levert av SMARTOUT AS.</p>
<h4>4. Bruksrett (lisens)</h4>
<p>LISENSINNEHAVER gis en ikke-eksklusiv, ikke-overforbar, tidsbegrenset rett til a benytte Plattformen via nettleser og mobilklienter for intern virksomhet.</p>
<h4>7. Service, support og tjenesteniva</h4>
<ul>
<li>Drift: 99,5% tilgjengelighet per kalendermaned</li>
<li>Backup: Daglige sikkerhetskopier, 30 dagers retensjon</li>
<li>Support: Virkedager 09:00–16:00 CET, forstelinje respons innen 1 virkedag</li>
</ul>
<h4>9. Priser og betaling</h4>
<p>Prisjustering: KPI (SSB) arlig per 1. januar. Supporttjenester utover inkludert omfang: NOK 850 eks. mva per time.</p>
<h4>13. Ansvarsbegrensning</h4>
<p>Samlet ansvar for direkte tap i en 12-manedersperiode er begrenset til det belop LISENSINNEHAVER faktisk har betalt for Plattformen i samme periode.</p>
<h4>15. Varighet, fornyelse og oppsigelse</h4>
<p>Avtalen loper i 12 maneder fra aksept. Fornyes automatisk. Oppsigelse med 1 maneds varsel.</p>
<h4>20. Lovvalg og verneting</h4>
<p>Norsk rett. Telemark tingrett.</p>
</div>

<div data-type="clause-block" data-clause-id="signatur_kontrakt" data-title="Signaturer" data-category="signatures" data-collapsed="false">
<p>Kunden samtykker herved til Smartouts "Lisens- og brukeravtale"</p>
<p>Kunden samtykker herved til Smartouts "Databehandlingsavtale"</p>
<table>
<tbody>
<tr><td><strong>SIGNATURER</strong></td><td><strong>Kundens signatur</strong></td></tr>
<tr><td>Navn: <span data-type="placeholder-field" data-key="kunde_daglig_leder" data-label="Daglig leder" data-placeholder-type="manual" data-value="">{{kunde_daglig_leder}}</span></td><td></td></tr>
<tr><td>E-post: <span data-type="placeholder-field" data-key="kunde_epost" data-label="E-post kunde" data-placeholder-type="manual" data-value="">{{kunde_epost}}</span></td><td></td></tr>
<tr><td>Tittel: <span data-type="placeholder-field" data-key="kunde_tittel" data-label="Tittel kunde" data-placeholder-type="manual" data-value="">{{kunde_tittel}}</span></td><td></td></tr>
</tbody>
</table>
<div data-type="signature-field" data-role="recipient" data-label="Kundens signatur" data-required="true"></div>
<table>
<tbody>
<tr><td><strong>SIGNATURER</strong></td><td><strong>Smartouts signatur</strong></td></tr>
<tr><td>Navn: <span data-type="placeholder-field" data-key="smartout_kontakt" data-label="Kontaktperson Smartout" data-placeholder-type="auto" data-value="">{{smartout_kontakt}}</span></td><td></td></tr>
<tr><td>Tittel: <span data-type="placeholder-field" data-key="smartout_tittel" data-label="Tittel Smartout" data-placeholder-type="auto" data-value="">{{smartout_tittel}}</span></td><td></td></tr>
</tbody>
</table>
<div data-type="signature-field" data-role="sender" data-label="Smartouts signatur" data-required="true"></div>
<p><em>Innholdet i kontrakten, inkl. priser og betingelser, er a anse som konfidensielt og skal kun vaere kjent for de signerende parter.</em></p>
</div>
',
  'client',
  'standard',
  'no',
  'nb-NO',
  'active',
  true,
  true,
  'Standard Smartout SaaS-kontrakt med lisens- og brukeravtale, databehandlingsavtale (DPA/GDPR), priser og vilkar, og signaturer. Komplett mal basert pa norsk kontraktspraksis.',
  '[
    {"key": "kunde_firma", "label": "Kundefirma", "source": "manual", "required": true},
    {"key": "kunde_adresse", "label": "Kundeadresse", "source": "manual", "required": true},
    {"key": "kunde_postnr_sted", "label": "Postnr./sted", "source": "manual", "required": true},
    {"key": "kunde_org_nr", "label": "Org.nr. kunde", "source": "manual", "required": true},
    {"key": "kunde_tlf", "label": "Telefon kunde", "source": "manual", "required": false},
    {"key": "kunde_epost", "label": "E-post kunde", "source": "manual", "required": true},
    {"key": "kunde_faktura_epost", "label": "Faktura e-post", "source": "manual", "required": false},
    {"key": "kunde_daglig_leder", "label": "Daglig leder", "source": "manual", "required": true},
    {"key": "kunde_tittel", "label": "Tittel kunde", "source": "manual", "required": false, "default_value": "Daglig leder"},
    {"key": "smartout_kontakt", "label": "Kontaktperson Smartout", "source": "auto", "required": true, "default_value": "Pontus S. Lindroth"},
    {"key": "smartout_tittel", "label": "Tittel Smartout", "source": "auto", "required": false, "default_value": "CEO"},
    {"key": "abonnement_type", "label": "Abonnementstype", "source": "manual", "required": true, "default_value": "Basic"},
    {"key": "inkl_brukere", "label": "Inkluderte brukere", "source": "manual", "required": true, "default_value": "10"},
    {"key": "arspris", "label": "Arspris", "source": "manual", "required": true, "default_value": "995"},
    {"key": "tilleggsbruker_pris", "label": "Tilleggsbrukerpris", "source": "manual", "required": false, "default_value": "50"},
    {"key": "betalingsbetingelser", "label": "Betalingsbetingelser", "source": "manual", "required": false, "default_value": "10"},
    {"key": "oppsigelsestid", "label": "Oppsigelsestid", "source": "manual", "required": false, "default_value": "Innev. + 3 mnd."},
    {"key": "oppstartshjelp", "label": "Oppstartshjelp", "source": "manual", "required": false, "default_value": "Oppstartshjelp: 3 timer digital gjennomgang og oppsett av systemet, inkludert import av ansatte, vaktlister, tillegg og regler."}
  ]'::jsonb,
  '[]'::jsonb,
  null
)
ON CONFLICT (template_id) DO NOTHING;
