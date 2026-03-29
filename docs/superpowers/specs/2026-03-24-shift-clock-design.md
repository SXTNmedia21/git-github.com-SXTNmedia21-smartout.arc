---
title: "ShiftClock — Punchklokke-komponent"
status: draft
updated: 2026-03-24
created: 2026-03-24
module: operations
tags: [shift-clock, punch, time-tracking, gps, payroll, chat, mobile, web]
---

# ShiftClock — Punchklokke-komponent

> Dedikert fullskjerm "Aktiv Vakt"-view. Den sentrale arbeidsflaten for ansatte.
> Samme komponent på web og mobil. Kronen på verket.

## Bakgrunn

Ansatte trenger én plass å stemple inn, jobbe gjennom vakten, kommunisere, registrere tillegg, ta pause, og stemple ut. Denne komponenten erstatter den fragmenterte tilnærmingen der punch, chat, oppgaver og notater lever i separate moduler.

**Referanser:**

- J-019 Punch Into Shift (journey spec, kun punch-in mobil — dette utvider massivt)
- J-024 Punch Out & See Summary (referert men ikke spekket — dekkes her)
- `timesheet.time_entry` (migrert, brukes som er)
- `payroll_manual_supplement` + `payroll_supplement_rule` (migrert, brukes for tillegg)
- `chat_conversation` med `source_type/source_id` (migrert, utvides)
- Interaktiv animasjons-demo: `.superpowers/brainstorm/64049-1774371756/punch-animation.html`

---

## Scope

### I scope

| #   | Funksjon             | Beskrivelse                                                           |
| --- | -------------------- | --------------------------------------------------------------------- |
| 1   | **Stemple inn**      | GPS-verifisert, planlagt vakt eller ad-hoc, trainee-modus             |
| 2   | **Stemple ut**       | GPS snapshot, oppsummering med timer/poeng/oppgaver                   |
| 3   | **Pause**            | Start/stopp, auto betalt/ubetalt via `payroll_break_rule`             |
| 4   | **Manuelle tillegg** | Ansatt registrerer forhåndskonfigurerte tillegg (smuss, ubekvem osv.) |
| 5   | **Notater**          | Fritekst-kommentarer på vakten                                        |
| 6   | **Chat**             | Avdelings-chat (alle på vakt) + privat shift-tråd (ansatt ↔ leder)    |
| 7   | **Voice**            | Ring alle ledere på vakt via WalkieTalkie/LiveKit                     |
| 8   | **Ad-hoc vakt**      | Ta åpen vakt eller start ny, admin-styrt per team/dept/dag            |
| 9   | **GPS Guard**        | Sjekk ved inn/ut/pause start/stopp, kan blokkere punch                |
| 10  | **Leder-oversikt**   | Live dashboard med alle aktive vakter + manuell punch for andre       |
| 11  | **Gamification**     | Poeng, streaks, achievements ved punch (fra J-019)                    |
| 12  | **Compliance**       | 11t hvile, maks uketimer, 5 år audit trail                            |

### Ikke i scope

- Fraværegistrering (egen modul)
- Vaktbytter/tilgjengelighetsregistrering
- Automatisk geofence punch (fremtidig)
- Tripletex-eksport (Phase D, ikke startet)

---

## Arkitektur

### State Machine

```
IDLE ──stemple inn──→ CLOCKED_IN ──stemple ut──→ SUMMARY ──ferdig──→ IDLE
                          ↕ pause
                       ON_BREAK
```

**GPS Guard** wrapper rundt alle state-overganger:

- `IDLE → CLOCKED_IN`: GPS sjekk — **kan blokkere** hvis admin-setting krever det
- `CLOCKED_IN → ON_BREAK`: GPS snapshot
- `ON_BREAK → CLOCKED_IN`: GPS snapshot
- `CLOCKED_IN → SUMMARY`: GPS sjekk + snapshot

### Komponent-hierarki

