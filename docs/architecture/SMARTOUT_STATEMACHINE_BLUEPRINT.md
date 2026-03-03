---
title: "State Machine Blueprint — Review & Solutions"
status: canonical
updated: 2026-03-11
created: 2026-03-02
module: architecture
tags: [state-machine, engine, automation, workflow]
---

# Smartout State Machine — Review & Løsninger

**Versjon:** 1.1  
**Dato:** 2. mars 2026  
**Status:** Supplement til grunnlagsdokumentet  
**Formål:** Identifisere hull, foreslå løsninger, definere scope-grenser, og liste domenespesifikke beslutninger

---

## 1. Identifiserte hull med løsningsforslag

### 1.1 Parallelle steg

**Problemet:** Alle steg har et `order`-felt og kjøres sekvensielt. Men i onboarding-eksempelet skjer steg 1 (assign task), 2 (notifikasjon) og 3 (schedule kontroll) samtidig på dag 0. Med ren sekvensiell kjøring blokkerer steg 2 på at steg 1 er "complete".

**Løsning — step groups:**

Legg til et `group`-felt på `engine.steps`:

```sql
ALTER TABLE engine.steps ADD COLUMN step_group integer DEFAULT NULL;
```

Regler:

- Steg med samme `step_group` kjøres parallelt (alle starter samtidig)
- Gruppen er "complete" når alle steg i gruppen er complete
- Steg uten `step_group` (NULL) kjøres sekvensielt som før
- Neste gruppe/steg starter først når forrige gruppe er ferdig

Eksempel for onboarding dag 0:

| Steg | order | step_group | action_type       |
| ---- | ----- | ---------- | ----------------- |
| 1    | 1     | 1          | assign_task       |
| 2    | 2     | 1          | send_notification |
| 3    | 3     | 1          | schedule_control  |
| 4    | 4     | NULL       | wait_for_event    |

Steg 1–3 kjøres parallelt (gruppe 1). Steg 4 venter til alle tre er ferdige.

**Alternativ (enklere):** Definer visse action_types som "fire-and-forget" (f.eks. `send_notification` trenger ikke ventes på). Motoren kjører dem og går videre uten å vente på complete. Men dette er mer implisitt og vanskeligere å debugge.

**Anbefaling:** `step_group` er eksplisitt og lettlest. Gå med det.

---

### 1.2 Delay-mekanismen

**Problemet:** Dokumentet nevner delays på to steder uten å skille dem:

1. **Trigger-delay** — `engine.triggers.delay` (f.eks. "vent 4 timer etter event")
2. **Step-delay** — `action_payload.delay` i steps (f.eks. `"+3d"` for schedule_control)

Hvem holder timeren? Hva er oppløsningen?

**Løsning — to mekanismer:**

**A) Trigger-delay → pg_cron + delayed_triggers-kø**

```sql
CREATE TABLE engine.delayed_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id uuid REFERENCES engine.triggers(id),
  event_id uuid REFERENCES engine.events(id),
  fire_at timestamp NOT NULL,
  fired boolean DEFAULT false,
  workspace_id uuid NOT NULL
);
```

Når en trigger matcher et event og har delay > 0:

1. Opprett rad i `delayed_triggers` med `fire_at = now() + delay`
2. pg_cron kjører hvert minutt: `SELECT * FROM engine.delayed_triggers WHERE fire_at <= now() AND fired = false`
3. For hver match: start prosessen, sett `fired = true`

**B) Step-delay → motoren scheduler neste steg**

Steps med delay i payload håndteres av motoren selv:

1. Motoren utfører steget (f.eks. `schedule_control`)
2. Handler returnerer `scheduled` (ny status, ikke bare success/failure)
3. Motoren oppretter en intern event med `fire_at`-tid
4. Samme pg_cron-jobb plukker det opp

**Oppløsning:** pg_cron med 1-minutts intervall er tilstrekkelig for restaurant-domenet. Ingenting krever sekundpresisjon. Dokumenter dette som en bevisst begrensning.

**Domenespørsmål:**

