---
title: "Smartout Landing Page — Komplett Innhold"
id: LANDING_CONTENT_FINAL
status: canonical
version: "2.0"
layer: plan
created: 2026-03-28
updated: 2026-03-28
author: pontus
depends_on:
  - LANDING_SPEC_FINAL
tags:
  - landing
  - content
  - copy
  - variants
---

# LANDING_CONTENT_FINAL.md — Alt Innhold

> All tekst for landingssiden. Ingen layout, ingen teknisk. Bare copy.
> Organisert per seksjon, med bransjevarianter der de finnes.

---

## Navigasjon

**Links:** Funksjoner · Priser · Kundehistorier · Dokumentasjon · Om oss · Logg inn · [Start gratis]
**Footer tagline:** "Vaktplan. Opplæring. Drift. HACCP. Én plattform for norske restauranter."
**Footer kolonner:**

| Produkt      | Selskap | Ressurser     | Juridisk   |
| ------------ | ------- | ------------- | ---------- |
| Vaktplan     | Om oss  | Kom i gang    | Personvern |
| Opplæring    | Blogg   | Dokumentasjon | Vilkår     |
| HACCP        |         | API           |            |
| Daglig drift |         |               |            |

---

## S02: Hero (universell)

- **Badge:** For restauranter, hoteller og kafeer i Norge
- **H1:** Slutt å _administrere_. Begynn å drive.
- **Subtitle:** Smartout samler vaktplan, opplæring, daglig drift, HACCP og en profesjonell nettside for restauranten din — i én plattform. Bygget for norsk arbeidsrett, norske tariffer og Mattilsynets krav.
- **CTA Primary:** Start gratis nå → /signup
- **CTA Secondary:** Se hvordan det fungerer → scroll #qualifier

---

## S03: Qualifier (universell)

- **H2:** Hva driver du?
- **Subtitle:** Vi tilpasser innholdet etter din bransje.

| ID         | Ikon | Label             | Sublabel        |
| ---------- | ---- | ----------------- | --------------- |
| restaurant | 🍽️   | Restaurant        | 15–50 ansatte   |
| hotel      | 🏨   | Hotell            | 30–150 ansatte  |
| cafe       | ☕   | Kafé              | 5–20 ansatte    |
| bar        | 🍸   | Bar / Nattklubb   | 10–30 ansatte   |
| other      | 🏢   | Annen skiftbasert | Fortell oss mer |

---

## S04: Pain Selector (bransjevarianter)

- **H2:** Kjenner du deg igjen?
- **Subtitle:** Trykk på det som treffer.

### Restaurant (4 kort)

| ID              | Ikon | Tittel                   | Tekst                                                                                                             |
| --------------- | ---- | ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| scheduling_pain | 📅   | Søndag kveld, vaktplanen | Du sitter med regnearket. Ringer tre stykker for å dekke hull. Ser lønnskostnadene først etter at lønna er kjørt. |
| onboarding_pain | 👤   | Ny ansatt på mandag      | Opplæringen skjer muntlig, mellom service. Ingen vet hvem som har lært hva. Etter tre uker slutter halvparten.    |
| compliance_pain | 🌡️   | Mattilsynet ringer       | Temperaturloggene ligger i en perm bak kaffemaskinen. Halvparten er fylt ut med gårsdagens dato.                  |
| followup_pain   | 📋   | Jager folk for svar      | Godkjenninger, signaturer, fravær — du bruker halve dagen på å mase. Ingenting skjer av seg selv.                 |

### Hotell (4 kort)

| ID                   | Ikon | Tittel                       | Tekst                                                                                               |
| -------------------- | ---- | ---------------------------- | --------------------------------------------------------------------------------------------------- |
| silos_pain           | 🏢   | Tre avdelinger, tre systemer | Resepsjon bruker ett verktøy, housekeeping et annet, restaurant et tredje. Ingen snakker sammen.    |
| crosscompliance_pain | 📋   | Internkontroll på tvers      | HACCP i kjøkkenet, brannrutiner i resepsjonen, renholdssjekk i rommene — alt i forskjellige permer. |
| seasonal_pain        | 🔄   | Sesongansatte hvert halvår   | 20 nye til sommeren, 15 til jul. Samme opplæring, fra scratch, hver gang.                           |
| coordination_pain    | 📨   | Beskjeder som forsvinner     | Driftslederen sender SMS. Resepsjonen vet ikke. Housekeeping har ikke fått beskjed. Gjesten klager. |