```
ShiftClockProvider (context: shift, timeEntry, phase, breaks, GPS, chat, supplements)
└── ShiftClockView (fullskjerm layout — tar over hele appen)
    ├── ShiftClockHeader (live timer, avdeling, status-badge)
    ├── ShiftClockActions (2x2 grid)
    │   ├── BreakToggle (auto betalt/ubetalt via regler)
    │   ├── NoteButton (åpner notat-input)
    │   ├── SupplementButton (åpner tillegg bottom sheet)
    │   └── CallDutyLeaders (WalkieTalkie → alle ledere på vakt)
    ├── ShiftClockTabs
    │   ├── FeedTab (oppgaver, dagsbriefing, arvede oppgaver)
    │   ├── ChatTab
    │   │   ├── SessionChat (source_type='session', alle på vakt)
    │   │   └── ShiftThread (source_type='shift', ansatt ↔ leder)
    │   └── NotesTab (kommentarer på vakten)
    ├── GPSGuard (wrapper — verifiserer ved alle state-overganger)
    ├── SupplementSheet (bottom sheet med forhåndskonfigurerte tillegg)
    └── ShiftClockSummary (ved punch-out: timer, pauser, poeng, tillegg, kommentar)
```

### Plattform-strategi

**Delt pakke (ren logikk, ingen DB-avhengigheter):**

```
packages/shift-clock/
├── src/
│   ├── state-machine.ts       — Pure: IDLE → CLOCKED_IN → ON_BREAK → SUMMARY
│   ├── types.ts                — ShiftClockState, GPSConfig, BreakRules, Zod schemas
│   ├── schemas.ts              — Zod validation for punch payloads, GPS, supplements
│   └── utils/
│       ├── break-classifier.ts — Pure fn: (arbeidstid, regler) → betalt|ubetalt
│       ├── gps-distance.ts     — Haversine avstandsberegning
│       └── points-calculator.ts — Pure fn: (punchTime, shiftStart, multipliers) → points
```

**Plattform-spesifikke hooks (med DB-tilgang):**

```
apps/web/src/hooks/shift-clock/
├── useShiftClock.ts            — Context + Supabase mutations
├── useGPSGuard.ts              — navigator.geolocation wrapper
├── useBreakRules.ts            — Henter payroll_break_rule fra DB
├── useShiftChat.ts             — Session-chat + shift-thread via Supabase
├── useShiftNotes.ts            — CRUD for shift_note via Supabase
└── useSupplements.ts           — Registrer/list manuelle tillegg via Supabase

apps/mobile/src/hooks/shift-clock/
├── useShiftClock.ts            — Context + offline queue mutations
├── useGPSGuard.ts              — expo-location wrapper
├── useBreakRules.ts            — Henter regler fra cache/DB
├── useShiftChat.ts             — Chat med offline-kø
├── useShiftNotes.ts            — CRUD med offline-kø
└── useSupplements.ts           — Tillegg med offline-kø
```

> **Mønster:** Matcher `packages/hms/` → pure logic i pakke, DB-avhengige hooks i apps. Hooks aksepterer IKKE injiserte klienter — de bruker plattformens Supabase-instans direkte.

**Plattform-spesifikt:**

| Concern | Mobile (`apps/mobile/`)     | Web (`apps/web/`)        |
| ------- | --------------------------- | ------------------------ |
| UI      | React Native components     | Next.js components       |
| GPS     | `expo-location`             | `navigator.geolocation`  |
| Voice   | LiveKit React Native SDK    | LiveKit Web SDK          |
| Offline | SQLite queue → sync         | Online-only              |
| Haptics | `expo-haptics`              | N/A                      |
| Route   | `/(app)/(home)/punch-clock` | `/dashboard/shift-clock` |

---

## Punch-in animasjon

> **Referanse-implementasjon:** `.superpowers/brainstorm/64049-1774371756/punch-animation.html`
> Denne HTML-filen er den kanoniske visuell referansen. Implementasjonen skal matche denne 1:1.

### Sekvens

1. **Stor glødende knapp** — Sirkulær, 180px diameter. Pulserende oransje glow-ring (conic gradient, roterer). Radial gradient innside (lys oransje sentrum → mørk oransje kant). Fingeravtrykk-SVG i sentrum.

2. **Press** — `scale(0.88)`, mørkere gradient, 200ms. Haptisk feedback (medium impact).

3. **Scanning-sekvens** (~2.5 sek) — Idle-skjermen fader ut (`scale(0.95) + opacity 0`). Fingeravtrykk pulserer i oransje. Spinning ring-border (1s rotation). 4 steg sjekkes av sekvensielt:
   - GPS-posisjon ✓ (400ms)
   - Identitet bekreftet ✓ (900ms)
   - Vakt aktivert ✓ (1500ms)
   - Sesjon startet ✓ (2100ms)
     Hvert steg: `active` (oransje puls) → `done` (grønn med checkmark).

