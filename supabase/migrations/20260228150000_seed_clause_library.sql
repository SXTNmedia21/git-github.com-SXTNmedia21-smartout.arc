-- Seed clause library with V1 Norwegian contract clauses
-- These are pre-approved clause blocks for the AI template creator.
-- Each clause is realistic Norwegian B2B contract language for SaaS/service agreements.

INSERT INTO clause_library (title, summary, content_html, category, contract_types, language, sort_order, is_active)
VALUES

-- 1. Parter (Parties) — identification
(
  'Parter',
  'Identifikasjon av avtalepartene med organisasjonsnummer og kontaktinformasjon',
  '<section class="contract-clause" data-clause="parties">
  <h2>§ 1 Parter</h2>
  <p>Denne avtalen er inngått mellom:</p>
  <div class="party-block">
    <p><strong>Leverandør:</strong></p>
    <p>Smartout AS<br/>
    Organisasjonsnummer: {{provider_org_number}}<br/>
    Adresse: {{provider_address}}<br/>
    Kontaktperson: {{provider_contact_name}}<br/>
    E-post: {{provider_contact_email}}</p>
  </div>
  <div class="party-block">
    <p><strong>Kunde:</strong></p>
    <p>{{customer_name}}<br/>
    Organisasjonsnummer: {{customer_org_number}}<br/>
    Adresse: {{customer_address}}<br/>
    Kontaktperson: {{customer_contact_name}}<br/>
    E-post: {{customer_contact_email}}</p>
  </div>
  <p>Leverandør og Kunde omtales heretter samlet som «Partene» og hver for seg som «Part».</p>
</section>',
  'identification',
  '{client,employee}',
  'no',
  1,
  true
),

-- 2. Tjenestebeskrivelse (Service Description) — service
(
  'Tjenestebeskrivelse',
  'Beskrivelse av SaaS-tjenesten, tilgjengelighet (SLA) og supportnivåer',
  '<section class="contract-clause" data-clause="service">
  <h2>§ 2 Tjenestebeskrivelse</h2>
  <p>Leverandør skal levere Smartout-plattformen («Tjenesten») som en skybasert SaaS-løsning for personaladministrasjon, opplæring og operasjonell styring i servicebransjen.</p>
  <h3>2.1 Tjenestens omfang</h3>
  <p>Tjenesten omfatter:</p>
  <ul>
    <li>Tilgang til Smartout webapplikasjon for administrasjon og daglig drift</li>
    <li>Ansattportalen for onboarding, opplæring og sertifisering</li>
    <li>Vaktplanlegging og operasjonell koordinering</li>
    <li>HACCP-styring og kontrollsystemer</li>
    <li>AI-assistert støtte og automatisering</li>
    <li>Rapportering og analyser</li>
  </ul>
  <h3>2.2 Tilgjengelighet</h3>
  <p>Leverandør tilstreber en oppetid på 99,5 % målt per kalendermåned, ekskludert planlagt vedlikehold. Planlagt vedlikehold varsles minst 48 timer i forveien og gjennomføres fortrinnsvis mellom kl. 02:00 og 06:00 norsk tid.</p>
  <h3>2.3 Support</h3>
  <p>Leverandør tilbyr support via e-post og chat i Tjenesten. Responstid for kritiske feil er inntil 4 timer på hverdager mellom kl. 08:00 og 17:00 norsk tid. Ikke-kritiske henvendelser besvares innen 1 virkedag.</p>
</section>',
  'service',
  '{client}',
  'no',
  2,
  true
),

