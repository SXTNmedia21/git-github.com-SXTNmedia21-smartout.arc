---
title: "Journey: Punch Into Shift"
status: draft
updated: 2026-03-06
created: 2026-03-06
module: operations
tags: [journey, deep-spec, operations, employee]
---

# Journey: J-019 — Punch Into Shift (Stemple inn)

## Package Identity

- Package ID: `JP-R019-PUNCH-INTO-SHIFT`
- Roadmap ID: `R-019`
- Journey ID: `J-019`
- Mission ID: `M-019` (TBD)
- License ID: `L-019` (TBD)

Related package docs:

- [Roadmap](./Roadmap.md)
- [Mission](./Mission.md) (pending)
- [License](./License.md) (pending)

## Classification

| Field          | Value                                                                 |
| -------------- | --------------------------------------------------------------------- |
| **ID**         | `j-019`                                                               |
| **Title**      | Punch Into Shift                                                      |
| **Slug**       | `punch-into-shift`                                                    |
| **Module**     | Operations (`operations`)                                             |
| **Actor**      | Employee (`employee`)                                                 |
| **Platform**   | Mobile (`mobile`)                                                     |
| **Priority**   | P0 — Critical                                                         |
| **Depth Tier** | P0 Full                                                               |
| **Tags**       | `write`, `gps`, `gamification`, `real-time`, `audit-trail`, `sandbox` |

## Trigger

Ansatt ankommer arbeidsplassen og apner appen. Punch In-knappen er synlig pa Home-fanen nar et skift er planlagt innenfor +/- 30 minutter av navarende tidspunkt.

## Preconditions

| #   | Precondition                                                  | Validation                                             |
| --- | ------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | Bruker er autentisert                                         | `auth.uid()` eksisterer                                |
| 2   | Profil har status `active` eller `trainee` (for sandbox)      | `profile.status IN ('active', 'trainee')`              |
| 3   | Skift finnes som starter innenfor +/- 30 min av na            | `shift.start_time BETWEEN now()-30min AND now()+30min` |
| 4   | Skiftet er tildelt denne profilen                             | `shift.profile_id = current_profile_id`                |
| 5   | Ingen aktiv stempling eksisterer (ikke allerede stemplet inn) | `NOT EXISTS punch_record WHERE punch_out IS NULL`      |
| 6   | Workspace har Operations-modulen aktiv                        | `workspace.active_modules @> '{operations}'`           |

## Related Journeys

| Relation        | Journey                           | Why                                      |
| --------------- | --------------------------------- | ---------------------------------------- |
| Requires        | J-011 Check My Schedule           | Ansatt ma vite at de har en vakt         |
| Leads to        | J-020 Work Through Feed Tasks     | Etter stempling lastes feed med oppgaver |
| Leads to        | J-021 View Day Brief              | Dagsbriefing vises etter stempling       |
| Opposite        | J-024 Punch Out & See Summary     | Avslutter det denne journey-en starter   |
| Sandbox variant | J-005 Module Journey (Operations) | Trainee gjor sandbox-stempling           |

## AI Council Validation

| Persona                | Applicable | Notes                                                                                                                |
| ---------------------- | :--------: | -------------------------------------------------------------------------------------------------------------------- |
| Multi-site Manager     |    yes     | Trenger sanntids-oversikt over hvem som har stemplet inn pa tvers av lokasjoner. Varsler ved forsinkelse er kritisk. |
| Back-office Admin      |    yes     | Audit trail og etterlevelse av Arbeidsmiljeloven er kjernekrav. Eksportmuligheter for tidsdata.                      |
| External Consultant    |    yes     | ROI-malbar: redusert tid pa manuell tidsregistrering, okt punktlighet via gamification.                              |
| Career Professional    |    yes     | Ma fungere smidig under live service — stempling pa under 5 sekunder.                                                |
| Fast-food Entry Worker |    yes     | Enkel, intuitiv flyt. Stor knapp, tydelig bekreftelse. Ingen forvirring.                                             |
| Low-literacy Worker    |    yes     | Visuell bekreftelse (konfetti, hake), minimal tekst. Farger og ikoner kommuniserer status.                           |
| Sommelier/Specialist   |    yes     | Samme flyt uavhengig av spesialisering. GPS og tidsregistrering gjelder alle.                                        |

## Niche Focus

| Niche dimension           | Multiplier | Effect                                                           |
| ------------------------- | :--------: | ---------------------------------------------------------------- |
| high-volume               |    1.3     | Hoy frekvens av stemplinger — ytelse og responstid er kritisk    |
| full-service              |    1.0     | Standard punch-flyt, ingen spesielle tilpasninger                |
| premium / quality-service |    1.1     | Punktlighet vektes hoyere — ekstra bonuspoeng for tidlig oppmote |
| high-turnover-workforce   |    1.2     | Mange nye ansatte — trainee/sandbox-modus ma fungere feilfritt   |
| multi-location            |    1.2     | GPS-verifisering viktigere, manager-varsler pa tvers av steder   |

---

## STEP 1: See Punch-In Availability

### Action

| Field       | Value                                                       |
| ----------- | ----------------------------------------------------------- |
| Description | Ansatt apner appen og ser Home-fanen med punch-in CTA       |
| Type        | `navigate`                                                  |
| Target      | Home-fane (automatisk valgt nar appen apnes og vakt er nar) |

### UI Elements

| testId                 | Type   | Label (NO)                            | Variant          |                  Visible When                  |     Disabled When     |
| ---------------------- | ------ | ------------------------------------- | ---------------- | :--------------------------------------------: | :-------------------: |
| `home-tab`             | tab    | "Hjem"                                | active           |                     Alltid                     |         Aldri         |
| `punch-cta-card`       | card   | —                                     | elevated         | Skift innenfor +/- 30 min OG ikke stemplet inn |           —           |
| `punch-cta-shift-info` | text   | "Din vakt starter om {{minutes}} min" | body             |                Inne i CTA-kort                 |           —           |
| `punch-cta-dept`       | badge  | "{{department_name}}"                 | department-color |                Inne i CTA-kort                 |           —           |
| `punch-cta-time`       | text   | "{{shift_start}} – {{shift_end}}"     | caption          |                Inne i CTA-kort                 |           —           |
| `punch-in-btn`         | button | "Stemple inn"                         | primary          |                Inne i CTA-kort                 | Allerede stemplet inn |