### Kafé (3 kort)

| ID            | Ikon | Tittel                     | Tekst                                                                                        |
| ------------- | ---- | -------------------------- | -------------------------------------------------------------------------------------------- |
| dualrole_pain | ⏰   | Du jobber OG administrerer | Du står bak disken og prøver å planlegge neste uke mellom bestillingene. Det blir aldri tid. |
| whatsapp_pain | 📱   | WhatsApp er vaktplanen     | Beskjeder forsvinner oppover i chatten. Ingen vet hvem som jobber på lørdag.                 |
| binders_pain  | 📝   | Permer du aldri åpner      | IK-mat, renholdsplan, temperaturlogg — du vet de finnes, men de er aldri oppdatert.          |

### Bar (3 kort)

| ID            | Ikon | Tittel                         | Tekst                                                                                                |
| ------------- | ---- | ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| nightpay_pain | 🌙   | Kveld og natt, hver helg       | Kveldstillegg, nattillegg, helgetillegg — du regner feil hver gang. Lønnskostnadene overrasker.      |
| turnover_pain | 🔄   | Høyt gjennomtrekk              | Bartendere som starter i september er borte til jul. Opplæringen går på repeat.                      |
| peaks_pain    | 📊   | Topper du aldri planlegger for | Fotballkamp, nyttårsaften, festival-helg. Du vet det blir kaos, men du planlegger som en vanlig uke. |

---

## S05: Action Grid — 12 operative handlinger

**H2:** Hva trenger du å gjøre?
**Subtitle:** Smartout løser det — med ett trykk.
**Expand-knapp:** Vis alle 12

| #   | ID                 | Tittel                 | Ikon | One-liner                                | Expanded                                                                                                                       |
| --- | ------------------ | ---------------------- | ---- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | smart-cover        | Finn vikar             | 🔍   | Noen er syk. Hvem kan ta vakten?         | Systemet finner ledige + kvalifiserte → sender push → første ja fyller hullet. Leder godkjenner eller det skjer automatisk.    |
| 2   | daily-session      | Dagens drift           | ✅   | Hva skal gjøres i dag?                   | Automatisk sjekkliste per avdeling. Ansatte kvitterer. Leder ser status i sanntid. Overlevering til neste skift med ett klikk. |
| 3   | shift-tasks        | Mine oppgaver          | 📋   | Ansatte vet hva de skal gjøre.           | Ved skiftstart: push med oppgavene. Kvitter med ett trykk. Avvik med bilde. Sjefen slipper å bli spurt.                        |
| 4   | daily-bulletin     | Dagens beskjed         | 📢   | Én melding til alle på vakt.             | Skriv → push til alle på vakt → kvittering synlig. Erstatter Facebook-gruppen.                                                 |
| 5   | shift-swap         | Vaktbytter             | 🔄   | Ansatte bytter. Systemet sjekker.        | Foreslå bytte → kompetanse + arbeidstid sjekkes → motpart godtar → leder godkjenner.                                           |
| 6   | timesheet-export   | Timer til lønn         | 💰   | Fra stempling til lønnsgrunnlag.         | Stempling inn/ut → tillegg beregnes automatisk (kveld, helg, helligdag) → eksporter til regnskapsfører.                        |
| 7   | shift-handoff      | Overlevering           | 🤝   | Neste skift vet alt.                     | Dagskift oppsummerer: gjort, gjenstår, avvik. Kveldsskift ser alt før de starter.                                              |
| 8   | quick-onboard      | Ny på jobb             | 👤   | Fra invitasjon til klar.                 | Inviter → kontrakt signeres → prosedyrer tildeles → readiness-score synlig → klar eller ikke klar.                             |
| 9   | compliance-check   | Temperatur og kontroll | 🌡️   | HACCP uten permer.                       | Push til rett person → sjekk + registrer → avvik flagges → dokumentasjon alltid klar.                                          |
| 10  | week-pulse         | Ukeoversikt            | 📊   | Alt lederen trenger. Én skjerm.          | Bemanning, hull, forespørsler, fravær, budsjett vs. faktisk.                                                                   |
| 11  | targeted-broadcast | Melding til gruppe     | 📨   | Filtrer. Skriv. Send. Se hvem som leste. | Velg mottakere etter avdeling, rolle, vakt eller team. Lesekvittering per person i sanntid.                                    |
| 12  | escalation-alerts  | Eskaleringsvarsler     | ⚠️   | Ingen ting glipper.                      | Ingen svar innen X min → eskaleres automatisk oppover. Vikarforespørsel, fravær, temperatur, oppgaver.                         |

