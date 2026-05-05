---
title: "Smartout Landing Page — Komplett Spesifikasjon"
id: LANDING_MASTER
status: draft
version: "1.0"
layer: plan
created: 2026-03-28
updated: 2026-03-28
author: pontus
depends_on:
  - CORE_ARCH_V2
  - MODULE_01
  - MODULE_04
  - MODULE_05
  - MODULE_09
tags:
  - landing
  - marketing
  - seo
  - conversion
  - personalization
  - frontend
---

# Smartout Landing Page — Komplett Spesifikasjon

> Alt i ett dokument. Innhold, layout, interaksjon, SEO, CTA, tracking og dynamisk personalisering.
> En agent som leser dette dokumentet skal kunne bygge hele landingssiden uten å stille spørsmål.

---

# INNHOLDSFORTEGNELSE

- **Del 1:** Strategi — Hvem vi selger til, hva de søker, hva de skal møte
- **Del 2:** Dynamisk personalisering — Arkitektur
- **Del 3:** Seksjon-for-seksjon — Innhold + Layout + Interaksjon + Tracking
- **Del 4:** Feature-sider — Individuelle landingssider per modul
- **Del 5:** Øvrige sider — Pricing, Free Forever, Om oss, Blog, Compare, Legal, Auth
- **Del 6:** SEO — Søkeord, metadata, teknisk SEO, innholdskalender
- **Del 7:** CTA — Hierarki, regler, persona-varianter, konverteringstrakt
- **Del 8:** Måling — KPIer, PostHog events, A/B-tester, benchmark
- **Del 9:** Konkurrentanalyse
- **Del 10:** Teknisk implementasjon — Komponentarkitektur, responsivt, animasjon

---

# DEL 1: STRATEGI

## 1.1 Kjøperen

Én person: **eier eller daglig leder med 10–50 ansatte, 1–3 lokasjoner.** Desktop-bruker, 90% av tiden. Googler om kvelden etter en lang dag, eller søndag kveld når de lager neste ukes vaktplan. Slitne av systemene de bruker i dag (Excel, WhatsApp, papir, POS-systemets halvveis løsning).

De søker ikke "Employee Readiness System." De søker løsningen på problemet de hadde _i dag_.

## 1.2 De seks pilarene

| #   | Pilar             | Inngangsdør (søk)             | Lokkemiddel                         |
| --- | ----------------- | ----------------------------- | ----------------------------------- |
| 1   | **Nettside**      | "gratis nettside restaurant"  | Laveste terskel — trojansk hest     |
| 2   | **Vaktplan**      | "vaktplanlegger restaurant"   | Høyeste søkevolum                   |
| 3   | **HACCP**         | "HACCP app", "temperaturlogg" | Compliance = trygghet               |
| 4   | **Opplæring**     | "onboarding restaurant"       | Turnover-smerte                     |
| 5   | **Daglig drift**  | "sjekkliste restaurant"       | Operasjonelt behov                  |
| 6   | **Kommunikasjon** | "teamchat skiftarbeid"        | Walkie-talkie = unik differensiator |

AI og tidsbesparelse er tverrgående argumenter, ikke egne produkter.

## 1.3 Bransjer

| ID           | Norsk           | Størrelse      | Primær smerte                             |
| ------------ | --------------- | -------------- | ----------------------------------------- |
| `restaurant` | Restaurant      | 15–50 ansatte  | Vaktplan + turnover                       |
| `hotel`      | Hotell          | 30–150 ansatte | Avdelingskoordinering + compliance        |
| `cafe`       | Kafé            | 5–20 ansatte   | Admin-overload (eier jobber selv i drift) |
| `bar`        | Bar / Nattklubb | 10–30 ansatte  | Kveld/natt-tillegg, sesongsvingninger     |
| `catering`   | Catering        | 10–40 ansatte  | Event-basert bemanning                    |

## 1.4 Personas

| ID        | Norsk                    | Plattform   | Kjøpsmotivasjon                              |
| --------- | ------------------------ | ----------- | -------------------------------------------- |
| `owner`   | Eier / Daglig leder      | Desktop 90% | Kostnadsreduksjon, oversikt, compliance      |
| `manager` | Driftsleder / Skiftleder | 50/50       | Tidsbesparelse, vaktdekning, daglig kontroll |
| `hr`      | HR-ansvarlig             | Desktop 95% | Onboarding, turnover, opplæring              |
| `ops`     | Operasjonsleder (kjeder) | Desktop 95% | Multi-lokasjon, standardisering, rapporter   |

## 1.5 Hva de IKKE skal møte

- Tekniske termer (engine_state, cascade-architecture, governance model)
- AI som hovedargument — AI er _hvordan_, ikke _hva_
- Engelske ord der norske finnes — "vaktplan" ikke "scheduling"
- Et tomt produkt — de må se skjermbilder av ekte UI

## 1.6 Fragmenteringsargumentet

| De bruker i dag               | Smartout erstatter                 |
| ----------------------------- | ---------------------------------- |
| Wix / Squarespace / ingenting | → Gratis nettside                  |
| Excel / Google Sheets         | → Vaktplanlegger                   |
| WhatsApp-grupper              | → Teamchat + walkie-talkie + video |
| Permer med sjekklister        | → Digital HACCP                    |
| Muntlig opplæring             | → Styrt onboarding med AI          |
| POS-rapport + kalkulator      | → Daglig avstemming                |

**Én linje:** _"Seks verktøy. Én plattform. Null permer."_

---

# DEL 2: DYNAMISK PERSONALISERING

## 2.1 Konsept

Landingssiden er en konverteringsmotor som bygger seg selv basert på hvem som ser den. Tre lag:

| Lag              | Hva                                             | Ansvar           |
| ---------------- | ----------------------------------------------- | ---------------- |
| Seksjonbibliotek | Hver seksjon i varianter per bransje og persona | Innhold + layout |
| Profilmotor      | Bygger besøksprofil i sanntid fra signaler      | Klassifisering   |
| Sideassembler    | Velger riktige varianter basert på profil       | Rendering        |

## 2.2 Profilsignaler

| Signal                     | Kilde             | Avslører                          |
| -------------------------- | ----------------- | --------------------------------- |
| Bransjeklikk               | Qualifier-seksjon | Bransje — direkte                 |
| UTM `?industry=restaurant` | Annonse-URL       | Bransje — direkte                 |
| UTM `?persona=owner`       | Annonse-URL       | Persona — direkte                 |
| Scrolldybde per seksjon    | Scroll-tracking   | Interesse                         |
| Tid brukt per seksjon      | Dwell-time        | Hva de studerer                   |
| CTA-hover uten klikk       | Hover-tracking    | Nøling                            |
| Klikk på feature-kort      | Click-tracking    | Modulinteresse                    |
| Enhet + skjermstørrelse    | Navigator         | Desktop = eier. Mobil = ansatt    |
| Tidspunkt                  | Timestamp         | Kveld/helg = eier. Dagtid = HR    |
| Geolokasjon                | IP                | Norsk = primær. Svensk = sekundær |

## 2.3 Sidemonteringslogikk

```
1. Besøkende lander → Universell Hero rendres
2. Qualifier-seksjon spør: "Hva driver du?"
3. Klikk "Restaurant" → profil.industry = restaurant
4. Assembler henter restaurant-varianter for alle seksjoner
5. Crossfade (300ms) — ingen page reload
6. Scrollmønster + klikkdata infererer persona over tid
7. CTA-tekst og argumenter justeres subtilt
```

## 2.4 Datamodell

Utvider eksisterende `landing_config`:

```sql
landing_section_variant
  variant_id         uuid PK
  section_key        text    -- hero, qualifier, features, haccp, etc.
  industry           text    -- null = universell
  persona            text    -- null = alle personas
  priority           int     -- høyere = mer spesifikk
  content            jsonb   -- tekst, bilder, CTAs
  layout             text    -- hero_split, feature_grid, etc.
  created_at         timestamptz
  updated_at         timestamptz
```

Seleksjon: mest spesifikk variant vinner. Fallback til universell.