- Hva er minste meningsfulle delay i restaurantdrift? (Sannsynligvis 5 minutter)
- Skal delays være relative til event-tidspunkt eller til arbeidstid? (F.eks. "+1d" — betyr det 24 timer, eller neste arbeidsdag?)

---

### 1.3 Timeout og feilhåndtering

**Problemet:** `wait_for_event` har timeout, men det er udefinert hva som skjer ved timeout og ved teknisk feil i handlers.

**Løsning — tre nivåer:**

**A) wait_for_event timeout:**

Legg til `on_timeout`-felt i action_payload:

```json
{
  "event": "control.day1.complete",
  "timeout": "48h",
  "on_timeout": "fail"
}
```

Gyldige verdier for `on_timeout`:

- `"fail"` — sett state til failed, fire `state.failed` event
- `"escalate"` — sett state til escalated, fire `state.escalated` event
- `"skip"` — gå videre til neste steg (for ikke-kritiske kontroller)
- `"retry"` — restart dette steget med ny timeout (maks 3 ganger)

Timeout sjekkes av pg_cron:

```sql
-- Finn states som venter på event og har passert timeout
SELECT * FROM engine.states
WHERE status = 'waiting'
AND (context->>'timeout_at')::timestamp <= now();
```

**B) Handler-feil (teknisk):**

Ny kolonne på states:

```sql
ALTER TABLE engine.states ADD COLUMN retry_count integer DEFAULT 0;
ALTER TABLE engine.states ADD COLUMN last_error text;
```

Strategi:

1. Handler feiler → retry_count += 1, last_error = feilmelding
2. Retry etter 30s, 2min, 10min (eksponentiell backoff)
3. Etter 3 retries → state = failed, fire `state.handler_failed` event
4. Logg alt til `engine.events` med type `handler.failed`

**C) Dead letter / stuck states:**

pg_cron-jobb som kjører hver time:

```sql
-- Finn states som har vært "active" i mer enn 7 dager uten endring
SELECT * FROM engine.states
WHERE status = 'active'
AND updated_at < now() - interval '7 days';
```

Disse flagges som `stale` og genererer et `state.stale` event som kan trigge varsling til admin.

**Domenespørsmål:**

- Hva er rimelig timeout for ulike kontrolltyper? (Dag 1-sjekk: 48h? HACCP: 2h?)
- Hvem skal varsles ved stuck states? Alltid leder? Eller avhengig av prosesstype?

---

### 1.4 Flerinstans-problemet

**Problemet:** Når to ansatte onboardes samtidig, finnes to state-rader med samme `process_id`. Det er ingen enkel måte å skille "Karis onboarding" fra "Oles onboarding" uten å grave i `context`-JSONB.

**Løsning — entity-referanse på states:**

```sql
ALTER TABLE engine.states ADD COLUMN entity_type text;      -- 'employee', 'checklist', 'shift'
ALTER TABLE engine.states ADD COLUMN entity_id uuid;         -- FK til den aktuelle raden
CREATE INDEX idx_states_entity ON engine.states(entity_type, entity_id);
```

Nå kan du:

```sql
-- Finn Karis onboarding
SELECT * FROM engine.states
WHERE entity_type = 'employee' AND entity_id = 'emp_123';

-- Finn alle aktive onboardinger
SELECT * FROM engine.states
WHERE process_id = 'onboarding_14d' AND status = 'active';
```

`entity_type` + `entity_id` er denormalisert fra `context`-JSONB, men det er verdt det for spørringshastighet og RLS-policies.

**Tillegg — unikhet:**

```sql
-- Én aktiv instans per entity per prosess
CREATE UNIQUE INDEX idx_states_unique_active
ON engine.states(entity_type, entity_id, process_id)
WHERE status IN ('pending', 'active');
```

Dette forhindrer at samme ansatt får to parallelle onboarding-prosesser.

---

### 1.5 Versjonering av prosesser

**Problemet:** Hvis du endrer `onboarding_14d` mens Kari er på steg 3, hva skjer? Endringen skal gjelde fremtidige kjøringer, ikke pågående.

