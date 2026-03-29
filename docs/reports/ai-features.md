---
title: AI-funksjoner i Smartout
status: done
updated: 2026-03-28
created: 2026-03-28
module: ai
tags: [ai, features, time-savings, botsson, capabilities]
---

# AI-funksjoner i Smartout

Alt du trenger å vite om hva AI-en gjør, hvordan den fungerer, og hvor mye tid den sparer.

---

## Oversikt

Smartout har **15 AI-drevne funksjoner** fordelt på tre lag:

| Lag                 | Hva                                                  | Eksempler                                           |
| ------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| **Stemmeagent**     | Samtalebasert AI som guider brukere gjennom oppgaver | Onboarding-wizard, vaktassistent, HMS-inspeksjon    |
| **Bakgrunnsmotor**  | Automatisering som kjører uten brukerinput           | Event Engine, Guardian, kunnskapsindeksering        |
| **Beregningsmotor** | Ren matematikk og regelmotor                         | Cascade-planlegging, sesongberegning, tariffoppslag |

---

## 1. Onboarding-wizard (Botsson)

### Hva den gjør

Stemmebasert oppsett av hele arbeidsplassen. Botsson intervjuer deg og fyller inn data mens dere snakker — ingen skjemaer å fylle ut manuelt.

### Hvordan den fungerer

- Du starter en samtale med Botsson via mikrofonen
- Han spør om bedriften din, avdelinger, rutiner, kontrakter
- Mens du snakker, søker han opp bedriften i Brønnøysund (Brreg), foreslår avdelinger basert på bransje (NACE-kode), og fyller inn skjemaet i sanntid
- 8 steg: Identitet → Sesong → Avdelinger → Lokasjoner → Soner → Prosedyrer → Kontrakt → Aktivering
- Arbeidsflyt: Forstå → Foreslå → Bekreft. Aldri leser et manus.

### Hva den hjelper med

- Eliminerer 2–4 timer manuell oppsett av arbeidsplassen
- Sørger for at bransjestandard rutiner og prosedyrer er på plass fra dag 1
- Reduserer feil — AI validerer data underveis

### Estimert tidsbesparelse

| Uten Smartout             | Med Smartout                  | Spart                     |
| ------------------------- | ----------------------------- | ------------------------- |
| 3–5 timer manuelt oppsett | 15–30 min samtale med Botsson | **~3 timer per oppstart** |

---

## 2. Daglig AI-assistent (Mr. Botsson)

### Hva den gjør

Personlig AI-assistent i dashboardet som kjenner rollen din, teamet, vakten din og hele historikken mellom dere. Svarer på spørsmål, gir innsikt, og hjelper med daglige oppgaver.

### Hvordan den fungerer

- Kontekstmotor laster: din profil, aktiv vakt, teamdata, readiness-status, samtalehistorikk
- Personligheten tilpasser seg etter rolle (trainee → varmere, eier → mer direkte), situasjon (HMS → presis, vaktplanlegging → løsningsorientert), og relasjonsnivå (nye brukere → mer forklarende)
- 5 personlighetsdimensjoner: formalitet, tydelighet, varme, humor, ordrikhet
- Forstår konteksten din uten at du forklarer bakgrunnen

### Hva den hjelper med

- Slipper å lete etter info — spør Botsson direkte
- Får svar tilpasset din rolle og kompetanse
- Raskere beslutninger med kontekstbasert innsikt

### Estimert tidsbesparelse

| Uten Smartout                                | Med Smartout            | Spart                      |
| -------------------------------------------- | ----------------------- | -------------------------- |
| 15–30 min/dag lete etter info, sjekke status | Spør → svar på sekunder | **~2 timer/uke per leder** |

---

## 3. Vaktassistent

### Hva den gjør

AI som hjelper med å bygge, optimalisere og publisere vaktplaner. Forstår dekningsgrad, overtid, tariff og tilgjengelighet.

### Hvordan den fungerer

