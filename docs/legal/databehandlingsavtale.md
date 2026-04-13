---
title: Databehandlingsavtale
status: draft
updated: 2026-04-13
created: 2026-04-13
module: legal
tags: [gdpr, dpa, personvern, compliance]
---

# Databehandlingsavtale

**mellom Behandlingsansvarlig (Lisensinnehaver) og Databehandler (Smartout AS)**

---

## 1. Formål

Avtalens hovedformål er å etablere retningslinjer og bestemmelser i samsvar med EUs personvernforordning (GDPR — Forordning (EU) 2016/679), den norske personopplysningsloven (Lov av 15. juni 2018 nr. 38) og tilhørende forskrifter.

Avtalen regulerer Databehandlers (Smartout AS, org.nr. 928 953 722) behandling av personopplysninger på vegne av Behandlingsansvarlig, herunder innsamling, registrering, sammenstilling, lagring, endring, utlevering, overføring til tredjeland, sletting, og enhver kombinasjon av disse aktivitetene.

Avtalen inngår som del av det samlede avtalegrunnlaget mellom partene, sammen med «Lisens- og brukeravtale for Smartout AS» og «Tilbudet». I spørsmål som gjelder behandling av personopplysninger, personvern og informasjonssikkerhet, har denne Databehandlingsavtalen forrang fremfor Lisens- og brukeravtalen. For øvrige saker gjelder prioriteringsrekkefølgen fastsatt i Lisens- og brukeravtalens punkt 2.

---

## 2. Systemene Smartout AS leverer

### 2.1 Systembeskrivelse

Smartout AS leverer en skybasert plattform («Smartout») for personalledelse i skiftbaserte virksomheter. Plattformen omfatter:

| Modul | Funksjon | Personopplysninger involvert |
|-------|----------|------------------------------|
| **Arbeidsplanlegging** | Vaktplanlegging, skiftbytte, inn-/utstempling, avvik | Navn, vaktdata, GPS (valgfritt), tidsstempler |
| **Lønn og avregning** | Timeberegning, tillegg, lønnsrapportering | Lønnssats, timer, personnummer, bankkontonummer |
| **Ansattforvaltning** | Profiler, kontrakter, onboarding, offboarding | Fullt navn, fødselsdato, personnummer, adresse, telefon, e-post, stillingstittel, ansattdato |
| **Opplæring** | Policyer, protokoller, kunnskapstester, sertifiseringer | Navn, testresultater, fremgang, kompetansestatus |
| **Kommunikasjon** | Meldinger, kanaler, tale (walkie-talkie) | Navn, meldingsinnhold, taleopptak (sanntid) |
| **AI-assistent** | Mr. Botsson — chat og stemmebasert veiledning | Kontekstuell arbeidsplassdata, stemmeopptak (ved bruk av talefunksjon) |
| **Kontrakter** | Arbeidsavtaler med e-signatur | Fullt navn, personnummer, adresse, lønn, signert PDF |
| **Rapportering** | KPI-er, belegg, budsjett, sesongplanlegging | Aggregerte data, normalt ikke direkte identifiserbare |
| **Governance** | Rutiner, sjekklister, HMS, avvikshåndtering | Navn på ansvarlige, avviksrapporter |

Plattformen er tilgjengelig via nettleser (dashboard), mobilapplikasjon (iOS/Android), og API-integrasjoner.

### 2.2 Personopplysninger som behandles

#### Kategori A — Alminnelige personopplysninger

| Opplysning | Kilde | Formål |
|------------|-------|--------|
| Fornavn og etternavn | Registrert av Behandlingsansvarlig | Identifikasjon |
| Fødselsdato | Registrert av Behandlingsansvarlig | Aldersverifisering, tariffberegning |
| E-postadresse (jobb og privat) | Registrert ved invitasjon/onboarding | Innlogging, varslinger |
| Telefonnummer | Registrert av Behandlingsansvarlig | SMS-varsler, nødkontakt |
| Adresse (gate, postnummer, by) | Registrert av Behandlingsansvarlig | Arbeidsavtaler, lønnsrapportering |
| Ansattnummer | Tildelt av Behandlingsansvarlig | Intern identifikasjon |
| Stillingstittel | Registrert av Behandlingsansvarlig | Rolle og avdelingstilhørighet |
| Ansattdato / startdato | Registrert av Behandlingsansvarlig | Ansiennitet, kontraktsberegning |
| Avdelingstilhørighet | Registrert av Behandlingsansvarlig | Arbeidsplanlegging |
| Profilbilde (avatar) | Lastet opp av den registrerte | Identifikasjon i systemet |
| Nødkontakt (navn, telefon, relasjon) | Registrert av den registrerte eller Behandlingsansvarlig | HMS/beredskap |
| Foretrukket språk og tidssone | Valgt av den registrerte | Lokalisering |