---

## S06: Nettside (bransjevariant)

- **Label:** Inkludert gratis
- **H2:** En nettside som oppdaterer seg selv.
- **Body:** Smartout lager en profesjonell nettside for restauranten din — automatisk. Åpningstider, menyer, events og nyheter synkroniseres direkte fra driften din. Du trenger aldri logge inn på en nettside-editor igjen.
- **Features:**
  - 🌐 Alltid oppdatert — Endrer du åpningstidene, oppdateres nettsiden automatisk.
  - 🍽️ Meny som lever — Menyen hentes fra produksjonsmodulen. Ny rett? Synlig med én gang.
  - 📅 Events og nyheter — Langbord, julelunsj, ølsmaking — publiser events som vises på nettsiden.
  - 📱 Mobiltilpasset og rask — Profesjonelt design, SSL og hosting inkludert. Gratis.

**Mockup-varianter:**

| Bransje    | Navn          | Tagline                               |
| ---------- | ------------- | ------------------------------------- |
| Restaurant | Brasserie K   | Moderne nordisk kjøkken midt i Oslo   |
| Hotell     | Fjordhotellet | Restaurant, konferanse og overnatting |
| Kafé       | Café Sør      | Kaffe, bakst og lunsj siden 2019      |
| Bar        | Barrique      | Naturvin og cocktails                 |

**Nettsidenivåer:**

| Nivå     | Innhold                                            | Pakke            |
| -------- | -------------------------------------------------- | ---------------- |
| Basic    | Én side — åpningstider, beskrivelse, kontakt, kart | Free             |
| Standard | Meny, events, nyheter/blogg, bildegalleri          | Standard         |
| Avansert | Flersidig, eget domene, frie moduler               | Pro / Enterprise |

---

## S07: Vaktplan (bransjevariant)

- **Label:** Kjernefunksjon
- **H2:** Vaktplanen som regner for deg.
- **Body:** Drag-and-drop planlegging med sanntids lønnskostnad. Kveldstillegg, helgetillegg og overtid beregnes automatisk etter Riksavtalen og arbeidsmiljøloven. Du ser hva uken koster før du publiserer.
- **Features:**
  - 💰 Sanntids lønnskostnad per dag og uke
  - ⚠️ Automatiske varsler ved overtid og hviletidsbrudd
  - 📋 Åpne vakter som ansatte kan melde seg på
- **AI i kontekst:** AI vaktassistent sjekker dekningsgrad, tariff og tilgjengelighet. 20 min istedenfor 3 timer.

---

## S08: HACCP (bransjevariant — skip for bar)

- **Label:** Klar for tilsyn
- **H2:** HACCP uten permer.
- **Body:** Temperaturlogging, avvikshåndtering og renholdssjekker — digitalt, tidsstemplet og alltid tilgjengelig. Ansatte får automatiske påminnelser. Når Mattilsynet kommer, trekker du opp rapporten på sekunder.
- **Features:**
  - 🔔 Automatiske push-varsler for temperaturkontroller
  - 📸 Avviksregistrering med mobilkamera
  - 📄 Komplett dokumentasjon klar for Mattilsynet
- **AI i kontekst:** HMS-inspektør med stemme guider gjennom sjekken. 0 timer forberedelse til tilsyn.

---

## S09: Opplæring (bransjevariant)