- Kobler direkte til vaktplanmotoren (shift-mcp) med 8 verktøy: hent plan, sjekk dekning, opprett/endre/slett vakter, navigér UI
- Arbeidsflyt: FORSTÅ → UNDERSØK → FORESLÅ → UTFØR → BEKREFT
- Sjekker automatisk mot arbeidstidsregler, tariffavtaler og tilgjengelige ansatte
- Viser dekningsgap og overtidsrisiko før du publiserer

### Hva den hjelper med

- Eliminerer timer med puslespill rundt bemanning
- Reduserer overbemanning (og dermed lønnskostnader)
- Sikrer at lovkrav og tariffavtaler følges automatisk

### Estimert tidsbesparelse

| Uten Smartout                         | Med Smartout                | Spart                        |
| ------------------------------------- | --------------------------- | ---------------------------- |
| 2–4 timer/uke manuell vaktplanlegging | 15–30 min med AI-assistanse | **~2–3 timer/uke**           |
| 10–15% overbemanning (typisk)         | Optimalisert bemanning      | **~10–15% lavere lønnskost** |

---

## 4. HMS / HACCP-inspektør

### Hva den gjør

Stemmebasert guide for temperaturkontroll, avviksregistrering og renholdssjekker. Presis og deterministisk — ingen kreative svar her.

### Hvordan den fungerer

- Temperatur: 0.2 (lavest mulig kreativitet — ren faktabasert)
- Guider deg gjennom: Visuell sjekk → Temperaturregistrering → Signatur
- Dokumenterer alt automatisk i systemet
- Sender push-varsler til rett person på rett tid

### Hva den hjelper med

- All dokumentasjon klar når Mattilsynet kommer
- Ansatte trenger ikke huske hva som skal sjekkes — systemet minner dem på det
- Avvik registreres med mobilkamera direkte i appen

### Estimert tidsbesparelse

| Uten Smartout                          | Med Smartout                 | Spart                      |
| -------------------------------------- | ---------------------------- | -------------------------- |
| 30–60 min/dag papirbaserte sjekklister | 10–15 min guidede sjekker    | **~3 timer/uke**           |
| Dager å forberede Mattilsyn-besøk      | Alltid klar — 0 forberedelse | **~8–16 timer per tilsyn** |

---

## 5. Kunnskapsmotor (RAG)

### Hva den gjør

AI som kan svare på spørsmål om bedriftens egne dokumenter — håndbøker, policyer, prosedyrer, rutiner.

### Hvordan den fungerer

- Innholdshåndtering: Henter håndbokkapitler, policyer, protokoller (TipTap JSON)
- Chunking: Deler opp tekst etter overskrifter (~4800 tegn per chunk)
- Embeddings: Genererer vektorrepresentasjoner (text-embedding-3-small)
- Lagring: pgvector i `workspace_doc_chunk` (arbeidsplasskoplet, RLS-beskyttet)
- Søk: Semantisk likhetssøk — returnerer topp 5 relevante seksjoner

### Hva den hjelper med

- Ansatte finner svar uten å spørre lederen
- Nye ansatte kan lære seg rutiner selv via AI
- Reduserer "Har du lest håndboken?"-spørsmål dramatisk

### Estimert tidsbesparelse

| Uten Smartout                             | Med Smartout               | Spart                        |
| ----------------------------------------- | -------------------------- | ---------------------------- |
| 5–10 min per spørsmål (lete i permer/PDF) | Spør AI → svar på sekunder | **~1 time/uke per ansatt**   |
| 30 min/dag for leder å svare på spørsmål  | AI svarer automatisk       | **~2,5 timer/uke per leder** |

---

## 6. Cascade-planleggingsmotor

### Hva den gjør

Beregner vaktforslag, sjekker tariff, håndhever arbeidsmiljøloven og løser budsjettmål ned til timenivå.

### Hvordan den fungerer

- 6 dimensjoner: Driftsenvelop (D1) → Ressurser (D2) → Regler (D3) → Etterspørsel (D4) → Konsept (D5) → Produksjon (D6)
- 4 kontrollplan: Kalibrering (C1), Interaksjon (C2), Kommersiell (C3), Governance (C4)
- Ren matematikk (pure functions) — ingen AI-hallusinasjoner
- Beregner: effektive timer, skiftplassering, regeletterlevelse, tariffoppslag, budsjettfordeling

