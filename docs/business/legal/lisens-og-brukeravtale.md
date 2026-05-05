---
title: Lisens- og brukeravtale
status: draft
updated: 2026-04-13
created: 2026-04-13
module: legal
tags: [lisens, avtale, saas, vilkår]
---

# Lisens- og brukeravtale

**mellom Kjøper (LISENSINNEHAVER) og Leverandør (SMARTOUT AS)**

---

## 1. Bestilling

Denne «Lisens- og brukeravtale» (heretter kalt «Avtalen») blir levert til LISENSINNEHAVER sammen med et tilbud om leveranse fra SMARTOUT AS (org.nr. 928 953 722, heretter kalt «SMARTOUT»). Avtalen trer i kraft fra det øyeblikket LISENSINNEHAVER godtar tilbudet.

Denne Avtalen gjelder for alle bestillinger av leveranser fra SMARTOUT og regulerer de generelle kontraktsrettslige forholdene mellom LISENSINNEHAVER og SMARTOUT. Ingen bestemmelser i denne Avtalen skal tolkes på en måte som fratar LISENSINNEHAVER rettigheter som er beskyttet av ufravikelig lovgivning.

---

## 2. Avtalens dokumenter

I tillegg til denne Avtalen gjelder også «Tilbudet» og «Databehandlingsavtalen». Disse dokumentene utgjør sammen det samlede avtalegrunnlaget. Ved motstrid mellom bestemmelsene gjelder følgende prioriteringsrekkefølge:

A. Tilbudet
B. Databehandlingsavtalen
C. Lisens- og brukeravtale

---

## 3. Avtalens innhold

### 3.1 Bruksrett

Denne Avtalen gir LISENSINNEHAVER rett til å bruke den skybaserte plattformen Smartout («Plattformen») som leveres som en tjeneste (SaaS) av SMARTOUT. Plattformen omfatter følgende moduler:

| Modul | Beskrivelse |
|-------|-------------|
| **Arbeidsplanlegging** | Vaktplanlegging, skiftbytte, sesongplanlegging, inn-/utstempling, avvikshåndtering, timerapportering |
| **Ansattforvaltning** | Ansattprofiler, onboarding, kontrakter, roller og tilgangsstyring, offboarding |
| **Lønn og avregning** | Timeberegning, tillegg, lønnsrapportering, tariffhåndtering, lønnsperiodegodkjenning |
| **Opplæring og kompetanse** | Policyer, protokoller, kunnskapstester, sertifiseringer, kompetanseoversikt, treningsforløp |
| **Kommunikasjon** | Meldingskanaler, varsler, sanntids talekanaler (walkie-talkie), push-varslinger |
| **AI-assistent (Mr. Botsson)** | Chat- og stemmebasert veiledning for ansatte, AI-støttet onboarding, lederstøtte |
| **Kontrakter** | Arbeidsavtaler med elektronisk signatur (enkel elektronisk signatur / SES iht. eIDAS-forordningen), kontraktsarkiv |
| **Governance** | Rutiner, sjekklister, HMS-dokumenter, avvikshåndtering, kontrollister |
| **Rapportering** | KPI-oversikt, belegg, budsjett, sesonganalyse, dashboards |

Plattformen er tilgjengelig via:
- **Nettleser:** Dashboard på `{virksomhet}.smartout.ai`
- **Mobilapplikasjon:** iOS og Android (via Expo/React Native)
- **API:** For godkjente integrasjoner (krever separat API-nøkkel)

Bruksretten er ikke-eksklusiv, ikke-overførbar, og begrenset til den avtaleperioden som følger av punkt 11.

### 3.2 Support

SMARTOUT tilbyr LISENSINNEHAVER støtte i forbindelse med utøvelsen av bruksretten beskrevet i punkt 3.1. Støtten tilbys via følgende kanaler:

- **AI-assistent (Mr. Botsson):** Tilgjengelig 24/7 i plattformen for operasjonell veiledning
- **E-post:** support@smartout.no
- **Chat:** Innebygd i plattformen
- **Video:** Teams eller tilsvarende medier ved behov

### 3.3 AI-funksjonalitet

Plattformen inkluderer AI-drevne funksjoner som bruker språkmodeller fra tredjepartsleverandører (se Databehandlingsavtalen Vedlegg 1). LISENSINNEHAVER samtykker til at:

