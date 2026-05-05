# PRD.md — Tips Module (Smartout v3)

> **Status:** Implementeringsklar
> **Eier:** Smartout AS
> **Avhengigheter:** ARCHITECTURE.md, COMPONENTS.md
> **Mål:** Gjøre tips-håndtering til en transparent, etterprøvbar prosess som kobles direkte til lønn

---

## 1. Product Summary

Tips-modulen lar restaurantledere registrere dagens tips-beløp, automatisk fordele det rettferdig på de som var på vakt, justere ved behov med sporing, og eksportere til lønn med korrekt skattebehandling. Ansatte ser sine egne tips samme dag.

**Problemet:** Tips-fordeling er manuelt, utransparent, og en av de største kildene til mistillit mellom ansatte og arbeidsgiver i bransjen.

**Produktet:** Ett tall inn, fordeling ut, lønnslinje på neste lønning. Alt sporet.

---

## 2. Users and Roles

| Rolle             | Hva de kan                                                       |
|-------------------|------------------------------------------------------------------|
| **Daglig leder**  | Registrere tips, se og justere fordeling, godkjenne, sette policy |
| **Lønnsansvarlig**| Eksportere tips til lønnskjøring, markere som utbetalt           |
| **Ansatt**        | Se egne tips per dag, status, og sum per lønnsperiode            |

Roller arves fra eksisterende Smartout-rollesystem — ingen nye roller introduseres.

---

## 3. Data Model (sammendrag)

Full schema i ARCHITECTURE.md §3. Sammendrag her:

| Tabell                 | Hva den representerer                                       |
|------------------------|-------------------------------------------------------------|
| `tip_policies`         | Aktive og historiske fordelingsregler per avdeling          |
| `tip_role_weights`     | Rolle → vekt-mapping for `weighted_hours`-policies          |
| `tip_pools`            | Ett tips-beløp for én avdeling, én dato                     |
| `tip_distributions`    | Hver ansatts andel av en pool                               |
| `tip_adjustment_log`   | Audit log: hver justering, hvem og hvorfor                  |

---

## 4. Core Workflows

### Workflow 1: Kveldsregistrering (~30 sekunder per avdeling)

1. Leder åpner Avstemming for kvelden
2. Fyller inn «Tips inn i dag: ___ kr»
3. Trykker «Beregn fordeling»
4. Ser tabell: navn, timer, vekt, beløp
5. Hvis nødvendig — klikker rad for å justere et beløp + skriver kort årsak
6. Trykker «Godkjenn»

**Resultat:** Pool låst. Ansatte kan se sin andel umiddelbart.

### Workflow 2: Sett opp policy (engangsoppgave per avdeling)

1. Leder går til Innstillinger → Tips
2. Velger metode: Lik / Per time / Per time med rolle-vekt
3. Hvis rolle-vekt: setter vekter for hver rolle (default: servitør 1.0, bartender 0.9, runner 0.7, kjøkken 0.5)
4. Lagrer

**Resultat:** Policy aktiv fra valgt dato. Forrige policy beholdes for historikk.

### Workflow 3: Lønnskjøring

1. Lønnsansvarlig starter eksisterende lønnskjøring
2. Lønnsmotor henter automatisk tips-summer per ansatt
3. Tips legges på lønnsslippen som egen linje med skatt
4. Når lønn er kjørt — tips-distributions markeres som utbetalt

**Resultat:** Tips og lønn samkjørt. Skattetrekk korrekt.

---

## 5. Screens

Detaljert komponentliste i COMPONENTS.md. Skjermoversikt her:

| Skjerm                          | Bruker          | Hovedfunksjon                                  |
|---------------------------------|-----------------|------------------------------------------------|
| Avstemming → Tips-felt          | Daglig leder    | Registrer dagens tips-beløp                    |
| Pool Review (`/tips/pools/[id]`)| Daglig leder    | Se fordeling, juster, godkjenn                 |
| Policy Settings (`/tips/policies`)| Daglig leder  | Velg metode + rolle-vekter                     |
| Min Tips (`/tips/me`)           | Ansatt          | Se egne tips per dag/periode                   |
| Lønnseksport (eksisterende)     | Lønnsansvarlig  | Tips kommer som lønnslinje automatisk          |

---

## 6. API Specification

Full spec i ARCHITECTURE.md §4. Sammendrag:

| Endpoint                                  | Bruker     |
|-------------------------------------------|------------|
| `POST /api/tips/pools`                    | Leder      |
| `GET  /api/tips/pools/[id]`               | Leder      |
| `POST /api/tips/pools/[id]/approve`       | Leder      |
| `PATCH /api/tips/distributions/[id]`      | Leder      |
| `GET  /api/tips/policies`                 | Leder      |
| `POST /api/tips/policies`                 | Leder      |
| `GET  /api/tips/payouts?period_id=`       | Lønn       |
| `POST /api/tips/payouts/mark-paid`        | Lønn       |
| `GET  /api/tips/me`                       | Ansatt     |