### Hva den hjelper med

- Automatisk overholdelse av Riksavtalen og lokale tariffer
- Budsjett fordelt riktig på dager og timer
- Avvik mellom plan og faktisk fanges automatisk

### Estimert tidsbesparelse

| Uten Smartout                             | Med Smartout           | Spart              |
| ----------------------------------------- | ---------------------- | ------------------ |
| Regneark + kalkulator for tariffberegning | Automatisk             | **~1–2 timer/uke** |
| Manuell budsjettkontroll                  | Sanntids avviksrapport | **~1 time/uke**    |

---

## 7. Sesongplanlegging

### Hva den gjør

Fordeler årsbudsjett ned til sesonger, ukedager og timer. Beregner nøyaktig bemanning basert på forventet omsetning.

### Hvordan den fungerer

- Dagsmål: `dagsmål = daglig_base × (ukedagsfaktor / snittfaktor)`
- Timemål: Fordeler dagsmål etter timefaktorer (lunsjrush, middagsrush)
- Bemanningsbehov: `ansatte = (timemål × lønnsandel%) / snitttimelønn`
- Bytt fra "rolig vintersesong" til "hektisk sommer" med ett klikk

### Hva den hjelper med

- Slutt med å gjette bemanning — tall styrer
- Rask omstilling mellom sesonger
- Optimaliserer lønnskostnader mot omsetning

### Estimert tidsbesparelse

| Uten Smartout                          | Med Smartout      | Spart                           |
| -------------------------------------- | ----------------- | ------------------------------- |
| 4–8 timer sesongplanlegging i regneark | 30 min i Smartout | **~4–7 timer per sesongskifte** |

---

## 8. Event Engine (hendelsesmotor)

### Hva den gjør

Fanger opp hendelser i systemet — fravær, vaktbytter, avvik, godkjenninger — og ruter dem til rett person med rett handling.

### Hvordan den fungerer

- Prosessblåkopi (`engine_process`) → Live instans (`engine_state`) → Steg-sporing (`engine_state_step`)
- Handlingstyper: `wait_for_event`, `assign_task`, `send_notification`, `update_entity`, `create_deviation`, `validate_settlement`, `start_process`, `upsert_session`
- Betingelseslogikk: match, step_status, all/any
- Cascade produserer hendelser → Event Engine konsumerer dem

### Hva den hjelper med

- Ingenting faller mellom sprekkene
- Rett varsel, i rett kanal, til rett person
- Automatiserer godkjenningsflyter som tidligere krevde manuell oppfølging

### Estimert tidsbesparelse

| Uten Smartout                               | Med Smartout                      | Spart              |
| ------------------------------------------- | --------------------------------- | ------------------ |
| 30–60 min/dag jage folk for svar/signaturer | Automatiske varsler og eskalering | **~3–5 timer/uke** |

---

## 9. Guardian (vaktpost)

### Hva den gjør

Overvåker arbeidsplassens helse — readiness-score, etterlevelse, dekningsgap, avvik. Sender signaler til ledere og AI-agenter.

### Hvordan den fungerer

- Overvåker: readiness-gap, compliance-avvik, vaktplankonflikter
- Sender signaler til `guardian_signal` og `guardian_log`
- AI-agenter kan reagere autonomt (innenfor autorisasjonsnivå)
- Periodisk sweep rydder opp i utdaterte signaler

### Hva den hjelper med

- Proaktiv varsling — problemer fanges før de eskalerer
- Leder trenger ikke sjekke manuelt — systemet sier fra
- Full audit trail for etterlevelse

### Estimert tidsbesparelse

| Uten Smartout                     | Med Smartout        | Spart               |
| --------------------------------- | ------------------- | ------------------- |
| 1–2 timer/dag manuell statussjekk | Automatiske varsler | **~5–10 timer/uke** |

---

## 10. Reiseassistent (Journey Engine)

### Hva den gjør

Guider brukere gjennom komplekse flerstegs-prosesser — onboarding av ansatte, opplæring, forfremmelser, sesongstart.

### Hvordan den fungerer