- Arbeidsplasskontekst (avdelingsstruktur, regler, rutiner) kan behandles av AI-modeller for å gi relevant veiledning
- Stemmedata behandles i sanntid ved bruk av tale-AI (ikke lagres permanent)
- AI-genererte svar er veiledende og erstatter ikke arbeidsgivers ansvar for korrekt informasjon
- LISENSINNEHAVER er ansvarlig for å informere sine ansatte om bruk av AI i plattformen

SMARTOUT forplikter seg til å:
- Ikke bruke LISENSINNEHAVERs data til å trene AI-modeller
- Sikre at underleverandører har tilsvarende forpliktelser
- Tilby chat som alternativ til tale for ansatte som ikke ønsker stemmebasert AI

---

## 4. Begrensninger

### 4.1 Antall brukere / lisenstelling

LISENSINNEHAVER har tillatelse til å registrere ansatte i samsvar med bruksretten beskrevet i punkt 3.1. Lisensen er begrenset til antallet **aktive ansattprofiler** i plattformen.

Med «aktive ansattprofiler» menes det totale antallet brukere som er registrert med status «trainee» eller «active» i LISENSINNEHAVERs arbeidsområde i Smartout. Profiler med status «inactive» eller «offboarding» telles ikke.

Lisenstellingen overvåkes automatisk av Plattformen og rapporteres til SMARTOUTs faktureringssystem (Stripe). Fakturering justeres automatisk ved endring i antall aktive profiler.

Dersom LISENSINNEHAVER ønsker å redusere antallet aktive profiler, gjøres dette via dashboardets administrasjonsfunksjoner. Økning skjer automatisk ved registrering av nye ansatte.

### 4.2 Antall foretak / arbeidsområder

Hvert foretak krever et eget arbeidsområde («workspace») i Plattformen med egen lisensavtale. LISENSINNEHAVER har ikke tillatelse til å dele bruksrett, brukerkontoer eller data mellom arbeidsområder tilhørende ulike foretak, uavhengig av konsern- eller eiertilknytning.

Dersom flere foretak ønsker å bruke Plattformen, må hvert foretak inngå en separat Lisens- og brukeravtale.

### 4.3 API-tilgang

LISENSINNEHAVER kan benytte SMARTOUTs API for godkjente integrasjoner. API-tilgang krever separat API-nøkkel og er underlagt hastighetsbegrensninger. Misbruk av API, herunder automatisert masseinnhenting av data, anses som brudd på Avtalen.

### 4.4 Øvrige begrensninger

Denne Avtalen dekker ikke:

- Tilpasning til annen programvare som LISENSINNEHAVER har tilgjengelig
- Feilsøking i LISENSINNEHAVERs egne datafiler, nettverk, maskinvare eller programvare
- Gjenoppretting av tapte eller skadede data forårsaket av feil fra LISENSINNEHAVER
- Fysisk oppmøte hos LISENSINNEHAVER
- Spesialutvikling eller tilpasninger etter LISENSINNEHAVERs forespørsel (med mindre skriftlig avtalt)
- Løsning av problemer som skyldes betaversjoner av SMARTOUT eller tredjepartsprogramvare

---

## 5. Priser og betalingsvilkår

### 5.1 Abonnementsavgift

LISENSINNEHAVER betaler en abonnementsavgift som spesifisert i Tilbudet. Avgiften beregnes per aktiv ansattprofil per måned, og inkluderer:

- Tilgang til alle moduler i Plattformen (iht. valgt abonnementsplan)
- AI-assistent (Mr. Botsson) — chat og tale
- Oppdateringer og nye versjoner av Plattformen
- Serverleie, infrastruktur og databaselagring
- Standard sikkerhetskopiering

Abonnementsavgiften kan betales **månedlig** eller **årlig** (med rabatt som spesifisert i Tilbudet).

SMARTOUT forbeholder seg retten til å justere abonnementsavgiften:
- Årlig i tråd med konsumprisindeksen (KPI), med virkning fra 1. januar — indeksregulering varsles ikke i forkant
- Ved vesentlige endringer i underleverandørkostnader, med minimum 90 dagers skriftlig varsel

Prisøkninger utover KPI-justering kan ikke overstige **15 % per år**. Dersom SMARTOUT varsler om en prisøkning som overstiger dette taket, har LISENSINNEHAVER rett til å si opp Avtalen med 30 dagers varsel uten å betale for resterende avtaleperiode.

### 5.2 Support utover standard

Support som ikke skyldes direkte feil i Plattformen faktureres etter medgått tid, minimum 15 minutter, til timepris kr 1 200 ekskl. mva.

Denne bestemmelsen gjelder ikke dersom LISENSINNEHAVER har inngått separat supportavtale.

### 5.3 Betalingsvilkår