### Screen States

| State             | Condition                        | Display                                                              |
| ----------------- | -------------------------------- | -------------------------------------------------------------------- |
| `shift_upcoming`  | Skift om 5-30 min                | CTA-kort: "Din vakt starter om X min" + aktivert knapp               |
| `shift_now`       | Skift startet for <=15 min siden | CTA-kort: "Vakten din har startet!" + fremhevet knapp + hastevisning |
| `shift_late`      | Skift startet for >15 min siden  | CTA-kort: "Du er {{min}} minutter forsinket" + advarselsvisning      |
| `no_shift`        | Ingen skift innenfor +/- 30 min  | Ingen CTA-kort. Vanlig hjemmefeed eller vaktplanlenke                |
| `already_punched` | Aktiv punch-record eksisterer    | CTA erstattet av aktiv vakt-indikator                                |
| `trainee`         | profile.status = trainee         | CTA-kort med sandbox-merke: "Ovingsmodus"                            |

### Data Operations

**Reads:**
| Table | Operation | Fields | Condition | RLS Policy | Index |
|-------|-----------|--------|-----------|-----------|-------|
| `schedule_shift` | SELECT | id, start_time, end_time, department_id, position, location_id | `profile_id = me AND start_time BETWEEN now()-30min AND now()+30min AND status = 'published'` | `shift_employee_read` | `idx_shift_profile_start` |
| `department` | SELECT | name, color | `id = shift.department_id` | `department_workspace_read` | PK |
| `punch_record` | SELECT | id | `profile_id = me AND punch_out IS NULL` | `punch_record_employee_read` | `idx_punch_active` |
| `department_session` | SELECT | id, status | `department_id = shift.department_id AND date = today()` | `session_workspace_read` | `idx_session_dept_date` |

**Writes:**
| Table | Operation | Fields | Notes |
|-------|-----------|--------|-------|
| — | — | — | Ingen skrivinger i dette steget |

**Realtime:**
| Channel | Event | Payload | Subscribers |
|---------|-------|---------|-------------|
| — | — | — | Ingen sanntid i dette steget |

### Events

**Emitted:**
| Event | Payload | Consumers |
|-------|---------|-----------|
| — | — | Ingen hendelser sendes i dette steget (pre-action) |

**Listened to:**
| Event | Source | Action |
|-------|--------|--------|
| `SHIFT_PUBLISHED` | Scheduling module | Oppdater skiftdata, vis/skjul CTA |
| `SHIFT_CANCELLED` | Scheduling module | Skjul CTA hvis dette var det matchende skiftet |

**Side Effects:**
| # | Description | Trigger | Type | Async |
|---|-------------|---------|------|:-----:|
| — | — | — | — | — |

### Notifications (P0 only)

| Template | Channel | Recipient | Title (NO) | Body (NO) | Deep Link | Priority | Condition                                 |
| -------- | ------- | --------- | ---------- | --------- | --------- | :------: | ----------------------------------------- |
| —        | —       | —         | —          | —         | —         |    —     | Ingen varsler i dette steget (pre-action) |

### Gamification (P0 only)

**Points:**
| Action | Base | Season Mult. | Category | Description |
|--------|:----:|:---:|----------|-------------|
| — | — | — | — | Ingen poeng i dette steget (pre-action) |

**Conditional Bonuses:**
| Condition | Bonus | Label (NO) | Description |
|-----------|:-----:|-----------|-------------|
| — | — | — | — |

**Achievements:**
| ID | Name (NO) | Condition | Icon | Points | One-time |
|----|----------|-----------|------|:------:|:--------:|
| — | — | — | — | — | — |

**Streaks:**
| Streak | Action | Milestones |
|--------|--------|------------|
| — | — | — |

### Compliance & Audit (P0 only)

**Audit Trail:**
| Type | Actor | Target | Data | Retention |
|------|-------|--------|------|-----------|
| — | — | — | — | Ingen audit i dette steget (pre-action) |

**Compliance Checks:**
| Law/Policy | Check | Action | Severity |
|-----------|-------|--------|:--------:|
| — | — | — | — |

### Error Scenarios

| #   | Trigger                            | Code             | User Message (NO)           | Recovery                           | Severity | Notify Admin |
| --- | ---------------------------------- | ---------------- | --------------------------- | ---------------------------------- | :------: | :----------: |
| 1   | Ingen skift funnet                 | `PUNCH_NO_SHIFT` | "Du har ingen vakt na"      | Vis lenke til vaktplan             |   info   |     nei      |
| 2   | Nettverksfeil ved lasting av skift | `NETWORK_ERROR`  | "Kunne ikke laste vaktdata" | Retry-knapp + offline-cachet skift | warning  |     nei      |

### Test Assertions

| Type         | Selector                               | Expected                                | Timeout |
| ------------ | -------------------------------------- | --------------------------------------- | :-----: |
| `visible`    | `[data-testid="punch-cta-card"]`       | Synlig nar skift innenfor 30 min        |  5000   |
| `text`       | `[data-testid="punch-cta-shift-info"]` | Inneholder starttidspunkt for skift     |  3000   |
| `enabled`    | `[data-testid="punch-in-btn"]`         | Aktivert nar ikke allerede stemplet inn |  3000   |
| `not_exists` | `[data-testid="punch-cta-card"]`       | Ikke synlig nar ingen skift planlagt    |  3000   |

---

## STEP 2: Tap Punch In

### Action

| Field       | Value                                   |
| ----------- | --------------------------------------- |
| Description | Ansatt trykker pa "Stemple inn"-knappen |
| Type        | `tap`                                   |
| Target      | `punch-in-btn`                          |