**Løsning — snapshot ved oppstart:**

Legg til `steps_snapshot` på states:

```sql
ALTER TABLE engine.states ADD COLUMN steps_snapshot jsonb;
```

Når en prosess startes:

1. Hent alle steps for process_id
2. Serialiser dem til JSON
3. Lagre i `steps_snapshot` på state-raden

Motoren leser alltid fra `steps_snapshot` for pågående prosesser, aldri direkte fra `engine.steps`.

Fordeler:

- Pågående prosesser påvirkes aldri av endringer
- Full audit trail — du kan se nøyaktig hvilke steg som ble kjørt
- Ingen behov for versjonsnummer på prosesser

Ulempe:

- Duplisert data (men JSONB er kompakt og states ryddes opp over tid)

**Domenespørsmål:**

- Skal det være mulig å "oppgradere" en pågående prosess til nye steg? (F.eks. tilsyn krever det.) I så fall: manuell operasjon med admin-rolle, logg alt.

---

### 1.6 workspace_id på states

**Problemet:** `engine.states` har ikke `workspace_id` direkte. For RLS og filtrering må du joine.

**Løsning:** Denormaliser.

```sql
ALTER TABLE engine.states ADD COLUMN workspace_id uuid NOT NULL;
CREATE INDEX idx_states_workspace ON engine.states(workspace_id);
```

Alle states får workspace_id satt ved opprettelse. Dette er standard Supabase-mønster for multi-tenant — RLS trenger direkte tilgang til workspace_id uten joins.

---

### 1.7 Rekursjonsbeskyttelse

**Problemet:** `start_process` som action og `state.changed` som trigger-event kan skape uendelig loop.

**Løsning — depth-teller og max:**

```sql
ALTER TABLE engine.states ADD COLUMN depth integer DEFAULT 0;
```

Regler:

- Når en prosess starter en ny prosess via `start_process`, arver child `depth = parent.depth + 1`
- Maks depth: **3** (konfigurerbar per workspace)
- Ved forsøk på å overskride: state = failed, fire `engine.recursion_limit` event
- `state.changed`-events har en `source_depth` i payload — triggers kan filtrere på dette

```json
{
  "event_type": "state.changed",
  "condition": { "max_source_depth": 1 }
}
```

---

### 1.8 Idempotency

**Problemet:** Hva skjer hvis `employee.created` fires to ganger? Webhook-retries, bugs, race conditions.

**Løsning — dedup-nøkkel:**

```sql
ALTER TABLE engine.events ADD COLUMN idempotency_key text;
CREATE UNIQUE INDEX idx_events_idempotency
ON engine.events(idempotency_key)
WHERE idempotency_key IS NOT NULL;
```

Regler:

- Listeners setter `idempotency_key` basert på kilde (f.eks. `"employee.created:emp_123"`)
- Hvis nøkkelen allerede finnes: event logges men trigger matcher ikke
- `idempotency_key` er valgfri — cron-events og manuelle events trenger det ikke
- TTL: keys eldre enn 24 timer kan ignoreres (konfigurerbar)

For webhooks med retry-mekanisme: bruk webhook-leveransens ID som idempotency_key.

---

### 1.9 Condition-språket

**Problemet:** Tre forskjellige condition-formater i dokumentet:

- `{"if": "step_4.complete"}`
- `{"role": "server"}`
- `{"if_state": "incomplete", "then": "escalate"}`

**Løsning — ett condition-format:**

Alle conditions evalueres som `{field: operator: value}`:

```json
// Enkel match mot context/payload
{"match": {"role": "server"}}

// Sjekk steg-status
{"step_status": {"step": 4, "is": "complete"}}

// Kombinasjon (AND)
{"all": [
  {"match": {"role": "server"}},
  {"step_status": {"step": 4, "is": "complete"}}
]}

// Kombinasjon (OR)
{"any": [
  {"match": {"department": "kitchen"}},
  {"match": {"department": "bar"}}
]}
```

**Begrensning (scope!):**