- **Label:** Klar fra dag én
- **H2:** Nyansatt i dag. Klar i morgen.
- **Body:** Nye ansatte læres opp via appen — tilpasset rollen, erfaringen og språket. Systemet sporer hvem som har fullført hva. Du ser nøyaktig hvem som er klar og hvem som mangler noe — før de starter på jobb.
- **Features:**
  - 🎯 Opplæring tilpasset stilling og avdeling
  - ✅ Kunnskapstester som bekrefter at de faktisk kan stoffet
  - 📊 Beredskapspoeng som viser hvem som er klar
- **AI i kontekst:** Reiseassistent guider gjennom hvert steg. 30 min istedenfor 4 timer per nyansatt.

---

## S10: Daglig drift (bransjevariant)

- **Label:** Fra åpning til stenging
- **H2:** Hele dagen — styrt digitalt.
- **Body:** Hver avdeling får sin egen driftsøkt med sjekklister, oppgaver og overlevering. Åpningsrutiner aktiveres automatisk. Stengingsrutiner krever signering. Ingenting glipper mellom skiftene.
- **Features:**
  - ⏰ Tidsbaserte sjekklister som aktiveres automatisk
  - 🤝 Overlevering mellom skift med tekst eller stemmenotat
  - ✍️ Daglig signering som låser og arkiverer dagen
- **AI i kontekst:** Event Engine ruter varsler. Guardian overvåker. Lederpuls gir daglig sammendrag. 5 min morgenrutine istedenfor 60.

---

## S11: Kommunikasjon (bransjevariant)

- **Label:** Alt i sanntid
- **H2:** Chat. Walkie-talkie. Video. I én app.
- **Body:** Slutt på WhatsApp-grupper og telefonkjeder. Smartout samler all kommunikasjon i én app — fra teamchat og push-varsler til walkie-talkie mellom kjøkken og sal. Trenger du å se hva som skjer? Åpne videostrømmen rett fra PC-en. Når vakten er over, gjør Mr. Botsson overleveringen via en strukturert telefonsamtale som transkriberes automatisk.
- **Features:**
  - 💬 Teamchat med kanaler — Avdelingschat, skiftchat, direktemeldinger.
  - 📻 Walkie-talkie — Push-to-talk mellom kjøkken og sal. Fungerer som en radio.
  - 📹 Videostrøm — Se kjøkkenet fra PC-en. Live video mellom mobil og desktop.
  - 📞 AI-handoff via telefon — Mr. Botsson ringer ved skiftslutt, intervjuer og transkriberer.

**Bransjevarianter (body):**

| Bransje    | Variant                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| Restaurant | Kokken trenger mer laks — walkie-talkie til lageret. Sjefen sjekker preppen — videostrøm fra kontoret. |
| Hotell     | Resepsjonen varsler housekeeping — walkie-talkie. Driftsleder ser lobbyen — videostrøm fra bakrommet.  |
| Kafé       | Bare 3 på jobb, men chat holder dere synkronisert. Eier sjekker driften hjemmefra — live video.        |
| Bar        | Bartender trenger backup — walkie-talkie til dørvakten. Sjef ser køen — videostrøm fra kontoret.       |

---

## S12: Tidsbesparelse (bransjevariant)

- **H2:** En hel arbeidsdag — tilbake.
- **Subtitle:** Smartout sparer deg 8–15 timer administrasjon per uke. Her er hva det betyr.

**Statistikk:**

| Tall   | Enhet     | Label                  | Sublabel                                          |
| ------ | --------- | ---------------------- | ------------------------------------------------- |
| 8–15   | timer/uke | Spart for daglig leder | Vaktplan, HACCP, rapporter, oppfølging            |
| 10–15% |           | Lavere lønnskostnader  | Optimalisert bemanning i sanntid                  |
| 3–5    | verktøy   | Erstattet med ett      | Vaktplan + HACCP + opplæring + chat + sjekklister |

**Tidsbruddtabell:**

| Oppgave                 | Uten Smartout | Med Smartout |
| ----------------------- | ------------- | ------------ |
| Vaktplanlegging         | 2–4 timer/uke | 15–30 min    |
| HACCP og sjekklister    | 30–60 min/dag | 10–15 min    |
| Onboarding per nyansatt | 3–5 timer     | 30–60 min    |
| Oppfølging og jaging    | 30–60 min/dag | Automatisk   |
| Morgenrutine for leder  | 30–60 min     | 2 min        |
| Forberede tilsyn        | 8–16 timer    | 0 timer      |

