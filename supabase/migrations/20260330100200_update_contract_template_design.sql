-- Update the B2B SaaS license template with professional design
-- matching the original PDF contract layout (orange branding, structured sections).

UPDATE contract_template
SET
  accent_color = '#FF6B35',

  -- ── CSS ──────────────────────────────────────────────────────────────
  content_css = $CSS$
    /* Page border */
    .contract-page {
      border: 3px solid #FF6B35;
      border-radius: 2px;
      padding: 40px 36px 32px;
    }

    /* Header bar */
    .contract-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 2px solid #FF6B35;
    }
    .contract-header h1 {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #1a1a2e;
      margin: 0;
    }
    .contract-header .logo-mark {
      width: 56px;
      height: 56px;
    }

    .contract-subtitle {
      font-size: 14px;
      color: #4b5563;
      margin: 8px 0 24px;
    }

    /* Party info cards */
    .parties-grid {
      display: flex;
      gap: 16px;
      margin-bottom: 28px;
    }
    .party-card {
      flex: 1;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 20px;
      background: #fafafa;
    }
    .party-card.seller {
      border-top: 3px solid #9ca3af;
    }
    .party-card.customer {
      border-top: 3px solid #FF6B35;
    }
    .party-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #6b7280;
      margin: 0 0 12px;
    }
    .party-card.customer .party-label {
      color: #FF6B35;
    }
    .party-row {
      font-size: 13px;
      line-height: 1.7;
      color: #374151;
    }
    .party-row .label {
      color: #9ca3af;
      font-size: 11px;
    }
    .party-row .value {
      font-weight: 600;
      color: #1a1a2e;
    }

    /* Section blocks */
    .contract-section {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.3px;
      text-transform: uppercase;
      color: #1a1a2e;
      border-bottom: 2px solid #FF6B35;
      padding-bottom: 6px;
      margin: 0 0 14px;
    }

    /* Pricing grid */
    .pricing-grid {
      display: flex;
      gap: 16px;
      margin-bottom: 12px;
    }
    .pricing-left, .pricing-right {
      flex: 1;
    }
    .price-row {
      font-size: 13px;
      line-height: 1.8;
      color: #374151;
    }
    .price-row strong {
      color: #1a1a2e;
    }
    .price-note {
      font-size: 11px;
      font-style: italic;
      color: #9ca3af;
      margin-top: 4px;
    }

    /* Special terms */
    .special-terms {
      background: #fff7ed;
      border-left: 3px solid #FF6B35;
      padding: 16px 20px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 24px;
    }
    .special-terms p {
      font-size: 13px;
      line-height: 1.6;
      color: #374151;
      margin: 0 0 8px;
    }
    .special-terms p:last-child { margin-bottom: 0; }
    .special-terms strong { color: #1a1a2e; }

    /* Legal sections (DPA, License) */
    .legal-section {
      margin-bottom: 20px;
    }
    .legal-section h3 {
      font-size: 16px;
      font-weight: 700;
      text-align: center;
      color: #1a1a2e;
      margin: 32px 0 4px;
    }
    .legal-section .legal-subtitle {
      font-size: 13px;
      text-align: center;
      color: #6b7280;
      margin: 0 0 20px;
    }
    .legal-section h4 {
      font-size: 13px;
      font-weight: 700;
      color: #1a1a2e;
      margin: 16px 0 6px;
    }
    .legal-section p, .legal-section li {
      font-size: 12px;
      line-height: 1.6;
      color: #4b5563;
    }
    .legal-section ul {
      padding-left: 20px;
      margin: 4px 0 8px;
    }

    /* Vedlegg table */
    .vedlegg-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin: 8px 0 16px;
    }
    .vedlegg-table th {
      background: #f3f4f6;
      font-weight: 700;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #e5e7eb;
      color: #374151;
    }
    .vedlegg-table td {
      padding: 5px 8px;
      border: 1px solid #e5e7eb;
      color: #4b5563;
    }

    /* Signature section */
    .signature-section {
      margin-top: 32px;
      page-break-inside: avoid;
    }
    .consent-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #1a1a2e;
      margin-bottom: 8px;
    }
    .consent-check {
      width: 18px;
      height: 18px;
      border: 2px solid #FF6B35;
      border-radius: 3px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #FF6B35;
      font-size: 12px;
      font-weight: 800;
    }
    .sig-grid {
      display: flex;
      gap: 24px;
      margin-top: 20px;
    }
    .sig-block {
      flex: 1;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 16px;
    }
    .sig-block .sig-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #6b7280;
      margin: 0 0 8px;
    }
    .sig-block .sig-info {
      font-size: 12px;
      line-height: 1.7;
      color: #374151;
    }

    /* Confidentiality footer */
    .confidential-notice {
      text-align: center;
      font-size: 11px;
      font-style: italic;
      color: #9ca3af;
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
    }

    /* Page numbering */
    .page-num {
      font-size: 10px;
      color: #9ca3af;
      text-align: center;
      margin-top: 16px;
    }

    /* Placeholder field styling */
    [data-type="placeholder-field"] {
      font-weight: 600;
      color: #1a1a2e;
    }
  $CSS$,

  -- ── HEADER HTML ──────────────────────────────────────────────────────
  header_html = '<div class="contract-page">',

  -- ── FOOTER HTML ──────────────────────────────────────────────────────
  footer_html = '</div>',

  -- ── CONTENT HTML ─────────────────────────────────────────────────────
  content_html = $CONTENT$