- Ingen nested conditions dypere enn 2 nivåer
- Ingen aritmetikk (> < >= <=) i v1 — kun equality og step_status
- Ingen referanser til eksterne tabeller — kun data som finnes i state.context og step-resultater

Implementer som én ren funksjon: `evaluate_condition(condition_json, context_json) → boolean`

**Domenespørsmål:**

- Trenger du noensinne "greater than"-logikk? (F.eks. "hvis score > 80% → sertifisert")
- I så fall: legg til `{"compare": {"field": "score", "op": ">=", "value": 80}}` i v2

---

### 1.10 Assignee-regler

**Problemet:** `assignee_rule` bruker strenger som `"new_employee"`, `"manager"`, `"department_head"` uten å definere hvordan disse resolves.

**Løsning — resolver-funksjon med definerte regler:**

`resolve_assignee(rule, context) → employee_id`

Reglene:

| assignee_rule       | Resolver-logikk                                                        |
| ------------------- | ---------------------------------------------------------------------- |
| `"self"`            | `context.employee_id` (personen som trigget eventet)                   |
| `"new_employee"`    | `context.employee_id` (alias for self i onboarding-kontekst)           |
| `"manager"`         | Lookup: `employees.manager_id WHERE id = context.employee_id`          |
| `"department_head"` | Lookup: `departments.head_id WHERE id = employees.department_id`       |
| `"role:<rolle>"`    | Lookup: alle med gitt rolle i workspace (f.eks. `"role:shift_leader"`) |
| `"specific:<id>"`   | Direkte employee_id                                                    |

**Forutsetning:** Applikasjonstabellen `employees` må ha:

- `manager_id` (FK til employees)
- `department_id` (FK til departments)

Og `departments` må ha:

- `head_id` (FK til employees)

**Domenespørsmål:**

- Hva skjer hvis manager_id er NULL? (Ny ansatt uten tildelt leder)
- Fallback-regel? (F.eks. eskalér til workspace-admin)
- Kan en oppgave tildeles et _team_ i stedet for en person? (F.eks. "kjøkkenet" skal gjøre HACCP)

---

## 2. Scope-grenser — hva motoren IKKE gjør

Disse grensene er bevisste valg. Bryt dem kun etter eksplisitt beslutning med dokumentert begrunnelse.

### Motoren er IKKE:

| Ikke dette                                      | Fordi                                              | I stedet                                             |
| ----------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| En generell workflow engine (Temporal, Inngest) | Kompleksiteten dreper vedlikehold for et lite team | Domenetilpasset state machine med faste action types |
| En regelmotor (Drools, BRMS)                    | Condition-språket holdes bevisst enkelt            | Enkel match/step_status med AND/OR                   |
| Et meldingskø-system (RabbitMQ, SQS)            | Overkill for volumet                               | pg_cron + delayed_triggers-tabell                    |
| En distribuert scheduler (Celery, Bull)         | Enkel server, enkel arkitektur                     | pg_cron med minuttoppløsning                         |
| Et BI/analytics-system                          | Motoren logger events, men analyse gjøres separat  | Events-tabellen som datakilde for fremtidig BI       |

### Eksplisitte begrensninger i v1:

1. **Ingen branching/if-else i prosesser.** Steg kjøres sekvensielt (eller parallelt i grupper). Betinget hopp støttes via `condition` som skipper et steg, ikke som "gå til steg X". Ingen goto.
2. **Ingen rollback.** Hvis steg 5 feiler, gjøres ikke steg 1–4 om igjen. State settes til failed. Ny prosess kan startes manuelt.
3. **Ingen human-in-the-loop approval gates** som egen mekanisme. Bruk `wait_for_event` med en manuell event-type i stedet.
4. **Ingen dynamiske steg.** Antall steg i en prosess er fast ved oppstart (snapshot). Kan ikke legge til steg underveis.
5. **Ingen sub-workflows med retur.** `start_process` er fire-and-forget. Child-prosessen rapporterer ikke tilbake til parent. Bruk events i stedet.
6. **Ingen prioritering mellom prosesser.** Alle prosesser er likeverdige. Prioritering skjer i presenter-laget (UI sorterer etter urgency).
7. **Maks 50 steg per prosess.** Hvis du trenger mer, bryt opp i flere prosesser koblet med events.
8. **Maks 3 nesting-nivåer** (prosess → start_process → start_process → stopp).
9. **Minutt-oppløsning på scheduling.** Ingenting under 1 minutt.
10. **Ingen real-time streaming av state-endringer til klienter fra motoren.** Bruk Supabase Realtime på `engine.states`-tabellen i presenter-laget.