- Abonnementsavgift (pkt. 5.1) faktureres **forskuddsvis**
- Ved automatisk fornyelse (pkt. 11.2) utstedes faktura automatisk og forskuddsvis
- Support utover standard (pkt. 5.2) faktureres **etterskuddsvis**
- Faktura utstedes med **15 dagers** betalingsfrist
- Ved forsinket betaling påløper forsinkelsesrenter iht. forsinkelsesrenteloven
- Fakturagebyr og merverdiavgift belastes etter gjeldende regler

Fakturering håndteres via Stripe. LISENSINNEHAVER kan administrere betalingsmetode og fakturahistorikk via dashboardets faktureringsside.

---

## 6. Rettigheter

Alle immaterielle rettigheter til Plattformen, inkludert kildekode, opphavsrett, design, algoritmer, AI-modeller utviklet av SMARTOUT, og andre rettigheter, forblir til enhver tid SMARTOUTs eiendom.

LISENSINNEHAVERs data, herunder alle opplysninger som legges inn i Plattformen, er og forblir LISENSINNEHAVERs eiendom.

SMARTOUT har ingen rett til å bruke LISENSINNEHAVERs data til andre formål enn å levere tjenesten, med mindre det foreligger eksplisitt samtykke.

---

## 7. Leverandørens ansvar og forpliktelser

### 7.1 Generelt

SMARTOUT forplikter seg til å:

- Gi LISENSINNEHAVER bruksrett til Plattformen iht. denne Avtale
- Vedlikeholde og oppdatere Plattformen, herunder sikkerhetspatcher
- Yte service og support iht. denne Avtale
- Sikre stabil og sikker drift gjennom:
  - Vedlikehold av servere og databaser
  - Regelmessig sikkerhetskopiering (daglig, med 30 dagers oppbevaring)
  - Overvåking av systemet for å minimere nedetid
  - Automatisert feilovervåking og varsling

### 7.2 Tilgjengelighet (SLA)

SMARTOUT tilstreber en tilgjengelighet på **99,5 %** målt månedlig, eksklusive:

- Planlagt vedlikehold (varsles minimum 24 timer i forveien)
- Force majeure-hendelser (pkt. 9.2)
- Nedetid forårsaket av underleverandører utenfor SMARTOUTs kontroll

Tilgjengelighet måles basert på SMARTOUTs overvåkingssystemer. Ved tilgjengelighet under 99,5 % i en kalendermåned kan LISENSINNEHAVER kreve kreditering etter følgende modell:

- For hver hele prosentpoeng under 99,5 % tilgjengelighet, krediteres **10 %** av månedens abonnementsavgift
- Maksimal kreditering: **30 %** av månedens abonnementsavgift
- Kreditering forutsetter skriftlig krav innen **30 dager** etter den berørte månedens utløp

### 7.3 Oppgradering av programvare

SMARTOUT gjennomfører løpende oppdateringer og oppgraderinger av Plattformen. Oppgraderinger som vesentlig endrer funksjonalitet varsles via e-post til LISENSINNEHAVERs primærkontakt. Sikkerhetsoppdateringer kan gjennomføres uten forvarsel.

### 7.4 Kundegaranti ved support

SMARTOUT forplikter seg til å yte support innen:

- **AI-assistent:** Umiddelbar respons (tilgjengelig 24/7)
- **E-post/chat:** Innen 1 virkedag
- **Kritiske feil (systemnedetid):** Innen 4 timer på virkedager

SMARTOUT forbeholder seg retten til å prioritere kunder med supportavtale iht. pkt. 5.2.

### 7.5 Ansvarsbegrensning

SMARTOUTs samlede erstatningsansvar under denne Avtalen er begrenset til det beløp LISENSINNEHAVER har betalt i abonnementsavgift de siste 12 månedene forut for det ansvarsbetingende forholdet.

SMARTOUT er ikke ansvarlig for:
- Indirekte tap, herunder tapt fortjeneste, tapt omsetning, tap av data (utover hva som er dekket av sikkerhetskopieringsforpliktelsen), eller tap som følge av krav fra tredjeparter
- Feil som skyldes LISENSINNEHAVERs egne handlinger eller unnlatelser
- Konsekvenser av at LISENSINNEHAVER bruker AI-genererte svar som juridisk eller faglig rådgivning uten egen verifisering

Denne begrensningen gjelder ikke ved forsett eller grov uaktsomhet fra SMARTOUTs side, eller ved brudd på personvernlovgivningen.

### 7.6 Skadesløsholdelse