<!-- ═══ HEADER ═══ -->
<div class="contract-header">
  <h1>KONTRAKT</h1>
  <svg class="logo-mark" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="28" cy="28" r="28" fill="#FF6B35"/>
    <path d="M36.5 18.5C34.2 16.8 31.3 16 28.2 16c-3.6 0-6.6 1.1-8.8 3.2-2.2 2.1-3.3 4.9-3.3 8.3 0 2.3.5 4.2 1.6 5.9 1.1 1.6 2.5 2.8 4.3 3.5-.3.7-.7 1.3-1.1 1.8-.5.5-1 .9-1.6 1.2l1.2 2.6c1.4-.6 2.6-1.5 3.6-2.8 1-.8 1.7-1.9 2.2-3.2.7.1 1.3.1 2 .1 3.5 0 6.4-1.1 8.6-3.2 2.2-2.2 3.3-5 3.3-8.4 0-2-.5-3.9-1.4-5.5z" fill="white"/>
    <text x="28" y="50" text-anchor="middle" font-family="Inter,sans-serif" font-weight="800" font-size="7" fill="#FF6B35" letter-spacing="1.5">SMARTOUT</text>
  </svg>
</div>

<p class="contract-subtitle">Avtale om kjøp og bruk av Smartout mellom:</p>

<!-- ═══ AVTALEPARTER ═══ -->
<div class="parties-grid">
  <div class="party-card seller">
    <p class="party-label">Selger <span style="font-weight:400;text-transform:none;letter-spacing:0">(Behandlingsansvarlig)</span></p>
    <div class="party-row"><span class="label">Firma:</span> <span class="value">Smartout AS</span></div>
    <div class="party-row"><span class="label">Adresse:</span> Europaveien 227</div>
    <div class="party-row"><span class="label">Postnr./sted:</span> 3962, Stathelle</div>
    <div class="party-row"><span class="label">Org.nr.:</span> <span class="value">929 620 291</span></div>
    <div class="party-row"><span class="label">Tlf.:</span> 31016212</div>
    <div class="party-row"><span class="label">E-post:</span> post@smartout.no</div>
    <div class="party-row"><span class="label">Kontakt:</span> <span data-type="placeholder-field" data-key="smartout_kontakt" data-label="Kontaktperson Smartout" data-placeholder-type="auto" data-value="">Pontus S. Lindroth</span></div>
  </div>
  <div class="party-card customer">
    <p class="party-label">Kunde <span style="font-weight:400;text-transform:none;letter-spacing:0">(Lisensinnehaver)</span></p>
    <div class="party-row"><span class="label">Firma:</span> <span class="value" data-type="placeholder-field" data-key="kunde_firma" data-label="Kundefirma" data-placeholder-type="manual" data-value=""></span></div>
    <div class="party-row"><span class="label">Adresse:</span> <span data-type="placeholder-field" data-key="kunde_adresse" data-label="Kundeadresse" data-placeholder-type="manual" data-value=""></span></div>
    <div class="party-row"><span class="label">Postnr./sted:</span> <span data-type="placeholder-field" data-key="kunde_postnr_sted" data-label="Postnr./sted" data-placeholder-type="manual" data-value=""></span></div>
    <div class="party-row"><span class="label">Org.nr.:</span> <span class="value" data-type="placeholder-field" data-key="kunde_org_nr" data-label="Org.nr. kunde" data-placeholder-type="manual" data-value=""></span></div>
    <div class="party-row"><span class="label">Tlf.:</span> <span data-type="placeholder-field" data-key="kunde_tlf" data-label="Telefon kunde" data-placeholder-type="manual" data-value=""></span></div>
    <div class="party-row"><span class="label">E-post:</span> <span data-type="placeholder-field" data-key="kunde_epost" data-label="E-post kunde" data-placeholder-type="manual" data-value=""></span></div>
    <div class="party-row"><span class="label">Faktura e-post:</span> <span data-type="placeholder-field" data-key="kunde_faktura_epost" data-label="Faktura e-post" data-placeholder-type="manual" data-value=""></span></div>
    <div class="party-row"><span class="label">Daglig leder:</span> <span data-type="placeholder-field" data-key="kunde_daglig_leder" data-label="Daglig leder" data-placeholder-type="manual" data-value=""></span></div>
  </div>