---

## 7. Non-functional Requirements

| Krav             | Mål                                                                   |
|------------------|-----------------------------------------------------------------------|
| Performance      | Beregning av fordeling: <200ms for opptil 50 ansatte                  |
| Tilgjengelighet  | Ansatt-visning skal fungere på mobil (anneMa)                         |
| Audit            | 100% av justeringer logges med bruker, tid, gammel/ny verdi, årsak    |
| Idempotens       | Re-kalkulering av en pool gir samme resultat før godkjenning          |
| Skattekompliance | Eksporterte tips flagges som `tips_taxable` for korrekt trekk         |
| Data integrity   | Sum av distributions = pool beløp. Alltid. Constraint på DB-nivå evt. på godkjenning |

---

## 8. Tech Stack

| Lag              | Teknologi                                            |
|------------------|------------------------------------------------------|
| Frontend         | Next.js App Router, React Server Components hvor mulig |
| State            | TanStack Query                                       |
| Validering       | Zod                                                  |
| Database         | Supabase Postgres                                    |
| Auth             | Supabase Auth (eksisterende)                         |
| Sikkerhet        | Row-Level Security                                   |
| Type safety      | TypeScript strict                                    |
| Testing          | Vitest for `calculate.ts`                            |

Ingen nye dependencies utenfor det Smartout v3 allerede bruker.

---

## 9. Build Order

| Fase | Hva                                              | Hvorfor først                          |
|------|--------------------------------------------------|----------------------------------------|
| 1    | DB schema + migrasjoner                          | Foundation                             |
| 2    | `calculate.ts` + enhetstester                    | Ren funksjon, lett å verifisere        |
| 3    | Route Handlers (pools, distributions)            | API før UI                             |
| 4    | Pool Review-skjerm                               | Hovedskjermen                          |
| 5    | Avstemming-integrasjon (tips-felt)               | Inngangspunkt for daglig bruk          |
| 6    | Policy-skjerm                                    | Engangsoppgave per kunde               |
| 7    | Ansatt-visning (`/tips/me`)                      | Driver tillit                          |
| 8    | Lønnsmotor-integrasjon                           | Lukker loopen                          |
| 9    | Audit log + RLS-tester                           | Compliance                             |

Hver fase = én Linear Sub-Epic.

---

## 10. Out of Scope

| Feature                          | Revurder når                                       |
|----------------------------------|----------------------------------------------------|
| Hybrid-policies                  | Når 3+ kunder eksplisitt etterspør                 |
| Salgsbaserte policies            | Når POS-integrasjon på linjenivå er bygget         |
| Ukespool / månedspool            | Når en kunde nekter å bruke dag-pool               |
| Skille på Vipps/kort/kontant     | Hvis revisjonsbehov dukker opp                     |
| Tilbakeføring etter utbetaling   | Etter første reelle case oppstår                   |
| Multi-currency                   | Ved ekspansjon utenfor Skandinavia                 |
| Skattetrekk-beregning i modulen  | Aldri — det er lønnsmotorens jobb                  |

---

## 11. Success Criteria

| Milepæl  | Mål                                                              |
|----------|------------------------------------------------------------------|
| MVP live | Én avdeling registrerer og godkjenner tips daglig i 14 dager     |
| Adopsjon | 100% av betalende kunder bruker modulen innen 90 dager           |
| Tillit   | <5% av distributions justeres manuelt etter første måned         |
| Lønn     | Tips på lønnsslipp uten manuell håndtering hos lønnsansvarlig    |

---

## 12. Risks and Mitigations

| Risiko                                    | Mitigering                                              |
|-------------------------------------------|--------------------------------------------------------|
| Beregningen oppleves urettferdig          | Vis transparente vekter + timer i UI; tillat justering |
| Justering misbrukes av leder              | Audit log synlig for ansatt og admin                   |
| Bemanningsdata mangler/er feil            | Block pool-opprettelse hvis ingen vakter funnet        |
| Ansatt klager på beløp                    | Distribution-rad har full forklaring (timer × vekt)    |
| Skattetrekk feilkonfigureres              | Eksport flagger linje, lønnsmotor eier trekk-logikk    |
| Endring av policy midt i lønnsperiode     | Policy versjoneres; pool refererer til policy_id       |

---

## 13. Document Index

- **ARCHITECTURE.md** — system, dataflyt, schema, API
- **COMPONENTS.md** — alle skjermer og komponenter
- **PRD.md** — dette dokumentet