---
title: "Handoff: Journey-Guided Testing System"
status: draft
updated: 2026-03-30
created: 2026-03-30
module: mobile
tags: [handoff, journeys, telemetry, botsson, testing]
---

# Handoff: Journey-Guided Testing System

## Hva vi har bygget

Et komplett system for å guide, måle og redde brukere gjennom 12 forhåndsdefinerte journeys i Smartout-appen. Systemet består av tre lag som jobber sammen:

```
USER-GUIDE        → Hva brukeren gjør (steg-for-steg instrukser)
EVENT-SEQUENCE    → Hva systemet observerer (telemetri-gates)
RESCUE-PROMPTS    → Hva Botsson gjør når en gate failer (støtte + veiledning)
```

Disse tre lagene danner et **lukket feedback-loop**: brukeren handler → systemet observerer → Botsson griper inn ved behov → brukeren fullfører.

---

## Hvorfor dette er viktig

Tradisjonell apptesting: "Prøv appen og gi tilbakemelding."
Resultat: 3 av 12 svarer. Ingen vet hva de testet. Ingen målbar data.

**Vår tilnærming:** Brukeren får en konkret oppgave. Hvert steg trigger et telemetri-event. Hvis brukeren stopper, vet vi nøyaktig hvor — og Botsson hjelper dem videre. Vi trenger ikke spørre noen om noe. Dataen forteller alt.

---

## Arkitektur

### Lag 1: USER-GUIDE (menneskelesbart)

Hver journey har en idiotsikker steg-for-steg guide. Ingen forutsetninger. Ingen tvetydighet. Hvert steg sier:

- Hva du skal **trykke på** (fet tekst, eksakt knappnavn)
- Hva du skal **se** (beskrivelse av forventet resultat)
- Hva som skjer **neste** (overgang til neste steg)

**Designprinsipp:** Hvis en 19-åring på sin første dag ikke klarer å følge guiden, er guiden feil — ikke brukeren.

### Lag 2: EVENT-SEQUENCE (maskinlesbart)

Hver journey har en forventet sekvens av telemetri-events med:

- **Tidslinje** — kronologisk rekkefølge med forventet T+ offset
- **Suksesskriterier** — minimum events som MÅ trigges for at journeyen teller som fullført
- **Feilscenarier** — hva manglende events betyr og hva som bør gjøres

Events er hentet direkte fra `packages/telemetry/src/registry.ts`. Ingen nye events er oppfunnet — alt bruker eksisterende infrastruktur.

### Lag 3: RESCUE-PROMPTS (Botsson-instrukser)

Mellom hvert forventet event er det en **gate**. Hvis gaten ikke passeres innen en definert timeout, sender systemet en prompt til Mr. Botsson som:

1. **Vet hvor brukeren er** — siste event som trigget
2. **Vet hvor de stoppet** — gaten som feilet
3. **Vet sannsynlig årsak** — dedusert fra konteksten mellom stegene
4. **Gir konkret hjelp** — "Trykk på X nederst på skjermen"
5. **Motiverer** — "Du er nesten der!" / "Bra jobba!"

**Tone-regler:**

- Aldri mas. Aldri klandre.
- Alltid: "Du er på rett vei, her er neste steg."
- Maks 5 linjer per rescue prompt.
- Spesifikk — aldri "prøv igjen", alltid "trykk på den grønne knappen"

---

## De 12 journeyene

### Ansatte (8 journeys)

| #   | Journey                | Kjerneproblem              | Sårbareste punkt                   | Gates |
| --- | ---------------------- | -------------------------- | ---------------------------------- | ----- |
| 1   | Første arbeidsdag      | Forvirring, ingen vet noe  | Arbeidsplasskode-input             | 6     |
| 2   | Stemple inn            | Upålitelig tidregistrering | Finne stemple-knappen              | 2     |
| 3   | Sjekke vakter          | Fysisk vaktliste           | Finne Vakter-fanen                 | 2     |
| 4   | Obligatorisk opplæring | PDF ingen leser            | Quiz-angst, gi opp midtveis        | 4     |
| 5   | Melde avvik            | Papirskjema                | Kamera-permissions, for mange steg | 2     |
| 6   | Sjekke lønn            | Mystisk lønn               | Finne Min Side, ingen data ennå    | 3     |
| 7   | Teamchat               | Privat WhatsApp            | Terskelen for å skrive             | 3     |
| 8   | Spørre Mr. Botsson     | Vet ikke svaret            | Stole på AI, stemme vs tekst       | 2     |