SMARTOUT holder LISENSINNEHAVER skadesløs for krav fra tredjeparter som skyldes at Plattformen krenker tredjeparters immaterielle rettigheter, forutsatt at LISENSINNEHAVER varsler SMARTOUT uten ugrunnet opphold og gir SMARTOUT kontroll over forsvar og eventuelle forlik.

LISENSINNEHAVER holder SMARTOUT skadesløs for krav fra tredjeparter som skyldes LISENSINNEHAVERs bruk av Plattformen i strid med denne Avtale, Databehandlingsavtalen eller gjeldende lovgivning.

Skadesløsholdelsen er i begge tilfeller begrenset oppad til ansvarsbegrensningen angitt i punkt 7.5.

---

## 8. Lisensinnehaverens ansvar og forpliktelser

LISENSINNEHAVER forplikter seg til å:

- Etterleve og oppfylle betingelsene i denne Avtale
- Legge inn og oppdatere opplysninger i egen database
- Informere sine ansatte om bruk av AI-funksjonalitet i Plattformen
- Ivareta rollen som behandlingsansvarlig iht. Databehandlingsavtalen
- Sikre at brukere med administratortilgang håndterer sensitive personopplysninger forsvarlig
- Tilpasse bruken ved skriftlig varsel om fare for overbelastning (pkt. 7.1)
- Sikre at bruk av Plattformens overvåkings- og kontrollfunksjoner (herunder GPS-basert tidsregistrering, inn-/utstempling, kommunikasjonslogg og aktivitetsdata) er i samsvar med arbeidsmiljølovens regler om kontrolltiltak og drøftingsplikt (aml. kap. 9, herunder §§ 9-1 til 9-5)

LISENSINNEHAVER har **ikke** rett til å:
- Leie ut, kopiere, tilby, lease, låne ut, selge eller distribuere Plattformen til tredjeparter
- Forsøke å dekompilere, reverse-engineere eller kopiere SMARTOUTs kildekode
- Bruke API-tilgang til å bygge konkurrerende produkter
- Dele brukerkontoer mellom flere personer

Alle opplysninger LISENSINNEHAVER legger inn i Plattformen er til enhver tid LISENSINNEHAVERs eiendom.

Ved oppdagelse av feil i Plattformen skal LISENSINNEHAVER melde fra skriftlig til SMARTOUT. Ønsker om ekstra funksjonalitet anses ikke som feil og medfører ingen forpliktelse for SMARTOUT uten skriftlig avtale.

---

## 9. Mislighold av forpliktelser

### 9.1 Generelt

Dersom en part ikke kan oppfylle sine forpliktelser, eller mener at den andre parten har brutt Avtalen, skal vedkommende umiddelbart gi den andre parten skriftlig beskjed. Den misligholdende part skal gis rimelig frist til å rette forholdet.

Følgende forhold anses som **vesentlig mislighold**:

- LISENSINNEHAVER unnlater å oppfylle betalingsforpliktelser i mer enn 30 dager etter forfall
- Uautorisert overføring, utleie, salg eller distribusjon av Plattformen
- Ethvert forsøk på datainnbrudd, hacking eller denial-of-service-angrep mot Plattformen
- Ethvert forsøk på å skade SMARTOUTs omdømme
- Brudd på Databehandlingsavtalen som medfører risiko for registrertes rettigheter

Ved manglende betaling har SMARTOUT rett til å **midlertidig suspendere** LISENSINNEHAVERs tilgang inntil betaling er mottatt. SMARTOUT skal varsle LISENSINNEHAVER skriftlig minimum 7 dager før suspensjon.

Ved suspensjon beholdes **lesetilgang** til eksisterende data, herunder publiserte vaktplaner, timelister og ansattinformasjon. Ny dataregistrering, administrasjon og endring av vaktplaner sperres. Formålet er å sikre at ansatte fortsatt kan se sine vakter og annen operasjonell informasjon i suspensjonsperioden.

### 9.2 Force Majeure

Ingen av partene anses å ha brutt sine forpliktelser dersom gjennomføring hindres av force majeure, herunder krig, brann, streik, lockout, pandemi, telekommunikasjonsfeil, driftsproblemer hos skytjenesteleverandører, eller lignende omstendigheter utenfor partenes kontroll.

Partenes forpliktelser suspenderes så lenge force majeure-omstendighetene vedvarer. Dersom force majeure vedvarer i mer enn 90 dager, har begge parter rett til å si opp Avtalen med umiddelbar virkning.

---

## 10. Taushetsplikt