### UI Elements

| testId                     | Type      | Label (NO)    | Variant |        Visible When         |  Disabled When   |
| -------------------------- | --------- | ------------- | ------- | :-------------------------: | :--------------: |
| `punch-in-btn`             | button    | "Stemple inn" | primary |       Inne i CTA-kort       | Under behandling |
| `punch-confirming-spinner` | indicator | —             | loading | Etter tap, under behandling |        —         |

### Screen States

| State              | Condition                       | Display                              |
| ------------------ | ------------------------------- | ------------------------------------ |
| `punch-confirming` | Etter tap, venter pa GPS/server | Spinner pa knappen, knapp deaktivert |

**UI Transitions:**
| From | To | Animation | Duration | Loading |
|------|-----|-----------|----------|---------|
| `punch-cta-card` | `punch-confirming` | Knapp viser spinner | 200ms | Yes |
| `punch-confirming` | `punch-gps-check` (hvis GPS aktivert) | Modal slide-up | 300ms | Yes |
| `punch-confirming` | `punch-success` (hvis GPS deaktivert) | Konfetti + kort-transformasjon | 500ms | No |

### Data Operations

**Reads:**
| Table | Operation | Fields | Condition | RLS Policy | Index |
|-------|-----------|--------|-----------|-----------|-------|
| `workspace` | SELECT | gps_punch_enabled, gps_punch_radius, gps_lat, gps_lng | `id = current_workspace_id` | `workspace_member_read` | PK |

**Writes:**
| Table | Operation | Fields | Notes |
|-------|-----------|--------|-------|
| `punch_record` | INSERT | `id` (uuid), `workspace_id`, `profile_id`, `shift_id`, `session_id`, `punch_in` (now()), `punch_type` ('shift_start'), `gps_lat`, `gps_lng`, `gps_accuracy`, `gps_verified` (bool), `device_info` (user agent), `is_sandbox` (trainee?), `created_at` | Kjerne-stemplingspost |
| `schedule_shift` | UPDATE | `actual_start` = now(), `status` = 'in_progress' | Marker skift som startet |
| `department_session` | UPDATE | Legg til profile_id i `active_employees`-array | Legg til i aktiv sesjon |

**Realtime:**
| Channel | Event | Payload | Subscribers |
|---------|-------|---------|-------------|
| `session:{session_id}` | `employee_punched_in` | `{ profileId, profileName, shiftId, punchTime, isOnTime, department }` | Alle ansatte i samme sesjon + managere |
| `workspace:{workspace_id}:admin` | `punch_event` | `{ profileId, profileName, department, punchTime, isLate }` | Adminer som ser pa dashboard |

### Events

**Emitted:**
| Event | Payload | Consumers |
|-------|---------|-----------|
| `SHIFT_PUNCHED_IN` | `{ profileId, shiftId, sessionId, punchTime, isOnTime, isLate, minutesEarlyOrLate, isSandbox }` | Feed-laster, sesjonsmanager, gamification-motor, audit-logger, AI-kontekstmotor |
| `SESSION_EMPLOYEE_JOINED` | `{ sessionId, profileId, activeCount }` | Sesjonstavle (manager-visning), hodetetsteller |
| `CONTEXT_SWITCH` | `{ newContext: 'session', sessionId, departmentId }` | App-shell (bytter fane-kontekst) |

**Listened to:**
| Event | Source | Action |
|-------|--------|--------|
| — | — | Ingen i dette steget |

**Side Effects:**
| # | Description | Trigger | Type | Async |
|---|-------------|---------|------|:-----:|
| 1 | App-kontekst bytter automatisk til aktiv sesjon | `CONTEXT_SWITCH` | `ui` | No |
| 2 | Feed laster med sesjons-spesifikt innhold | `SHIFT_PUNCHED_IN` | `ui` | Yes |
| 3 | Dagsbriefing pinnet ost i feed | `SESSION_EMPLOYEE_JOINED` | `ui` | Yes |
| 4 | Sesjonsoppgaver tildelt denne profilen lastes | `SHIFT_PUNCHED_IN` | `data` | Yes |
| 5 | AI-kontekst oppdatert (ansatt er na pa vakt) | `SHIFT_PUNCHED_IN` | `ai` | Yes |
| 6 | Gamification-poeng beregnes og tildeles | `SHIFT_PUNCHED_IN` | `data` | Yes |

### Notifications (P0 only)

| Template                | Channel          | Recipient              | Title (NO)                                   | Body (NO)                                    | Deep Link                          | Priority | Condition                           |
| ----------------------- | ---------------- | ---------------------- | -------------------------------------------- | -------------------------------------------- | ---------------------------------- | :------: | ----------------------------------- |
| `shift.punch_in`        | `in_app`         | Manager for avdelingen | "{{name}} har stemplet inn"                  | "{{department}} — {{shift_time}}"            | `/operations/session/{session_id}` |   low    | Alltid                              |
| `shift.punch_late`      | `push`, `in_app` | Manager                | "{{name}} stemplet inn {{min}} min for sent" | "{{department}} — forventet {{shift_start}}" | `/operations/session/{session_id}` |  normal  | `minutesLate > 5`                   |
| `shift.punch_very_late` | `push`, `sms`    | Admin                  | "{{name}} er {{min}} min forsinket"          | "{{department}} — ingen stempling enna"      | `/operations/session/{session_id}` |   high   | `minutesLate > 30 AND no_punch_yet` |

### Gamification (P0 only)

**Points:**
| Action | Base | Season Mult. | Category | Description |
|--------|:----:|:---:|----------|-------------|
| `punch_in` | 2 | yes | `attendance` | Basispoeng for a stemple inn |

**Conditional Bonuses:**
| Condition | Bonus | Label (NO) | Description |
|-----------|:-----:|-----------|-------------|
| `punch_time <= shift_start` | +3 | "I tide" | I tide eller tidlig |
| `punch_time <= shift_start - 5min` | +2 | "Tidlig-fugl" | 5+ minutter tidlig (stables med over) |
| `punch_time > shift_start` | -2 | "Forsinket" | Trekk for sen ankomst |
| `punch_time > shift_start + 15min` | -3 | "Veldig sent" | Ekstra trekk (stables med over) |