</div>

<!-- ═══ PRISER OG VILKÅR ═══ -->
<div class="contract-section">
  <h2 class="section-title">Priser og vilkår</h2>
  <div class="pricing-grid">
    <div class="pricing-left">
      <div class="price-row">Abonnement: <strong><span data-type="placeholder-field" data-key="abonnement_type" data-label="Abonnementstype" data-placeholder-type="manual" data-value="">Basic</span></strong></div>
      <div class="price-row">Startdato: <strong><span data-type="date-field" data-key="startdato" data-label="Startdato" data-format="dd.MM.yyyy" data-value=""></span></strong></div>
      <div class="price-row">Årspris inkl. <span data-type="placeholder-field" data-key="inkl_brukere" data-label="Inkluderte brukere" data-placeholder-type="manual" data-value="">10</span> brukere: <strong><span data-type="placeholder-field" data-key="arspris" data-label="Årspris" data-placeholder-type="manual" data-value="">995</span>,-</strong></div>
      <div class="price-row">Pris per mnd. per tilleggsbruker: <strong><span data-type="placeholder-field" data-key="tilleggsbruker_pris" data-label="Tilleggsbrukerpris" data-placeholder-type="manual" data-value="">50</span>,-</strong></div>
      <p class="price-note">* Alle priser er oppgitt eks. mva.</p>
    </div>
    <div class="pricing-right">
      <div class="price-row">Betalingsbetingelser: <strong><span data-type="placeholder-field" data-key="betalingsbetingelser" data-label="Betalingsbetingelser" data-placeholder-type="manual" data-value="">10</span> dager</strong></div>
      <div class="price-row">Oppsigelsestid: <strong><span data-type="placeholder-field" data-key="oppsigelsestid" data-label="Oppsigelsestid" data-placeholder-type="manual" data-value="">Innev. + 3 mnd.</span></strong></div>
      <div class="price-row">Abonnement forskudds-faktureres per <strong>år</strong></div>
      <div class="price-row">Tilleggsbrukere (utover inkl.) etterskudds faktureres per <strong>måned</strong></div>
    </div>
  </div>
</div>

<!-- ═══ SPESIELLE VILKÅR ═══ -->
<div class="contract-section">
  <h2 class="section-title">Spesielle vilkår og kommentarer</h2>
  <div class="special-terms">
    <p><strong>Avtalen kan kanselleres innen 30 dager fra startdato oppgitt ovenfor.</strong></p>
    <p><span data-type="placeholder-field" data-key="oppstartshjelp" data-label="Oppstartshjelp" data-placeholder-type="manual" data-value="">Oppstartshjelp: 3 timer digital gjennomgang og oppsett av systemet, inkludert import av ansatte, vaktlister, tillegg og regler.</span></p>
  </div>
</div>

