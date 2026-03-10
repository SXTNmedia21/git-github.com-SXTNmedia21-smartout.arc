---
title: "Systemguide Gap Analysis — K-base vs. Systemguide"
status: review
updated: 2026-03-05
created: 2026-03-05
module: meta
tags: [gap-analysis, systemguide, kbase, audit, truth]
---

# Systemguide Gap Analysis

> **Premiss:** [docs/smartout-systemguide.md](smartout-systemguide.md) er sann. Den beskriver _hva systemet skal være_. Denne rapporten identifiserer alt i k-basen (docs/ og modul-filer) som sier noe annet, er ufullstendig, eller som aktivt motsier systemguiden.

**Metode:** Systematisk gjennomgang av alle relevante modul-filer, arkitekturdokumenter og referansefiler mot hver seksjon i systemguiden.

**Scoring:**

- **Confidence (1-10):** Sikkerhet for at avviket er reelt (10 = dokumentert bevis)
- **Impact (1-10):** Hvor mye gjør dette systemguiden "ikke sann" i praksis (10 = direkte feil, 1 = kosmetisk)

---

## Sammendrag

| ID   | Seksjon i Systemguide         | Avvikstype                                         | Confidence | Impact |
| ---- | ----------------------------- | -------------------------------------------------- | ---------- | ------ |
| G-01 | Avdelingsøkten — livssyklus   | Manglende status                                   | 9          | 5      |
| G-02 | Veikart / Reise / Protokoll   | Terminologikonflikt (kritisk)                      | 10         | 9      |
| G-03 | Vaktplanen — lønn og tillegg  | Udokumentert / DRAFT-modul                         | 9          | 9      |
| G-04 | Beredskap — styringsmodellen  | Ufullstendig tabell                                | 10         | 7      |
| G-05 | Mr. Botsson — tre agentroller | Udefinert i k-basen                                | 7          | 5      |
| G-06 | Veikart som konsept           | Konseptet finnes ikke i k-basen                    | 9          | 6      |
| G-07 | Sesongen — spillifisering     | Manglende implementasjonsdetaljer                  | 6          | 4      |
| G-08 | Avstemming — tre nivåer       | Spredt over separate moduler, motstridende framing | 7          | 4      |

---

## G-01 — Avdelingsøkten: Manglende `missed`-status

**Seksjon i systemguide:** "Øktens livssyklus"

**Systemguide sier:**

```
Kommende → Aktiv → Venter på signering → Stengt
```

**K-basen sier:**

Fra [docs/modules/SMARTOUT_MODULE_4_OPERATIONS.md](modules/SMARTOUT_MODULE_4_OPERATIONS.md):

```
status: upcoming | active | pending_signoff | closed | missed
```

Med forklaring:

> `missed` — No one showed up. No punch-ins. Flagged for review. [...] The "missed" status is critical for accountability.

**Avvik:** Systemguiden viser kun fire statuser i livssyklusen. Den femte statusen, `missed`, er fullstendig utelatt. Ifølge modul-dokumentasjonen er dette en _kritisk_ status for ansvarsstyring — et scenarie der avdelingen skulle åpnet men ingen møtte opp. Den er ikke et edge case; den er en primær operasjonell tilstand.

**Hva mangler i systemguide:** Statusen `missed` og dens konsekvenser (flagging for gjennomgang, ikke-slettet økt som forblir synlig).

| Confidence | Impact |
| ---------- | ------ |
| 9/10       | 5/10   |

_Høy confidence fordi det er eksplisitt dokumentert. Moderat impact fordi systemguiden primært er for "power users" — ikke systemadministratorer som lever i kantscenariene._

---

## G-02 — Veikart / Reise / Protokoll: Direkte terminologikonflikt

**Seksjon i systemguide:** "Veikart, Reise og Protokoll"

**Systemguide sier:**

| Perspektiv  | Navn              | Hva du ser                                    |
| ----------- | ----------------- | --------------------------------------------- |
| Oppskriften | Veikart (Roadmap) | Blueprinten — trinn, krav, rekkefølge         |
| Opplevelsen | Reise (Journey)   | Live-instansen, guidet av Botsson             |
| Oversikten  | **Protokoll**     | **Lederens blikk — status, beredskap, avvik** |

**K-basen sier:**

Fra [docs/architecture/SMARTOUT_FOUNDATION_DATA_MODEL.md](architecture/SMARTOUT_FOUNDATION_DATA_MODEL.md):

```
Governance Model:
Policy      →  "What must happen"
Protocol    →  "How we comply" (enforcement container for a Policy)
  ├── Procedure
  ├── Routine
  ├── Runbook
  ├── Control List
  ├── Knowledge Test
  └── Confirmation
```