#### Kategori B — Sensitive og beskyttelsesverdige opplysninger

| Opplysning | Kilde | Formål | Sikring |
|------------|-------|--------|---------|
| Personnummer (fødselsnummer) | Registrert av Behandlingsansvarlig via auditert RPC | Lønnsrapportering, arbeidsavtaler | Auditert tilgang, ikke i logg |
| Bankkontonummer | Registrert av Behandlingsansvarlig via auditert RPC | Lønnsutbetaling | Auditert tilgang, ikke i logg |
| Timelønn / månedslønn | Registrert av Behandlingsansvarlig | Lønnsberegning, kontrakter | Begrenset tilgang (admin/eier) |

**Viktig:** Kategori B-opplysninger kan kun registreres via en dedikert, auditert funksjon (`admin_submit_employee_pii`). Selve verdiene logges **ikke** i systemets revisjonslogg — kun at oppdatering ble foretatt, av hvem, og hvilke feltkategorier som ble endret.

#### Kategori C — Systemgenererte opplysninger

| Opplysning | Formål |
|------------|--------|
| Timelister og vaktlister | Arbeidsplanlegging, lønnsgrunnlag |
| Inn-/utklokking med tidsstempler | Tidsregistrering |
| Avvik og korreksjoner | Lønnsavregning |
| Testresultater og opplæringsfremdrift | Kompetansestyring |
| Kommunikasjonslogg (meldinger, varsler) | Operasjonell drift |
| Enhetsinformasjon (push-token) | Mobilvarslinger |
| IP-adresse og user agent | Revisjonslogg, sikkerhet |
| Innloggingsmetode (e-post, Google, Microsoft) | Autentisering |

#### Kategori D — AI-behandlet data

| Opplysning | Formål | Underdatabehandler |
|------------|--------|--------------------|
| Arbeidsplasskontekst (avdeling, roller, regler) | AI-assistert veiledning og onboarding | OpenRouter → Anthropic |
| Dokumentinnhold (policyer, rutiner, håndbøker) | Vektorisering for kunnskapssøk | OpenRouter → OpenAI |
| Stemmedata (strømmes i sanntid, forkastes umiddelbart etter prosessering — ingen permanent lagring hos Databehandler eller underleverandør) | Talebasert AI-veiledning | Ultravox |
| Sanntid tale/video (kanaler) | Intern kommunikasjon | LiveKit |

### 2.3 Databehandlers behandling

Smartout AS har ansvaret for drift og administrasjon av plattformen på vegne av Behandlingsansvarlig. Databehandler skal:

- Sikre at plattformen opprettholder nødvendig tilgjengelighet og sikkerhet
- Forhindre at uautoriserte personer får tilgang til personopplysninger
- Lagre data i samsvar med gjeldende regelverk til enhver tid
- Kun benytte opplysninger til formål avtalt med Behandlingsansvarlig og som grunnlag for fakturering
- Implementere tekniske og organisatoriske tiltak i henhold til GDPR artikkel 32
- Ikke bruke Behandlingsansvarligs data til trening av AI-modeller, og sikre at underleverandører som leverer AI-tjenester har tilsvarende forpliktelser

**Datalagring:** All primær datalagring skjer hos Supabase (PostgreSQL på AWS infrastruktur) innenfor EU/EOS. All trafikk mellom bruker og plattformen er kryptert med TLS. Data er kryptert i hvile (AES-256) hos databaseleverandør.

**Tilgangskontroll:** Systemet implementerer radnivå-sikkerhet (Row-Level Security) på alle brukertilgjengelige tabeller, slik at data kun er tilgjengelig for autoriserte brukere innenfor den registrertes arbeidsområde.

