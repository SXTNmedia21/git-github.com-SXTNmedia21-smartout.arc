# Connecteam Help Desk – Feature-dokumentasjon og konkurrentanalyse

**Kilde:** connecteam.com/employee-communication-app/help-desk/ + help center-artikler
**Analyseformål:** Referansemateriale for Smartout – modul-posisjonering, prismodell-inspirasjon, differensieringsvinkler
**Dato:** 19. april 2026

---

## 1. Kjernekonsept

Connecteam Help Desk er et **internt ticketing-system** for ansatte – ikke et eksternt kundesupport-verktøy. Lansert oktober 2024 som "industry-first Help Desk for the Deskless Workforce". Posisjoneres eksplisitt mot Zendesk og Jira, som Connecteam hevder er bygget for kontoransatte, ikke for feltarbeidere med mobil som primær flate.

Målsegment: retail, healthcare, construction, hospitality, field services – altså det samme segmentet Smartout sikter mot i F&B-vertikalen.

---

## 2. Use cases (som promotert av Connecteam)

| Kategori | Formål |
|---|---|
| Urgent support | Sikkerhetsfarer, utstyrshavari |
| In-shift support | Manglende jobbinfo under vakt |
| Payroll | Lønnsavvik, timelister, overtid, pay rules |
| Onboarding | Nyansattes spørsmål – "point of contact" |
| Absence reporting | Sykemeldinger, planlagt fravær |
| IT support | Software- og nettverksproblemer |
| Dispatch-kommunikasjon | Real-time kontakt med dispatcher |
| HR-spørsmål | Policies, ansettelsesvilkår |

Merk: "Absence reporting" som help desk-case er interessant – de bruker ticketing-paradigmet for noe som egentlig er et eget fraværsregistreringsprodukt.

---

## 3. Funksjonell kjerne

### 3.1 Admin/oppsett

Help Desk aktiveres fra venstre sidepanel i admin-dashboardet, under "Communication Hub". For hver desk konfigureres:

- **Navn + beskrivelse** (f.eks. "Finance", "IT", "HR")
- **Representanter** – må være Admin eller Owner på plattformen (dette er en viktig begrensning)
- **Målgruppe** – hvem som kan åpne tickets. Tre alternativer:
  - Smart Groups (dynamiske segmenter)
  - Utvalgte brukere
  - Kombinasjon av begge

Hver desk har delbar lenke som kan distribueres til brukere.

### 3.2 Rep-arbeidsflyt

Representanten har tre hovedviews:

1. **Unassigned** – alle ikke-tilordnede, inaktive tickets som venter på håndtering
2. **Assigned** – alle aktive tickets repet selv har tatt
3. **All** – både og

Arbeidsflyten er enkel:

1. Rep toggler **"Available to help"** på (admin-dashboard eller mobil)
2. Rep ser Unassigned-køen
3. Rep svarer på en query → ticket blir automatisk tilordnet repet
4. Rep lukker ticket ved løsning, eller handler av til annen rep

Når rep toggler seg som ikke-tilgjengelig, **unassignes alle tilordnede conversations automatisk** og flyttes tilbake til Unassigned-køen. Dette er en bevisst designvalg – ingen tickets blir "låst" til en rep som er offline.

### 3.3 Proaktive tickets (fra admin til ansatt)

Admin/rep kan starte tickets proaktivt, ikke bare reaktivt:

- **"New message"** fra dashboard → velg desk + ansatt → send
- På mobil: + ikon øverst til høyre

### 3.4 Broadcast (nyere funksjon)

Help Desk-meldinger kan sendes som **broadcast til flere brukere samtidig**, men leveres som individuelle 1:1-meldinger. Bruksområde: systemoppdateringer, vedlikeholdsvarsler, organisasjonsnotiser.

Hvis en mottaker svarer, **skaper svaret en ny, separat Help Desk-query** – admin får individuelle tråder å følge opp, ikke en gruppechat.

### 3.5 Visningsindikatorer per ticket

For hver ticket i lista vises:

- Hvilken Help Desk (kategori) ticket tilhører
- Tidspunkt åpnet
- Bruker som åpnet
- Rep tilordnet (avatar hvis tilordnet, oransje ikon hvis unassigned)

### 3.6 Rapporter / historikk

Svært begrenset analytikk:

- "All" → Closed conversations (liste over lukkede tickets)
- Manage Desks: antall reps, tilordnede brukere, antall conversations per desk, opprettelsesdato, aktiv/deaktivert

**Ingen SLA-tracking, ingen response-time-metrikk, ingen dashboarder med KPI-er**. Dette er en svak flanke.

---

## 4. Pakketering og prising

Help Desk er eksplisitt feature-gated på antall desks per plan:

| Plan | Antall Help Desks |
|---|---|
| Basic | 1 |
| Advanced | Opptil 3 |
| Expert | Opptil 12 |
| Enterprise | Ubegrenset |

Small Business Plan: gratis opp til 10 brukere, med **ubegrensede help desks**. Dette er et bevisst "land-grab"-grep for å låse inn småbedrifter før de vokser.

Betalte planer starter fra $29/mnd for opptil 30 ansatte (dette er totalpris for plattformen, ikke bare Help Desk).

### Implikasjon for Smartout

Connecteam bruker **antall desks** som gating-mekanisme, ikke feature-tilgang. Dette er smart fordi:

- Alle kunder får verdien av konseptet
- Større organisasjoner må oppgradere når de trenger flere kategorier (HR + IT + Payroll + Onboarding + ...)
- Det skalerer naturlig med kundens kompleksitet, ikke antall brukere

Dette er en mulig modell for Smartout å vurdere for modultilganger.

---