**Point Calculation:**

```
Base:        2 pts
I tide:     +3 pts (hvis punch <= shift start)
Tidlig:     +2 pts (hvis punch <= shift start - 5min)
Sent:       -2 pts (hvis punch > shift start)
Veldig sent:-3 pts (hvis punch > shift start + 15min)
                ------
Subtotal:   2-7 pts (i tide) eller -3 til 0 pts (sent)
                x season_multiplier (standard 1.0)
                x workspace_booster (hvis aktiv)
                ------
Final:      Skrives til points_event-tabellen
```

**Achievements:**
| ID | Name (NO) | Condition | Icon | Points | One-time |
|----|----------|-----------|------|:------:|:--------:|
| `first_punch` | "Forste dag!" | Forste stempling noensinne | flagg | 10 | yes |
| `early_bird` | "Tidlig fugl" | Stemple inn 15+ min tidlig | fugl | 5 | yes |
| `perfect_week` | "Perfekt uke" | 5 i-tide stemplinger pa rad (man-fre) | stjerne | 25 | no (repeterbar) |

**Streaks:**
| Streak | Action | Milestones |
|--------|--------|------------|
| `on_time_streak` | I-tide stempling: inkrementer. Sent: reset til 0. | 3 dager: +5 pts "Tre pa rad!", 5 dager: +10 pts "Uke-mester!", 10 dager: +25 pts "Punktlighets-guru!", 30 dager: +100 pts "Manedens beste!" |

### Compliance & Audit (P0 only)

**Audit Trail:**
| Type | Actor | Target | Data | Retention |
|------|-------|--------|------|-----------|
| `punch_in` | `profile:{id}` | `shift:{id}` | Tidsstempel, GPS-koordinater, enhet, IP, noyaktighet, is_verified | 5 ar (Arbeidsmiljeloven) |
| `session_join` | `profile:{id}` | `session:{id}` | Tiltredelsestidspunkt, antall aktive ansatte | 5 ar |

**Compliance Checks:**
| Law/Policy | Check | Action | Severity |
|-----------|-------|--------|:--------:|
| Arbeidsmiljeloven SS10-8 | Minimum 11 timers hvile siden siste punch-out | Hvis <11t: vis advarsel "Du har hvilt under 11 timer. Vennligst bekreft at du onsker a starte." | `warning` |
| Arbeidsmiljeloven SS10-6 | Maks uketimer (40t normalt) | Hvis dette skiftet overstiger 40t: flagg for manager-gjennomgang | `warning` |
| Intern policy | GPS-verifisering | Hvis GPS-avvik >500m: tillat med manager-overstyring | `warning` |

### Error Scenarios

| #   | Trigger                                 | Code                   | User Message (NO)                                                            | Recovery                                                               | Severity | Notify Admin |
| --- | --------------------------------------- | ---------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- | :------: | :----------: |
| 1   | GPS >500m fra workspace                 | `PUNCH_GPS_MISMATCH`   | "Du ser ut til a vare langt fra arbeidsplassen. Vil du stemple inn likevel?" | Tillat med kommentarfelt, manager varsles                              | warning  |     yes      |
| 2   | GPS utilgjengelig                       | `PUNCH_GPS_UNAVAIL`    | "Kunne ikke finne posisjonen din"                                            | Tillat stempling uten GPS, flagg i post                                |   info   |      no      |
| 3   | Allerede stemplet inn                   | `PUNCH_ALREADY_ACTIVE` | "Du er allerede stemplet inn"                                                | Vis aktiv vaktinfo                                                     |   info   |      no      |
| 4   | Ingen sesjon eksisterer                 | `PUNCH_NO_SESSION`     | "Ingen aktiv okt funnet for avdelingen"                                      | Auto-opprett sesjon hvis innenfor apningstider, ellers kontakt manager | warning  |     yes      |
| 5   | Nettverksfeil                           | `NETWORK_ERROR`        | "Ingen nettverkstilkobling. Prov igjen."                                     | Ko stempling lokalt, prov igjen nar online                             | warning  |      no      |
| 6   | Trainee forsoker reell stempling        | `PUNCH_SANDBOX_ONLY`   | n/a (usynlig — systemet ruter automatisk til sandbox)                        | Opprett sandbox stemplingspost (is_sandbox = true)                     |   info   |      no      |
| 7   | Skift ikke tildelt bruker               | `PUNCH_WRONG_SHIFT`    | "Denne vakten er ikke tildelt deg"                                           | Vis brukerens faktiske skift                                           |  block   |      no      |
| 8   | Workspace krever GPS men tilgang nektet | `PUNCH_GPS_REQUIRED`   | "Arbeidsplassen krever GPS-verifisering. Vennligst aktiver stedstjenester."  | Lenke til enhetsinnstillinger                                          |  block   |      no      |

### Test Assertions

| Type        | Selector                                   | Expected                              | Timeout |
| ----------- | ------------------------------------------ | ------------------------------------- | :-----: |
| `visible`   | `[data-testid="punch-confirming-spinner"]` | Synlig etter tap pa knapp             |  1000   |
| `db_record` | `punch_record`                             | Post eksisterer med punch_in = ~now() |  5000   |
| `db_record` | `schedule_shift`                           | status = 'in_progress'                |  5000   |
| `visible`   | `[data-testid="punch-success-message"]`    | Synlig etter vellykket stempling      |  5000   |

---

## STEP 3: GPS Verification (Conditional)

_Dette steget oppstar kun hvis `workspace.gps_punch_enabled = true`._

### Action

| Field       | Value                                                            |
| ----------- | ---------------------------------------------------------------- |
| Description | Systemet ber om GPS-posisjon og validerer mot workspace-lokasjon |
| Type        | `system_auto`                                                    |
| Target      | Enhets-GPS-API                                                   |