4. **Suksess-eksplosjon** — Grønn sirkel bouncer inn (`cubic-bezier(0.34, 1.56, 0.64, 1)`). Checkmark tegnes med stroke-dasharray animasjon (0.6s). 60 konfetti-partikler i brand-farger faller ned (1.5-3.5s, random posisjon/størrelse/farge). Tekst fader opp sekvensielt:
   - "Du er stemplet inn!" (serif, 24px, 0.5s delay)
   - "Restaurant Sal · 15:00 – 23:00" (grønn, 0.7s delay)
   - "+7 poeng — Tidlig fugl!" (gull badge, 0.9s delay)

5. **Crossfade til aktiv vakt** (~2.6s etter suksess) — Suksess-overlay fader ut. Aktiv vakt-view fader inn. Live timer starter. Oppgavekort glir inn med staggered delay (0.1s mellom hvert kort).

### Design-tokens

| Element           | Verdi                                                                      |
| ----------------- | -------------------------------------------------------------------------- |
| Knapp diameter    | 180px (mobil), skaleres for web                                            |
| Glow ring         | `conic-gradient(#e85c0d, #ff8c42, #e85c0d, #d44a00, #e85c0d)`, 4s rotation |
| Pulse             | `scale(1) → scale(1.15)`, 2s ease-in-out infinite                          |
| Knapp gradient    | `radial-gradient(circle at 40% 35%, #ff8c42, #e85c0d 50%, #c43e00 100%)`   |
| Suksess grønn     | `#00b894` → `#00a381`                                                      |
| Konfetti farger   | `#e85c0d, #ff8c42, #ffd93d, #00b894, #5b9bd5, #b57edc, #ff6b6b, #6bcb77`   |
| Spring for bounce | `cubic-bezier(0.34, 1.56, 0.64, 1)`                                        |
| Haptisk           | Medium impact ved press, success notification ved ✓                        |

---

## UI-states

### Fase 1: IDLE (før stempling)

**Variant A: Planlagt vakt tilgjengelig**

- Header: "NESTE VAKT", tidspunkt, avdeling/zone badges
- Nedtelling: stor monospace timer til vaktstart
- Stor punch-knapp med fingeravtrykk (som beskrevet over)
- Info-kort: kollegaer på vakt (avatarer + antall)

**Variant B: Ingen planlagt vakt (ad-hoc aktivert)**

- Header: "INGEN PLANLAGT VAKT — Vil du starte en vakt?"
- Seksjon 1: Åpne vakter (ubemannede shifts) med "Ta vakt"-knapp per vakt
- Separator: "eller"
- Seksjon 2: "Start ny ad-hoc vakt" (dashed border, oransje ikon)
- Undertekst: "Krever godkjenning fra leder"

**Visibility-regler (fra J-019):**

| State             | Condition                  | Display                                  |
| ----------------- | -------------------------- | ---------------------------------------- |
| `shift_upcoming`  | Vakt om 5-30 min           | Nedtelling + aktiv knapp                 |
| `shift_now`       | Vakt startet ≤15 min siden | "Vakten din har startet!" + hastevisning |
| `shift_late`      | Vakt startet >15 min siden | "Du er X min forsinket" + advarsel       |
| `no_shift`        | Ingen vakt innenfor window | Ad-hoc view (hvis aktivert) eller tom    |
| `already_punched` | Aktiv time_entry           | Direkte til CLOCKED_IN view              |
| `trainee`         | profile.status = trainee   | Sandbox-merke: "Øvingsmodus"             |

### Fase 2: CLOCKED_IN (aktiv vakt)

- **Header:** Live timer (HH:MM:SS monospace), grønn status-badge "PÅ VAKT"
- **Actions:** 2x2 grid — Pause ☕, Notat 📝, Tillegg 💰, Ring leder 📞
- **Badge på Tillegg:** Viser antall registrerte tillegg (hvis > 0)
- **Registrerte tillegg-banner:** Under actions, viser siste tillegg med tidspunkt
- **Tabs:** Oppgaver (default) | Chat (med ulest-badge) | Notater
- **Feed:** Oppgavekort med fargekodede border-left (oransje=rutine, blå=briefing, grønn=oppgave)
- **Punch out-knapp:** Fast nederst, rød, gradient fade-overlay

### Fase 3: ON_BREAK (pause)

- **Header:** Pause-timer i oransje/rød, "PAUSE" status-badge
- **Info:** Arbeidstid så langt, antall pauser i dag, total pausetid
- **Stor knapp:** Grønn "Tilbake fra pause" med play-ikon
- **Pause-info kort:** "Pausetype avgjøres automatisk basert på arbeidstid og regler"