-- 3. Betaling og fakturering (Payment) — financial
(
  'Betaling og fakturering',
  'Betalingsvilkår, priser, faktureringsfrekvens og forsinkelsesrenter',
  '<section class="contract-clause" data-clause="payment">
  <h2>§ 3 Betaling og fakturering</h2>
  <h3>3.1 Pris</h3>
  <p>Kunden betaler et abonnement basert på valgt prisplan og antall aktive brukere. Gjeldende priser fremgår av prislisten på Leverandørens nettside eller i eget pristilbud vedlagt denne avtalen.</p>
  <h3>3.2 Fakturering</h3>
  <p>Fakturering skjer {{billing_cycle}} forskuddsvis. Fakturaer sendes elektronisk til oppgitt e-postadresse med {{payment_terms}} dagers betalingsfrist.</p>
  <h3>3.3 Prisjustering</h3>
  <p>Leverandør kan justere prisene årlig per 1. januar med virkning fra påfølgende faktureringsperiode. Prisendringer varsles skriftlig minst 60 dager før ikrafttredelse. Kunden kan si opp avtalen dersom prisøkningen overstiger 10 % av gjeldende pris.</p>
  <h3>3.4 Forsinket betaling</h3>
  <p>Ved forsinket betaling påløper forsinkelsesrente i henhold til forsinkelsesrenteloven. Leverandør kan suspendere tilgangen til Tjenesten dersom betaling er mer enn 30 dager forsinket, etter skriftlig varsel med 14 dagers frist.</p>
</section>',
  'financial',
  '{client}',
  'no',
  3,
  true
),

-- 4. Varighet og oppsigelse (Duration) — legal
(
  'Varighet og oppsigelse',
  'Avtalens varighet, prøveperiode, automatisk fornyelse og oppsigelsesvilkår',
  '<section class="contract-clause" data-clause="duration">
  <h2>§ 4 Varighet og oppsigelse</h2>
  <h3>4.1 Avtalens varighet</h3>
  <p>Avtalen trer i kraft ved signering og løper i en initial periode på {{initial_term}} måneder («Avtaleperioden»). Etter utløpet av Avtaleperioden fornyes avtalen automatisk for perioder på {{renewal_term}} måneder, med mindre en Part sier opp i henhold til punkt 4.3.</p>
  <h3>4.2 Prøveperiode</h3>
  <p>Kunden tilbys en gratis prøveperiode på 14 dager fra opprettelse av arbeidsplass. I prøveperioden har Kunden full tilgang til Tjenesten. Dersom Kunden ikke inngår betalingsavtale innen prøveperiodens utløp, reduseres tilgangen til skrivebeskyttet modus i 14 dager (utsettelsesperiode), før kontoen deaktiveres.</p>
  <h3>4.3 Oppsigelse</h3>
  <p>Hver Part kan si opp avtalen med minst 30 dagers skriftlig varsel før utløpet av gjeldende avtaleperiode. Oppsigelse skal sendes per e-post til den andre Partens oppgitte kontaktadresse.</p>
  <h3>4.4 Heving</h3>
  <p>Hver Part kan heve avtalen med umiddelbar virkning ved vesentlig mislighold fra den andre Part som ikke er utbedret innen 30 dager etter skriftlig varsel.</p>
</section>',
  'legal',
  '{client}',
  'no',
  4,
  true
),

-- 5. Data og personvern (Data & GDPR) — compliance
(
  'Data og personvern',
  'Databehandleravtale, GDPR-forpliktelser, dataeierskap og portabilitet',
  '<section class="contract-clause" data-clause="gdpr">
  <h2>§ 5 Data og personvern</h2>
  <h3>5.1 Roller</h3>
  <p>Kunden er behandlingsansvarlig for personopplysninger som behandles i Tjenesten. Leverandør er databehandler og behandler personopplysninger utelukkende etter Kundens dokumenterte instrukser.</p>
  <h3>5.2 Databehandleravtale</h3>
  <p>Partenes forpliktelser knyttet til behandling av personopplysninger er regulert i en separat databehandleravtale (Bilag A), som er en integrert del av denne avtalen. Databehandleravtalen er utformet i samsvar med GDPR artikkel 28 og personopplysningsloven.</p>
  <h3>5.3 Dataeierskap</h3>
  <p>Kunden eier alle data som lastes opp til eller genereres i Tjenesten. Leverandør har ingen rettigheter til Kundens data ut over det som er nødvendig for å levere Tjenesten.</p>
  <h3>5.4 Dataportabilitet</h3>
  <p>Kunden kan til enhver tid eksportere sine data i maskinlesbart format (JSON/CSV). Ved opphør av avtalen vil Leverandør gjøre Kundens data tilgjengelig for eksport i 30 dager, hvoretter data slettes permanent.</p>
  <h3>5.5 Varsling ved sikkerhetsbrudd</h3>
  <p>Leverandør skal varsle Kunden uten ugrunnet opphold, og senest innen 48 timer, dersom det oppdages brudd på sikkerheten som berører Kundens personopplysninger.</p>
</section>',
  'compliance',
  '{client}',
  'no',
  5,
  true
),