**Revisjonslogg:** Alle vesentlige handlinger i systemet logges i en uforanderlig revisjonslogg (`activity_trail`) som inkluderer hvem som utførte handlingen, tidspunkt, og hva som ble endret — men uten å inkludere selve verdien av Kategori B-opplysninger.

### 2.4 Tilgang for Behandlingsansvarlig

Smartout-plattformen tilbys gjennom passordbeskyttet, nettleserbasert tilgang via dedikert underdomene (`{virksomhet}.smartout.ai`). Mobilapplikasjon krever autentisering via e-post/passord, Google eller Microsoft SSO.

Behandlingsansvarlig styrer selv hvilken tilgang ansatte i organisasjonen skal ha gjennom følgende rollenivåer:

| Rolle | Tilgang |
|-------|---------|
| **Eier** | Full tilgang, inkludert fakturering og sletting |
| **Administrator** | Ansattforvaltning, vaktplanlegging, lønn, rapporter |
| **Leder** | Teamets vakter, kommunikasjon, opplæring |
| **Ansatt** | Egen profil, egne vakter, opplæring, kommunikasjon |

Smartout AS kan justere tilgangsnivå i samsvar med avtale eller ved teknisk support etter forespørsel fra Behandlingsansvarlig.

### 2.5 Utlevering av personopplysninger

Smartout AS vil ikke dele personopplysninger med tredjeparter utover de underdatabehandlere som er oppført i Vedlegg 1, med mindre:

- Behandlingsansvarlig har gitt dokumentert instruks
- Det foreligger gyldig rettskjennelse eller pålegg fra Datatilsynet
- Det er nødvendig for å oppfylle avtaleforpliktelser (f.eks. e-signatur av arbeidsavtaler)

Alle ansatte i Smartout AS er underlagt generell taushetsplikt og har signert taushetserklæring. Kun ansatte som arbeider med drift, utvikling og brukerstøtte har tilgang til personopplysninger, og kun i den grad det er nødvendig for å utføre sine oppgaver.

---

## 3. Databehandlers plikter

Databehandler skal:

1. **Kun behandle personopplysninger etter dokumentert instruks** fra Behandlingsansvarlig, med mindre behandling er pålagt etter EU-rett eller norsk rett (GDPR art. 28(3)(a))
2. **Sikre at personer som er autorisert** til å behandle personopplysninger har forpliktet seg til konfidensialitet (GDPR art. 28(3)(b))
3. **Treffe alle nødvendige sikkerhetstiltak** i henhold til GDPR art. 32 (se punkt 5)
4. **Bistå Behandlingsansvarlig** med å oppfylle de registrertes rettigheter (GDPR art. 15–22), herunder innsyn, retting, sletting, portabilitet og innsigelse
5. **Varsle Behandlingsansvarlig uten ugrunnet opphold** ved brudd på personopplysningssikkerheten (se punkt 5.2)
6. **Bistå med konsekvensanalyser** (DPIA) og forhåndsdrøftinger med Datatilsynet der dette er relevant (GDPR art. 35–36)
7. **Slette eller tilbakelevere alle personopplysninger** ved opphør av avtalen (se punkt 7)
8. **Gi Behandlingsansvarlig tilgang** til all informasjon som er nødvendig for å påvise at forpliktelsene er oppfylt, og tillate og bidra til revisjoner og inspeksjoner (GDPR art. 28(3)(h))

9. **Utpeke kontaktperson for personvernspørsmål.** Henvendelser om personvern rettes til `support@smartout.no`. Smartout AS har per dato ikke utpekt personvernombud (DPO) i henhold til GDPR art. 37, men vurderer dette løpende i takt med virksomhetens vekst og behandlingsaktivitetenes omfang.

Taushetsplikt etter dette punkt gjelder også etter avtalens opphør.

---

## 4. Bruk av underdatabehandlere

### 4.1 Generell tillatelse

Behandlingsansvarlig gir Databehandler generell tillatelse til å engasjere underdatabehandlere for å utføre spesifikke behandlingsaktiviteter, jf. GDPR art. 28(2). Alle godkjente underdatabehandlere er oppført i **Vedlegg 1**.