### Fase 4: SUMMARY (etter punch-out)

- **Header:** Checkmark + "Bra jobbet!" (serif)
- **Stats grid:** 2x2 — Arbeidstid, Pauser, Poeng opptjent, Dager på rad (streak)
- **Oppgaver-progress:** "3/3 fullført" med progress bar
- **Registrerte tillegg:** Liste over tillegg registrert under vakten
- **Kommentarfelt:** Valgfritt fritekst til vakten
- **Ferdig-knapp:** Oransje, returnerer til IDLE

---

## Manuelle tillegg

### Konsept

Admin forhåndskonfigurerer tilgjengelige tillegg per workspace/avdeling. Ansatte velger fra listen under aktiv vakt. Tilleggene krever leder-godkjenning og mapper direkte til `payroll_manual_supplement` via lønnskode.

### Ansatt-flyt

1. Trykk "Tillegg 💰" i action-grid
2. Bottom sheet åpnes med forhåndskonfigurerte tillegg
3. Velg tillegg → bekreftelseskjerm med:
   - Tilleggets navn og sats
   - **Obligatorisk kommentar** (beskrivelse av hendelsen)
   - Tidspunkt (default: nå)
4. Trykk "Registrer tillegg"
5. Badge oppdateres, banner vises under actions
6. Sendes til leder for godkjenning

### Admin-konfigurasjon

Dashboard → Innstillinger → Manuelle tillegg:

| Felt              | Beskrivelse                                                   |
| ----------------- | ------------------------------------------------------------- |
| Navn              | Tilleggets displaynavn (f.eks. "Smusstillegg")                |
| Beskrivelse       | Kort forklaring av når det gjelder                            |
| Lønnskode         | Mapper til `payroll_salary_code` (f.eks. 1450)                |
| Sats              | Beløp (kr)                                                    |
| Satstype          | Per time / Per vakt                                           |
| Avdelinger        | Hvilke avdelinger ser dette tillegget (alle eller spesifikke) |
| Kommentar påkrevd | Boolean — kan ikke registrere uten kommentar                  |
| Aktiv             | Boolean — toggle on/off                                       |

### Database-mapping

- `payroll_supplement_rule` med `type = 'manual'` — admin-konfigurasjonen
- `payroll_manual_supplement` — ansattens registrering (eksisterer allerede)
  - Kobling: `supplement_rule_id` → regelen, `schedule_shift_id` → vakten
  - Ny kolonne: `employee_comment TEXT` (obligatorisk kommentar)
  - Ny kolonne: `status` ENUM ('pending', 'approved', 'rejected') — leder-godkjenning
  - Ny kolonne: `reviewed_by UUID`, `reviewed_at TIMESTAMPTZ`

---

## Chat-arkitektur

### To kanaler

| Kanal          | `type`  | `source_type` | `source_id`             | Deltakere                  | Livssyklus                              |
| -------------- | ------- | ------------- | ----------------------- | -------------------------- | --------------------------------------- |
| Avdelings-chat | `group` | `session`     | `department_session_id` | Alle stemplet inn + ledere | Opprettes ved første punch-in den dagen |
| Shift-tråd     | `dm`    | `shift`       | `schedule_shift_id`     | Ansatt + nærmeste leder(e) | Opprettes ved punch-in                  |

### Regler

- Avdelings-chat: `chat_conversation.type = 'group'`. Man legges til som `chat_participant` ved punch-in, `left_at` settes ved punch-out
- Shift-tråd: `chat_conversation.type = 'dm'`. 1:1 (eller 1:N hvis flere ledere). Ansatt kan skrive kommentarer, spørsmål, flagge avvik
- Begge kanalene er tilgjengelige under `ChatTab` i ShiftClock-view
- Meldinger synkroniseres via Supabase Realtime (`chat_message` subscriptions)
- Mobil: offline meldinger køes i SQLite og synkes

---

## GPS Guard

### Konfigurasjon (cascading: team > department > workspace)

`shift_clock_config` tabell:

| Felt                      | Type    | Default  | Beskrivelse                                  |
| ------------------------- | ------- | -------- | -------------------------------------------- |
| `workspace_id`            | UUID FK | required | Workspace                                    |
| `department_id`           | UUID FK | nullable | Avdeling (overstyrer workspace)              |
| `team_id`                 | UUID FK | nullable | Team (overstyrer avdeling)                   |
| `gps_required`            | BOOLEAN | false    | **Blokkerer** punch uten GPS innenfor radius |
| `gps_radius_meters`       | INT     | 200      | Geofence radius                              |
| `gps_reference_lat`       | NUMERIC | nullable | Referansepunkt latitude                      |
| `gps_reference_lng`       | NUMERIC | nullable | Referansepunkt longitude                     |
| `adhoc_shifts_enabled`    | BOOLEAN | false    | Tillater ad-hoc vakter                       |
| `adhoc_requires_approval` | BOOLEAN | true     | Krever leder-godkjenning for ad-hoc          |
| `punch_window_minutes`    | INT     | 30       | Hvor tidlig man kan stemple inn              |

### GPS-snapshots

GPS registreres ved 4 tidspunkt (lagres i `timesheet.time_entry`):

1. **Punch-in:** `punch_in_location` JSONB `{lat, lng, accuracy, timestamp}`
2. **Pause start:** Legges til i `break_locations` JSONB array
3. **Pause slutt:** Legges til i `break_locations` JSONB array
4. **Punch-out:** `punch_out_location` JSONB `{lat, lng, accuracy, timestamp}`

### Blokkering

Hvis `gps_required = true` og avstand > `gps_radius_meters`:

- Punch-in **blokkeres**. Feilmelding: "Du er for langt fra arbeidsplassen. Kontakt leder."
- Pause/punch-out: snapshot tas men blokkeres **ikke** (ansatt må kunne avslutte)

---

## Ad-hoc vakter

### To metoder

1. **Ta åpen vakt:** Velg fra ubemannede `schedule_shift` med `employee_id IS NULL` og `status = 'published'`
2. **Start ny ad-hoc vakt:** Systemet oppretter `schedule_shift` med `is_adhoc = true`, `start_time = now()`

### Admin-kontroll

- `shift_clock_config.adhoc_shifts_enabled` — master toggle per team/dept/workspace
- `shift_clock_config.adhoc_requires_approval` — om leder må godkjenne
- Ved godkjenningskrav: push-varsel til ledere på vakt → godkjenn/avvis

### Database-endringer

`schedule_shift` utvidelser:

- `is_adhoc BOOLEAN DEFAULT false`
- `adhoc_approved_by UUID` (FK profile)
- `adhoc_approved_at TIMESTAMPTZ`

---

## Pause-regler

### Ansatt-opplevelse

Ansatt trykker "Pause" → timer bytter til pause-modus. Trykker "Tilbake fra pause" → tilbake til arbeidstid.

### Backend-klassifisering

`payroll_break_rule` (eksisterer) definerer:

- `trigger_type`: `after_duration` (etter X timer) eller `time_of_day`
- `trigger_value`: Antall minutter arbeidstid eller klokkeslett
- `duration_minutes`: Standard pauselengde
- `is_paid`: Boolean

**Pure function** `classifyBreak(workMinutes, breakDuration, rules)`:

1. Matcher regler basert på arbeidstid ved pause-start
2. Returnerer `{isPaid: boolean, rule: PayrollBreakRule | null}`
3. Ansatt ser **ikke** om pausen er betalt/ubetalt — bare "Pause"
4. Klassifiseringen brukes kun i lønnsberegning (`payroll_calculation_line`)

---

## WalkieTalkie-integrasjon

### "Ring leder"-knapp

- Trykk → starter voice call via LiveKit
- **Ringer alle** med leder-rolle som er stemplet inn (duty) for denne avdelingen
- Første som svarer tar samtalen
- Mobil: LiveKit React Native SDK
- Web: LiveKit Web SDK
- Avhengighet: LiveKit-integrasjon (wt-1, in progress)

### Fallback

Hvis LiveKit ikke er konfigurert/tilgjengelig: knappen åpner shift-tråd chatten direkte.

---

## Leder-oversikt (Web)

### Dashboard-view: `/dashboard/shift-clock`

- **Header:** "Aktive vakter" + avdeling + dato
- **Status-badges:** X på vakt (grønn), X på pause (oransje), X venter (grå)
- **Ansatt-kort grid:** Et kort per ansatt med:
  - Avatar, navn, rolle, zone
  - Status: PÅ VAKT / PAUSE / VENTER
  - Timer: Inn-tidspunkt + arbeidstid (live) eller pausetid
  - For ventende: "Starter: HH:MM" + "Stemple inn manuelt"-knapp