- PM-vennlige reisedefinisjoner: tittel, steg, forventede data, bekreftelseskrav
- Journey Compiler konverterer definisjoner → engine_process + engine_steps + engine_trigger
- Botsson guider gjennom hvert steg med stemme
- Guardian evaluerer datakomplettering og avanserer automatisk når klart
- Støtter obligatorisk bekreftelse (`required_confirmation`)

### Hva den hjelper med

- Komplekse prosesser blir enkle — AI guider steg for steg
- Reduserer opplæringstid for nye ledere
- Sikrer at ingen steg hoppes over

### Estimert tidsbesparelse

| Uten Smartout                      | Med Smartout             | Spart                       |
| ---------------------------------- | ------------------------ | --------------------------- |
| 2–4 timer onboarding per ny ansatt | 30–60 min guidet prosess | **~2–3 timer per nyansatt** |

---

## 11. Rapportassistent

### Hva den gjør

AI-guidet rapportbygging i 7 steg. Velg datakilde, metrikker, gruppering, filter, visualisering — forhåndsvis og lagre.

### Hvordan den fungerer

- 7-stegs wizard: Datakilde → Metrikker → Gruppering → Filter → Visualisering → Forhåndsvisning → Lagre
- AI foreslår relevante metrikker basert på datakilde
- Forhåndsvisning før lagring

### Hva den hjelper med

- Ledere trenger ikke kunne Excel eller SQL
- Raskere innsikt i drift, lønnskostnader, bemanning

### Estimert tidsbesparelse

| Uten Smartout                      | Med Smartout           | Spart                      |
| ---------------------------------- | ---------------------- | -------------------------- |
| 1–2 timer bygge rapport i regneark | 10–15 min med AI-guide | **~1–2 timer per rapport** |

---

## 12. Kontraktassistent

### Hva den gjør

AI som hjelper med å bygge og redigere arbeidskontrakter. Sjekker mot norsk lov (Avtaleloven, GDPR).

### Hvordan den fungerer

- Leser, redigerer, validerer kontraktmaler
- Støtter plassholdere (`{{variabel}}`)
- Viser endringer som diff (grønn/rød)
- Klausulbibliotek med søk
- Automatisk signaturfelthåndtering

### Hva den hjelper med

- Kontrakter som faktisk er juridisk korrekte
- Slipper advokattimer for standardkontrakter
- Raskere ansettelsesprosess

### Estimert tidsbesparelse

| Uten Smartout                    | Med Smartout     | Spart                    |
| -------------------------------- | ---------------- | ------------------------ |
| 30–60 min per kontrakt (manuelt) | 10–15 min med AI | **~30 min per kontrakt** |

---

## 13. Brreg-integrasjon (bedriftsoppslag)

### Hva den gjør

Slår opp bedrifter i Brønnøysundregistrene automatisk under onboarding.

### Hvordan den fungerer

- Søker på bedriftsnavn + sted
- Henter: org.nr, bransje (NACE-kode), antall ansatte, daglig leder
- NACE-koden brukes til å foreslå avdelinger, prosedyrer og tariffavtaler

### Hva den hjelper med

- Ingen manuell innlegging av bedriftsdata
- Bransjetilpassede forslag fra første sekund

### Estimert tidsbesparelse

| Uten Smartout                   | Med Smartout           | Spart                    |
| ------------------------------- | ---------------------- | ------------------------ |
| 15–30 min søke opp og taste inn | Automatisk på sekunder | **~20 min per oppstart** |

---

## 14. Dokumentanalyse

### Hva den gjør

Trekker ut strukturert data fra opplastede PDF-er og bilder (menyer, kontrakter, ansattlister, rutiner).

### Hvordan den fungerer

- Last opp fil → Scrapling-tjenesten trekker ut tekst/bilder
- Claude analyserer innholdet
- Returnerer strukturert data: policyer, lønnsprofiler, ansattlister, vaktdata, håndbokseksjoner
- Lagres direkte i workspace-oppsettet

### Hva den hjelper med

- Slipper å taste inn data fra eksisterende dokumenter
- Raskere migrasjon fra gamle systemer

### Estimert tidsbesparelse