---

## 3. Domenespesifikke spørsmål å ta stilling til

Disse spørsmålene krever domeneekspertise fra restaurantbransjen. Svarene påvirker implementeringen direkte.

### 3.1 Organisasjonsstruktur

- **Hierarki-dybde:** Hvor mange nivåer har en typisk restaurant? (Ansatt → Skiftleder → Avdelingsleder → Daglig leder → Eier?) Trenger resolver mer enn 2 nivåer?
- **Stedfortreder:** Hva skjer når "manager" er på ferie? Er det en stedfortreder-mekanisme, eller brukes `role:shift_leader` som fallback?
- **Multi-avdeling:** Kan en ansatt tilhøre flere avdelinger? (F.eks. både kjøkken og bar?) Påvirker assignee_rule og condition-matching.

### 3.2 Arbeidstid og tidssoner

- **Delays vs arbeidstid:** "+1d" — er det 24 klokketimer eller neste arbeidsdag? For en restaurant som er stengt mandager, skal kontroll "dag 3" hoppe over mandag?
- **Åpningstider:** Skal cron-triggers være klar over åpningstider? (Ingen vits å fire `cron.06:00` for åpningsrutine hvis restauranten åpner 11:00)
- **Tidssone:** Alltid norsk tid (CET/CEST), eller er det kunder i andre tidssoner?

### 3.3 Kontroller og HACCP

- **Kontroll-frekvens:** Hvor ofte kjøres HACCP-kontroller? Daglig? Per skift? Påvirker volum i events-tabellen.
- **Avvik:** Hva skjer ved HACCP-avvik? Er det en fast prosess (logg → tiltak → verifisering), eller varierer det per type avvik?
- **Dokumentasjonskrav:** Mattilsynet krever X års lagring av HACCP-logger. Skal events-tabellen arkiveres, eller trenger vi en separat audit-tabell?

### 3.4 Sertifisering

- **Resertifisering:** Hvor ofte? Årlig? Ved endring av prosedyre? Automatisk trigger?
- **Delvis sertifisering:** Kan en avdelingsleder være sertifisert for kjøkken men ikke bar? Betyr det sertifisering per prosedyre eller per avdeling?
- **Blokkering:** Dokumentet sier "prosedyre kan ikke eies av usertifisert leder". Hva betyr "eies"? Kan prosedyren fortsatt kjøres, bare med en annen eier? Eller er prosessen blokkert helt?

### 3.5 Onboarding

- **Variasjon per rolle:** Har servitør, kokk og bartender samme onboarding-prosess med ulike steg, eller helt separate prosesser? Betyr `condition: {"role": "server"}` at det er én stor prosess med betingede steg, eller mange små prosesser?
- **Prøvetid:** Er onboarding-prosessen koblet til prøvetidsperioden juridisk? Påvirker det krav til dokumentasjon og logging?
- **Re-onboarding:** Hva skjer hvis en ansatt bytter rolle? Ny full onboarding, eller en forkortet versjon?

### 3.6 Volum og ytelse

- **Antall ansatte per restaurant:** 10? 50? 200? Påvirker antall samtidige prosesser.
- **Antall events per dag:** Estimat per restaurant? (Viktig for å dimensjonere events-tabellen og bestemme arkiveringsstrategi)
- **Antall workspaces:** 20 i dag. 200 om et år? 2000? Påvirker indeksering og partisjonering.

### 3.7 Integrasjoner