- **Manuell punch:** Leder kan stemple inn/ut for ansatte
- **Realtime:** Supabase subscription på `timesheet.time_entry` changes

---

## Database-endringer

### Endringer på eksisterende tabeller

**`timesheet.time_entry`:**

- `+ punch_out_location JSONB` — GPS ved punch-out `{lat, lng, accuracy, timestamp}`
- `+ break_locations JSONB` — GPS ved pause start/stopp `[{start: {lat,lng}, end: {lat,lng}}]`
- `+ notes TEXT` — Ansatt-kommentarer (valgfritt)

**`schedule_shift`:**

- `+ is_adhoc BOOLEAN DEFAULT false`
- `+ adhoc_approved_by UUID` (FK profile)
- `+ adhoc_approved_at TIMESTAMPTZ`

**`payroll.manual_supplement`:**

- `+ employee_comment TEXT` — Nullable i DB, **application-enforced** som obligatorisk i ShiftClock-flyten. Nullable fordi eksisterende supplement-flyt (admin-opprettet) ikke krever kommentar.
- `+ status supplement_claim_status DEFAULT 'pending'` — Ny enum
- `+ reviewed_by UUID` (FK profile)
- `+ reviewed_at TIMESTAMPTZ`

### Nye tabeller

**`shift_clock_config`** (workspace-scoped, cascading):

```sql
CREATE TABLE shift_clock_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES workspace(workspace_id),
  department_id         UUID REFERENCES department(department_id),
  team_id               UUID REFERENCES team(team_id),
  gps_required          BOOLEAN NOT NULL DEFAULT false,
  gps_radius_meters     INT NOT NULL DEFAULT 200,
  gps_reference_lat     NUMERIC(10,7),
  gps_reference_lng     NUMERIC(10,7),
  adhoc_shifts_enabled  BOOLEAN NOT NULL DEFAULT false,
  adhoc_requires_approval BOOLEAN NOT NULL DEFAULT true,
  punch_window_minutes  INT NOT NULL DEFAULT 30,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_shift_clock_config UNIQUE (workspace_id, department_id, team_id)
);
```

**`shift_note`** (per-vakt kommentarer):

```sql
CREATE TABLE shift_note (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id      UUID NOT NULL REFERENCES schedule_shift(schedule_shift_id),
  profile_id    UUID NOT NULL REFERENCES profile(profile_id),
  workspace_id  UUID NOT NULL REFERENCES workspace(workspace_id),
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger (use set_updated_at, NOT moddatetime)
CREATE TRIGGER set_shift_note_updated_at
  BEFORE UPDATE ON shift_note
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### RLS-policies

**`shift_clock_config`** (admin-only write, workspace read):

```sql
ALTER TABLE shift_clock_config ENABLE ROW LEVEL SECURITY;

-- JWT: all workspace members can read config
CREATE POLICY "jwt_read_shift_clock_config" ON shift_clock_config
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- JWT: only admins can manage config
CREATE POLICY "jwt_manage_shift_clock_config" ON shift_clock_config
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- API key: workspace-scoped read
CREATE POLICY "api_key_read_shift_clock_config" ON shift_clock_config
  FOR SELECT USING (workspace_id = get_api_workspace_id());
```

**`shift_note`** (employees write own, workspace read):

```sql
ALTER TABLE shift_note ENABLE ROW LEVEL SECURITY;

-- JWT: all workspace members can read notes
CREATE POLICY "jwt_read_shift_note" ON shift_note
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- JWT: employees can insert own notes
CREATE POLICY "jwt_insert_shift_note" ON shift_note
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND profile_id = (SELECT profile_id FROM profile WHERE user_id = auth.uid() LIMIT 1)
  );

-- API key: workspace-scoped read
CREATE POLICY "api_key_read_shift_note" ON shift_note
  FOR SELECT USING (workspace_id = get_api_workspace_id());