### UI Elements

| testId                 | Type      | Label (NO)                     | Variant |         Visible When         | Disabled When |
| ---------------------- | --------- | ------------------------------ | ------- | :--------------------------: | :-----------: |
| `gps-check-modal`      | modal     | "Bekrefter posisjon..."        | loading |       GPS-sjekk pagar        |       —       |
| `gps-check-success`    | indicator | "Posisjon bekreftet"           | success |      GPS verifisert OK       |       —       |
| `gps-check-warning`    | indicator | "Du er {{distance}}m unna"     | warning |          GPS-avvik           |       —       |
| `gps-override-btn`     | button    | "Stemple inn likevel"          | ghost   | Avvik men innenfor toleranse |       —       |
| `gps-override-comment` | input     | "Hvorfor er du et annet sted?" | text    |      Overstyring valgt       |       —       |

### Screen States

| State             | Condition                        | Display                                     |
| ----------------- | -------------------------------- | ------------------------------------------- |
| `gps_checking`    | GPS-sjekk pagar                  | Modal med spinner + kartnal-animasjon       |
| `gps_verified`    | Avstand <= radius                | Suksessindikator, vises 1s for auto-dismiss |
| `gps_mismatch`    | Avstand > radius men < 2x radius | Advarsel med overstyringmulighet            |
| `gps_far`         | Avstand > 2x radius              | Blokkert stempling (workspace-policy)       |
| `gps_unavailable` | Enhet nektet eller timeout       | Fortsett uten GPS (flagg i post)            |

### Data Operations

**Reads:**
| Table | Operation | Fields | Condition | RLS Policy | Index |
|-------|-----------|--------|-----------|-----------|-------|
| Device GPS | `getCurrentPosition()` | lat, lng, accuracy | `{enableHighAccuracy: true, timeout: 10000}` | n/a | n/a |

**Writes:**
| Table | Operation | Fields | Notes |
|-------|-----------|--------|-------|
| — | — | — | Ingen skrivinger; GPS-data inkluderes i punch_record fra Steg 2 |

**Realtime:**
| Channel | Event | Payload | Subscribers |
|---------|-------|---------|-------------|
| — | — | — | — |

### Events

**Emitted:**
| Event | Payload | Consumers |
|-------|---------|-----------|
| `GPS_VERIFIED` | `{ verified: bool, distance, accuracy }` | Punch-flyt (fortsett/blokker) |

**Listened to:**
| Event | Source | Action |
|-------|--------|--------|
| — | — | — |

**Side Effects:**
| # | Description | Trigger | Type | Async |
|---|-------------|---------|------|:-----:|
| 1 | GPS-avvik logges i audit trail | `GPS_VERIFIED` med verified=false | `data` | Yes |

### Notifications (P0 only)

| Template             | Channel  | Recipient | Title (NO)                                 | Body (NO)                                         | Deep Link                          | Priority | Condition             |
| -------------------- | -------- | --------- | ------------------------------------------ | ------------------------------------------------- | ---------------------------------- | :------: | --------------------- |
| `shift.gps_override` | `in_app` | Manager   | "{{name}} stemplet inn fra annen lokasjon" | "Avstand: {{distance}}m — Kommentar: {{comment}}" | `/operations/session/{session_id}` |  normal  | GPS-overstyring brukt |

### Gamification (P0 only)

**Points:**
| Action | Base | Season Mult. | Category | Description |
|--------|:----:|:---:|----------|-------------|
| — | — | — | — | Ingen poeng i dette steget |

**Conditional Bonuses:**
| Condition | Bonus | Label (NO) | Description |
|-----------|:-----:|-----------|-------------|
| — | — | — | — |

**Achievements:**
| ID | Name (NO) | Condition | Icon | Points | One-time |
|----|----------|-----------|------|:------:|:--------:|
| — | — | — | — | — | — |

**Streaks:**
| Streak | Action | Milestones |
|--------|--------|------------|
| — | — | — |

### Compliance & Audit (P0 only)

**Audit Trail:**
| Type | Actor | Target | Data | Retention |
|------|-------|--------|------|-----------|
| `gps_check` | `system` | `punch_record:{id}` | Enhetskoordinater, workspace-koordinater, avstand, noyaktighet, resultat | 5 ar |
| `gps_override` | `profile:{id}` | `punch_record:{id}` | Overstyring-kommentar, avstand, tidspunkt | 5 ar |

**Compliance Checks:**
| Law/Policy | Check | Action | Severity |
|-----------|-------|--------|:--------:|
| Intern policy | GPS-verifisering | Logg avvik, varsle manager ved overstyring | `warning` |

### Error Scenarios

| #   | Trigger                     | Code          | User Message (NO)                        | Recovery                                         | Severity | Notify Admin |
| --- | --------------------------- | ------------- | ---------------------------------------- | ------------------------------------------------ | :------: | :----------: |
| 1   | GPS-timeout (>10s)          | `GPS_TIMEOUT` | "Kunne ikke finne posisjonen din i tide" | Tillat stempling uten GPS, flagg                 |   info   |      no      |
| 2   | GPS-tilgang nektet          | `GPS_DENIED`  | "Stedstjenester er deaktivert"           | Lenke til innstillinger, eller fortsett uten GPS | warning  |      no      |
| 3   | GPS langt unna (>2x radius) | `GPS_TOO_FAR` | "Du er for langt fra arbeidsplassen"     | Blokkert — kontakt manager                       |  block   |     yes      |

### Test Assertions

| Type      | Selector                            | Expected                              | Timeout |
| --------- | ----------------------------------- | ------------------------------------- | :-----: |
| `visible` | `[data-testid="gps-check-modal"]`   | Synlig nar GPS-sjekk pagar            |  3000   |
| `visible` | `[data-testid="gps-check-success"]` | Synlig nar GPS er verifisert          |  12000  |
| `visible` | `[data-testid="gps-check-warning"]` | Synlig ved GPS-avvik                  |  12000  |
| `enabled` | `[data-testid="gps-override-btn"]`  | Aktivert ved avvik innenfor toleranse |  3000   |