## 2.5 Variant-matrise

| Seksjon                | Universell | Restaurant | Hotell |  Kafé   | Bar |
| ---------------------- | :--------: | :--------: | :----: | :-----: | :-: |
| hero                   |     ✅     |     —      |   —    |    —    |  —  |
| qualifier              |     ✅     |     —      |   —    |    —    |  —  |
| pain_points            |     —      |     ✅     |   ✅   |   ✅    | ✅  |
| solution_overview      |     ✅     |     —      |   —    |    —    |  —  |
| feature: nettside      |     —      |     ✅     |   ✅   |   ✅    | ✅  |
| feature: vaktplan      |     —      |     ✅     |   ✅   |   ✅    | ✅  |
| feature: haccp         |     —      |     ✅     |   ✅   | ✅ lite |  —  |
| feature: opplæring     |     —      |     ✅     |   ✅   |   ✅    | ✅  |
| feature: drift         |     —      |     ✅     |   ✅   | ✅ lite | ✅  |
| feature: kommunikasjon |     —      |     ✅     |   ✅   |   ✅    | ✅  |
| time_savings           |     —      |     ✅     |   ✅   |   ✅    | ✅  |
| comparison             |     ✅     |     —      |   —    |    —    |  —  |
| ai_section             |     ✅     |     —      |   —    |    —    |  —  |
| norwegian              |     ✅     |     —      |   —    |    —    |  —  |
| social_proof           |     —      |     ✅     |   ✅   |   ✅    | ✅  |
| pricing_preview        |     ✅     |     —      |   —    |    —    |  —  |
| founder                |     ✅     |     —      |   —    |    —    |  —  |
| poll                   |     —      |     ✅     |   ✅   |   ✅    | ✅  |
| final_cta              |   Owner    |  Manager   |   HR   |   Ops   |  —  |

---

# DEL 3: SEKSJON-FOR-SEKSJON

## Seksjonsflyt (komplett rekkefølge)

```
S01  header
S02  hero                  ← Universell
S03  qualifier             ← "Hva driver du?"
S04  pain_points           ← Bransjevariant
S05  solution_overview     ← "Seks verktøy. Én plattform."
S06  feature: nettside     ← Lokkemiddelet — "inkludert gratis"
S07  feature: vaktplan     ← + AI vaktassistent
S08  feature: haccp        ← + HMS-inspektør AI
S09  feature: opplæring    ← + reiseassistent AI
S10  feature: drift        ← + event engine + guardian
S11  feature: kommunikasjon← + walkie-talkie + video + handoff
S12  time_savings          ← Aggregerte AI-tall
S13  comparison            ← Før/etter
S14  ai_section            ← Mr. Botsson overordnet
S15  norwegian             ← Bygget for norske regler
S16  social_proof          ← Bransjevariant
S17  pricing_preview       ← Universell
S18  founder               ← Universell
S19  poll                  ← Bransjevariant
S20  final_cta             ← Persona-variant
S21  footer                ← Statisk
```

---

### S01: Header

**Innhold:**

- Logo · Funksjoner · Priser · Kundehistorier · Docs · Om oss · [Logg inn] · **[Start gratis →]**

**Layout:**

- Sticky top. Logo venstre, nav senter, CTAs høyre.
- Mobil: Logo + hamburger → drawer.
- Scroll: Shrink 80→56px. Bakgrunn: transparent → solid ved scroll > 100px.

**Tracking:** `nav_link_clicked { label }`

---

### S02: Hero (universell)

**Innhold:**

- **Badge:** For restauranter, hoteller og kafeer i Norge
- **H1:** Slutt å _administrere_. Begynn å drive.
- **Subtitle:** Smartout samler vaktplan, opplæring, daglig drift, HACCP og en profesjonell nettside for restauranten din — i én plattform. Bygget for norsk arbeidsrett, norske tariffer og Mattilsynets krav.
- **CTA Primary:** Start gratis nå → /signup
- **CTA Secondary:** Se hvordan det fungerer → scroll #qualifier

**Layout:**

- Desktop: 55/45 split. Tekst venstre. Dashboard-skjermbilde høyre.
- Mobil: Stacked — tekst over, bilde under.
- Max-width: 1280px. Padding: 80px top, 64px bottom.

**Visuelt:**

- Skjermbilde: Vaktplan ukevisning med lønnskostnad-overlay.
- Behandling: 2° rotasjon, drop-shadow, browser-frame.
- Badge: Pill, sekundærfarge, 14px.
- H1 highlight: "administrere" i primary-color.

**Animasjon:**

- Tekst: Fade-in 400ms.
- Bilde: Fade-in fra høyre, 300ms delay.

**Tracking:**

- `hero_cta_clicked { variant: primary|secondary }`
- `hero_visible { percent: 50|100 }`

---

### S03: Qualifier (universell)

**Innhold:**

- **H2:** Hva driver du?
- **Subtitle:** Vi tilpasser innholdet etter din bransje.
- **Kort:**
  - 🍽️ Restaurant (15–50 ansatte)
  - 🏨 Hotell (30–150 ansatte)
  - ☕ Kafé (5–20 ansatte)
  - 🍸 Bar / Nattklubb (10–30 ansatte)
  - 🏢 Annen skiftbasert (Fortell oss mer)

**Layout:**

- Desktop: Sentrert tittel. 5 kort i rad.
- Mobil: 2×2 grid + 1 sentrert.
- Bakgrunn: muted/5%. Padding: 64px.

**Oppførsel:**

1. Klikk → profil.industry = card.id
2. Kort: selected-state (ring + check)
3. Smooth-scroll til neste seksjon
4. Alle bransjevarianter under swapper med crossfade (200ms)
5. Skip: universelle varianter brukes
6. UTM override: `?industry=X` pre-selekterer + auto-scroll forbi

**Animasjon:** Stagger fade-in (50ms mellom kort). Selected: scale 1.05 + ring.

**Tracking:**

- `qualifier_industry_selected { industry }`
- `qualifier_skipped { }`

---

### S04: Pain Points (bransjevarianter)

**Layout:** Sentrert overskrift. 3 kort i rad (desktop) / stack (mobil). Padding: 64px.

**Restaurant:**

- H2: "Kjenner du deg igjen?"
- 📅 **Søndag kveld, vaktplanen** — Du sitter med regnearket. Ringer tre stykker for å dekke hull. Ser lønnskostnadene først etter at lønna er kjørt.
- 👤 **Ny ansatt på mandag** — Opplæringen skjer muntlig, mellom service. Ingen vet hvem som har lært hva. Etter tre uker slutter halvparten.
- 🌡️ **Mattilsynet ringer** — Temperaturloggene ligger i en perm bak kaffemaskinen. Halvparten er fylt ut med gårsdagens dato.

**Hotell:**

- H2: "Kjenner du deg igjen?"
- 🏢 **Tre avdelinger, tre systemer** — Resepsjon bruker ett verktøy, housekeeping et annet, restaurant et tredje. Ingen snakker sammen.
- 📋 **Internkontroll på tvers** — HACCP i kjøkkenet, brannrutiner i resepsjonen, renholdssjekk i rommene — alt i forskjellige permer.
- 🔄 **Sesongansatte hvert halvår** — 20 nye til sommeren, 15 til jul. Samme opplæring, fra scratch, hver gang.

**Kafé:**

- H2: "Kjenner du deg igjen?"
- ⏰ **Du jobber OG administrerer** — Du står bak disken og prøver å planlegge neste uke mellom bestillingene. Det blir aldri tid.
- 📱 **WhatsApp er vaktplanen** — Beskjeder forsvinner oppover i chatten. Ingen vet hvem som jobber på lørdag.
- 📝 **Permer du aldri åpner** — IK-mat, renholdsplan, temperaturlogg — du vet de finnes, men de er aldri oppdatert.

**Bar:**