**Kilde:** Basert på estimater fra norsk restaurantdrift med 15–30 ansatte.

**Besparelse per rolle:**

| Rolle                        | Timer spart/uke |
| ---------------------------- | --------------- |
| Daglig leder / Eier          | 8–15            |
| Driftsleder / Restaurantsjef | 10–18           |
| Avdelingsleder / Skiftleder  | 5–10            |
| Ansatt                       | 1–3             |

---

## S13: Sammenligning (universell)

- **H2:** Før og etter Smartout

| Før Smartout                                                                              | Med Smartout                                                                              |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Vaktplan i Excel. Ringer rundt for å dekke hull. Ser lønnskostnaden etter lønna er kjørt. | Drag-and-drop vaktplan med sanntids lønnskostnad. Ansatte melder seg på åpne vakter selv. |
| Permer med sjekklister. Temperaturlogger på papir. Mattilsynet = stress.                  | Digital HACCP med tidsstempling, push-varsler og dokumentasjon klar på sekunder.          |
| Opplæring skjer muntlig mellom service. Ingen vet hvem som kan hva.                       | Styrt opplæring via appen. Kunnskapstester bekrefter at de kan stoffet.                   |
| WhatsApp-grupper for alt. Beskjeder forsvinner i støyen.                                  | Teamchat med kanaler, walkie-talkie, video og overlevering mellom skift.                  |
| 4–5 separate systemer. Ingenting snakker sammen.                                          | Én plattform. Én innlogging. Alt på ett sted.                                             |

---

## S14: AI-seksjon — Mr. Botsson (universell)

- **H2:** En kollega som aldri glemmer noe.
- **Body:** Mr. Botsson kjenner restauranten din. Han guider nyansatte gjennom opplæringen, svarer på spørsmål om rutiner og varsler deg når noe trenger oppmerksomhet. Han snakker norsk, svensk og engelsk — og tilpasser seg rollen til den han snakker med.
- **CTA:** Start gratis nå → /signup

**Chat-mockup:**

| Rolle   | Melding                                                                                             |
| ------- | --------------------------------------------------------------------------------------------------- |
| Bruker  | Hvem kan ta vakten til Jonas på fredag?                                                             |
| Botsson | Maria og Thomas er tilgjengelige. Maria har flest timer fri denne uken. Skal jeg sende forespørsel? |
| Bruker  | Send til Maria.                                                                                     |
| Botsson | Sendt. Maria har 30 minutter på å svare.                                                            |

---

## S15: Norsk (universell)

- **H2:** Laget for norsk drift.

| Ikon | Tittel                        | Tekst                                                                     |
| ---- | ----------------------------- | ------------------------------------------------------------------------- |
| 📜   | Riksavtalen innebygd          | Tillegg, overtid og hviletid beregnes automatisk etter gjeldende avtaler. |
| 🌡️   | HACCP etter Mattilsynets krav | Temperaturlogging, CCP-kontroll og avvikshåndtering i tråd med norsk lov. |
| 🇳🇴   | Norsk språk, norske brukere   | Ikke oversatt fra engelsk. Bygget her, for dere.                          |

---

## S16: Kundebevis (bransjevariant)

### Restaurant

| Sitat                                                                                                              | Rolle        | Selskap     |
| ------------------------------------------------------------------------------------------------------------------ | ------------ | ----------- |
| Vi gikk fra fem systemer til ett. Vaktplan, opplæring og HACCP — alt på samme sted. Det sparer oss timer hver uke. | Daglig leder | Brasserie K |
| Nyansatte får opplæring via appen før de møter opp. Første dag handler om gjestene, ikke om å forklare rutiner.    | Driftssjef   | Café Sør    |
| Lønnskostnadene gikk ned 12% fordi vi endelig ser hva en uke koster mens vi planlegger.                            | Eier         | Gastro Bar  |

_(Hotell, kafé og bar-testimonialer skrives når ekte kunder finnes.)_

---

## S17: Prisforhåndsvisning (universell)

- **H2:** Ubegrenset antall ansatte. Alltid.
- **Body:** De fleste systemer tar betalt per ansatt — og straffer deg for å vokse. Smartout tar en flat månedspris. Ansett ringevikarer, sesongarbeidere og nye folk uten å tenke på lisenskostnader.