Fra [CLAUDE.md](../CLAUDE.md):

> "policy → protocol → {procedure, routine, runbook, control_list, knowledge_test, confirmation}"

**Avvik (kritisk):** Systemguiden bruker "Protokoll" til å beskrive _lederens oversiktsperspektiv på en Journey_. I hele k-basen, i alle 17 moduler og i CLAUDE.md betyr "Protokoll" noe fundamentalt annet: det er _enforcement-containeren_ for en Policy i styringsmodellen — en konkret datastruktur som inneholder Prosedyrer, Rutiner, Runbooks og Tester.

Det er to uforenlige definisjoner av samme ord:

- **Systemguide:** Protokoll = lederens dashboardvisning av en pågående Journey
- **K-base:** Protokoll = Policy's implementasjonsenhet (datastruktur med sub-komponenter)

I tillegg eksisterer konseptet "Veikart (Roadmap)" _ikke_ som en navngitt enhet i k-basen. Journey-modulen bruker "Journey" (live-instansen) og Policy/Protocol-kjeden for blueprints — men ikke "Veikart" som begrep.

**Hva mangler i k-basen:** En klar mapping mellom systemguidens "Veikart/Reise/Protokoll"-treenighet og den faktiske datamodellen. Alternativt: systemguiden bør klargjøre at "Protokoll" her er brukt i et operativt brukerbegrep, _ikke_ det tekniske styringsmodell-begrepet.

**Konsekvens:** En administrator som leser systemguiden og deretter k-basen (eller omvendt) vil ha to motstridende mentale modeller for hva "Protokoll" betyr. Dette er en av de mest alvorlige avvikene.

| Confidence | Impact |
| ---------- | ------ |
| 10/10      | 9/10   |

_Maksimal confidence fordi begge definisjoner er eksplisitt dokumentert. Høy impact fordi "Protokoll" er et kjernebegrep brukt overalt i systemet._

---

## G-03 — Vaktplanen: Automatisk lønnsberegning er udokumentert

**Seksjon i systemguide:** "Vaktplanen — Lønn og arbeidsrettslige regler"

**Systemguide sier:**

> Lønnstillegg, overtidsregler og avspasering styres av arbeidsmiljøloven og gjeldende tariffavtaler. Smartout beregner automatisk timelønn, kveld- og nattillegg, helgetillegg og overtid — basert på hver medarbeiders ansettelsesform, avtalte timer og faktisk arbeidstid. Du legger inn vakten. Systemet regner ut lønnsgrunnlaget.

**K-basen sier:**

Fra [docs/modules/SMARTOUT_MODULE_8_PAYROLL.md](modules/SMARTOUT_MODULE_8_PAYROLL.md):

```yaml
status: draft
```

> **Status:** PLACEHOLDER — requires detailed specification

Innholdet er en liste over hva modulen _skal dekke_, men ingen spesifikasjon av:

- Tilleggssatser og regler
- Overtidsberegningslogikk
- AML-validering
- Beregningsmotor

Fra [docs/INDEX.md](INDEX.md):

```
| MODULE_08 | modules/SMARTOUT_MODULE_8_PAYROLL.md | draft | -- |
```

**Avvik:** Systemguiden presenterer automatisk lønnsberegning som en etablert, fungerende funksjon. K-basen viser at Modul 8 (Lønn & Økonomi) er et `draft`/`PLACEHOLDER`-dokument uten noen spesifisert implementasjon, datamodell eller beregningslogikk. Modul 3 (Vaktplan) har en "Lønnsgrunnlag-fane" i vaktmodalen, men selve beregningslogikken er ikke dokumentert.

**Hva mangler:** Hele spesifikasjonen for Modul 8. K-basen har ingen kilde som bekrefter at automatisk lønnsberegning eksisterer i systemet.

| Confidence | Impact |
| ---------- | ------ |
| 9/10       | 9/10   |

_Høy confidence basert på eksplisitt draft-status. Høy impact fordi lønnsberegning er presentert som en nøkkelfunksjon — ikke som fremtidig funksjonalitet._

---

## G-04 — Beredskap: Styringsmodellen er ufullstendig

**Seksjon i systemguide:** "Beredskap — Styringsmodellen"

**Systemguide sier:**

| Nivå                   | Hva det er                                                   |
| ---------------------- | ------------------------------------------------------------ |
| Retningslinje (Policy) | Et regelverk, f.eks. Mattrygghet eller Brannsikring          |
| Protokoll              | Det en ansatt må gjennomføre for å oppfylle retningslinjen   |
| Prosedyre              | Trinn-for-trinn-instruksjoner som skal læres og gjennomføres |
| Kunnskapstest          | Quiz for å verifisere forståelse                             |
| Bekreftelse            | Digital signatur: «Jeg har lest og forstått dette»           |