### Ledere (4 journeys)

| #   | Journey          | Kjerneproblem     | Sårbareste punkt          | Gates |
| --- | ---------------- | ----------------- | ------------------------- | ----- |
| 9   | Hvem er på jobb  | Ringe rundt       | Manager-spesifikk visning | 1     |
| 10  | HACCP-logging    | Penn og papir     | Vite hva som er OK temp   | 3     |
| 11  | Readiness-status | Magefølelse       | Forstå prosent-betydning  | 2     |
| 12  | Vernerunde       | Halvhjertet sjekk | Fatigue ved 12 punkter    | 6     |

**Total: 36 gates med rescue prompts.**

---

## Hva som må implementeres

### 1. Gate Monitor (backend)

En tjeneste som overvåker telemetri-strømmen og matcher events mot forventede sekvenser per bruker.

```
Input:  Bruker X starter Journey 2
Watch:  page_viewed(home) → shift_punched_in → shift_punched_out
Timeout: Hvis shift_punched_in ikke kommer innen 2 min etter page_viewed(home)
Action: Send rescue prompt til Botsson for bruker X
```

**Hvor dette bør leve:** En ny capability i `packages/ai/src/capabilities/` eller en Edge Function som lytter på `engine_event`-tabellen.

**Alternativ (enklere MVP):** PostHog cohort + webhook. Definer en funnel per journey. Hvis brukeren dropper ut av funnelen, trigger en webhook som sender rescue prompt.

### 2. Rescue Prompt Delivery

Botsson trenger en kanal for å levere rescue prompts:

- **Push-notifikasjon** — best for "du har stoppet opp"-scenarier
- **In-app melding** — best for "du er på feil sted"-scenarier
- **Botsson-proaktiv** — Botsson-boblen lyser opp med tilbudt hjelp

Anbefaling: Start med push-notifikasjon (enklest). Utvid til in-app Botsson-intervensjon senere.

### 3. Journey Assignment

Hvordan testere får sine journeys:

- **Manuelt:** Admin tildeler 2-3 journeys per tester i Play Console-testgruppa
- **Automatisk:** Basert på rolle (employee → journey 1-8, manager → journey 9-12)
- **Progressiv:** Fullfør journey 1 → journey 2 låses opp automatisk

Anbefaling for testing-fasen: manuell tildeling. Progressiv unlock for production.

### 4. Dashboard

En enkel oversikt som viser:

```
Tester      | J1  | J2  | J3  | J4  | J5  | Status
Sara        | ✓   | ✓   | ●   | —   | —   | 2/5 fullført
Ahmed       | ✓   | ✓   | ✓   | ✓   | —   | 4/5 fullført
Lisa        | ✓   | ●   | —   | —   | —   | 1/5, stuck på J2 gate 1
```

✓ = fullført, ● = pågår/stuck, — = ikke startet

**Datakilde:** PostHog events filtrert på tester-profiler. Kan bygges som et PostHog-dashboard eller en enkel query mot `engine_event`-tabellen.

---

## Hva som allerede finnes

| Komponent           | Status                | Plassering                                         |
| ------------------- | --------------------- | -------------------------------------------------- |
| Telemetri-registry  | Produksjonsklar       | `packages/telemetry/src/registry.ts`               |
| Event routing       | Produksjonsklar       | `packages/telemetry/src/emit.ts`                   |
| PostHog-integrasjon | Produksjonsklar       | `packages/telemetry/src/providers/posthog.ts`      |
| Engine Event        | Produksjonsklar       | `packages/telemetry/src/providers/engine-event.ts` |
| Mr. Botsson         | Delvis (voice + text) | `apps/mobile/` FAB + LiveKit                       |
| Push-notifikasjoner | Konfigurert           | `expo-notifications` i appen                       |
| 12 USER-GUIDEs      | Ferdig                | `store-listing/journeys/*/USER-GUIDE.md`           |
| 12 EVENT-SEQUENCEs  | Ferdig                | `store-listing/journeys/*/EVENT-SEQUENCE.md`       |
| 12 RESCUE-PROMPTs   | Ferdig                | `store-listing/journeys/*/RESCUE-PROMPTS.md`       |