## 5. Differensiering mot Chat (deres egen posisjonering)

Connecteam legger mye vekt på å forklare at Help Desk ≠ Chat. Dette er ikke tilfeldig – de må rettferdiggjøre at Help Desk er en separat betalingsmodul:

| Dimensjon | Help Desk | Chat |
|---|---|---|
| Struktur | Formelt ticketing-system | Uformell melding |
| Sporbarhet | Full logg, status-tracking | Ingen tracking |
| Ansvarliggjøring | Tilordnet rep, lukkes bevisst | Ingen eierskap |
| Bruksområde | Support-henvendelser | Daglig prat |
| Ruting | Rutes til rett desk/rep | Direkte til person |

---

## 6. Kjente begrensninger (viktig for differensiering)

Basert på help center og FAQs:

### 6.1 Ingen prioritering av tickets

Fra Connecteams egen FAQ: det finnes **ingen innebygget prioriteringsmekanisme**. Eneste workaround er å "pinne" viktige queries. Ingen critical/high/medium/low-labels, ingen auto-eskalering, ingen SLA-deadlines.

### 6.2 Kun Admins/Owners kan være representanter

Dette er en stor begrensning. En kjøkkensjef som skal håndtere "In-shift support"-tickets må være Admin på hele plattformen. Dette skalerer dårlig og skaper permission-problemer.

### 6.3 Sletting er permanent

Hvis en desk slettes, er all meldingshistorikk borte. Ingen arkivering, ingen eksport.

### 6.4 Ingen AI/automatisering

- Ingen auto-routing basert på regler eller innhold
- Ingen AI-kategorisering av tickets
- Ingen automatiske svar for vanlige spørsmål
- Ingen integrasjon mot knowledge base som foreslår svar

### 6.5 Ingen SLA-funksjoner

- Ingen response-time tracking
- Ingen auto-eskalering ved manglende svar
- Ingen notifikasjoner til manager ved åpne tickets over X tid
- Ingen metrikk på rep-ytelse (utover å se antall conversations)

### 6.6 Ingen integrasjoner nevnt for Help Desk

Connecteam har integrasjoner generelt, men Help Desk ser ut til å være isolert – ingen kobling mot Slack, Teams, e-post, eller eksterne systemer.

---

## 7. Strategiske observasjoner for Smartout

### 7.1 Dette er et "basic ticketing-system pakket pent inn"

Funksjonelt minner dette mer om en kategorisert chat enn et ordentlig ticketing-system. De mangler nesten alt man forventer av moderne help desk-produkter:

- Priority levels
- SLA-tracking
- Auto-routing
- Knowledge base-integrasjon i tickets
- AI-assistanse
- Reporting/analytics

Men: for målgruppen (deskless workers som ellers bruker SMS og telefon), er dette sannsynligvis **good enough**. Konkurrenten er ikke Zendesk – det er kaoset.

### 7.2 Mulige differensieringsvinkler for Smartout

Hvis Smartout skal inn i dette rommet (eller utvide ERS med lignende tenkning), er disse angrepsvinklene åpne:

**ERS-drevet auto-ticketing**
Ansatt har ikke fullført påkrevd trening → system oppretter automatisk "readiness-ticket" til manager. Ikke reaktivt, men proaktivt. Dette er kjerneDNA i deres event-driven arkitektur (EVENT → TRIGGER → PROCESS → ACTION → STATE).

**Context-aware tickets**
Ticket om "pay discrepancy" → system henter automatisk vakter, timer, og relevante pay rules fra CDS (kontekst-dimensjonssystem). Repet trenger ikke be om info – den er allerede der.

**AI-kategorisering og -svar**
Integrere Lise/Lisa eller lignende for å foreslå svar basert på Knowledge Base. Spesielt kraftig for norsk språk, hvor Connecteam sannsynligvis er svak.

**Non-admin representanter**
La vaktleder/teamleder være representant uten å gi dem Admin-rettigheter. Bruk rolle-basert tilgang (Smartout har allerede 72 enums – permission-modellen finnes).

**SLA + readiness-kobling**
"In-shift support"-tickets får automatisk høy prioritet basert på at ansatt er på vakt akkurat nå. Fravær-tickets rutes automatisk basert på hvem som er scheduled å dekke.

**Trening-integrasjon**
Hvis en ansatt åpner ticket om "hvordan gjør jeg X", foreslå relevant opplæringsmodul fra Smartouts training-lag. Ticket blir lukket + læringssti tildelt.

### 7.3 Pakketeringslæring

Connecteams modell (antall desks som gating) er **lettere å forklare og selge** enn Smartouts nåværende 995 NOK/mnd per workspace. Verd å vurdere om modulantall bør være en dimensjon i prisdiskusjonen – ikke erstatte, men supplere.

---

## 8. Kildeliste

Hovedside:
- connecteam.com/employee-communication-app/help-desk/

Help center-artikler:
- help.connecteam.com/en/articles/9725892-starting-guide-to-the-help-desk
- help.connecteam.com/en/articles/9726353-adding-managing-help-desks
- help.connecteam.com/en/articles/9858856-working-with-the-help-desk-as-a-representative
- help.connecteam.com/en/articles/10839474-how-to-view-reports-of-resolved-help-desk-queries
- help.connecteam.com/en/articles/10903814 (prioritering – FAQ)
- help.connecteam.com/en/articles/10359377-how-to-create-a-dedicated-help-desk-for-connecteam-questions

Presselansering:
- globenewswire.com/news-release/2024/10/23 – "Industry-First Help Desk for the Deskless Workforce"

Sammenlignings-/markedsartikler:
- connecteam.com/e-what-is-a-ticketing-system/
- connecteam.com/best-internal-ticketing-system/