- H2: "Kjenner du deg igjen?"
- 🌙 **Kveld og natt, hver helg** — Kveldstillegg, nattillegg, helgetillegg — du regner feil hver gang.
- 🔄 **Høyt gjennomtrekk** — Bartendere som starter i september er borte til jul. Opplæringen går på repeat.
- 📊 **Topper du aldri planlegger for** — Fotballkamp, nyttårsaften, festival. Du vet det blir kaos.

**Kortstil:** card bg, 1px border, 12px radius, 24px padding. Tittel 18px semibold. Body 15px muted.

**Tracking:** `pain_section_visible { industry }`, `pain_card_clicked { industry, card_index }`

---

### S05: Solution Overview (universell)

**Innhold:**

- **H2:** Seks verktøy. Én plattform. Null permer.
- **Kort (6 stk):**
  - 🌐 **Nettside** — Profesjonell og alltid oppdatert. Gratis.
  - 📅 **Vaktplan** — Drag-and-drop med lønnskostnad i sanntid.
  - 🌡️ **HACCP** — Temperaturlogging klar for Mattilsynet.
  - 🎓 **Opplæring** — Nye ansatte klare før første vakt.
  - ✅ **Daglig drift** — Sjekklister fra åpning til stenging.
  - 📻 **Kommunikasjon** — Chat, walkie-talkie og video i én app.

**Layout:** Desktop: 3×2 grid. Mobil: 2×3 grid. Padding: 64px.
**Hvert kort er klikkbart:** smooth-scroll til tilhørende feature-deep seksjon.

---

### S06: Feature — Nettside (bransjevarianter)

**Innhold:**

- **Label:** Inkludert gratis
- **H2:** En nettside som oppdaterer seg selv.
- **Body:** Smartout lager en profesjonell nettside for restauranten din — automatisk. Åpningstider, menyer, events og nyheter synkroniseres direkte fra driften din. Du trenger aldri logge inn på en nettside-editor igjen.
- **Features:**
  - 🌐 **Alltid oppdatert** — Endrer du åpningstidene i Smartout, oppdateres nettsiden automatisk.
  - 🍽️ **Meny som lever** — Menyen hentes fra produksjonsmodulen. Ny rett? Synlig med én gang.
  - 📅 **Events og nyheter** — Langbord, julelunsj, ølsmaking — publiser events direkte.
  - 📱 **Mobiltilpasset og rask** — Profesjonelt design, SSL og hosting inkludert. Gratis.
- **CTA Primary:** Få din gratis nettside → /signup
- **CTA Secondary:** Se eksempler → /concepts/website

**Mockup-varianter:**

- Restaurant: "Brasserie K" — Moderne nordisk kjøkken midt i Oslo
- Hotell: "Fjordhotellet" — Restaurant, konferanse og overnatting
- Kafé: "Café Sør" — Kaffe, bakst og lunsj siden 2019
- Bar: "Barrique" — Naturvin og cocktails

**Nettsidenivåer:**

| Nivå     | Innhold                                                                           | Pakke            |
| -------- | --------------------------------------------------------------------------------- | ---------------- |
| Basic    | Én side — åpningstider, beskrivelse, kontaktinfo, kart. SSL og hosting inkludert. | Free             |
| Standard | Meny-integrasjon, events, nyheter/blogg, bildegalleri. Mer designkontroll.        | Standard         |
| Avansert | Flersidig: forside + meny + events + om oss + booking. Eget domene.               | Pro / Enterprise |

**Layout:** 50/50 split. Tekst venstre, browser-frame mockup av restaurant-nettside høyre.

**Tracking:** `feature_website_visible`, `feature_website_cta_clicked`

---

### S07: Feature — Vaktplan (bransjevarianter)

**Innhold:**

- **Label:** Kjernefunksjon
- **H2:** Vaktplanen som regner for deg.
- **Body:** Drag-and-drop planlegging med sanntids lønnskostnad. Kveldstillegg, helgetillegg og overtid beregnes automatisk etter Riksavtalen og arbeidsmiljøloven. Du ser hva uken koster før du publiserer.
- **Features:**
  - 💰 **Sanntids lønnskostnad** — Per dag, per uke, per ansatt.
  - ⚠️ **Automatiske varsler** — Overtid og hviletidsbrudd flagges.
  - 📋 **Åpne vakter** — Ansatte melder seg på selv.
- **AI-kontekst:** Vaktassistenten hjelper deg bygge planen. Si "Jeg trenger to kokker fredag kveld" — AI finner tilgjengelige, sjekker tariff, foreslår og publiserer.

**Mockup:** Ukevisning med ansatte loddrett, dager vannrett. Lønnskostnad per dag i bunnen. Fargekoding: grønn (dekket), gul (hull). Vaktinnsikt-overlay ved hover (tillegg, krav, beredskap).

**Tidsbesparelse vist i seksjon:**

> Uten Smartout: 2–4 timer/uke. Med Smartout: 15–30 min. **+ 10–15% lavere lønnskostnader.**

**Varianter:**

- Restaurant: Ukevisning kjøkken + sal
- Hotell: Flerlokasjon housekeeping + resepsjon
- Kafé: Enkel dagsvisning, få ansatte
- Bar: Kveld/natt-fokus med tilleggsberegning

**Layout:** Tekst venstre, mockup høyre (desktop). Stacked (mobil).

**Tracking:** `feature_schedule_visible`, `feature_schedule_cta_clicked`

---

### S08: Feature — HACCP (bransjevarianter)

**Innhold:**

- **Label:** Klar for tilsyn
- **H2:** HACCP uten permer.
- **Body:** Temperaturlogging, avvikshåndtering og renholdssjekker — digitalt, tidsstemplet og alltid tilgjengelig. Ansatte får automatiske påminnelser. Når Mattilsynet kommer, trekker du opp rapporten på sekunder.
- **Features:**
  - 🔔 **Automatiske push-varsler** — For temperaturkontroller til rett tid.
  - 📸 **Avviksregistrering** — Med mobilkamera direkte i appen.
  - 📄 **Komplett dokumentasjon** — Tidsstemplet og klar for Mattilsynet.
- **AI-kontekst:** HMS-inspektøren guider ansatte gjennom kontrollene med stemme. Temperatur: 0.2 (lavest mulig kreativitet — ren faktabasert). Avvik eskaleres automatisk.

**Mockup:** Mobilskjerm med temperaturregistrering: Kjøl 1 → visuell sjekk → temperatur → signatur → "Kontroll loggført."

**Tidsbesparelse vist i seksjon:**

> HACCP: 10–15 min/dag (ned fra 30–60). Forberede tilsyn: 0 timer (ned fra 8–16).

**Layout:** Mockup venstre, tekst høyre (alternerer fra forrige seksjon).

**Tracking:** `feature_haccp_visible`, `feature_haccp_cta_clicked`

---

### S09: Feature — Opplæring (bransjevarianter)

**Innhold:**

- **Label:** Klar fra dag én
- **H2:** Nyansatt i dag. Klar i morgen.
- **Body:** Nye ansatte læres opp via appen — tilpasset rollen, erfaringen og språket. Systemet sporer hvem som har fullført hva. Du ser nøyaktig hvem som er klar og hvem som mangler noe — før de starter.
- **Features:**
  - 📋 **Tilpasset stilling og avdeling** — Kokk får kjøkkenrutiner. Servitør får salgsprosedyrer.
  - 📝 **Kunnskapstester** — Bekrefter at de faktisk kan stoffet.
  - 📊 **Beredskapspoeng** — Viser hvem som er klar, hvem som mangler.
- **AI-kontekst:** Reiseassistenten guider nye ansatte gjennom opplæringen. Tilpasser tempo etter erfaring. Eskalerer til leder hvis de henger etter. Snakker norsk, svensk og engelsk.

**Mockup:** Ansattkort med beredskapspoeng. Steg: Håndbok (Fullført), Matsikkerhet (Pågår), Alkoholloven (Mangler).

**Tidsbesparelse vist i seksjon:**

> Onboarding: 30–60 min per nyansatt (ned fra 3–5 timer).

**Layout:** Tekst venstre, mockup høyre.

**Tracking:** `feature_training_visible`, `feature_training_cta_clicked`