### 4.2 Krav til underdatabehandlere

Databehandler skal:

- Inngå skriftlig avtale med alle underdatabehandlere som pålegger tilsvarende forpliktelser som denne avtale
- Sikre at underdatabehandlere implementerer tilstrekkelige tekniske og organisatoriske sikkerhetstiltak
- Forbli fullt ansvarlig overfor Behandlingsansvarlig for underdatabehandleres oppfyllelse

### 4.3 Varsling ved endring

Databehandler skal varsle Behandlingsansvarlig skriftlig minst **30 dager** før nye underdatabehandlere engasjeres eller eksisterende erstattes. Behandlingsansvarlig kan gjøre innsigelse mot endringen innen 14 dager etter varsling. Ved uløst innsigelse har Behandlingsansvarlig rett til å si opp avtalen med 30 dagers varsel.

### 4.4 Overføring til tredjeland

Flere underdatabehandlere behandler data i USA. For samtlige er overføringsgrunnlaget EUs standardkontraktsklausuler (SCCs) vedtatt av EU-kommisjonen 4. juni 2021, **Modul 3 (Databehandler til Underdatabehandler)**, med mindre annet er spesifisert for den enkelte underleverandør i Vedlegg 1. Overføringene er supplert med tilleggstiltak (kryptering i transit og hvile).

En fullstendig oversikt over underdatabehandlere, deres lokasjon, overføringsgrunnlag, og hvilke data som overføres, finnes i **Vedlegg 1**.

### 4.5 Transfer Impact Assessment (TIA)

Databehandler har gjennomført Transfer Impact Assessment (TIA) for alle overføringer til tredjeland oppført i Vedlegg 1, i henhold til kravene fastsatt av EU-domstolens avgjørelse i Schrems II (C-311/18). TIA-er er tilgjengelige for Behandlingsansvarlig ved forespørsel.

---

## 5. Sikkerhet

### 5.1 Sikkerhetstiltak

Databehandler implementerer følgende tekniske og organisatoriske tiltak i henhold til GDPR art. 32:

**Tilgangskontroll:**

| Tiltak | Beskrivelse |
|--------|-------------|
| Autentisering | JWT-basert med 1 times utløp, automatisk refresh-token rotasjon |
| Rollebasert tilgang (RBAC) | Fire rollenivåer: ansatt, leder, administrator, eier |
| Radnivå-sikkerhet (RLS) | Alle brukertilgjengelige databasetabeller har policyer som sikrer at brukere kun ser data i eget arbeidsområde |
| Hastighetsbegrensning | Innlogging (5/min), OTP (3/15min), API (20/min), opprettelse av arbeidsområde (3/time) — blokkerer ved utilgjengelig cache (fail-closed) |
| Plattformadministrasjon | Egen auditert tilgangslogg, inkludert personifiseringslogg med begrunnelse |

**Kryptering:**

| Tiltak | Beskrivelse |
|--------|-------------|
| I transit | TLS 1.2+ for all trafikk mellom bruker og plattform |
| I hvile | AES-256 hos databaseleverandør (Supabase/AWS) |
| Webhook-verifisering | ECDSA P-256/SHA-256 (SendGrid), HMAC (DocuSeal, Stripe) |

**Revisjonslogg:**

| Tiltak | Beskrivelse |
|--------|-------------|
| Uforanderlig logg | `activity_trail` — kun innsetting tillatt, ingen endring eller sletting |
| Kontraktslogg | `contract_event` — full livsløpssporing med IP og user agent |
| PII-audit | Sensitiv data (Kategori B) logges uten verdier — kun feltkategori og aktør |
| Plattformlogg | Superadmin-handlinger og personifisering logges separat |

**Organisatoriske tiltak:**

- Alle ansatte i Smartout AS har signert taushetserklæring
- Tilgang til produksjonsdata er begrenset til utviklings- og driftspersonell
- Utvikling skjer mot isolert lokalt miljø — aldri mot produksjonsdatabase
- Koderevisjon og automatisert sikkerhetstesting ved alle endringer

### 5.2 Avvikshåndtering

Ved brudd på personopplysningssikkerheten (GDPR art. 33) skal Databehandler:

1. Varsle Behandlingsansvarlig **uten ugrunnet opphold**, og senest innen **36 timer** etter å ha blitt kjent med bruddet, slik at Behandlingsansvarlig har tilstrekkelig tid til å oppfylle sin egen varslingsfrist overfor Datatilsynet (72 timer, jf. GDPR art. 33)
2. Varselet skal inneholde:
   - Beskrivelse av bruddet, inkludert kategorier og omtrentlig antall berørte registrerte
   - Navn og kontaktinformasjon til personvernombud eller annen kontaktperson
   - Sannsynlige konsekvenser av bruddet
   - Tiltak som er iverksatt eller foreslått for å håndtere bruddet
3. Bistå Behandlingsansvarlig med melding til Datatilsynet og eventuell varsling av registrerte

Det er Behandlingsansvarlig som har ansvaret for å rapportere avvik til Datatilsynet.

---

## 6. De registrertes rettigheter

Databehandler skal bistå Behandlingsansvarlig med å oppfylle de registrertes rettigheter etter GDPR kapittel III:

| Rettighet | Plattformstøtte |
|-----------|-----------------|
| **Innsyn** (art. 15) | Ansatte kan se egne opplysninger i profil, timelister og kontrakter. Administrator kan eksportere fullstendig profil. |
| **Retting** (art. 16) | Ansatte kan rette egne kontaktopplysninger. Administrator kan rette øvrige felt. |
| **Sletting** (art. 17) | Automatisert anonymiseringsfunksjon som fjerner PII fra alle tabeller. Se punkt 7. |
| **Begrensning** (art. 18) | Administrator kan sette profil som inaktiv, som begrenser behandling til oppbevaring. |
| **Dataportabilitet** (art. 20) | Eksport i maskinlesbart format (JSON/CSV) innen 30 dager ved forespørsel. |
| **Innsigelse** (art. 21) | Behandlingsansvarlig håndterer innsigelser. Databehandler bistår med teknisk gjennomføring. |

---

## 7. Avtalens varighet og opphør

### 7.1 Varighet

Denne avtalen er gyldig så lenge Databehandler behandler personopplysninger på vegne av Behandlingsansvarlig. Avtalen følger lisens- og brukeravtalens varighet.

### 7.2 Ved opphør — dataeksport

Ved opphør skal Behandlingsansvarlig gis mulighet til å eksportere alle data i maskinlesbart format. Eksport skal gjøres tilgjengelig innen **30 dager** etter oppsigelsesdato.

### 7.3 Ved opphør — sletting

Etter at eksportperioden er utløpt, forplikter Databehandler seg til:

1. Slette alle personopplysninger fra aktive systemer innen **60 dager**
2. Sikre at sikkerhetskopier rulleres ut innen **90 dager**
3. Utstede **slettebekreftelse** til Behandlingsansvarlig

Sletting gjennomføres gjennom plattformens anonymiseringsfunksjoner, som:

- Overskriver identifiserende opplysninger i brukeridentitetstabellen med anonymiserte verdier
- Nullstiller telefon, personnummer, bankkonto, adresse og andre PII-felt i profiltabellen
- Deaktiverer autentiseringskontoen
- Anonymiserer avslåtte eller utløpte kontrakter (i henhold til bokføringslovens oppbevaringsplikt — 3 år)

*Merk: Full automatisering av sletterutiner er under ferdigstilling. Inntil automatiseringen er komplett, utfører Databehandler sletting manuelt ved forespørsel innenfor de frister som er angitt ovenfor.*

### 7.4 Oppbevaringsplikt

Dersom Databehandler er rettslig forpliktet til å beholde visse opplysninger etter avtalens opphør (f.eks. regnskapslovens krav), skal Behandlingsansvarlig informeres om dette, og opplysningene skal kun behandles for det lovpålagte formålet.

---

## 8. Lovvalg og verneting

Avtalen er underlagt norsk rett. Partene vedtar Telemark tingrett som verneting. Dette gjelder også etter avtalens opphør.

---

## Vedlegg 1 — Underdatabehandlere

*Sist oppdatert: 2026-04-13*

### Infrastruktur og database