---

## STEP 4: Punch Success + Context Switch

### Action

| Field       | Value                                                      |
| ----------- | ---------------------------------------------------------- |
| Description | Stempling bekreftet. Appen bytter til aktiv vakt-kontekst. |
| Type        | `system_auto`                                              |
| Target      | App shell kontekst-manager                                 |

### UI Elements

| testId                      | Type      | Label (NO)                | Variant        |    Visible When     | Disabled When |
| --------------------------- | --------- | ------------------------- | -------------- | :-----------------: | :-----------: |
| `punch-success-animation`   | animation | —                         | confetti       | Stempling vellykket |       —       |
| `punch-success-message`     | text      | "Du er stemplet inn!"     | large-centered | Stempling vellykket |       —       |
| `punch-success-points`      | badge     | "+{{points}} poeng"       | animated       | Stempling vellykket |       —       |
| `punch-success-streak`      | badge     | "{{count}} dager pa rad!" | animated       | Streak-milepel nadd |       —       |
| `punch-success-achievement` | card      | Achievement-kort          | celebration    | Achievement opplast |       —       |

### Screen States

| State                 | Condition           | Display                                       |
| --------------------- | ------------------- | --------------------------------------------- |
| `success_animation`   | Stempling vellykket | Konfetti + hakemerke, 1.5s                    |
| `success_message`     | Etter animasjon     | "Du er stemplet inn!" stor sentrert tekst, 2s |
| `success_points`      | Poeng tildelt       | Animert poeng-teller                          |
| `success_streak`      | Streak-milepel nadd | Streak-badge med flammeikon                   |
| `success_achievement` | Achievement opplast | Achievement-kort med ikon og beskrivelse      |

**UI Transitions:**
| From | To | Animation | Duration | Loading |
|------|-----|-----------|----------|---------|
| Punch CTA | Suksess-animasjon | Konfetti + hakemerke | 1500ms | No |
| Suksess-animasjon | Feed (sesjonskontekst) | Crossfade | 500ms | No |
| Home-fane (generisk) | Home-fane (sesjonskontekst) | Innholdsbytte | 300ms | No |
| Bunnfaner | Bunnfaner (sesjonsindikator) | Badge vises pa Hjem | 200ms | No |

### Data Operations

**Reads:**
| Table | Operation | Fields | Condition | RLS Policy | Index |
|-------|-----------|--------|-----------|-----------|-------|
| — | — | — | — | — | — |

**Writes:**
| Table | Operation | Fields | Notes |
|-------|-----------|--------|-------|
| `points_event` | INSERT | `id`, `workspace_id`, `profile_id`, `season_id`, `action` ('punch_on_time'), `base_points`, `multiplier`, `final_points`, `category` ('attendance'), `source_type` ('shift'), `source_id` (shift_id), `metadata` (breakdown), `created_at` | Poeng-tildeling |
| `profile_streak` | UPSERT | `profile_id`, `streak_type` ('on_time'), `current_count` (+1 eller reset), `best_count` (max), `last_event_at` | Streak-oppdatering |
| `achievement_unlock` | INSERT (betinget) | `profile_id`, `achievement_id`, `unlocked_at` | Kun hvis ny achievement |

**Realtime:**
| Channel | Event | Payload | Subscribers |
|---------|-------|---------|-------------|
| — | — | — | Allerede broadcast fra Steg 2 |

### Events

**Emitted:**
| Event | Payload | Consumers |
|-------|---------|-----------|
| `POINTS_AWARDED` | `{ profileId, points, category, breakdown }` | Poeng-UI, leaderboard, profil-stats |
| `STREAK_UPDATED` | `{ profileId, streakType, count, milestone }` | Streak-UI, achievements-sjekk |
| `ACHIEVEMENT_UNLOCKED` | `{ profileId, achievementId, name, points }` | Achievement-UI, toast, push (valgfritt) |

**Listened to:**
| Event | Source | Action |
|-------|--------|--------|
| `SHIFT_PUNCHED_IN` | Steg 2 | Trigger poeng-beregning og kontekstbytte |

**Side Effects:**
| # | Description | Trigger | Type | Async |
|---|-------------|---------|------|:-----:|
| 1 | Leaderboard oppdatert med nye poeng | `POINTS_AWARDED` | `data` | Yes |
| 2 | Profil-statistikk oppdatert | `POINTS_AWARDED` | `data` | Yes |
| 3 | Push-varsel hvis achievement opplast | `ACHIEVEMENT_UNLOCKED` | `notification` | Yes |

### Notifications (P0 only)

| Template | Channel | Recipient | Title (NO) | Body (NO) | Deep Link | Priority | Condition                |
| -------- | ------- | --------- | ---------- | --------- | --------- | :------: | ------------------------ |
| —        | —       | —         | —          | —         | —         |    —     | Varsler sendt fra Steg 2 |

### Gamification (P0 only)

_Se Steg 2 for fullstendig poengberegning. Dette steget viser resultatet visuelt._

**Points:**
| Action | Base | Season Mult. | Category | Description |
|--------|:----:|:---:|----------|-------------|
| — | — | — | — | Beregning skjer i Steg 2, visning i dette steget |

**Conditional Bonuses:**
| Condition | Bonus | Label (NO) | Description |
|-----------|:-----:|-----------|-------------|
| — | — | — | — |

**Achievements:**
| ID | Name (NO) | Condition | Icon | Points | One-time |
|----|----------|-----------|------|:------:|:--------:|
| — | — | — | — | — | — |

**Streaks:**
| Streak | Action | Milestones |
|--------|--------|------------|
| — | — | — |

### Compliance & Audit (P0 only)

**Audit Trail:**
| Type | Actor | Target | Data | Retention |
|------|-------|--------|------|-----------|
| `points_awarded` | `system` | `profile:{id}` | Poeng-breakdown, sesong, multiplikator | 2 ar |