```

### Nye enums

```sql
CREATE TYPE supplement_claim_status AS ENUM ('pending', 'approved', 'rejected');
```

### Schema-plassering

Alle nye tabeller i `public` schema. Vurdert `timesheet` schema, men `shift_clock_config` konfigurerer adferd på tvers av `public.schedule_shift`, `public.chat_conversation`, og `timesheet.time_entry` — plassering i én spesifikk schema ville vært misvisende. `shift_note` relaterer til `public.schedule_shift`, ikke til timesheet-domenet. For få tabeller (2) til å rettferdiggjøre et eget schema.

`timesheet.time_entry` forblir i `timesheet` schema som den er.

---

## Telemetri

Alle mutations emitter via `@smartout/telemetry`. Event-navn følger eksisterende konvensjon i `registry.ts` (space-separated, ikke dot notation). Hvert event krever: (a) typed interface i `registry.ts`, (b) entry i `EVENT_ROUTING`, (c) `SmartoutEvent` union member.

| Event                         | Trigger               | Destinations                                  |
| ----------------------------- | --------------------- | --------------------------------------------- |
| `"shift punched_in"`          | Punch-in              | PostHog, logger, activity_trail, engine_event |
| `"shift punched_out"`         | Punch-out             | PostHog, logger, activity_trail, engine_event |
| `"shift break_started"`       | Pause start           | PostHog, logger, activity_trail               |
| `"shift break_ended"`         | Pause slutt           | PostHog, logger, activity_trail               |
| `"shift supplement_claimed"`  | Tillegg registrert    | PostHog, logger, activity_trail               |
| `"shift supplement_reviewed"` | Leder godkjent/avvist | PostHog, logger, activity_trail               |
| `"shift note_added"`          | Notat skrevet         | logger, activity_trail                        |
| `"shift adhoc_created"`       | Ad-hoc vakt opprettet | PostHog, logger, activity_trail, engine_event |
| `"shift adhoc_approved"`      | Ad-hoc godkjent       | PostHog, logger, activity_trail               |
| `"shift call_initiated"`      | Ring leder            | PostHog, logger                               |

---

## Compliance & Audit

Fra J-019 (gjelder fortsatt):

| Sjekk            | Lov                     | Handling                                  | Alvorlighet   |
| ---------------- | ----------------------- | ----------------------------------------- | ------------- |
| 11t hvile        | Arbeidsmiljøloven §10-8 | Advarsel hvis < 11t siden siste punch-out | warning       |
| Maks uketimer    | Arbeidsmiljøloven §10-6 | Flagg for manager ved >40t                | warning       |
| GPS-verifisering | Intern policy           | Blokkerer eller logger avhengig av config | block/warning |

**Audit trail retensjon:** 5 år (Arbeidsmiljøloven).

**Data lagret per punch:** Tidsstempel, GPS-koordinater (lat/lng/accuracy), device info, IP, verifikasjonsresultat.

---

## Gamification

Fra J-019 (gjelder for punch-in).

**Faseplan:** Gamification er Phase 2. ShiftClock V1 leveres uten poeng/streaks UI. Animasjonssekvensen viser suksess-skjerm uten poeng-badge. Når gamification-tabellene migreres, aktiveres poeng-UI via feature flag.

**Graceful degradation:** Hvis `points_event`-tabell ikke eksisterer:

- Suksess-animasjonen viser "Du er stemplet inn!" uten poeng-badge
- Summary-skjermen viser arbeidstid/pauser uten poeng/streak-kort
- Ingen feil, ingen broken UI — poeng-elementer er betinget rendret

**Poeng (Phase 2):**

- Base: 2 pts
- I tide (≤ shift start): +3 pts
- Tidlig (≤ shift start - 5min): +2 pts
- Sent (> shift start): -2 pts
- Veldig sent (> shift start + 15min): -3 pts
- × season_multiplier × workspace_booster
- Beregningslogikk: `packages/shift-clock/src/utils/points-calculator.ts` (ren funksjon, klar fra dag 1)

**Streaks (Phase 2):** `on_time_streak` — milepæler ved 3, 5, 10, 30 dager.

**Achievements (Phase 2):** `first_punch` (10 pts), `early_bird` (5 pts), `perfect_week` (25 pts, repeterbar).

---

## Avhengigheter

| Avhengighet                           | Status             | Blokkerer                                |
| ------------------------------------- | ------------------ | ---------------------------------------- |
| `timesheet.time_entry` tabell         | Migrert ✅         | Nei                                      |
| `payroll.manual_supplement` tabell    | Migrert ✅         | Nei                                      |
| `payroll.break_rule` tabell           | Migrert ✅         | Nei                                      |
| `chat_conversation` med `source_type` | Migrert ✅         | Nei                                      |
| LiveKit/WalkieTalkie                  | In progress (wt-1) | Ja, for voice. Fallback til chat.        |
| Gamification-tabeller                 | Ikke migrert ❌    | Nei — Phase 2, graceful degradation i V1 |

---

## i18n

All UI-tekst bruker i18n-nøkler fra `@smartout/i18n`. Norsk tekst i denne specen (f.eks. "Du er stemplet inn!", "Stemple inn", "Bra jobbet!") er design-intensjon, ikke literal implementasjon.

**Nøkkel-namespace:** `shift_clock.*`

| Nøkkel                              | Norsk (design)                     |
| ----------------------------------- | ---------------------------------- |
| `shift_clock.status.on_shift`       | PÅ VAKT                            |
| `shift_clock.status.on_break`       | PAUSE                              |
| `shift_clock.action.punch_in`       | Stemple inn                        |
| `shift_clock.action.punch_out`      | Stemple ut                         |
| `shift_clock.action.start_break`    | Pause                              |
| `shift_clock.action.end_break`      | Tilbake fra pause                  |
| `shift_clock.action.add_note`       | Notat                              |
| `shift_clock.action.add_supplement` | Tillegg                            |
| `shift_clock.action.call_leader`    | Ring leder                         |
| `shift_clock.success.punched_in`    | Du er stemplet inn!                |
| `shift_clock.summary.well_done`     | Bra jobbet!                        |
| `shift_clock.idle.next_shift`       | NESTE VAKT                         |
| `shift_clock.idle.no_shift`         | INGEN PLANLAGT VAKT                |
| `shift_clock.idle.start_adhoc`      | Start ny ad-hoc vakt               |
| `shift_clock.gps.blocked`           | Du er for langt fra arbeidsplassen |
| `shift_clock.supplement.pending`    | Sendes til leder for godkjenning   |

---

## Compliance-kjøring

Compliance-sjekker (11t hvile, maks uketimer) kjører **server-side** via Edge Function — ikke kun klient-side. Audit-kritisk logikk kan ikke stole på klienten.

**Edge Function:** `shift-clock-compliance`

| Sjekk          | Kjøretidspunkt                   | Logikk                                                                                              |
| -------------- | -------------------------------- | --------------------------------------------------------------------------------------------------- |
| 11t hvile      | Ved punch-in (server-validering) | Query siste `time_entry.punch_out` for profilen. Hvis `now() - punch_out < 11h` → returner warning. |
| Maks uketimer  | Ved punch-in (server-validering) | Sum `net_working_minutes` fra `payroll_calculation` denne uken. Hvis >40t → returner warning.       |
| GPS-blokkering | Ved punch-in (server-validering) | Hent `shift_clock_config` (cascading), beregn avstand, returner block/allow.                        |

**Flyt:**

1. Klient sender punch-in request med GPS-data
2. Edge Function kjører alle compliance-sjekker
3. Returnerer `{allowed: boolean, warnings: Warning[], block_reason?: string}`
4. Klient viser warnings/blokkering basert på respons
5. Audit trail skrives server-side uansett utfall

> **Viktig:** Klienten har **ikke** myndighet til å bestemme om en punch er lovlig. Server er sannhetskilde. Klient-side sjekker er kun for UX (rask feedback) — server dobbeltsjekker alt.

---

## Realtime-subscriptions

| Kanal                                       | Filter         | Payload                                                    | Subscribers                    |
| ------------------------------------------- | -------------- | ---------------------------------------------------------- | ------------------------------ |
| `timesheet.time_entry:workspace_id=eq.{id}` | INSERT, UPDATE | `{time_entry_id, profile_id, status, punch_in, punch_out}` | Leder-oversikt (web)           |
| `chat_message:conversation_id=eq.{id}`      | INSERT         | `{id, content, sender_id, created_at}`                     | ChatTab (session + shift tråd) |
| `shift_note:shift_id=eq.{id}`               | INSERT         | `{id, content, profile_id, created_at}`                    | NotesTab                       |
| `schedule_shift:workspace_id=eq.{id}`       | UPDATE         | `{schedule_shift_id, status, employee_id}`                 | Ad-hoc vakt-godkjenning        |

---

## Ikke-mål

- Ikke redesigne eksisterende chat-modul — vi bruker `chat_conversation`/`chat_message` som de er
- Ikke bygge payroll-beregning — vi skriver til `payroll_manual_supplement`, payroll-modulen leser
- Ikke erstatte eksisterende schedule-grid — ShiftClock er ansatt-facing, grid er leder-facing
- Ikke implementere automatisk geofence punch — kun manuell med GPS-verifisering