-- 6. Konfidensialitet (Confidentiality) — legal
(
  'Konfidensialitet',
  'Gjensidig taushetsplikt, unntak og varighet etter opphør',
  '<section class="contract-clause" data-clause="confidentiality">
  <h2>§ 6 Konfidensialitet</h2>
  <h3>6.1 Taushetsplikt</h3>
  <p>Hver Part forplikter seg til å behandle all konfidensiell informasjon mottatt fra den andre Part med fortrolighet. Konfidensiell informasjon skal ikke deles med tredjeparter uten skriftlig samtykke, med mindre det er nødvendig for å oppfylle forpliktelser under denne avtalen.</p>
  <h3>6.2 Unntak</h3>
  <p>Taushetsplikten gjelder ikke informasjon som:</p>
  <ul>
    <li>er eller blir allment kjent uten brudd på denne avtalen</li>
    <li>var kjent for mottakende Part før mottak</li>
    <li>er mottatt fra en tredjepart uten konfidensialitetsforpliktelse</li>
    <li>er utviklet uavhengig av mottakende Part</li>
    <li>må utleveres i henhold til lov, forskrift eller rettskraftig avgjørelse</li>
  </ul>
  <h3>6.3 Varighet</h3>
  <p>Taushetsplikten gjelder i avtalens løpetid og i 3 år etter avtalens opphør.</p>
</section>',
  'legal',
  '{client,employee}',
  'no',
  6,
  true
),

-- 7. Ansvarsbegrensning (Liability) — legal
(
  'Ansvarsbegrensning',
  'Begrensning av erstatningsansvar, indirekte tap og garantifraskrivelse',
  '<section class="contract-clause" data-clause="liability">
  <h2>§ 7 Ansvarsbegrensning</h2>
  <h3>7.1 Ansvarets omfang</h3>
  <p>Leverandørens samlede erstatningsansvar under denne avtalen er begrenset til det totale beløp Kunden har betalt i abonnement de siste 12 måneder forut for det ansvarsbetingende forholdet.</p>
  <h3>7.2 Indirekte tap</h3>
  <p>Ingen av Partene er ansvarlig for indirekte tap, herunder, men ikke begrenset til, tapt fortjeneste, tapte data (ut over Leverandørens forpliktelse til sikkerhetskopiering), tap av goodwill eller driftsavbrudd, med mindre tapet skyldes forsett eller grov uaktsomhet.</p>
  <h3>7.3 Garantifraskrivelse</h3>
  <p>Tjenesten leveres «som den er» innenfor de spesifikasjoner som er beskrevet i § 2. Leverandør gir ingen garantier ut over det som følger av denne avtalen og ufravikelig lovgivning.</p>
  <h3>7.4 Unntak</h3>
  <p>Ansvarsbegrensningene i denne paragraf gjelder ikke ved brudd på taushetsplikt (§ 6), brudd på personvernforpliktelser (§ 5), eller ved forsett eller grov uaktsomhet.</p>
</section>',
  'legal',
  '{client}',
  'no',
  7,
  true
),