Partene er forpliktet til å opprettholde taushet om konfidensielle opplysninger som angår den andre partens forretningsaktiviteter.

**SMARTOUT** har spesiell plikt til å:
- Bevare taushet om LISENSINNEHAVERs lønns-, personal- og forretningsdata
- Hindre uautorisert tilgang til informasjon i LISENSINNEHAVERs arbeidsområde
- Sikre at alle ansatte og underleverandører er underlagt tilsvarende taushetsplikt

**LISENSINNEHAVER** er forpliktet til å:
- Bevare taushet om testresultater fra beta-testing
- Ikke dele informasjon om SMARTOUTs forretningsutvikling, produktplaner eller teknisk arkitektur

Taushetsplikten gjelder for alle ansatte og representanter hos begge parter, og opprettholdes også etter Avtalens opphør.

For øvrig vises til gjeldende Databehandlingsavtale.

---

## 11. Varighet

### 11.1 Ikrafttredelse og varighet

Denne Avtale trer i kraft fra det tidspunkt Tilbudet aksepteres av LISENSINNEHAVER og løper i **1 år**.

### 11.2 Automatisk fornyelse

Avtalen fornyes automatisk for **1 år** av gangen ved utløp av gjeldende periode, med mindre en av partene sier opp iht. punkt 12.

---

## 12. Opphør

### 12.1 Oppsigelse

Begge parter kan si opp Avtalen med **3 måneders** skriftlig varsel til utløpet av gjeldende avtaleperiode. Oppsigelse kan sendes via e-post eller Plattformens administrasjonsfunksjon.

### 12.2 Virkninger av oppsigelse

Ved oppsigelse:

1. **Eksportperiode (30 dager):** LISENSINNEHAVER gis tilgang til å eksportere alle data i maskinlesbart format (JSON/CSV) i 30 dager etter oppsigelsesdato
2. **Tilgangsstopp:** Ved utløp av gjeldende avtaleperiode opphører all tilgang til Plattformen
3. **Datahåndtering:** Etter eksportperioden håndteres data iht. Databehandlingsavtalen punkt 7 (sletting innen 60 dager, sikkerhetskopier innen 90 dager, slettebekreftelse utstedes)

### 12.3 Opphør ved heving

Ved vesentlig mislighold (pkt. 9) har den andre parten rett til å heve Avtalen med umiddelbar virkning. Melding om heving skal gis skriftlig.

Ved heving fra SMARTOUTs side gis LISENSINNEHAVER minimum 14 dagers frist til å eksportere data.

### 12.4 Overdragelse

LISENSINNEHAVER kan ikke overdra denne Avtale til tredjepart uten forutgående skriftlig samtykke fra SMARTOUT. SMARTOUT kan overdra Avtalen ved virksomhetsoverdragelse, forutsatt at vilkårene opprettholdes. Ved slik overdragelse skal LISENSINNEHAVER varsles skriftlig minimum **30 dager** i forveien. LISENSINNEHAVER har rett til å si opp Avtalen med virkning fra overdragelsestidspunktet dersom oppsigelse gis innen 14 dager etter mottak av varsel.

### 12.5 Insolvens

Dersom SMARTOUT innleder gjeldsforhandling, konkursbehandling eller avvikling, har LISENSINNEHAVER rett til umiddelbar eksport av alle sine data i maskinlesbart format. SMARTOUT skal, så langt det er mulig, sikre at data gjøres tilgjengelig for eksport i minimum **30 dager** etter melding om insolvens.

---

## 13. Elektronisk kommunikasjon

Partene kan kommunisere elektronisk i forbindelse med gjennomføring av denne Avtale. Elektronisk kommunikasjon, herunder e-post og meldinger i Plattformen, tilfredsstiller Avtalens skriftlighetskrav.

---

## 14. Personvern

Behandling av personopplysninger reguleres av en separat Databehandlingsavtale mellom partene. Databehandlingsavtalen er en integrert del av dette avtalegrunnlaget.

LISENSINNEHAVER er behandlingsansvarlig for personopplysninger som registreres i Plattformen. SMARTOUT er databehandler.

---

## 15. Lovvalg og verneting

Denne Avtale er underlagt norsk rett. Tvister som gjelder forståelse av denne Avtale eller forhold som springer ut av den, skal søkes løst ved forhandlinger.

Ved eventuelt søksmål er **Telemark tingrett** verneting. Dette gjelder også etter Avtalens opphør.

---

*Denne avtalen er utarbeidet 2026-04-13 og erstatter tidligere versjoner av Lisens- og brukeravtale for Smartout AS.*