**Compliance Checks:**
| Law/Policy | Check | Action | Severity |
|-----------|-------|--------|:--------:|
| — | — | — | — |

### Error Scenarios

| #   | Trigger                    | Code                     | User Message (NO)                           | Recovery                          | Severity | Notify Admin |
| --- | -------------------------- | ------------------------ | ------------------------------------------- | --------------------------------- | :------: | :----------: |
| 1   | Poeng-beregning feilet     | `POINTS_CALC_ERROR`      | — (skjult, stempling er allerede vellykket) | Logg feil, tildel poeng asynkront |   info   |      no      |
| 2   | Achievement-lagring feilet | `ACHIEVEMENT_SAVE_ERROR` | — (skjult)                                  | Prov igjen asynkront              |   info   |      no      |

### Test Assertions

| Type        | Selector                                | Expected                                   | Timeout |
| ----------- | --------------------------------------- | ------------------------------------------ | :-----: |
| `visible`   | `[data-testid="punch-success-message"]` | Synlig etter vellykket stempling           |  5000   |
| `visible`   | `[data-testid="punch-success-points"]`  | Viser poeng-tildeling                      |  5000   |
| `text`      | `[data-testid="punch-success-points"]`  | Inneholder "+7" for tidlig ankomst (2+3+2) |  5000   |
| `db_record` | `points_event`                          | Post opprettet med korrekte poeng          |  5000   |
| `db_record` | `profile_streak`                        | Streak inkrementert eller reset            |  5000   |

---

## STEP 5: Feed Loads with Session Context

### Action

| Field       | Value                                        |
| ----------- | -------------------------------------------- |
| Description | Feed-en fylles med sesjons-spesifikt innhold |
| Type        | `system_auto`                                |
| Target      | FeedContainer-komponent                      |

### UI Elements

| testId                | Type                | Label (NO)                           | Variant   |      Visible When      | Disabled When |
| --------------------- | ------------------- | ------------------------------------ | --------- | :--------------------: | :-----------: |
| `feed-day-brief`      | card (pinned)       | AI-kompilert dagsbriefing            | pinned    | Alltid etter stempling |       —       |
| `feed-task-{id}`      | card                | Sesjonsoppgave med prosedyre         | standard  |    Oppgaver tildelt    |       —       |
| `feed-note-{id}`      | card                | Sesjonsnotat                         | standard  |     Notater finnes     |       —       |
| `feed-message-{id}`   | card                | Teammelding                          | standard  |    Meldinger finnes    |       —       |
| `feed-inherited-{id}` | card (amber border) | Oppgave fra forrige skift            | inherited |  Arvet oppgave finnes  |       —       |
| `feed-empty`          | empty state         | "Alt er klart! Ingen oppgaver enna." | empty     |    Ingen elementer     |       —       |

### Screen States

| State                    | Condition                     | Display                                              |
| ------------------------ | ----------------------------- | ---------------------------------------------------- |
| `feed_loading`           | Feed-data lastes              | Skeleton-kort-animasjon                              |
| `feed_loaded`            | Data lastet, elementer finnes | Dagsbriefing pinnet ost, oppgaver sortert etter hast |
| `feed_empty`             | Data lastet, ingen elementer  | Tom tilstand med oppmuntrende melding                |
| `session_context_active` | Kontekst byttet               | App-header viser avdelingsnavn + vakttid             |

**Screen Elements After Transition:**
| Element | New State |
|---------|-----------|
| Home-fane | Byttet til sesjonsfeed — oppgaver, notater, dagsbriefing |
| Fane-bar | "Hjem"-fane viser aktiv sesjons-punkt-indikator |
| App-header | Viser avdelingsnavn + vakttid |
| Feed | Dagsbriefing pinnet ost, oppgaver sortert etter hast under |
| AI FAB | Kontekst oppdatert — Mr. Botsson vet du er pa vakt |

### Data Operations

**Reads:**
| Table | Operation | Fields | Condition | RLS Policy | Index |
|-------|-----------|--------|-----------|-----------|-------|
| `session_task` | SELECT | _ | `session_id = current AND (assigned_to = me OR assigned_to IS NULL)` | `session_task_employee_read` | `idx_task_session_assignee` |
| `session_note` | SELECT | _ | `session_id = current` | `session_note_workspace_read` | `idx_note_session` |
| `day_brief` | SELECT | _ | `session_id = current` | `day_brief_workspace_read` | `idx_brief_session` |
| `message` | SELECT | _ | `channel IN my_channels AND created_at > last_seen` | `message_channel_read` | `idx_message_channel_time` |
| `inherited_task` | SELECT | \* | `previous_session_id AND status != completed AND inheritable = true` | `inherited_task_read` | `idx_inherited_session` |

**Writes:**
| Table | Operation | Fields | Notes |
|-------|-----------|--------|-------|
| — | — | — | Ingen skrivinger i dette steget |

**Realtime:**
| Channel | Event | Payload | Subscribers |
|---------|-------|---------|-------------|
| `session:{id}` | `task_created`, `task_completed`, `note_added`, `employee_joined`, `employee_left` | Hendelsesspesifikk | Alle sesjons-deltakere |
| `dept:{dept_id}` | `message_new`, `announcement` | Meldings-innhold | Avdelingsansatte |
| `shift:{shift_id}` | `task_assigned`, `urgent_update` | Oppgave-detaljer | Denne ansatte |

### Events

**Emitted:**
| Event | Payload | Consumers |
|-------|---------|-----------|
| `FEED_LOADED` | `{ sessionId, itemCount, hasDayBrief, hasInheritedTasks }` | Analytics, AI-kontekst |

**Listened to:**
| Event | Source | Action |
|-------|--------|--------|
| `SHIFT_PUNCHED_IN` | Steg 2 | Trigger feed-lasting |
| `SESSION_EMPLOYEE_JOINED` | Steg 2 | Oppdater sesjons-kontekst |