-- 8. Immaterielle rettigheter (IP) — legal
(
  'Immaterielle rettigheter',
  'Eierskap til plattform, lisensrettigheter og kundens innhold',
  '<section class="contract-clause" data-clause="ip">
  <h2>§ 8 Immaterielle rettigheter</h2>
  <h3>8.1 Leverandørens rettigheter</h3>
  <p>Alle immaterielle rettigheter til Tjenesten, herunder programvare, kildekode, design, algoritmer, AI-modeller og dokumentasjon, tilhører Leverandør. Ingenting i denne avtalen skal tolkes som en overdragelse av slike rettigheter til Kunden.</p>
  <h3>8.2 Lisens</h3>
  <p>Leverandør gir Kunden en ikke-eksklusiv, ikke-overførbar, tidsbegrenset lisens til å bruke Tjenesten i samsvar med denne avtalen og gjeldende bruksvilkår, så lenge avtalen løper og abonnementet er betalt.</p>
  <h3>8.3 Kundens innhold</h3>
  <p>Kunden beholder alle rettigheter til innhold som Kunden laster opp til eller oppretter i Tjenesten, herunder dokumenter, bilder, policyer og opplæringsmateriell. Leverandør gis en begrenset lisens til å bruke dette innholdet utelukkende for å levere Tjenesten.</p>
</section>',
  'legal',
  '{client}',
  'no',
  8,
  true
),

-- 9. Force Majeure — legal
(
  'Force Majeure',
  'Ansvarsfritak ved ekstraordinære omstendigheter utenfor partenes kontroll',
  '<section class="contract-clause" data-clause="force-majeure">
  <h2>§ 9 Force Majeure</h2>
  <p>Ingen av Partene er ansvarlig for manglende oppfyllelse av sine forpliktelser under denne avtalen dersom oppfyllelsen er forhindret av omstendigheter utenfor Partens rimelige kontroll, herunder, men ikke begrenset til:</p>
  <ul>
    <li>naturkatastrofer, pandemi eller epidemi</li>
    <li>krig, terrorhandlinger eller sivil uro</li>
    <li>streik eller lockout (unntatt i egen virksomhet)</li>
    <li>myndighetspålegg eller lovendringer</li>
    <li>alvorlige cyberangrep eller infrastruktursvikt hos tredjepartsleverandører</li>
  </ul>
  <p>Den berørte Part skal uten ugrunnet opphold varsle den andre Part om force majeure-situasjonen og forventet varighet. Dersom force majeure-situasjonen varer i mer enn 90 dager, kan hver Part si opp avtalen med 30 dagers skriftlig varsel uten erstatningsansvar.</p>
</section>',
  'legal',
  '{client,employee}',
  'no',
  9,
  true
),

-- 10. Endringer (Amendments) — legal
(
  'Endringer',
  'Prosedyre for endringer i avtalevilkår og oppdatering av tjenesten',
  '<section class="contract-clause" data-clause="amendments">
  <h2>§ 10 Endringer</h2>
  <h3>10.1 Endring av avtalen</h3>
  <p>Endringer i denne avtalen krever skriftlig avtale mellom Partene, med mindre annet er spesifikt angitt i avtalen (for eksempel prisjustering i henhold til § 3.3).</p>
  <h3>10.2 Endring av Tjenesten</h3>
  <p>Leverandør kan gjøre endringer i Tjenestens funksjonalitet, utseende og tekniske plattform som en del av normal produktutvikling. Vesentlige endringer som påvirker Kundens bruk varsles minst 30 dager i forveien. Leverandør skal tilstrebe at endringer ikke medfører tap av funksjonalitet som Kunden er avhengig av.</p>
  <h3>10.3 Vilkårsendringer</h3>
  <p>Leverandør kan oppdatere generelle bruksvilkår med 30 dagers skriftlig varsel. Kunden kan si opp avtalen innen 30 dager dersom endringene er vesentlig ugunstige for Kunden.</p>
</section>',
  'legal',
  '{client}',
  'no',
  10,
  true
),

-- 11. Tvister og lovvalg (Disputes) — legal
(
  'Tvister og lovvalg',
  'Lovvalg (norsk rett), verneting (Oslo tingrett) og mekling',
  '<section class="contract-clause" data-clause="disputes">
  <h2>§ 11 Tvister og lovvalg</h2>
  <h3>11.1 Lovvalg</h3>
  <p>Denne avtalen er underlagt norsk rett.</p>
  <h3>11.2 Forhandling og mekling</h3>
  <p>Tvister som oppstår i forbindelse med denne avtalen skal først søkes løst gjennom forhandlinger mellom Partene. Dersom forhandlinger ikke fører frem innen 30 dager, kan hver Part kreve mekling gjennom Oslo Handelskammers meklingstjeneste.</p>
  <h3>11.3 Verneting</h3>
  <p>Dersom tvisten ikke løses gjennom mekling, skal tvisten avgjøres ved Oslo tingrett som avtalt verneting.</p>
</section>',
  'legal',
  '{client,employee}',
  'no',
  11,
  true
),