| # | Leverandør | Formål | Data som overføres | Lokasjon | Overføringsgrunnlag |
|---|-----------|--------|-------------------|----------|-------------------|
| 1 | **Supabase** (på AWS) | Primær database, autentisering, fillagring, sanntid, Edge Functions | Alle personopplysninger | EU (EOS) | Ingen tredjelandsoverføring |
| 2 | **Vercel** | Hosting av webapplikasjon, CDN, serverless-funksjoner | IP-adresser, request-headers, cookies | Global (US + EU CDN) | SCCs |

### Betaling

| # | Leverandør | Formål | Data som overføres | Lokasjon | Overføringsgrunnlag |
|---|-----------|--------|-------------------|----------|-------------------|
| 3 | **Stripe** | Abonnementsfakturering, betalingsbehandling | Virksomhetens faktureringsdata (ikke ansattdata) | USA | SCCs |

### E-post og SMS

| # | Leverandør | Formål | Data som overføres | Lokasjon | Overføringsgrunnlag |
|---|-----------|--------|-------------------|----------|-------------------|
| 4 | **SendGrid** (Twilio) | Transaksjonell e-post — invitasjoner, morgenrapport, kontraktspåminnelser | E-postadresse, varslingsinnhold | USA | SCCs |
| 5 | **Twilio** | SMS-varslinger — vaktbekreftelser, OTP, kritiske varsler | Telefonnummer, SMS-innhold | USA | SCCs |

### AI og maskinlæring

| # | Leverandør | Formål | Data som overføres | Lokasjon | Overføringsgrunnlag |
|---|-----------|--------|-------------------|----------|-------------------|
| 6 | **OpenRouter** | AI-gateway for ruting til LLM-modeller | Arbeidsplasskontekst, dokumentinnhold, samtalekontekst | USA | SCCs |
| 7 | **Anthropic** (via OpenRouter) | Språkmodell (Claude) for AI-assistent, kontraktskomposisjon, onboarding | Arbeidsplasskontekst, kontraktsvilkår (ikke personnummer direkte) | USA | SCCs |
| 8 | **OpenAI** (via OpenRouter) | Vektorisering av dokumenter for kunnskapssøk | Policyer, rutiner, håndbokinnhold (ikke direkte PII) | USA | SCCs |

### Tale og sanntidskommunikasjon

| # | Leverandør | Formål | Data som overføres | Lokasjon | Overføringsgrunnlag |
|---|-----------|--------|-------------------|----------|-------------------|
| 9 | **Ultravox** | AI-stemmeassistent (onboarding, Mr. Botsson) | Sanntid stemmeopptak, sesjonsdata | USA | SCCs |
| 10 | **LiveKit** | Sanntid tale-/videokanaler (walkie-talkie, teamkommunikasjon) | Lyd-/videostrømmer, visningsnavn, profilbilde | USA/EU | SCCs |

### E-signatur

| # | Leverandør | Formål | Data som overføres | Lokasjon | Overføringsgrunnlag |
|---|-----------|--------|-------------------|----------|-------------------|
| 11 | **DocuSeal** | Elektronisk signatur for arbeidsavtaler og lisensavtaler | **Fullt navn, e-post, personnummer, adresse, lønn**, signert PDF | USA | SCCs + kryptering |

> **Merknad:** DocuSeal mottar de mest sensitive personopplysningene i systemet, inkludert personnummer og lønnsinformasjon som del av arbeidsavtaler. Se «Handlingsplan for personvern og sikkerhet» (Vedlegg 4) for tiltak knyttet til denne overføringen.

### Analyse og feilovervåking

| # | Leverandør | Formål | Data som overføres | Lokasjon | Overføringsgrunnlag |
|---|-----------|--------|-------------------|----------|-------------------|
| 12 | **PostHog** (EU) | Produktanalyse, brukeratferd (pseudonymisert) | Pseudonym bruker-ID, sidevisninger, klikk | EU | Ingen tredjelandsoverføring |
| 13 | **Sentry** | Feilovervåking, ytelsesmåling | Stack traces, bruker-ID, potensielt request-data | USA | SCCs |
| 14 | **Vercel Analytics** | Web-vitals, sideanalyse | Aggregerte ytelsesdata | USA | SCCs |

### Cache og infrastruktur