<!-- ═══ DATABEHANDLINGSAVTALE ═══ -->
<div class="legal-section">
  <h3>Databehandlingsavtale</h3>
  <p class="legal-subtitle">mellom Kjøper (LISENSINNEHAVER) og leverandør (SMARTOUT)</p>

  <h4>1. Formål, omfang og varighet</h4>
  <p>Avtalen er inngått i henhold til GDPR (EU) 2016/679 artikkel 28 og personopplysningsloven av 15. juni 2018 nr. 38. Avtalen regulerer Smartout AS sin behandling av personopplysninger på vegne av Behandlingsansvarlig som ledd i leveranse av Smartout-plattformen (SaaS). Avtalen gjelder så lenge lisensavtalen løper. Smartout behandler kun etter dokumenterte instrukser fra Behandlingsansvarlig.</p>

  <h4>2. Behandlingen av personopplysninger</h4>
  <p><strong>2.1 Tjenester/Moduler:</strong> Smartout leverer elektroniske systemer for arbeidsplanlegging, rutiner og prosedyrer, kommunikasjon, varebeholdning, opplæring og rapportering.</p>
  <p><strong>2.2 Personopplysninger som behandles:</strong></p>
  <ul>
    <li>Fornavn og etternavn</li>
    <li>Fødselsdato og fødselsnummer (kun der strengt nødvendig)</li>
    <li>Ansattnummer, adresse, telefonnummer, e-postadresse</li>
    <li>Stilling/tittel og ansettelsesforhold</li>
    <li>Lønnstype/timesats, avdelingstilhørighet</li>
    <li>Timelister, stemplinger, vaktlister og oppgaveplaner</li>
    <li>Systemhendelser og meldinger</li>
  </ul>

  <h4>3. Roller, instruks og plikter</h4>
  <p>Behandlingsansvarlig forplikter seg til å fastsette behandlingsgrunnlag, informere registrerte, ivareta dataminimering, konfigurere tilgangsstyring, og håndtere henvendelser fra registrerte.</p>

  <h4>4. Tekniske og organisatoriske tiltak</h4>
  <p>RBAC, MFA, TLS 1.2+ i transitt, AES-256 i hvile, sikker utvikling, sårbarhetsskanning, daglig backup med 30 dagers retensjon.</p>

  <h4>5. Underbehandlere</h4>
  <p>Godkjente underbehandlere fremgår av Vedlegg 2. Nye underbehandlere varsles minst 30 dager før bruk.</p>

  <h4>6. Varsling ved brudd</h4>
  <p>Smartout varsler Behandlingsansvarlig uten ugrunnet opphold og senest innen 24 timer etter kjennskap til brudd.</p>

  <h4>7. Sletting og retur ved opphør</h4>
  <p>Eksport innen 30 dager, sletting innen 60 dager, sanitering av backup innen 90 dager.</p>
</div>

<!-- ═══ VEDLEGG 1 ═══ -->
<div class="legal-section">
  <h4>Vedlegg 1 – Tekniske og organisatoriske tiltak (TOMs)</h4>
  <ul>
    <li><strong>Tilgangsstyring:</strong> RBAC, least-privilege, MFA på admin, periodisk tilgangsrevisjon</li>
    <li><strong>Kryptering:</strong> TLS 1.2+ i transitt, AES-256 i hvile, KMS-basert nøkkelstyring</li>
    <li><strong>Utvikling:</strong> Code review, SAST/DAST, avhengighetskontroll, sikker SDLC</li>
    <li><strong>Logging:</strong> Sentral logg, alarmer, integritetsbeskyttelse, formålsbestemt lagring</li>
    <li><strong>Sårbarheter:</strong> Kvartalsvis skann, årlig pentest, patching etter kritikalitet</li>
    <li><strong>Backup/BCP:</strong> Daglig backup, 30 dagers retensjon, dokumenterte RPO/RTO</li>
  </ul>
</div>

<!-- ═══ VEDLEGG 2 ═══ -->
<div class="legal-section">
  <h4>Vedlegg 2 – Underbehandlere og lokasjon</h4>
  <table class="vedlegg-table">
    <thead>
      <tr><th>Leverandør</th><th>Rolle/Formål</th><th>Datatyper</th><th>Lokasjon</th><th>Overføring</th></tr>
    </thead>
    <tbody>
      <tr><td>AWS</td><td>Infrastruktur/hosting</td><td>Kundedata, logger</td><td>EU (eu-west-1)</td><td>Innen EØS</td></tr>
      <tr><td>Supabase</td><td>Database/auth</td><td>All appdata</td><td>EU (Frankfurt)</td><td>Innen EØS</td></tr>
      <tr><td>Vercel</td><td>Frontend hosting</td><td>Metadata</td><td>EU</td><td>Innen EØS</td></tr>
      <tr><td>n8n</td><td>Integrasjoner</td><td>Kontakt-/ID-data</td><td>EU (self-hosted)</td><td>Innen EØS</td></tr>
      <tr><td>Anthropic</td><td>AI-behandling</td><td>Tekstprompter</td><td>EU/USA</td><td>DPF/SCC</td></tr>
      <tr><td>SendGrid</td><td>E-post</td><td>Navn, e-post</td><td>USA</td><td>DPF/SCC</td></tr>
    </tbody>
  </table>