-- 12. Underskrifter (Signatures) — signature
(
  'Underskrifter',
  'Signaturblokk med dato, navn og stilling for begge parter',
  '<section class="contract-clause" data-clause="signatures">
  <h2>§ 12 Underskrifter</h2>
  <p>Denne avtalen er inngått i to (2) likelydende eksemplarer, hvorav hver Part beholder ett. Ved elektronisk signering anses avtalen som gyldig inngått i samsvar med eIDAS-forordningen.</p>
  <div class="signature-block">
    <div class="signature-party">
      <p><strong>For Leverandør:</strong></p>
      <p>Sted/Dato: {{provider_signing_location}}, {{signing_date}}</p>
      <div class="signature-line"></div>
      <p>{{provider_signatory_name}}<br/>
      {{provider_signatory_title}}<br/>
      Smartout AS</p>
    </div>
    <div class="signature-party">
      <p><strong>For Kunde:</strong></p>
      <p>Sted/Dato: {{customer_signing_location}}, {{signing_date}}</p>
      <div class="signature-line"></div>
      <p>{{customer_signatory_name}}<br/>
      {{customer_signatory_title}}<br/>
      {{customer_name}}</p>
    </div>
  </div>
</section>',
  'signature',
  '{client,employee}',
  'no',
  12,
  true
);

-- English versions

INSERT INTO clause_library (title, summary, content_html, category, contract_types, language, sort_order, is_active)
VALUES

-- 1. Parties — identification (EN)
(
  'Parties',
  'Identification of contracting parties with organization numbers and contact information',
  '<section class="contract-clause" data-clause="parties">
  <h2>§ 1 Parties</h2>
  <p>This agreement is entered into between:</p>
  <div class="party-block">
    <p><strong>Provider:</strong></p>
    <p>Smartout AS<br/>
    Organization number: {{provider_org_number}}<br/>
    Address: {{provider_address}}<br/>
    Contact person: {{provider_contact_name}}<br/>
    Email: {{provider_contact_email}}</p>
  </div>
  <div class="party-block">
    <p><strong>Customer:</strong></p>
    <p>{{customer_name}}<br/>
    Organization number: {{customer_org_number}}<br/>
    Address: {{customer_address}}<br/>
    Contact person: {{customer_contact_name}}<br/>
    Email: {{customer_contact_email}}</p>
  </div>
  <p>The Provider and the Customer are hereinafter collectively referred to as the "Parties" and individually as a "Party."</p>
</section>',
  'identification',
  '{client,employee}',
  'en',
  1,
  true
),

-- 2. Service Description (EN)
(
  'Service Description',
  'Description of the SaaS service, availability (SLA) and support levels',
  '<section class="contract-clause" data-clause="service">
  <h2>§ 2 Service Description</h2>
  <p>The Provider shall deliver the Smartout platform (the "Service") as a cloud-based SaaS solution for workforce management, training and operational control in the hospitality industry.</p>
  <h3>2.1 Scope of Service</h3>
  <p>The Service includes:</p>
  <ul>
    <li>Access to the Smartout web application for administration and daily operations</li>
    <li>Employee portal for onboarding, training and certification</li>
    <li>Shift scheduling and operational coordination</li>
    <li>HACCP management and control systems</li>
    <li>AI-assisted support and automation</li>
    <li>Reporting and analytics</li>
  </ul>
  <h3>2.2 Availability</h3>
  <p>The Provider targets an uptime of 99.5% measured per calendar month, excluding planned maintenance. Planned maintenance will be notified at least 48 hours in advance and will preferably be performed between 02:00 and 06:00 CET.</p>
  <h3>2.3 Support</h3>
  <p>The Provider offers support via email and in-app chat. Response time for critical issues is within 4 hours on business days between 08:00 and 17:00 CET. Non-critical inquiries will be responded to within 1 business day.</p>
</section>',
  'service',
  '{client}',
  'en',
  2,
  true
),