---

### S10: Feature — Daglig drift (bransjevarianter)

**Innhold:**

- **Label:** Fra åpning til stenging
- **H2:** Hele dagen — styrt digitalt.
- **Body:** Hver avdeling får sin egen driftsøkt med sjekklister, oppgaver og overlevering. Åpningsrutiner aktiveres automatisk. Stengingsrutiner krever signering. Ingenting glipper mellom skiftene.
- **Features:**
  - ⏰ **Tidsbaserte sjekklister** — Aktiveres automatisk ved åpning, lunsj, stenging.
  - 🔄 **Overlevering mellom skift** — Tekst, stemmenotat eller AI-intervju.
  - ✍️ **Daglig signering** — Låser og arkiverer dagen. Revisjonsspor.
- **AI-kontekst:** Event Engine fanger opp alt — fravær, avvik, vaktbytter. Guardian varsler proaktivt. Lederpuls gir 2-min morgensammendrag.

**Mockup:** Driftsøkt med oppgaveliste: Morgenrutine (3/5 fullført), HACCP kl 10 (venter), Pre-service (kommende). Sign-off knapp nederst.

**Tidsbesparelse vist i seksjon:**

> Morgenrutine: 2 min (ned fra 30–60). Oppfølging/jaging: automatisk (ned fra 30–60 min/dag).

**Layout:** Mockup venstre, tekst høyre (alternerer).

**Tracking:** `feature_operations_visible`, `feature_operations_cta_clicked`

---

### S11: Feature — Kommunikasjon (bransjevarianter)

**Innhold:**

- **Label:** Alt i sanntid
- **H2:** Chat. Walkie-talkie. Video. I én app.
- **Body:** Slutt på WhatsApp-grupper og telefonkjeder. Smartout samler all kommunikasjon i én app — fra teamchat og push-varsler til walkie-talkie mellom kjøkken og sal. Trenger du å se hva som skjer? Åpne videostrømmen fra PC-en. Når vakten er over, gjør Mr. Botsson overleveringen via en strukturert telefonsamtale som transkriberes automatisk.
- **Features:**
  - 💬 **Teamchat med kanaler** — Avdelingschat, skiftchat, direktemeldinger.
  - 📻 **Walkie-talkie** — Push-to-talk mellom kjøkken og sal. Fungerer som en radio.
  - 📹 **Videostrøm** — Se kjøkkenet fra PC-en. Live video mellom mobil og desktop.
  - 📞 **AI-handoff** — Mr. Botsson ringer ved skiftslutt, intervjuer og transkriberer.

**Mockup:** Splitscreen — venstre: mobilskjerm med walkie-talkie UI (push-to-talk knapp, aktiv kanal "Kjøkken"). Høyre: desktop med videostrøm fra kjøkkenet.

**Varianter:**

- Restaurant: "Kokken trenger mer laks — walkie-talkie til lageret. Sjefen sjekker preppen — video fra kontoret."
- Hotell: "Resepsjonen varsler housekeeping — walkie-talkie. Driftsleder ser lobbyen — video fra bakrommet."
- Kafé: "Bare 3 på jobb, men chat holder dere synkronisert. Eier sjekker driften hjemmefra — live video."

**Differensiator-badge:** "Ingen konkurrent har walkie-talkie og videostrøm."

**Tracking:** `feature_communication_visible`, `feature_communication_cta_clicked`

---

### S12: Tidsbesparelse (bransjevarianter)

**Innhold:**

- **Label:** Tallene taler
- **H2:** En hel arbeidsdag — tilbake.
- **Subtitle:** Smartout sparer deg 8–15 timer administrasjon per uke.

**Stats (3 kort):**

- **8–15** timer/uke — Spart for daglig leder
- **10–15%** — Lavere lønnskostnader
- **3–5** verktøy — Erstattet med ett

**Nedbrytningstabell:**

| Oppgave                 | Uten Smartout | Med Smartout | Hvordan                                          |
| ----------------------- | ------------- | ------------ | ------------------------------------------------ |
| Vaktplanlegging         | 2–4 timer/uke | 15–30 min    | AI-assistert planlegging med lønnsberegning      |
| HACCP og sjekklister    | 30–60 min/dag | 10–15 min    | Push-varsler, guidede sjekker, digital signering |
| Onboarding per nyansatt | 3–5 timer     | 30–60 min    | AI-guidet opplæring via appen                    |
| Oppfølging og jaging    | 30–60 min/dag | Automatisk   | Event Engine sender varsler og eskalerer         |
| Morgenrutine for leder  | 30–60 min     | 2 min        | AI-kompilert daglig sammendrag                   |
| Forberede Mattilsyn     | 8–16 timer    | 0 timer      | Alltid klar — alt digitalt og tidsstemplet       |

**Per rolle:**

| Rolle                        | Ukentlig besparelse |
| ---------------------------- | ------------------- |
| Daglig leder / Eier          | 8–15 timer/uke      |
| Driftsleder / Restaurantsjef | 10–18 timer/uke     |
| Avdelingsleder / Skiftleder  | 5–10 timer/uke      |
| Ansatt                       | 1–3 timer/uke       |

**Layout:** 3 stat-kort øverst (count-up animasjon). Tabell under. Padding: 80px.

**Kilde-note:** "Basert på estimater fra norsk restaurantdrift med 15–30 ansatte."

**Tracking:** `time_savings_visible`, `time_savings_table_scrolled`

---

### S13: Comparison (universell)

**Innhold:**

- **H2:** Før og etter Smartout

| Før Smartout                                       | Med Smartout                                                      |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| Ingen nettside, eller en Wix-side ingen oppdaterer | Profesjonell nettside som oppdaterer seg selv — gratis            |
| Vaktplan i Excel. Ringer rundt for å dekke hull    | Drag-and-drop vaktplan med sanntids lønnskostnad                  |
| Permer med sjekklister. Mattilsynet = stress       | Digital HACCP med tidsstempling og dokumentasjon klar på sekunder |
| Opplæring muntlig mellom service                   | Styrt opplæring via appen. Kunnskapstester bekrefter forståelse   |
| WhatsApp-grupper for alt                           | Teamchat + walkie-talkie + video + AI-handoff i én app            |
| 30–60 min morgenrutine                             | 2 min AI-sammendrag                                               |

**Layout:** 2-kolonne tabell. Venstre: faded/muted. Høyre: bold highlights.
**Animasjon:** Stagger slide-in fra venstre/høyre, 100ms mellom rader.

---

### S14: AI-seksjon — Mr. Botsson (universell)

**Innhold:**

- **H2:** En kollega som aldri glemmer noe.
- **Body:** Mr. Botsson kjenner restauranten din. Han guider nyansatte gjennom opplæringen, svarer på spørsmål om rutiner, varsler deg når noe trenger oppmerksomhet, og gjør overlevering mellom skift via telefonsamtale. Han snakker norsk, svensk og engelsk — og tilpasser seg rollen til den han snakker med.
- **Tagline:** Du driver restauranten. Mr. Botsson sørger for at ingenting glipper.
- **CTA:** Start gratis nå → /signup

**Mockup: Chat-simulering:**

- Bruker: "Hvem kan ta vakten til Jonas på fredag?"
- Botsson: "Maria og Thomas er tilgjengelige. Maria har flest timer fri denne uken. Skal jeg sende forespørsel?"
- Bruker: "Send til Maria."
- Botsson: "Sendt. Maria har 30 minutter på å svare."

**Layout:** Tekst venstre (60%), chat-mockup høyre (40%). Gradient bakgrunn.
**Animasjon:** Meldinger vises sekvensielt (typing-indikator → melding), 800ms mellom.

---

### S15: Norsk-seksjon (universell)

**Innhold:**

- **H2:** Laget for norsk drift.
- 📜 **Riksavtalen innebygd** — Tillegg, overtid og hviletid beregnes automatisk etter gjeldende avtaler.
- 🌡️ **HACCP etter Mattilsynets krav** — Temperaturlogging, CCP-kontroll og avvikshåndtering i tråd med norsk lov.
- 🇳🇴 **Norsk språk, norske brukere** — Ikke oversatt fra engelsk. Bygget her, for dere.