### Hva som IKKE finnes ennå

| Komponent              | Innsats   | Prioritet                                          |
| ---------------------- | --------- | -------------------------------------------------- |
| Gate Monitor           | 2-3 dager | Høy — uten dette er rescue prompts bare dokumenter |
| Rescue Prompt Delivery | 1 dag     | Høy — Botsson trenger en leveringskanal            |
| Journey Assignment     | 1 dag     | Middels — kan gjøres manuelt for testing           |
| Test Dashboard         | 1 dag     | Middels — PostHog funnel er raskest                |

---

## Beslutninger tatt

| Beslutning                                            | Begrunnelse                                     |
| ----------------------------------------------------- | ----------------------------------------------- |
| Bruker eksisterende telemetri-events, ingen nye       | Null ny infrastruktur, alt funker allerede      |
| Rescue prompts er statiske tekster, ikke AI-genererte | Forutsigbarhet > kreativitet i krisesituasjoner |
| Timeout-baserte gates, ikke ML-baserte                | Enkelt, debuggbart, ingen falske positiver      |
| Norsk som eneste språk i rescue prompts               | Målgruppen er norsk serveringsbransje           |
| Maks 5 linjer per rescue prompt                       | Brukere på vakt har ikke tid til essays         |
| Tone: coach, ikke sjef                                | Smartout er en støtte, ikke en overvåker        |

---

## Risiko

| Risiko                             | Konsekvens                             | Tiltak                                                            |
| ---------------------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| Rescue prompts trigger for ofte    | Brukeren irriteres, slår av varslinger | Maks 1 rescue per gate per 10 min                                 |
| Rescue prompts trigger for sent    | Brukeren har allerede gitt opp         | Start med korte timeouts, juster basert på data                   |
| Events mangler i appen             | Gates trigger aldri, system er blindt  | Verifiser at alle events i EVENT-SEQUENCE faktisk emitter i koden |
| Botsson-leveringskanal funker ikke | Rescue prompts blir aldri levert       | Fallback til push-notifikasjon                                    |

### Kritisk verifisering før lansering

**Hvert event i EVENT-SEQUENCE.md må verifiseres mot faktisk kode.** Sekvensene er bygget basert på registeret og appens arkitektur, men noen events kan mangle `emit()`-kall i den faktiske koden. En audit av:

```
For hvert event i EVENT-SEQUENCE:
  1. Finn emit() kallet i koden
  2. Verifiser at det trigges på riktig brukerhandling
  3. Verifiser at det inneholder riktig payload (page, action, etc.)
```

Uten denne verifiseringen er systemet teori, ikke praksis.

---

## Anbefalt neste steg

1. **Audit emit()-dekning** — verifiser at alle 36 gate-events faktisk emitter i koden
2. **Bygg Gate Monitor MVP** — Edge Function som lytter på events og matcher mot sekvenser
3. **Koble Botsson** — levér rescue prompts via push-notifikasjon
4. **Tildel journeys** — gi 12 testere 2-3 journeys hver
5. **Kjør 14-dagers test** — observer dashboardet, juster timeouts
6. **Iterér** — data fra testperioden forteller oss hva som fungerer og hva som må endres

---

## Filstruktur

```
apps/mobile/store-listing/
├── LAUNCH-PLAN.md                    ← Google Play launch checklist
├── HANDOFF-JOURNEY-SYSTEM.md         ← denne filen
├── TEST-JOURNEYS.md                  ← oversikt over alle 12 journeys
├── google-play-listing.md            ← store listing content
└── journeys/
    ├── 01-first-day/
    │   ├── USER-GUIDE.md             ← steg-for-steg for brukeren
    │   ├── EVENT-SEQUENCE.md         ← forventet event-tidslinje
    │   └── RESCUE-PROMPTS.md         ← Botsson-intervensjon ved feilende gates
    ├── 02-punch-in/
    │   └── ...
    ├── ...
    └── 12-safety-round/
        └── ...
```

36 filer. 12 journeys. 36 gates. Ett system.