| Uten Smartout                                 | Med Smartout            | Spart                       |
| --------------------------------------------- | ----------------------- | --------------------------- |
| 1–3 timer manuell datainntasting per dokument | Minutter med AI-analyse | **~1–3 timer per dokument** |

---

## 15. Lederpuls (daglig sammendrag)

### Hva den gjør

Kompilerer daglige/ukentlige ledersammendrag — hva skjedde, avvik, KPI-trender, viktige hendelser.

### Hvordan den fungerer

- Henter: sesjonnotater, overlevering, nøkkelhendelser, KPI-trender per avdeling
- Genererer sammendrag per leder
- Leveres via push eller i dashboardet

### Hva den hjelper med

- Ledere starter dagen med full oversikt uten å lese 10 rapporter
- Fokuserer på det som faktisk krever oppmerksomhet

### Estimert tidsbesparelse

| Uten Smartout                    | Med Smartout          | Spart                        |
| -------------------------------- | --------------------- | ---------------------------- |
| 30–60 min morgenrutine for leder | 2 min lese sammendrag | **~3–5 timer/uke per leder** |

---

## Samlet tidsbesparelse

### Per rolle, per uke

| Rolle                            | Funksjoner som brukes mest                              | Estimert ukentlig besparelse |
| -------------------------------- | ------------------------------------------------------- | ---------------------------- |
| **Daglig leder / Eier**          | Sesong, rapporter, guardian, lederpuls, budsjett        | **8–15 timer/uke**           |
| **Driftsleder / Restaurantsjef** | Vaktplan, HMS, event engine, daglig assistent, guardian | **10–18 timer/uke**          |
| **Avdelingsleder / Skiftleder**  | Vaktplan, HMS, kommunikasjon, daglig assistent          | **5–10 timer/uke**           |
| **Ansatt**                       | Kunnskapsmotor, reiseassistent, daglig assistent        | **1–3 timer/uke**            |

### Per bedriftsstørrelse

| Bedriftsstørrelse      | Estimert total besparelse | Tilsvarer      |
| ---------------------- | ------------------------- | -------------- |
| Liten (1–10 ansatte)   | 10–20 timer/uke           | ~0,5 årsverk   |
| Medium (11–30 ansatte) | 20–40 timer/uke           | ~1 årsverk     |
| Stor (30+ ansatte)     | 40–80 timer/uke           | ~1,5–2 årsverk |

### Økonomisk effekt

| Effekt                      | Estimat                           |
| --------------------------- | --------------------------------- |
| Redusert overbemanning      | 10–15% lavere lønnskostnader      |
| Raskere onboarding          | 3+ timer spart per nyansatt       |
| Eliminert HMS-forberedelse  | 8–16 timer spart per tilsynsbesøk |
| Redusert ledertid på admin  | 50–70% mindre administrativ tid   |
| Færre systemer å betale for | Erstatter 3–5 separate verktøy    |

---

## Autorisasjonsmodell

Alle AI-funksjoner er styrt av et finkornet autorisasjonssystem:

| Nivå         | Hva AI kan gjøre                      | Eksempel                               |
| ------------ | ------------------------------------- | -------------------------------------- |
| `disabled`   | Ingen tilgang                         | Funksjon avslått                       |
| `read_only`  | Kun lese data                         | "Du har 3 vakter denne uken"           |
| `suggest`    | Foreslå handlinger — bruker bekrefter | "Skal jeg opprette vakt for Maria?"    |
| `confirm`    | Utfører etter eksplisitt bekreftelse  | "Vakt opprettet. Bekreft publisering." |
| `autonomous` | Utfører selv innenfor rammer          | Auto-varsler ved avvik                 |

Konfigureres per arbeidssted, per kapabilitet. Full audit trail i AI Event Log.

---

## Sikkerhet og transparens

- **Ingen data lekker mellom arbeidsplasser** — Row Level Security på alt
- **Alle AI-beslutninger logges** — guardian_event med tidspunkt, aktør, handling, detaljer
- **Destruktive handlinger krever bekreftelse** — slett, publiser, fullfør
- **Norsk språk som standard** — med engelsk fallback
- **Modell:** Claude Sonnet 4 (tekst/resonnering), Ultravox Mark (stemme)