**Layout:** Sentrert overskrift. 3 kort i rad. Padding: 48px.

---

### S16: Social Proof (bransjevarianter)

**Restaurant-testimonialer:**

| Sitat                                                                                                              | Rolle        | Selskap     |
| ------------------------------------------------------------------------------------------------------------------ | ------------ | ----------- |
| Vi gikk fra fem systemer til ett. Vaktplan, opplæring og HACCP — alt på samme sted. Det sparer oss timer hver uke. | Daglig leder | Brasserie K |
| Nyansatte får opplæring via appen før de møter opp. Første dag handler om gjestene, ikke om å forklare rutiner.    | Driftssjef   | Café Sør    |
| Lønnskostnadene gikk ned 12% fordi vi endelig ser hva en uke koster mens vi planlegger — ikke etterpå.             | Eier         | Gastro Bar  |

**Bransjetall (når vi ikke har ekte kunder ennå):**

- **75%** årlig turnover i restaurantbransjen
- **88%** av operatører rapporterer økte lønnskostnader
- **27%** bruker fortsatt papir eller tavle for vaktplanlegging
- **~23 000 kr** — kostnad per tapt timeansatt
- _Kilde: National Restaurant Association / 7shifts 2025_

**Layout:** 3 testimonial-kort (desktop). Horisontal scroll med snap (mobil).

---

### S17: Pricing Preview (universell)

**Innhold:**

- **H2:** Ubegrenset antall ansatte. Alltid.
- **Subtitle:** De fleste systemer tar betalt per ansatt. Smartout tar en flat månedspris.
- **Kort:**
  - Free (0,-) — Vaktplan, nettside, stemplingsur, chat. Alltid gratis.
  - Standard (995,-/mnd) — + HACCP, opplæring, driftsøkter, sesong. _Anbefalt_
- **Link:** Se alle planer → /pricing

**Layout:** 2 kort side-by-side. Standard har "Anbefalt"-badge.

---

### S18: Founder (universell)

**Innhold:**

- **Label:** Hvorfor vi bygger dette
- **H2:** Vi bygger det ingen andre ville bygge.
- **P1:** Jeg har jobbet i restaurantbransjen i 20 år. Jeg vet hvordan det føles å sitte med Excel-planen søndag kveld, å ringe fire stykker for å dekke et hull, å grave etter temperaturlogger når Mattilsynet banker på.
- **P2:** Det finnes vaktplanleggere. Det finnes HACCP-apper. Det finnes oppgavelister. Men ingen samler alt. Smartout gjør det — fordi restauranten din ikke fungerer i separate systemer.
- **P3:** Bygget i Norge, for norsk drift. Av folk som kjenner bransjen.
- **Signatur:** Pontus — Gründer, Smartout

**Layout:** Sentrert, max-width 720px. Portrett (80px sirkulært) + tekst.

---

### S19: Poll (bransjevarianter)

**Steg 1 — Teamstørrelse:**

- Hvor stort er teamet ditt?
- 1–10 · 11–30 · Over 30

**Steg 2 — Største tidstyv:**

- Hva bruker du mest tid på?
- Vaktplan og fravær
- Opplæring — forklare det samme om igjen
- Dokumentasjon — HACCP, sjekklister, permer

**Steg 3 — Resultat (basert på svar + bransje):**

- Vaktplan → "Publiser ukeplanen på 20 minutter med lønnsberegning."
- Opplæring → "Nye ansatte lærer rutinene via appen. Slipper å forklare muntlig."
- Dokumentasjon → "Alt digitalt, alt tidsstemplet. Mattilsynet-klar uten permer."

**Layout:** Sentrert, max-width 640px. Auto-advance ved klikk.

---

### S20: Final CTA (persona-varianter)

| Persona                | H2                                     | Subtitle                                                                      | CTA                           |
| ---------------------- | -------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------- |
| Owner (standard)       | Klar for å prøve?                      | Gratis oppstart. Ingen kredittkort. Sett opp restauranten din på 15 minutter. | Start gratis nå → /signup     |
| Owner (nettside-fokus) | Få en gratis nettside for restauranten | Profesjonell, mobiltilpasset og alltid oppdatert. Inkludert i Smartout Free.  | Lag din nettside nå → /signup |
| Manager                | Prøv Smartout i din avdeling           | Del lenken med sjefen — eller start selv med gratisversjonen.                 | Start gratis nå → /signup     |
| HR                     | Kutt onboarding-tiden i to             | Se hvordan Smartout digitaliserer opplæring og compliance.                    | Book en demo → /demo          |

**Layout:** Full-width banner, sentrert tekst, stor CTA. Gradient bakgrunn.

---

### S21: Footer

**Kolonner:**

| Produkt       | Selskap | Ressurser     | Lovpålagt  |
| ------------- | ------- | ------------- | ---------- |
| Vaktplan      | Om oss  | Kom i gang    | Personvern |
| Opplæring     | Blogg   | Dokumentasjon | Vilkår     |
| HACCP         | Kontakt | API           |            |
| Daglig drift  |         |               |            |
| Kommunikasjon |         |               |            |
| Nettside      |         |               |            |
| Priser        |         |               |            |

**Tagline:** "Vaktplan. Opplæring. Drift. HACCP. Nettside. Én plattform for norske restauranter."
**Copyright:** © [Year] SmartOut AS

---

# DEL 4: FEATURE-SIDER

Individuelle landingssider per modul. Hver side ranker for spesifikke søkeord.

### /features/website (NY)

- **Title tag:** Gratis nettside for restauranter — Smartout
- **H1:** En nettside for restauranten som aldri blir utdatert
- **Meta:** Profesjonell nettside med åpningstider, meny, events og nyheter — synkronisert fra Smartout. Gratis, med SSL og hosting.
- **Seksjoner:** Hero → Nivåer (Basic/Standard/Avansert) → Synkronisering forklart → Eksempler/mockups → CTA

### /features/shiftplanner

- **Title tag:** Vaktplanlegger for restaurant — Smartout
- **H1:** Vaktplan med innebygd lønnskalkulator
- **Meta:** Drag-and-drop vaktplan med sanntids lønnskostnad. Kveldstillegg, helgetillegg og overtid beregnet etter Riksavtalen.
- **Seksjoner:** Hero → Visninger (uke/dag/ansatt) → AI vaktassistent → Lønnsberegning forklart → Eksempelvakter → CTA

### /features/haccp-complience

- **Title tag:** HACCP-kontroll for restaurant — Smartout
- **H1:** HACCP og internkontroll
- **Meta:** Digital temperaturlogging, avvikshåndtering og internkontroll. Tidsstemplet dokumentasjon klar for Mattilsynet.
- **Seksjoner:** Hero → 3-stegs sjekk (visuell → temperatur → signatur) → Push-varsler → Mattilsyn-rapport → CTA

### /features/staff-training

- **Title tag:** Opplæring for restaurantansatte — Smartout
- **H1:** Opplæring og kompetanse
- **Meta:** Styrt opplæring via appen. Kunnskapstester, beredskapspoeng og prosedyregjennomgang.
- **Seksjoner:** Hero → Eksempelmodul → Quiz-eksempel → Beredskapspoeng forklart → CTA

### /features/communications

- **Title tag:** Teamkommunikasjon for restaurant — Smartout
- **H1:** Chat. Walkie-talkie. Video. I én app.
- **Meta:** Teamchat, push-to-talk, videostrøm og AI-handoff. Erstatter WhatsApp, telefon og walkietalkie-utstyr.
- **Seksjoner:** Hero → Chat (kanaler) → Walkie-talkie (demo) → Video (demo) → AI-handoff forklart → CTA

### /features/daily-operations (NY)