| Tier     | Pris                | Highlights                                                     |
| -------- | ------------------- | -------------------------------------------------------------- |
| Free     | 0,- (alltid gratis) | Vaktplan · Stemplingsur · Teamchat · Grunnleggende nettside    |
| Standard | 995,-/mnd           | + HACCP · Opplæring · Driftsøkter · Sesong · Standard nettside |

**Link:** "Se alle planer →" → /pricing

---

## S18: Gründerens ord (universell)

- **Label:** Hvorfor vi bygger dette
- **H2:** Vi bygger det ingen andre ville bygge.

> Jeg har jobbet i restaurantbransjen i 20 år. Jeg vet hvordan det føles å sitte med Excel-planen søndag kveld, å ringe fire stykker for å dekke et hull, å grave etter temperaturlogger når Mattilsynet banker på.

> Det finnes vaktplanleggere. Det finnes HACCP-apper. Det finnes oppgavelister. Men ingen samler alt. Smartout gjør det — fordi restauranten din ikke fungerer i separate systemer.

> Bygget i Norge, for norsk drift. Av folk som kjenner bransjen.

— Pontus, Gründer, Smartout

---

## S19: Avsluttende CTA (persona-variant)

### Owner (default)

- **H2:** Klar for å prøve?
- **Subtitle:** Gratis oppstart. Ingen kredittkort. Sett opp restauranten din på 15 minutter — med AI-hjelp.
- **CTA:** Start gratis nå → /signup

### Manager

- **H2:** Prøv Smartout i din avdeling
- **Subtitle:** Del lenken med sjefen din — eller start selv med gratisversjonen.
- **CTA:** Start gratis nå → /signup

### HR

- **H2:** Kutt onboarding-tiden i to
- **Subtitle:** Se hvordan Smartout digitaliserer opplæring og compliance.
- **CTA:** Book en demo → /demo

---

## Prisside (`/pricing`)

### Header

- **Badge:** Enkel og forutsigbar
- **H1:** Flat pris. Ubegrenset ansatte.
- **Body:** Andre systemer tar betalt per ansatt og straffer deg for å vokse. Smartout har en flat månedspris — uansett om du har 10 eller 100 på lønningslista.

### Planer

| Tier       | Pris        | Beskrivelse                                         | Features                                                                                                                      |
| ---------- | ----------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Free       | 0,-         | Alt for grunnleggende drift. Ingen tidsbegrensning. | Ubegrenset ansatte · Vaktplan og stemplingsur · Teamchat og varsler · Grunnleggende nettside · Ansattoversikt og kontrakter   |
| Standard   | 995,-/mnd   | Full plattform med HACCP, opplæring og drift.       | + Temperaturlogging og HACCP · Styrt opplæring med tester · Driftsøkter med signering · Sesongplanlegging · Standard nettside |
| Pro        | 2 500,-/mnd | Høyere tempo, flere lokasjoner.                     | + AI-assistert vaktplanlegging · Avansert rapportering · Flerlokasjonsstyring · Lønnsberegning med tariff · Avansert nettside |
| Enterprise | Tilpasset   | Kjeder og spesialbehov.                             | + Ubegrenset lokasjoner · SAML/enterprise auth · Dedikert kontakt · API · Flersidig nettside                                  |

### Konkurrentsammenligning

**Vs. Planday/Tidsbanken:** Per ansatt-pris som straffer vekst. Smartout: alt-i-ett, flat pris, ubegrenset ansatte.

**Vs. eSmiley:** Isolert HACCP-system. Smartout: HACCP i samme app som vaktplan og kommunikasjon.

**Free erstatter regnearket:** Vaktplan, stemplingsur, teamchat — gratis for alltid. Ingen prøveperiode. Oppgrader ved behov.

---

## Free Forever (`/free-forever`)

- **Badge:** Ingen tidsbegrensning. Ingen kredittkort.
- **H1:** Vaktplan og stemplingsur. Gratis. For alltid.
- **Subtitle:** Smartout Free gir deg det du trenger for å erstatte Excel og WhatsApp — uten å betale en krone.
- **CTA:** Start gratis nå · Se hva som er inkludert