-- 3. Payment and Invoicing (EN)
(
  'Payment and Invoicing',
  'Payment terms, pricing, billing frequency and late payment interest',
  '<section class="contract-clause" data-clause="payment">
  <h2>§ 3 Payment and Invoicing</h2>
  <h3>3.1 Price</h3>
  <p>The Customer shall pay a subscription based on the selected pricing plan and number of active users. Current prices are specified in the price list on the Provider''s website or in a separate price quote attached to this agreement.</p>
  <h3>3.2 Invoicing</h3>
  <p>Invoicing occurs {{billing_cycle}} in advance. Invoices are sent electronically to the designated email address with {{payment_terms}} days payment terms.</p>
  <h3>3.3 Price Adjustments</h3>
  <p>The Provider may adjust prices annually as of January 1, effective from the subsequent billing period. Price changes will be communicated in writing at least 60 days before taking effect. The Customer may terminate the agreement if the price increase exceeds 10% of the current price.</p>
  <h3>3.4 Late Payment</h3>
  <p>Late payment interest will be charged in accordance with the Norwegian Late Payment Interest Act. The Provider may suspend access to the Service if payment is more than 30 days overdue, following written notice with a 14-day deadline.</p>
</section>',
  'financial',
  '{client}',
  'en',
  3,
  true
),

-- 4. Duration and Termination (EN)
(
  'Duration and Termination',
  'Agreement duration, trial period, automatic renewal and termination terms',
  '<section class="contract-clause" data-clause="duration">
  <h2>§ 4 Duration and Termination</h2>
  <h3>4.1 Duration</h3>
  <p>This agreement takes effect upon signing and runs for an initial period of {{initial_term}} months (the "Agreement Period"). Upon expiration of the Agreement Period, the agreement is automatically renewed for periods of {{renewal_term}} months, unless a Party terminates in accordance with section 4.3.</p>
  <h3>4.2 Trial Period</h3>
  <p>The Customer is offered a free trial period of 14 days from workspace creation. During the trial period, the Customer has full access to the Service. If the Customer does not enter into a payment agreement within the trial period, access is reduced to read-only mode for 14 days (grace period), before the account is deactivated.</p>
  <h3>4.3 Termination</h3>
  <p>Either Party may terminate the agreement with at least 30 days'' written notice before the end of the current agreement period. Termination shall be sent by email to the other Party''s designated contact address.</p>
  <h3>4.4 Breach</h3>
  <p>Either Party may terminate the agreement with immediate effect in case of material breach by the other Party that is not remedied within 30 days of written notice.</p>
</section>',
  'legal',
  '{client}',
  'en',
  4,
  true
),

-- 5. Data and Privacy (EN)
(
  'Data and Privacy',
  'Data processing agreement, GDPR obligations, data ownership and portability',
  '<section class="contract-clause" data-clause="gdpr">
  <h2>§ 5 Data and Privacy</h2>
  <h3>5.1 Roles</h3>
  <p>The Customer is the data controller for personal data processed in the Service. The Provider is the data processor and processes personal data solely in accordance with the Customer''s documented instructions.</p>
  <h3>5.2 Data Processing Agreement</h3>
  <p>The Parties'' obligations regarding the processing of personal data are governed by a separate Data Processing Agreement (Annex A), which is an integral part of this agreement. The DPA is drafted in compliance with GDPR Article 28 and the Norwegian Personal Data Act.</p>
  <h3>5.3 Data Ownership</h3>
  <p>The Customer owns all data uploaded to or generated in the Service. The Provider has no rights to the Customer''s data beyond what is necessary to deliver the Service.</p>
  <h3>5.4 Data Portability</h3>
  <p>The Customer may export their data in machine-readable format (JSON/CSV) at any time. Upon termination of the agreement, the Provider shall make the Customer''s data available for export for 30 days, after which the data is permanently deleted.</p>
  <h3>5.5 Security Breach Notification</h3>
  <p>The Provider shall notify the Customer without undue delay, and no later than 48 hours, upon discovery of a security breach affecting the Customer''s personal data.</p>
</section>',
  'compliance',
  '{client}',
  'en',
  5,
  true
),