- **Title tag:** Daglig driftsøkt for restaurant — Smartout
- **H1:** Fra åpning til stenging — styrt digitalt
- **Meta:** Sjekklister, oppgaver og overlevering. Automatisert fra åpning til signering.
- **Seksjoner:** Hero → Øktens livssyklus → Hooks forklart → Sign-off → Overlevering → CTA

---

# DEL 5: ØVRIGE SIDER

## Pricing (/pricing)

**Header:**

- **Badge:** Enkel og forutsigbar
- **H1:** Flat pris. Ubegrenset ansatte.
- **Subtitle:** Andre tar betalt per ansatt. Smartout har flat månedspris — 10 eller 100 på lønningslista.

**Tiers:**

| Tier       | Pris        | Beskrivelse                                 | Nøkkelfunksjoner                                                                                         |
| ---------- | ----------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Free       | 0,-         | Grunnleggende drift. Ingen tidsbegrensning. | Ubegrenset ansatte · Vaktplan og stemplingsur · Grunnleggende chat · Basic nettside · Sjekklister        |
| Standard   | 995,-/mnd   | Full plattform.                             | + HACCP · Styrt opplæring · Driftsøkter · Sesongplanlegging · Standard nettside · Walkie-talkie og video |
| Pro        | 2 500,-/mnd | Høyere tempo, flere lokasjoner.             | + AI-vaktplanlegging · Avansert rapportering · Flerlokasjon · Lønnsberegning · Avansert nettside         |
| Enterprise | Tilpasset   | Kjeder og spesialbehov.                     | + Ubegrenset lokasjoner · SAML · Dedikert kontakt · API · Booking-integrasjon                            |

**Sammenligning med konkurrenter:**

- **Vs. Planday / Tidsbanken:** Per-ansatt-pris. Kun vaktplan. Smartout: alt-i-ett + flat pris.
- **Vs. eSmiley:** Kun HACCP, isolert. Smartout: HACCP + alt annet i samme app.
- **Vs. Wix/Squarespace:** Manuell oppdatering. Smartout: automatisk synkronisert nettside.

---

## Free Forever (/free-forever)

**Hero:**

- **Badge:** Ingen tidsbegrensning. Ingen kredittkort.
- **H1:** Vaktplan, chat og nettside. Gratis. For alltid.
- **Subtitle:** Erstatt Excel, WhatsApp og den utdaterte nettsiden — uten å betale en krone.
- **CTAs:** Start gratis nå · Se hva som er inkludert

**Funksjonstrapp:**

| Nivå        | Innhold                                                                    | Pakker           |
| ----------- | -------------------------------------------------------------------------- | ---------------- |
| Grunnmur    | Vaktplan, stemplingsur, chat, basic nettside. Erstatter Excel og WhatsApp. | Free             |
| Full drift  | + HACCP, opplæring, driftsøkter, sesong, walkie-talkie, standard nettside. | Standard         |
| Intelligens | + AI-planlegging, rapporter, lønnsberegning, avansert nettside.            | Pro + Enterprise |

**FAQ:**

| Spørsmål                                | Svar                                                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Er Smartout virkelig gratis?            | Ja. Free inkluderer vaktplan, chat, stemplingsur og nettside — uten tidsbegrensning.           |
| Hva er forskjellen på Free og Standard? | Free: vaktplan og kommunikasjon. Standard: + HACCP, opplæring, driftsøkter og sesong.          |
| Er det bindingstid?                     | Nei. Oppgrader, nedgrader eller avslutt når som helst.                                         |
| Fungerer det på mobil?                  | Ja. Ansatte bruker appen. Ledere planlegger på desktop.                                        |
| Er nettsiden virkelig gratis?           | Ja. Basic-nettside med åpningstider, kontaktinfo og beskrivelse. Oppgrader for meny og events. |

---

## Om Oss (/om-oss)

**H1:** 20 år i bransjen. 4 år med å bygge løsningen.

**Gründerhistorie:**

> Jeg har stått bak bardisken, planlagt vakter på papir og ringt rundt søndag kveld for å dekke hull. I 20 år.
> De siste fire årene har vi bygget Smartout. Vi har gjort feil, tapt kunder og startet på nytt. Fordi det vi bygger er vanskelig — å samle vaktplan, opplæring, HACCP, kommunikasjon og nettside i ett system.
> Teknologien har endelig tatt igjen visjonen. AI gjør det mulig å bygge verktøyet vi alltid trengte — men aldri fikk.

**Verdier:**

- 🎯 Hver ting på rett sted — Hvert minutt spart er et minutt mer til gjestene.
- 🛡️ Alltid klar for tilsyn — Dokumentasjon som holder seg oppdatert selv.
- ❤️ Bygget for folk — Teknologi som gjør jobben enklere, ikke overvåker.

---

## Blog (/blog)

| #   | Tittel                                                 | Søkeord                 |
| --- | ------------------------------------------------------ | ----------------------- |
| 1   | Vaktplanen tok 3 timer. Nå tar den 20 minutter.        | vaktplan restaurant     |
| 2   | Mattilsynet kom. Vi var klare på 30 sekunder.          | HACCP mattilsynet       |
| 3   | 40% lavere turnover etter vi digitaliserte opplæringen | turnover restaurant     |
| 4   | Fra 5 apper til 1 — og endelig oversikt                | restaurant system       |
| 5   | Hvordan vi halverte onboarding-tiden                   | onboarding nyansatte    |
| 6   | 12% lavere lønnskostnad — fordi vi ser tallene         | lønnskostnad restaurant |

---

## Compare (/compare)

| System                | Pris           | Modell       | Smartout-fordel                       |
| --------------------- | -------------- | ------------ | ------------------------------------- |
| Planday               | ~900 kr/mnd    | Per ansatt   | Flat pris + alt-i-ett                 |
| Tidsbanken            | ~1000+ kr/mnd  | Per ansatt   | Moderne UX + AI                       |
| eSmiley               | ~500+ kr/mnd   | Per lokasjon | HACCP + alt annet                     |
| 7shifts               | ~330 kr/mnd    | Per lokasjon | Norsk-først + compliance              |
| When I Work           | ~540 kr/mnd    | Per ansatt   | Bredere plattform                     |
| Wix/Squarespace       | 100–300 kr/mnd | Abonnement   | Auto-synkronisert nettside            |
| **Smartout Free**     | **0 kr**       | **Flat**     | **Vaktplan + chat + nettside gratis** |
| **Smartout Standard** | **995 kr/mnd** | **Flat**     | **Alt i ett, ubegrenset ansatte**     |

---

## Legal (kort)

- **/vilkar** — 12 seksjoner. Ingen bindingstid. support@smartout.no.
- **/personvern** — 9 seksjoner. Behandlingsansvarlig: SmartOut AS. personvern@smartout.no.

## Auth

| Side      | H1              | CTA                 |
| --------- | --------------- | ------------------- |
| /login    | Logg inn        | Gå til dashboardet  |
| /signup   | Opprett konto   | Start gratis        |
| /waitlist | Sikre deg plass | Registrer interesse |

---

# DEL 6: SEO

## 6.1 Primære søkeord (høy intensjon)

| Søkefrase                       | Volum   | Landingsside               |
| ------------------------------- | ------- | -------------------------- |
| vaktplanlegger restaurant       | 200–500 | /features/shiftplanner     |
| vaktplan app ansatte            | 300–600 | /features/shiftplanner     |
| gratis nettside restaurant      | 100–300 | /free-forever              |
| digital vaktplan                | 200–400 | / (hero)                   |
| HACCP app restaurant            | 50–150  | /features/haccp-complience |
| temperaturlogg app              | 50–100  | /features/haccp-complience |
| sjekkliste restaurant           | 100–200 | /concepts/procedures       |
| onboarding nyansatte restaurant | 50–100  | /features/staff-training   |
| planday alternativ              | 30–80   | /compare                   |
| eSmiley alternativ              | 20–50   | /compare                   |

## 6.2 SEO-metadata per side