**K-basen sier:**

Fra [docs/architecture/SMARTOUT_FOUNDATION_DATA_MODEL.md](architecture/SMARTOUT_FOUNDATION_DATA_MODEL.md):

```
Policy → Protocol
  ├── Procedure
  ├── Routine          <- MANGLER i systemguide
  ├── Runbook          <- MANGLER i systemguide
  ├── Control List     <- MANGLER i systemguide
  ├── Knowledge Test
  └── Confirmation
```

Alle tre manglende elementer er sentrale i HACCP-modul (5) og operasjonsmodul (4):

- **Routine** — den tidsstyrte triggeren som aktiverer prosedyrer ved åpning/stenging/HACCP-intervaller
- **Runbook** — eskaleringsworkflow ved avvik (direkte nevnt i temperatur-avvikshåndtering)
- **Control List** — verifikasjonsliste som bekrefter at rutiner er fulgt

**Avvik:** Systemguiden presenterer styringsmodellen med 5 elementer. Den fullstendige modellen i k-basen har 8 (Policy + Protocol + 6 sub-typer). De tre utelatte elementene er ikke perifere — de driver kjernelogikken i HACCP (Module 5) og avdelingsøkter (Module 4).

**Merk:** Dette er en _forenkling_, ikke en feil. For et power-user-dokument er det forståelig. Men det mangler de tre typene som er mest relevante for daglig drift (Routine, Runbook) og for Mattilsynet-compliance (Control List).

| Confidence | Impact |
| ---------- | ------ |
| 10/10      | 7/10   |

_Maksimal confidence: begge modeller er eksplisitt dokumentert. Moderat-høy impact fordi den forenklede modellen er teknisk sett unøyaktig, selv om den er pedagogisk grei._

---

## G-05 — Mr. Botsson: Tre agentroller er udefinert i k-basen

**Seksjon i systemguide:** "Mr. Botsson — den digitale kollegaen"

**Systemguide sier:**

> - **Botsson (onboarding-agenten)** — driver oppsettsintervjuet når en ny arbeidsplass konfigureres
> - **Mr. Botsson (den daglige assistenten)** — dashboard-hjelpen i hverdagen
> - **Spesialagenter** — HACCP-inspektøren, vaktassistenten og andre kontekstspesifikke stemmer

**K-basen sier:**

Fra [docs/modules/SMARTOUT_MODULE_12_AI.md](modules/SMARTOUT_MODULE_12_AI.md):

```yaml
status: draft
```

> **Status:** PLACEHOLDER — requires detailed specification

Modulen beskriver 8 AI-motorer men definerer ikke eksplisitt de tre persona-rollene fra systemguiden. "Botsson" og "Mr. Botsson" brukes om hverandre i all dokumentasjon som ett enkelt konsept.

**Avvik:** Systemguiden introduserer et distinkt skille mellom:

1. "Botsson" (kun onboarding-setup-agent)
2. "Mr. Botsson" (daglig assistent)
3. "Spesialagenter" (kontekstspesifikke)

K-basen støtter ikke dette skillet eksplisitt. Modul 12 er et PLACEHOLDER-dokument. I andre moduler brukes "Mr. Botsson" som én enhet for alle AI-funksjoner — ingen dokumentasjon skiller på "Botsson" vs "Mr. Botsson" som separate personae med ulike roller.

**Viktig kontekst:** ADR-0042 (agent architecture) og `architecture/agent-framework.md` kan inneholde mer, men de er ikke lest. Confidence er justert ned for dette.

| Confidence | Impact |
| ---------- | ------ |
| 7/10       | 5/10   |

_Noe lavere confidence fordi agent-arkitektur-dokumenter kan inneholde mer. Moderat impact — navneskillet har ingen teknisk konsekvens, men er pedagogisk viktig for brukere som forventer tre separate hjelpere._

---

## G-06 — "Veikart" som konsept eksisterer ikke i k-basen

**Seksjon i systemguide:** "Veikart, Reise og Protokoll"

**Systemguide sier:**

> Dette kalles et **Veikart (Roadmap)** — blueprinten som definerer hva som skal skje, i hvilken rekkefølge og med hvilke krav.

**K-basen sier:**

"Veikart" som et navngitt konsept finnes ikke i k-basen. K-basen bruker:

- **Journey** (live-instans av en arbeidsflyt, fra `modules/journey/`)
- **Protocol/Procedure** (blueprints og templates i styringsmodellen)
- **Roadmap** (kun i ADR-0031 om "journey portal system")

Fra [docs/INDEX.md](INDEX.md) om Journey-moduler:

> `JOURNEY_DEEP_SPEC | modules/journey/SMARTOUT_JOURNEY_DEEP_SPEC.md | in_progress`

Journey-spesifikasjonen bruker "journey" for live-instansen men ikke "Veikart" for blueprints. Blueprints kalles implisitt Protocol/Procedure-kjeden.

**Avvik:** Systemguiden introduserer "Veikart" som det norske brukerterminus for blueprint-laget. Dette begrepet finnes ikke i noen modul-fil, referansefil eller arkitekturdokument i k-basen. Dersom dette er et planlagt brukergrensesnitt-begrep, er det ikke dokumentert som det.

| Confidence | Impact |
| ---------- | ------ |
| 9/10       | 6/10   |

_Høy confidence fordi "Veikart" er gjennomgående absent fra k-basen. Moderat impact — dette er primært et terminologisk gap, ikke et funksjonelt gap._

---

## G-07 — Sesongen: Gamification er udokumentert

**Seksjon i systemguide:** "Spillifisering og anerkjennelse"

**Systemguide sier:**

> Sesongen har egne poängregler og ledertavler. Medarbeidere samler poeng gjennom perioden for utført arbeid, kompetanseutvikling og tilstedeværelse. God jobb blir synlig — ikke bare for ledelsen, men for hele teamet.

**K-basen sier:**

Fra [docs/modules/SMARTOUT_MODULE_15_SEASON_PLANNING.md](modules/SMARTOUT_MODULE_15_SEASON_PLANNING.md):

- Gamification nevnes som en dimensjon av Season men er ikke spesifisert i Modul 15.

Fra [docs/modules/SMARTOUT_MODULE_6_TRAINING.md](modules/SMARTOUT_MODULE_6_TRAINING.md):

- Gamification for treningsaktiviteter er beskrevet med eksempel-poengverdier (10 poeng per prosedyre, 25 per test, etc.)

Fra [docs/modules/SMARTOUT_MODULE_4_OPERATIONS.md](modules/SMARTOUT_MODULE_4_OPERATIONS.md):

- Gamification er nevnt som en integrert del av avdelingsøktene.

**Avvik:** Systemguiden presenterer sesongens gamification-lag som en ferdig og klar funksjon. K-basen har ingen dedikert gamification-modul eller fullstendig spesifikasjon for poengregeler, ledertavler, eller synlighetslogikk for hele teamet. Gamification-logikken er spredt som referanser i ulike moduler uten en samlet kilde til sannhet.

**Merk:** `gamification_config.rules_json` er nevnt i Modul 6, men ingen gamification-spesifikasjon eksisterer på modul-nivå.

| Confidence | Impact |
| ---------- | ------ |
| 6/10       | 4/10   |

_Moderat confidence fordi gamification-referanser finnes i k-basen, men samlet spesifikasjon mangler. Lav-moderat impact fordi dette er mer et dokumentasjonsgap enn en funksjonell feil._

---

## G-08 — Avstemming: Framing vs. arkitektur

**Seksjon i systemguide:** "Avstemming — den digitale avleveringen"

**Systemguide sier:** Tre nivåer:

1. **Personalets daglige handoff** — strukturert sjekkpunkt ved dagslutt
2. **Administratorens dagavstemmning** — neste dag, bekrefter avvik og omsetning
3. **Uke- og månedsoversikt** — automatisk bygget fra daglige registreringer

**K-basen sier:**

Disse tre nivåene er dekket av _tre separate moduler_:

- Nivå 1 → **Module 4** (Department Session sign-off, `pending_signoff → closed`)
- Nivå 2 → **Module 4.5** (Daily Financial Close Engine — "Sättelfunktion") — inkluderer AI-verifisert finansielt avslutning, OCR av kvitteringer, manageraggodkjenning
- Nivå 3 → **Module 10** (Reports & KPIs)

Module 4.5 er betydelig mer kompleks enn det systemguiden antyder for nivå 2. Fra [docs/modules/SMARTOUT_MODULE_4.5_DAILY_SATTLED.md](modules/SMARTOUT_MODULE_4.5_DAILY_SATTLED.md):

> "AI-verified, image-based financial close that is part of the session sign-off flow. Nobody checks out until the money is accounted for."

**Avvik:** Systemguiden presenterer "Administratorens dagavstemmning" som en relativt enkel bekreftelsesprosess. Module 4.5 beskriver et betydelig mer avansert system med AI, OCR, kamerafangst, krysvalidering mot POS-data og gatekeeper-logikk. Systemguiden _underdriver_ kompleksiteten vesentlig.