</div>

<!-- ═══ LISENS- OG BRUKERAVTALE ═══ -->
<div class="legal-section">
  <h3>Lisens- og brukeravtale</h3>
  <p class="legal-subtitle">mellom Kjøper (LISENSINNEHAVER) og leverandør (SMARTOUT)</p>

  <h4>1. Formål og bestilling</h4>
  <p>Denne lisens- og brukeravtalen regulerer LISENSINNEHAVERS tilgang til og bruk av Smartout-plattformen, levert av SMARTOUT AS.</p>

  <h4>4. Bruksrett (lisens)</h4>
  <p>LISENSINNEHAVER gis en ikke-eksklusiv, ikke-overførbar, tidsbegrenset rett til å benytte Plattformen via nettleser og mobilklienter for intern virksomhet.</p>

  <h4>7. Service, support og tjenestenivå</h4>
  <ul>
    <li>Drift: 99,5% tilgjengelighet per kalendermåned</li>
    <li>Backup: Daglige sikkerhetskopier, 30 dagers retensjon</li>
    <li>Support: Virkedager 09:00–16:00 CET, førstelinje respons innen 1 virkedag</li>
  </ul>

  <h4>9. Priser og betaling</h4>
  <p>Prisjustering: KPI (SSB) årlig per 1. januar. Supporttjenester utover inkludert omfang: NOK 850 eks. mva per time.</p>

  <h4>13. Ansvarsbegrensning</h4>
  <p>Samlet ansvar for direkte tap i en 12-månedersperiode er begrenset til det beløp LISENSINNEHAVER faktisk har betalt for Plattformen i samme periode.</p>

  <h4>15. Varighet, fornyelse og oppsigelse</h4>
  <p>Avtalen løper i 12 måneder fra aksept. Fornyes automatisk. Oppsigelse med 1 måneds varsel.</p>

  <h4>20. Lovvalg og verneting</h4>
  <p>Norsk rett. Telemark tingrett.</p>
</div>

<!-- ═══ SIGNATURER ═══ -->
<div class="signature-section">
  <div class="consent-row"><span class="consent-check">&#10003;</span> Kunden samtykker herved til Smartouts Lisens- og brukeravtale</div>
  <div class="consent-row"><span class="consent-check">&#10003;</span> Kunden samtykker herved til Smartouts Databehandlingsavtale</div>

  <div class="sig-grid">
    <div class="sig-block">
      <p class="sig-label">Kundens signatur</p>
      <div class="sig-info">
        Navn: <span data-type="placeholder-field" data-key="kunde_daglig_leder" data-label="Daglig leder" data-placeholder-type="manual" data-value=""></span><br/>
        E-post: <span data-type="placeholder-field" data-key="kunde_epost" data-label="E-post kunde" data-placeholder-type="manual" data-value=""></span><br/>
        Tittel: <span data-type="placeholder-field" data-key="kunde_tittel" data-label="Tittel kunde" data-placeholder-type="manual" data-value="">Daglig leder</span>
      </div>
      <div data-type="signature-field" data-role="recipient" data-label="Kundens signatur" data-required="true"></div>
    </div>
    <div class="sig-block">
      <p class="sig-label">Smartouts signatur</p>
      <div class="sig-info">
        Navn: <span data-type="placeholder-field" data-key="smartout_kontakt" data-label="Kontaktperson Smartout" data-placeholder-type="auto" data-value="">Pontus S. Lindroth</span><br/>
        Tittel: <span data-type="placeholder-field" data-key="smartout_tittel" data-label="Tittel Smartout" data-placeholder-type="auto" data-value="">CEO</span>
      </div>
      <div data-type="signature-field" data-role="sender" data-label="Smartouts signatur" data-required="true"></div>
    </div>
  </div>
</div>

<p class="confidential-notice">Innholdet i kontrakten, inkl. priser og betingelser, er å anse som konfidensielt og skal kun være kjent for de signerende parter.</p>
$CONTENT$,

  updated_at = now()

WHERE template_id = 'c0000002-0000-0000-0000-000000000002';