| Side                         | Title (50–60 tegn)                                       | Meta Description (150–160 tegn)                                                                                   |
| ---------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/`                          | Smartout — Vaktplan, opplæring og HACCP for restauranter | Samle vaktplan, opplæring, daglig drift, HACCP og nettside i én plattform. For norske restauranter. Start gratis. |
| `/pricing`                   | Priser — Smartout                                        | Flat pris, ubegrenset ansatte. Free alltid gratis. Standard fra 995 kr/mnd. Ingen bindingstid.                    |
| `/free-forever`              | Gratis vaktplan og nettside for restauranter — Smartout  | Vaktplan, stemplingsur, chat og nettside — gratis for alltid. Ingen kredittkort.                                  |
| `/features/website`          | Gratis nettside for restauranter — Smartout              | Profesjonell nettside som synkroniserer åpningstider, meny og events fra Smartout. Gratis.                        |
| `/features/shiftplanner`     | Vaktplanlegger for restaurant — Smartout                 | Drag-and-drop vaktplan med sanntids lønnskostnad. Riksavtalen og arbeidsmiljøloven innebygd.                      |
| `/features/haccp-complience` | HACCP-kontroll for restaurant — Smartout                 | Digital temperaturlogging, avvikshåndtering og internkontroll. Klar for Mattilsynet.                              |
| `/features/staff-training`   | Opplæring for restaurantansatte — Smartout               | Styrt opplæring via appen. Kunnskapstester og beredskapspoeng tilpasset rolle.                                    |
| `/features/communications`   | Teamchat og walkie-talkie for restaurant — Smartout      | Chat, push-to-talk, videostrøm og AI-handoff. Erstatter WhatsApp og telefonkjeder.                                |
| `/compare`                   | Smartout vs. Planday vs. eSmiley                         | Sammenlign Smartout med Planday, Tidsbanken, eSmiley og andre. Flat pris, ubegrenset ansatte.                     |
| `/om-oss`                    | Om Smartout — Bygget for norsk restaurantdrift           | 20 år i bransjen. Smartout samler alt restauranten trenger i én plattform.                                        |

## 6.3 Teknisk SEO

| Element                 | Krav                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| Schema                  | `SoftwareApplication` (forside), `FAQPage` (priser, free-forever), `Article` (blogg)                  |
| Open Graph              | Tittel, beskrivelse, bilde (1200×630) per side                                                        |
| Sitemap                 | Auto-generert via Next.js                                                                             |
| Robots                  | Tillat alt. Blokkér /api/, /admin/, /platform-admin/                                                  |
| Canonical               | Selvpekende per side                                                                                  |
| Hreflang                | `nb` primær, `en` sekundær                                                                            |
| Core Web Vitals         | LCP < 2.5s, FID < 100ms, CLS < 0.1                                                                    |
| Personalisering vs. SEO | Universell variant rendres server-side (Google ser den). Personalisering client-side etter hydration. |

## 6.4 Innholdskalender

| Uke | Innhold                                        | Søkeord              | Type               |
| --- | ---------------------------------------------- | -------------------- | ------------------ |
| 1   | Forsiden + feature-sider live                  | Alle primære         | Sider              |
| 2   | Sammenligningsside + prisside                  | Alternativ-søk       | Sider              |
| 3   | "Hva koster turnover i restaurantbransjen?"    | turnover restaurant  | Blogg              |
| 4   | "Mattilsynets krav til temperaturlogging"      | mattilsynet krav     | Guide              |
| 6   | "Riksavtalens tillegg: komplett oversikt 2026" | Riksavtalen tillegg  | Referanse          |
| 8   | "Lønnskostnad i restaurant: hva er normalt?"   | lønnskostnad prosent | Blogg + kalkulator |
| 10  | "Sesongplanlegging: forbered sommeren"         | sesongansatte regler | Guide              |

---

# DEL 7: CTA

## 7.1 Konverteringstrakt

```
OPPMERKSOMHET → Google-søk, blogg, annonse
  ↓
INTERESSE → Qualifier-klikk, feature-seksjoner, nettside-lokkemiddel
  ↓
VURDERING → Prissiden, sammenligning, testimonials, tidsbesparelse-tall
  ↓
HANDLING → "Start gratis nå" → Signup → Onboarding wizard
```

## 7.2 CTA-plassering

| CTA              | Tekst                   | Mål                   | Plassering             |
| ---------------- | ----------------------- | --------------------- | ---------------------- |
| Header           | Start gratis            | /signup               | Sticky, alltid synlig  |
| Hero primær      | Start gratis nå         | /signup               | Hero                   |
| Hero sekundær    | Se hvordan det fungerer | scroll → qualifier    | Hero                   |
| Nettside CTA     | Få din gratis nettside  | /signup               | Feature: nettside      |
| Feature lenker   | Les mer →               | /features/\*          | Feature-deep seksjoner |
| Pricing Free     | Start gratis            | /signup               | Pricing preview        |
| Pricing Standard | Kom i gang              | /signup?plan=standard | Pricing preview        |
| AI CTA           | Start gratis nå         | /signup               | AI-seksjon             |
| Final CTA        | Start gratis nå         | /signup               | Avsluttende banner     |

## 7.3 CTA-regler

- Maks 1 primær CTA synlig samtidig (utenom header)
- Aldri "Book demo" som primær for SMB — de vil prøve selv
- "Start gratis" > "Opprett konto" — verdi fremfor handling
- Aldri pris i CTA-tekst
- Mobil: CTA full bredde

## 7.4 CTA per persona

| Persona        | Primær                 | Sekundær             |
| -------------- | ---------------------- | -------------------- |
| Owner (liten)  | Få din gratis nettside | Se hva mer du får    |
| Owner (medium) | Start gratis nå        | Se priser            |
| Manager        | Start gratis nå        | Del med sjefen din   |
| HR             | Book en demo           | Se opplæringsmodulen |
| Ops (kjeder)   | Kontakt oss            | Se enterprise-pakken |

---

# DEL 8: MÅLING

## 8.1 Primære KPIer

| KPI                          | Mål      |
| ---------------------------- | -------- |
| Visit → signup               | 2–4%     |
| Signup → onboarding fullført | 40–60%   |
| Bounce rate forside          | < 50%    |
| Tid på forside               | > 90 sek |
| CTA click-through            | > 3%     |
| Qualifier completion         | > 60%    |
| Scroll depth > 50%           | > 30%    |

## 8.2 PostHog Event-katalog

| Event                         | Properties                               |
| ----------------------------- | ---------------------------------------- |
| `page_viewed`                 | page, industry, persona, device, utm\_\* |
| `hero_cta_clicked`            | variant                                  |
| `qualifier_industry_selected` | industry                                 |
| `qualifier_skipped`           | —                                        |
| `section_visible`             | section, industry_variant, percent       |
| `section_dwell`               | section, seconds                         |
| `feature_card_clicked`        | feature, section                         |
| `cta_clicked`                 | section, label, target, persona          |
| `cta_hovered`                 | section, label                           |
| `pain_card_clicked`           | industry, card_index                     |
| `chat_mockup_viewed`          | messages_shown                           |
| `poll_step_completed`         | step, answer                             |
| `poll_completed`              | industry, team_size, pain_point          |
| `pricing_card_clicked`        | tier                                     |
| `time_savings_visible`        | —                                        |
| `signup_started`              | source_section, industry, persona        |
| `scroll_depth`                | percent: 25, 50, 75, 100                 |

Alle events har felles: `{ industry, persona, device, session_id }`.

## 8.3 A/B-tester

| Test                        | A                      | B                             | KPI                     | Varighet |
| --------------------------- | ---------------------- | ----------------------------- | ----------------------- | -------- |
| Hero H1                     | "Slutt å administrere" | "Seks verktøy. Én plattform." | CTA CTR                 | 2 uker   |
| Hero CTA                    | "Start gratis nå"      | "Få din gratis nettside"      | Signup                  | 2 uker   |
| Nettside-seksjon plassering | #6 (etter solution)    | #2 (rett etter hero)          | Signup                  | 3 uker   |
| Pricing teaser              | Ja                     | Nei (kun link)                | Pricing visits + signup | 3 uker   |

## 8.4 Måletavle

| Metrikk          | Uke 1 | Måned 3 | Måned 6 |
| ---------------- | ----- | ------- | ------- |
| Unike besøk/uke  | 200   | 1 000   | 3 000   |
| Signups/uke      | 5     | 30      | 100     |
| Konvertering     | 2%    | 3%      | 3.5%    |
| Organisk trafikk | 10%   | 30%     | 50%     |

---

# DEL 9: KONKURRENTANALYSE

## Direkte konkurrenter (Norge)

| Konkurrent      | Pris         | Styrke           | Svakhet             | Smartout-fordel       |
| --------------- | ------------ | ---------------- | ------------------- | --------------------- |
| Planday         | Per ansatt   | Etablert, god UX | Kun vaktplan, dyrt  | Alt-i-ett + flat pris |
| Tidsbanken      | Per ansatt   | Norsk, bredt     | Gammel UX           | Moderne + AI          |
| eSmiley         | Per lokasjon | HACCP-spesialist | Kun HACCP           | HACCP + alt annet     |
| Timegrip        | Varierer     | Timeregistrering | Smal                | Bredere               |
| Wix/Squarespace | 100–300/mnd  | Nettsidebygger   | Manuell oppdatering | Auto-synkronisert     |

## Søkeord-gaps

| Søkefrase                      | Hvem ranker        | Smartouts mulighet                |
| ------------------------------ | ------------------ | --------------------------------- |
| "gratis nettside restaurant"   | Wix (generisk)     | Spesifikk restaurant-landingsside |
| "vaktplan restaurant gratis"   | Ingen dominerer    | Free-tier landing                 |
| "HACCP app norsk"              | eSmiley (svak SEO) | Feature-side + guide              |
| "Planday alternativ"           | Ingen dedikert     | Sammenligningsside                |
| "walkie-talkie restaurant app" | Ingen              | Kommunikasjons-side               |

---

# DEL 10: TEKNISK IMPLEMENTASJON

## 10.1 Komponentarkitektur

```
apps/landing/src/
├── components/
│   ├── sections/           — Én komponent per seksjon (S01–S21)
│   │   ├── Header.tsx
│   │   ├── Hero.tsx
│   │   ├── Qualifier.tsx
│   │   ├── PainPoints.tsx
│   │   ├── SolutionOverview.tsx
│   │   ├── FeatureDeep.tsx       (gjenbrukbar med variant-props)
│   │   ├── TimeSavings.tsx
│   │   ├── Comparison.tsx
│   │   ├── AiSection.tsx
│   │   ├── Norwegian.tsx
│   │   ├── SocialProof.tsx
│   │   ├── PricingPreview.tsx
│   │   ├── Founder.tsx
│   │   ├── Poll.tsx
│   │   ├── FinalCta.tsx
│   │   └── Footer.tsx
│   ├── ui/                 — Gjenbrukbare
│   │   ├── SectionWrapper.tsx    (padding, max-width, IO-animasjon)
│   │   ├── Badge.tsx
│   │   ├── StatCard.tsx
│   │   ├── FeatureCard.tsx
│   │   ├── TestimonialCard.tsx
│   │   ├── ComparisonRow.tsx
│   │   ├── ChatMockup.tsx
│   │   ├── BrowserFrame.tsx
│   │   └── PhoneFrame.tsx
│   └── personalization/
│       ├── ProfileContext.tsx     (React Context)
│       ├── useProfile.ts         (hook)
│       ├── VariantSelector.tsx   (velger riktig variant)
│       └── signals.ts            (scroll, dwell, hover tracking)
├── content/                — Innhold per variant (JSON/TS)
│   ├── universal.ts
│   ├── restaurant.ts
│   ├── hotel.ts
│   ├── cafe.ts
│   └── bar.ts
└── tracking/
    └── posthog.ts