Systemguiden beskriver heller ikke at sesjonslukking (nivå 1) og finansiell avslutning (nivå 2) er _separate operasjoner_ med ulik ansvarlig og ulik timing.

| Confidence | Impact |
| ---------- | ------ |
| 7/10       | 4/10   |

_Moderat confidence. Systemguiden er ikke feil, men den forenkler noe som er langt mer avansert i k-basen. Lav-moderat impact siden dette primært gjelder graden av kompleksitet, ikke riktig/galt._

---

## Hva er korrekt i systemguiden (bekreftet av k-basen)

For transparensens skyld: Følgende påstander i systemguiden er verifisert som korrekte mot k-basen:

| Systemguide-påstand                                                 | K-base-kilde                                                 | Status  |
| ------------------------------------------------------------------- | ------------------------------------------------------------ | ------- |
| Departements-/avdelingsøkt opprettes automatisk                     | MODULE_04: auto-generation via department_schedule           | Korrekt |
| Beredskapsprosent = (fullførte / tildelte) x 100                    | MODULE_06: eksakt samme formel                               | Korrekt |
| Posisjon tilordnes per vakt, ikke per person                        | MODULE_02, MODULE_04                                         | Korrekt |
| HACCP er ikke et separat system                                     | MODULE_05: "no new data tables"                              | Korrekt |
| Temperaturlogging via tidsstyrt oppgave                             | MODULE_05: session_hook → session_task                       | Korrekt |
| Avvik flagges umiddelbart                                           | MODULE_05: deviation_flagged + Runbook-trigger               | Korrekt |
| Eskalering etter forhåndsdefinerte regler                           | MODULE_05: escalation_chain (L1: 0min, L2: 20min, L3: 60min) | Korrekt |
| Økt kan ikke manipuleres i etterkant                                | MODULE_04: sealed on closed status                           | Korrekt |
| Tre inngangsverdier for budsjett (totalmål, dagsprofil, timeprofil) | MODULE_15: total_target_revenue + day_factor + hour_factor   | Korrekt |
| Team er dynamiske og kan være sesongbaserte                         | MODULE_02: team.season_id                                    | Korrekt |
| Avdelinger er faste (aldri sesongbasert)                            | MODULE_02: "NEVER seasonal. Permanent structure."            | Korrekt |
| Politikk tilordnes automatisk ved teammedlemskap                    | MODULE_06: scope cascade via team/department                 | Korrekt |

---

## Prioritert handlingsliste

Rangert etter kombinert score (Confidence × Impact):

| Prioritet   | Gap-ID   | Anbefalt tiltak                                                                                                                                                                                   |
| ----------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 (kritisk) | **G-02** | Disambiguere "Protokoll"-begrepet. Enten: (a) lag et eget norsk brukerbegrep for leder-perspektiv-visningen, eller (b) klargjer i systemguiden at "Protokoll" der betyr noe annet enn i teknikken |
| 2 (kritisk) | **G-03** | Modul 8 (Lønn) må spesifiseres. Alternativt: systemguiden bør merke lønnsberegning som "planlagt funksjon, ikke tilgjengelig i dag"                                                               |
| 3 (høy)     | **G-04** | Legg til Routine, Runbook og Control List i styringsmodell-tabellen i systemguiden, eller lag en fotnote                                                                                          |
| 4 (middels) | **G-06** | Bestem om "Veikart" er et offisielt begrep. Hvis ja: dokumenter det i k-basen. Hvis nei: fjern det fra systemguiden                                                                               |
| 5 (middels) | **G-01** | Legg til `missed`-status i livssyklus-diagrammet i systemguiden                                                                                                                                   |
| 6 (middels) | **G-05** | Spesifiser de tre Botsson-persona-rollene i Modul 12, eller fjern distinksjonene fra systemguiden                                                                                                 |
| 7 (lav)     | **G-08** | Legg til en kort note om at nivå 2 (adminavstemming) inkluderer finansiell close med AI-verifisering                                                                                              |
| 8 (lav)     | **G-07** | Lag en dedikert gamification-spesifikasjon eller lenk til der reglene faktisk er definert                                                                                                         |

---

_Rapport generert: 2026-03-05_
_Metode: Manuell gjennomgang av systemguiden mot 8 modul-filer, 2 arkitekturdokumenter, og CLAUDE.md_
_Ikke gjennomgått: archive/, decisions/ (ADRs), reference/DATABASE.md (full schema), agent-framework.md_