-- 6. Confidentiality (EN)
(
  'Confidentiality',
  'Mutual confidentiality obligations, exceptions and post-termination duration',
  '<section class="contract-clause" data-clause="confidentiality">
  <h2>§ 6 Confidentiality</h2>
  <h3>6.1 Obligation</h3>
  <p>Each Party undertakes to treat all confidential information received from the other Party with confidentiality. Confidential information shall not be shared with third parties without written consent, unless necessary to fulfill obligations under this agreement.</p>
  <h3>6.2 Exceptions</h3>
  <p>The confidentiality obligation does not apply to information that:</p>
  <ul>
    <li>is or becomes publicly known without breach of this agreement</li>
    <li>was known to the receiving Party prior to receipt</li>
    <li>is received from a third party without confidentiality obligation</li>
    <li>is independently developed by the receiving Party</li>
    <li>must be disclosed pursuant to law, regulation or binding court order</li>
  </ul>
  <h3>6.3 Duration</h3>
  <p>The confidentiality obligation applies during the term of the agreement and for 3 years after its termination.</p>
</section>',
  'legal',
  '{client,employee}',
  'en',
  6,
  true
),

-- 7. Limitation of Liability (EN)
(
  'Limitation of Liability',
  'Limitation of liability, indirect damages and warranty disclaimer',
  '<section class="contract-clause" data-clause="liability">
  <h2>§ 7 Limitation of Liability</h2>
  <h3>7.1 Scope of Liability</h3>
  <p>The Provider''s total aggregate liability under this agreement is limited to the total amount the Customer has paid in subscription fees during the 12 months preceding the event giving rise to the liability.</p>
  <h3>7.2 Indirect Damages</h3>
  <p>Neither Party is liable for indirect damages, including but not limited to lost profits, lost data (beyond the Provider''s backup obligations), loss of goodwill or business interruption, unless the damage is caused by willful misconduct or gross negligence.</p>
  <h3>7.3 Warranty Disclaimer</h3>
  <p>The Service is provided "as is" within the specifications described in § 2. The Provider makes no warranties beyond those set forth in this agreement and mandatory legislation.</p>
  <h3>7.4 Exceptions</h3>
  <p>The liability limitations in this section do not apply to breaches of confidentiality (§ 6), privacy obligations (§ 5), or willful misconduct or gross negligence.</p>
</section>',
  'legal',
  '{client}',
  'en',
  7,
  true
),

-- 8. Intellectual Property (EN)
(
  'Intellectual Property',
  'Platform ownership, license rights and customer content',
  '<section class="contract-clause" data-clause="ip">
  <h2>§ 8 Intellectual Property</h2>
  <h3>8.1 Provider Rights</h3>
  <p>All intellectual property rights in the Service, including software, source code, design, algorithms, AI models and documentation, belong to the Provider. Nothing in this agreement shall be construed as a transfer of such rights to the Customer.</p>
  <h3>8.2 License</h3>
  <p>The Provider grants the Customer a non-exclusive, non-transferable, time-limited license to use the Service in accordance with this agreement and applicable terms of use, for as long as the agreement is in effect and the subscription is paid.</p>
  <h3>8.3 Customer Content</h3>
  <p>The Customer retains all rights to content uploaded to or created in the Service, including documents, images, policies and training materials. The Provider is granted a limited license to use this content solely for the purpose of delivering the Service.</p>
</section>',
  'legal',
  '{client}',
  'en',
  8,
  true
),