**FAQ:**

| Spørsmål                     | Svar                                                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Er Smartout virkelig gratis? | Ja. Free inkluderer vaktplan, stemplingsur og teamchat — uten tidsbegrensning. Oppgrader for HACCP og opplæring. |
| Forskjell Free vs. Standard? | Free = vaktplan + chat. Standard = + HACCP + opplæring + driftsøkter + sesong + nettside.                        |
| Bindingstid?                 | Nei. Oppgrader, nedgrader eller avslutt når som helst.                                                           |
| Fungerer på mobil?           | Ja. Ansatte bruker mobil. Ledere planlegger på desktop. Begge fungerer fullt.                                    |

---

## Om Oss (`/om-oss`)

- **Badge:** Historien bak
- **H1:** 20 år i bransjen. 4 år med å bygge løsningen.

> Jeg har stått bak bardisken, planlagt vakter på papir og ringt rundt søndag kveld for å dekke hull. I 20 år.

> De siste fire årene har vi bygget Smartout. Vi har gjort feil, tapt kunder og startet på nytt. Fordi det vi bygger er vanskelig — å samle alt i ett system.

> Teknologien har endelig tatt igjen visjonen. AI gjør det mulig å bygge verktøyet vi alltid trengte.

— Pontus, Gründer

**Verdier:**

- 🎯 Hver ting på rett sted — Hvert minutt spart på admin er et minutt mer til gjestene.
- 🛡️ Alltid klar for tilsyn — Dokumentasjon som holder seg oppdatert selv.
- ❤️ Bygget for folk, ikke mot dem — Teknologi for mestring, ikke kontroll.

---

## Blogg (`/blog`)

- **H1:** Historier fra norsk restaurantdrift.

| #   | Tittel                                                 | Rolle          | Status |
| --- | ------------------------------------------------------ | -------------- | ------ |
| 1   | Vaktplanen tok 3 timer. Nå tar den 20 minutter.        | Daglig leder   | Klar   |
| 2   | Mattilsynet kom. Vi var klare på 30 sekunder.          | Driftsjef      | Klar   |
| 3   | 40% lavere turnover etter vi digitaliserte opplæringen | HR-ansvarlig   | Kommer |
| 4   | Fra 5 apper til 1 — og endelig oversikt                | Eier           | Kommer |
| 5   | Hvordan vi halverte onboarding-tiden                   | Restaurantsjef | Kommer |
| 6   | 12% lavere lønnskostnad                                | Kjøkkensjef    | Kommer |

---

## Feature-sider

### Vaktplan (`/features/shiftplanner`)

- **H1:** Vaktplan med innebygd lønnskalkulator
- **Subtitle:** Drag-and-drop planlegging. Sanntids lønnskostnad. Norske tillegg beregnet automatisk.

### HACCP (`/features/haccp-complience`)

- **H1:** HACCP og internkontroll
- **Subtitle:** Temperaturlogging, avvikshåndtering og renhold — digitalt og tidsstemplet.

### Opplæring (`/features/staff-training`)

- **H1:** Opplæring og kompetanse
- **Subtitle:** Kunnskapstester, prosedyregjennomgang og beredskapspoeng — i appen.

### Kommunikasjon (`/features/communications`)

- **H1:** Chat, walkie-talkie og video for restaurant
- **Subtitle:** All kommunikasjon i én app. Push-to-talk, videostrøm, AI-handoff.

### Sjekklister (`/concepts/procedures`)

- **H1:** Sjekklister og rutiner
- **Subtitle:** Alt som skal gjøres — standardisert, tildelt og sporbart.

### Driftsøkt (`/concepts/daily-session`)

- **H1:** Daglig driftsøkt
- **Subtitle:** Sjekklister, oppgaver og overlevering fra åpning til stenging.

### Sesonger (`/concepts/seasons`)

- **H1:** Sesongplanlegging
- **Subtitle:** Bytt mellom sommer og vinter med ett klikk. Budsjett ned til timenivå.

### Nettside (`/concepts/website`)

- **H1:** Gratis nettside for restauranten
- **Subtitle:** Automatisk oppdatert med åpningstider, menyer og events fra Smartout.