```

## 10.2 VisitorProfile (type)

```typescript
type Industry = "restaurant" | "hotel" | "cafe" | "bar" | "catering" | "other";
type Persona = "owner" | "manager" | "hr" | "ops";

type VisitorProfile = {
  industry: Industry | null;
  persona: Persona | null;
  signals: {
    scrollDepth: Record<string, number>;
    dwellTime: Record<string, number>;
    clicks: string[];
    ctaHovers: string[];
  };
  source: {
    utm_campaign: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    referrer: string | null;
    device: "desktop" | "tablet" | "mobile";
    timeOfDay: "morning" | "afternoon" | "evening" | "night";
  };
};
```

## 10.3 Responsivt design

| Breakpoint | Navn    | Endringer                                  |
| ---------- | ------- | ------------------------------------------ |
| < 640px    | Mobile  | Single column. Hamburger. Full-width CTAs. |
| 640–1024px | Tablet  | 2-kolonne der desktop har 3+.              |
| > 1024px   | Desktop | Full layout som spesifisert.               |

**Globalt:** Max 1280px, sentrert. Padding: 64px desktop, 40px mobil. Font: H1 48→32, H2 36→24, body 16→15. Bilder: lazy-load, blur placeholder.

## 10.4 Animasjon

| Element          | Trigger   | Animasjon               | Timing        |
| ---------------- | --------- | ----------------------- | ------------- |
| Seksjon          | IO 0.2    | Fade-in + slide-up 20px | 400ms         |
| Statistikk-tall  | IO 0.5    | Count-up                | 1200ms        |
| Feature-kort     | IO 0.3    | Stagger fade-in         | 50ms delay    |
| Mockup           | IO 0.3    | Fade-in fra side        | 600ms         |
| Chat-mockup      | IO 0.5    | Sekvensielle meldinger  | 800ms mellom  |
| Qualifier-kort   | Klikk     | Scale 1.05 + ring       | 200ms         |
| Bransjebytte     | Qualifier | Crossfade varianter     | 300ms         |
| CTA              | Hover     | Lift -2px + shadow      | 150ms         |
| Comparison-rader | IO 0.3    | Slide-in L/R            | 100ms stagger |

**Regler:**

- Alle via CSS transforms/opacity (GPU)
- Ingen animasjon ved prefers-reduced-motion
- IntersectionObserver, aldri scroll events
- Framer Motion for exit-animasjoner

---

# ENDRINGSLOGG FRA EKSISTERENDE LANDINGSSIDE

| Seksjon              | Endring                                        | Begrunnelse                                 |
| -------------------- | ---------------------------------------------- | ------------------------------------------- |
| Hero                 | "Fremtiden" → Konkret verdiforslag med søkeord | SEO + klarhet                               |
| Badge                | AI-fokus → Bransjefokus                        | Eiere søker «vaktplan», ikke «AI»           |
| Website Factory      | → Nettside som feature-deep #1                 | Trojansk hest — laveste terskel             |
| Lise Botsson         | → Mr. Botsson                                  | Konsistent med bygget produkt               |
| Prismodell           | Per-ansatt-implikasjon → Eksplisitt flat pris  | Differensiering fra Planday                 |
| Engine-seksjon       | Teknisk arkitektur → Sesong / drift            | Ingen søker "Event Engine"                  |
| Testimonials         | Generisk ros → Spesifikke tall                 | "12% lavere lønnskost" > "føles bra"        |
| Steps                | Vag AI-pitch → Konkrete onboarding-steg        | Veien fra registrering til drift            |
| Comparison           | Vag → Spesifikk before/after                   | Gjenkjennelig smerte → løsning              |
| NY: Kommunikasjon    | —                                              | Walkie-talkie + video = unik differensiator |
| NY: Tidsbesparelse   | —                                              | 15 AI-funksjoner med konkrete tall          |
| NY: Qualifier        | —                                              | Dynamisk personalisering                    |
| NY: Bransjevarianter | —                                              | Relevant innhold per besøkende              |
| NY: Nettside-feature | —                                              | Akkvisisjonsstrategi (trojansk hest)        |
| Prisside             | AI-tokens → Funksjonsnivåer                    | Eiere forstår "HACCP inkludert"             |
| SEO                  | Manglende → Komplett                           | Hvert søkeord har sin landingsside          |