-- 9. Force Majeure (EN)
(
  'Force Majeure',
  'Liability exemption for extraordinary circumstances beyond the parties'' control',
  '<section class="contract-clause" data-clause="force-majeure">
  <h2>§ 9 Force Majeure</h2>
  <p>Neither Party is liable for failure to perform its obligations under this agreement if performance is prevented by circumstances beyond the Party''s reasonable control, including but not limited to:</p>
  <ul>
    <li>natural disasters, pandemic or epidemic</li>
    <li>war, acts of terrorism or civil unrest</li>
    <li>strike or lockout (except within the Party''s own organization)</li>
    <li>government orders or changes in legislation</li>
    <li>severe cyber attacks or infrastructure failure at third-party providers</li>
  </ul>
  <p>The affected Party shall notify the other Party without undue delay of the force majeure event and its expected duration. If the force majeure event continues for more than 90 days, either Party may terminate the agreement with 30 days'' written notice without liability.</p>
</section>',
  'legal',
  '{client,employee}',
  'en',
  9,
  true
),

-- 10. Amendments (EN)
(
  'Amendments',
  'Procedure for changes to agreement terms and service updates',
  '<section class="contract-clause" data-clause="amendments">
  <h2>§ 10 Amendments</h2>
  <h3>10.1 Agreement Amendments</h3>
  <p>Amendments to this agreement require written agreement between the Parties, unless otherwise specifically stated in the agreement (e.g., price adjustments pursuant to § 3.3).</p>
  <h3>10.2 Service Changes</h3>
  <p>The Provider may make changes to the Service''s functionality, design and technical platform as part of normal product development. Material changes affecting the Customer''s use will be notified at least 30 days in advance. The Provider shall endeavor to ensure that changes do not result in loss of functionality that the Customer relies on.</p>
  <h3>10.3 Terms Changes</h3>
  <p>The Provider may update general terms of use with 30 days'' written notice. The Customer may terminate the agreement within 30 days if the changes are materially unfavorable to the Customer.</p>
</section>',
  'legal',
  '{client}',
  'en',
  10,
  true
),

-- 11. Disputes and Governing Law (EN)
(
  'Disputes and Governing Law',
  'Governing law (Norwegian law), jurisdiction (Oslo District Court) and mediation',
  '<section class="contract-clause" data-clause="disputes">
  <h2>§ 11 Disputes and Governing Law</h2>
  <h3>11.1 Governing Law</h3>
  <p>This agreement is governed by Norwegian law.</p>
  <h3>11.2 Negotiation and Mediation</h3>
  <p>Disputes arising in connection with this agreement shall first be resolved through negotiations between the Parties. If negotiations do not succeed within 30 days, either Party may request mediation through the Oslo Chamber of Commerce mediation service.</p>
  <h3>11.3 Jurisdiction</h3>
  <p>If the dispute is not resolved through mediation, the dispute shall be settled by the Oslo District Court as the agreed jurisdiction.</p>
</section>',
  'legal',
  '{client,employee}',
  'en',
  11,
  true
),

-- 12. Signatures (EN)
(
  'Signatures',
  'Signature block with date, name and title for both parties',
  '<section class="contract-clause" data-clause="signatures">
  <h2>§ 12 Signatures</h2>
  <p>This agreement has been executed in two (2) identical copies, of which each Party retains one. When signed electronically, the agreement is considered validly executed in accordance with the eIDAS Regulation.</p>
  <div class="signature-block">
    <div class="signature-party">
      <p><strong>For the Provider:</strong></p>
      <p>Place/Date: {{provider_signing_location}}, {{signing_date}}</p>
      <div class="signature-line"></div>
      <p>{{provider_signatory_name}}<br/>
      {{provider_signatory_title}}<br/>
      Smartout AS</p>
    </div>
    <div class="signature-party">
      <p><strong>For the Customer:</strong></p>
      <p>Place/Date: {{customer_signing_location}}, {{signing_date}}</p>
      <div class="signature-line"></div>
      <p>{{customer_signatory_name}}<br/>
      {{customer_signatory_title}}<br/>
      {{customer_name}}</p>
    </div>
  </div>
</section>',
  'signature',
  '{client,employee}',
  'en',
  12,
  true
);