**Side Effects:**
| # | Description | Trigger | Type | Async |
|---|-------------|---------|------|:-----:|
| 1 | AI FAB kontekst oppdatert | `FEED_LOADED` | `ai` | Yes |
| 2 | Sanntids-abonnementer aktivert | `FEED_LOADED` | `data` | No |
| 3 | Uleste-teller oppdatert | `FEED_LOADED` | `ui` | No |

### Notifications (P0 only)

| Template | Channel | Recipient | Title (NO) | Body (NO) | Deep Link | Priority | Condition                    |
| -------- | ------- | --------- | ---------- | --------- | --------- | :------: | ---------------------------- |
| —        | —       | —         | —          | —         | —         |    —     | Ingen varsler i dette steget |

### Gamification (P0 only)

**Points:**
| Action | Base | Season Mult. | Category | Description |
|--------|:----:|:---:|----------|-------------|
| — | — | — | — | Ingen poeng i dette steget |

**Conditional Bonuses:**
| Condition | Bonus | Label (NO) | Description |
|-----------|:-----:|-----------|-------------|
| — | — | — | — |

**Achievements:**
| ID | Name (NO) | Condition | Icon | Points | One-time |
|----|----------|-----------|------|:------:|:--------:|
| — | — | — | — | — | — |

**Streaks:**
| Streak | Action | Milestones |
|--------|--------|------------|
| — | — | — |

### Compliance & Audit (P0 only)

**Audit Trail:**
| Type | Actor | Target | Data | Retention |
|------|-------|--------|------|-----------|
| — | — | — | — | Ingen audit i dette steget |

**Compliance Checks:**
| Law/Policy | Check | Action | Severity |
|-----------|-------|--------|:--------:|
| — | — | — | — |

### Error Scenarios

| #   | Trigger                        | Code                | User Message (NO)                        | Recovery                            | Severity | Notify Admin |
| --- | ------------------------------ | ------------------- | ---------------------------------------- | ----------------------------------- | :------: | :----------: |
| 1   | Feed-data lasting feilet       | `FEED_LOAD_ERROR`   | "Kunne ikke laste oppgavene dine"        | Retry-knapp, vakt er fortsatt aktiv | warning  |      no      |
| 2   | Dagsbriefing ikke tilgjengelig | `DAY_BRIEF_MISSING` | — (skjult, feed vises uten briefing)     | Briefing genereres asynkront        |   info   |      no      |
| 3   | Sanntids-tilkobling feilet     | `REALTIME_ERROR`    | — (skjult, manuell refresh tilgjengelig) | Fallback til polling hvert 30s      |   info   |      no      |

### Test Assertions

| Type      | Selector                            | Expected                                       | Timeout |
| --------- | ----------------------------------- | ---------------------------------------------- | :-----: |
| `visible` | `[data-testid="feed-day-brief"]`    | Synlig etter stempling                         |  10000  |
| `visible` | `[data-testid="feed-task-"]`        | Minst en oppgave synlig (hvis oppgaver finnes) |  10000  |
| `text`    | `[data-testid="feed-empty"]`        | "Alt er klart!" nar ingen oppgaver             |  5000   |
| `exists`  | `[data-testid="session-indicator"]` | Sesjonsindikator synlig i fane-bar             |  5000   |

---

## Event Envelope Summary

All events in this journey follow `ENGINE_SYSTEM_EVENT_ENVELOPE`:

| Event Name                | Family                                           | Source Domain | Subject Kind |
| ------------------------- | ------------------------------------------------ | ------------- | ------------ |
| `SHIFT_PUNCHED_IN`        | Journey execution (`step_completed`)             | `journey`     | `step`       |
| `SESSION_EMPLOYEE_JOINED` | Journey execution (`step_completed`)             | `journey`     | `session`    |
| `CONTEXT_SWITCH`          | Journey execution (`step_completed`)             | `journey`     | `step`       |
| `GPS_VERIFIED`            | Journey execution (`data_saved`)                 | `journey`     | `step`       |
| `POINTS_AWARDED`          | Process orchestration (`process_step_completed`) | `process`     | `journey`    |
| `STREAK_UPDATED`          | Process orchestration (`process_step_completed`) | `process`     | `journey`    |
| `ACHIEVEMENT_UNLOCKED`    | Process orchestration (`process_step_completed`) | `process`     | `journey`    |
| `FEED_LOADED`             | Journey execution (`step_completed`)             | `journey`     | `session`    |
| `SHIFT_PUBLISHED`         | Process orchestration (listened to)              | `process`     | `journey`    |
| `SHIFT_CANCELLED`         | Process orchestration (listened to)              | `process`     | `journey`    |

## Technical Links

| Link Type                  | References                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Events used                | `SHIFT_PUNCHED_IN`, `SESSION_EMPLOYEE_JOINED`, `CONTEXT_SWITCH`, `GPS_VERIFIED`, `POINTS_AWARDED`, `STREAK_UPDATED`, `ACHIEVEMENT_UNLOCKED`, `FEED_LOADED`                                 |
| Hooks invoked              | start: `SHIFT_PUBLISHED` (CTA visibility), run: punch_record INSERT + GPS check + gamification, verify: GPS verification + compliance checks, stop: `FEED_LOADED` (session context active) |
| Triggers listened to       | `SHIFT_PUBLISHED`, `SHIFT_CANCELLED`                                                                                                                                                       |
| Endpoints touched          | `schedule_shift` (read), `punch_record` (insert), `department_session` (update), `points_event` (insert), `profile_streak` (upsert), `achievement_unlock` (insert)                         |
| Policy gates evaluated     | GPS verification policy, 11h rest period (Arbeidsmiljeloven SS10-8), max weekly hours (SS10-6), trainee sandbox policy                                                                     |
| Component templates        | PunchCTACard, GPSCheckModal, PunchSuccessAnimation, FeedContainer, DayBriefCard, TaskCard                                                                                                  |
| Role capabilities required | Shift Leader (session management), Waiter/Service Operator (punch execution), Cook/Kitchen Operator (punch execution)                                                                      |