- **Punching-systemer:** Hvilke systemer sender webhook for inn-/utstempling? Er det et standardisert format, eller trenger du adapter per leverandør?
- **POS-systemer:** Skal salgsdata (f.eks. "siste salg registrert") trigge events? (F.eks. daglig avslutning)
- **Lønnssystem:** Genererer onboarding-completion et event som lønnssystemet trenger? (Endring fra prøvetid til fast ansatt)

---

## 4. Oppdatert datamodell

Basert på løsningene over, her er den reviderte tabellstrukturen:

### engine.events (oppdatert)

| Kolonne         | Type      | Beskrivelse                                 |
| --------------- | --------- | ------------------------------------------- |
| id              | uuid      | PK                                          |
| type            | text      | Event-type                                  |
| payload         | jsonb     | Kontekstdata                                |
| fired_at        | timestamp | Når eventet skjedde                         |
| workspace_id    | uuid      | Scope                                       |
| idempotency_key | text      | Valgfri dedup-nøkkel (UNIQUE der ikke NULL) |

### engine.triggers (uendret)

Samme som original.

### engine.delayed_triggers (NY)

| Kolonne      | Type      | Beskrivelse            |
| ------------ | --------- | ---------------------- |
| id           | uuid      | PK                     |
| trigger_id   | uuid      | FK → triggers          |
| event_id     | uuid      | FK → events            |
| fire_at      | timestamp | Når trigger skal fires |
| fired        | boolean   | Er den utført?         |
| workspace_id | uuid      | Scope                  |

### engine.processes (uendret)

Samme som original.

### engine.steps (oppdatert)

| Kolonne        | Type    | Beskrivelse                                    |
| -------------- | ------- | ---------------------------------------------- |
| id             | uuid    | PK                                             |
| process_id     | uuid    | FK → processes                                 |
| order          | integer | Rekkefølge                                     |
| step_group     | integer | Valgfri: steg med samme group kjøres parallelt |
| action_type    | text    | Type action                                    |
| action_payload | jsonb   | Innhold                                        |
| condition      | jsonb   | Standardisert condition-format                 |

### engine.states (oppdatert)

| Kolonne        | Type      | Beskrivelse                                                |
| -------------- | --------- | ---------------------------------------------------------- |
| id             | uuid      | PK                                                         |
| trigger_id     | uuid      | FK → triggers                                              |
| process_id     | uuid      | FK → processes                                             |
| current_step   | integer   | Hvilket steg vi er på                                      |
| status         | text      | pending / active / waiting / complete / failed / escalated |
| assignee_id    | uuid      | Hvem er ansvarlig                                          |
| context        | jsonb     | Data fra eventet                                           |
| entity_type    | text      | Hva dette handler om (employee, checklist, etc.)           |
| entity_id      | uuid      | Referanse til entiteten                                    |
| workspace_id   | uuid      | Scope (denormalisert)                                      |
| steps_snapshot | jsonb     | Kopi av prosess-steg ved oppstart                          |
| depth          | integer   | Nesting-nivå (0 = top-level)                               |
| retry_count    | integer   | Antall retries for current step                            |
| last_error     | text      | Siste feilmelding                                          |
| started_at     | timestamp | Start                                                      |
| updated_at     | timestamp | Siste endring                                              |
| completed_at   | timestamp | Fullført (nullable)                                        |

**Ny status: `waiting`** — brukes av `wait_for_event` for å skille "aktiv og jobber" fra "aktiv og venter på noe".

---

## 5. Neste steg

Prioritert rekkefølge for implementering:

1. **Oppdater grunnlagsdokumentet** med scope-grensene og det standardiserte condition-formatet
2. **Ta stilling til domenespørsmålene** i seksjon 3 — svarene påvirker alt annet
3. **Implementer events + states** med de nye kolonnene
4. **Bygg condition-evaluator** som én ren funksjon
5. **Bygg assignee-resolver** med fallback-regler
6. **Implementer delayed_triggers + pg_cron**
7. **Proof of concept:** 14-dagers onboarding med reelle data

---

_Dette dokumentet er et supplement til State Machine v1.1. Det erstatter ikke grunnlagsdokumentet, men adresserer åpne spørsmål og foreslår konkrete løsninger._