| # | Leverandør | Formål | Data som overføres | Lokasjon | Overføringsgrunnlag |
|---|-----------|--------|-------------------|----------|-------------------|
| 15 | **Upstash** | Redis-cache for hastighetsbegrensning | IP-adresser som identifikatorer (ingen direkte PII) | USA | SCCs |

### Mobilvarslinger

| # | Leverandør | Formål | Data som overføres | Lokasjon | Overføringsgrunnlag |
|---|-----------|--------|-------------------|----------|-------------------|
| 16 | **Expo** (push) | Push-varslinger til mobilappen | Enhets-push-token, varslingsinnhold | USA | SCCs |

### Oppslag og integrasjoner

| # | Leverandør | Formål | Data som overføres | Lokasjon | Overføringsgrunnlag |
|---|-----------|--------|-------------------|----------|-------------------|
| 17 | **Google** (Places/OAuth) | Virksomhetsoppslag ved onboarding, sosial innlogging | Virksomhetsnavn, OAuth-legitimasjon | USA | SCCs |
| 18 | **Serper** | Webintelligens om virksomheter ved onboarding | Virksomhetsnavn (ingen PII) | USA | SCCs |
| 19 | **Brønnøysundregistrene** | Norsk foretaksregister (offentlig API) | Organisasjonsnummer (offentlig info) | Norge | Ingen tredjelandsoverføring |

---

## Vedlegg 2 — Dataoppbevaring og sletting

| Datakategori | Oppbevaringstid | Slettemåte |
|-------------|-----------------|------------|
| Aktiv ansattprofil | Så lenge ansettelsesforholdet varer | Anonymisering ved offboarding |
| Timelister og vaktdata | Etter gjeldende bokføringslov (5 år) | Automatisk sletting |
| Arbeidsavtaler (aktive) | Ansettelsesforholdets varighet + 3 år | Anonymisering av avslåtte/utløpte etter 3 år |
| Kommunikasjon (meldinger) | Standard 365 dager (konfigurerbart) | Automatisk sletting |
| Media i kanaler | Standard 90 dager (konfigurerbart) | Automatisk sletting |
| Invitasjonslenker | 7 dager | Automatisk utløp |
| Revisjonslogg | 5 år | Anonymisering (ikke sletting) |
| Stemmedata (sanntid) | Ikke lagret — kun sanntidsstrømming | Ikke aktuelt |
| Analytiske data (PostHog) | I henhold til PostHogs retningslinjer | Pseudonymisert |

---

## Vedlegg 3 — Tekniske sikkerhetstiltak

### Autentisering og autorisasjon

- JWT med 1 times levetid og automatisk refresh-token rotasjon
- Støtte for e-post/passord, Google OAuth og Microsoft SSO
- Multi-nivå rollebasert tilgangskontroll (RBAC)
- Hastighetsbegrensning med fail-closed design (blokkerer ved systemfeil)

### Databasesikkerhet

- Row-Level Security (RLS) på alle brukertilgjengelige tabeller
- Dedikerte hjelpefunksjoner for tilgangskontroll (`get_workspace_ids_for_user()`, `is_admin_in_workspace()`)
- Separate sikkerhetspolicyer for JWT-autentiserte brukere og API-nøkler
- PII-felt (personnummer, bankkonto) kun tilgjengelig via auditert RPC

### Kryptering

- TLS 1.2+ for all nettverkstrafikk
- AES-256 kryptering i hvile (AWS/Supabase)
- Webhook-signaturverifisering (ECDSA, HMAC)

### Overvåking og logging

- Uforanderlig revisjonslogg (kun innsetting)
- Feilovervåking via Sentry
- Ytelsesmåling via Vercel Analytics

---

## Vedlegg 4 — Handlingsplan for personvern og sikkerhet

Se eget dokument: `docs/legal/tiltaksdokument-personvern.md`

Handlingsplanen beskriver pågående og planlagt arbeid med personvern og sikkerhet, herunder leverandørgjennomgang, DPIA, samtykkeflyt for stemme-AI, og automatiserte sletterutiner.

---

*Denne avtalen er utarbeidet 2026-04-13 og skal gjennomgås årlig eller ved vesentlige endringer i behandlingsaktivitetene.*
