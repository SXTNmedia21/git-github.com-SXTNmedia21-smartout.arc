---
title: "Journey: Check My Schedule"
status: draft
updated: 2026-03-06
created: 2026-03-06
module: scheduling
tags: [journey, deep-spec, scheduling, employee]
---

# Journey: J-011 -- Check My Schedule

## Package Identity

- Package ID: `JP-R011-CHECK-MY-SCHEDULE`
- Roadmap ID: `R-011`
- Journey ID: `J-011`
- Mission ID: `M-011` (TBD)
- License ID: `L-011` (TBD)

Related package docs:

- [Roadmap](./Roadmap.md)
- [Mission](./Mission.md) (pending)
- [License](./License.md) (pending)

## Classification

| Field          | Value                                   |
| -------------- | --------------------------------------- |
| **ID**         | `j-011`                                 |
| **Title**      | Check My Schedule                       |
| **Slug**       | `check-my-schedule`                     |
| **Module**     | scheduling                              |
| **Actor**      | employee                                |
| **Platform**   | mobile                                  |
| **Priority**   | P1                                      |
| **Depth Tier** | P2 Skeleton                             |
| **Tags**       | read-only, scheduling, employee, mobile |

## Trigger

Ansatt trykker paa "Vakter"-fanen i mobilappens bunnmeny.

## Preconditions

| #   | Precondition                          | Validation                                                                     |
| --- | ------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | Ansatt er innlogget med gyldig sesjon | `auth.uid()` returnerer en verdi                                               |
| 2   | Ansatt har en profil i workspace      | `profile` rad finnes med `user_id = auth.uid()`                                |
| 3   | Publiserte vakter finnes for ansatt   | `schedule_shift` rader der `employee_id = profile_id` og `is_published = true` |

## Related Journeys

| Relation | Journey                        | Why                                             |
| -------- | ------------------------------ | ----------------------------------------------- |
| Requires | J-003 Login & Route to Context | Autentisering og workspace-kontekst             |
| Requires | J-015 Build Weekly Schedule    | Vakter maa eksistere i systemet                 |
| Leads to | J-017 Swap Shift               | Ansatt kan initiere vaktbytte fra detaljvisning |
| Leads to | J-016 Handle Sick Call         | Ansatt kan melde sykdom fra vaktvisning         |

## AI Council Validation

| Persona                | Applicable | Notes                                                              |
| ---------------------- | :--------: | ------------------------------------------------------------------ |
| Multi-site Manager     |     no     | Denne reisen er for ansatte, ikke ledere                           |
| Back-office Admin      |     no     | Kun lesing, ingen admin-funksjonalitet                             |
| External Consultant    |     no     | Ikke relevant for eksterne                                         |
| Career Professional    |    yes     | Ser sine vakter for aa planlegge karriereutvikling                 |
| Fast-food Entry Worker |    yes     | Primaerbruker -- maa vaere enkel og rask                           |
| Low-literacy Worker    |    yes     | Maa fungere med minimal tekst, tydelige ikoner og visuell kalender |
| Sommelier/Specialist   |    yes     | Ser vakter som alle andre ansatte                                  |

## Niche Focus

| Niche dimension     | Multiplier | Effect                               |
| ------------------- | :--------: | ------------------------------------ |
| Schedule complexity |    1.0     | Standard vaktvisning                 |
| Mobile-first        |    1.3     | Ekstra fokus paa mobiloptimalisering |

---

## STEP 1: Aapne vaktlisten

### Action

| Field       | Value                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| Description | Ansatt navigerer til Vakter-fanen og ser en kalender/listevisning med sine kommende publiserte vakter |
| Type        | navigate                                                                                              |
| Target      | Vakter-fane i bunnmeny                                                                                |

### Data Operations

**Reads:**
| Table | Operation | Fields | Condition | RLS Policy | Index |
|-------|-----------|--------|-----------|-----------|-------|
| `schedule_shift` | SELECT | `schedule_shift_id`, `shift_date`, `start_time`, `end_time`, `work_hours`, `status`, `day_category`, `zone`, `indicator`, `notes`, `is_published` | `employee_id = {current_profile_id} AND is_published = true AND shift_date >= CURRENT_DATE` | `jwt_read_schedule_shift` (workspace member) | `(employee_id, shift_date)` |

### Test Assertions

| Type       | Selector                                             | Expected                                    | Timeout |
| ---------- | ---------------------------------------------------- | ------------------------------------------- | :-----: |
| visible    | `[data-testid="schedule-list"]`                      | Vaktliste er synlig med minst en vakt       |  3000   |
| count      | `[data-testid="shift-card"]`                         | Antall matcher publiserte vakter for ansatt |  3000   |
| not_exists | `[data-testid="shift-card"][data-published="false"]` | Ingen upubliserte vakter vises              |  1000   |

---

## STEP 2: Se vaktdetaljer

### Action

| Field       | Value                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| Description | Ansatt trykker paa en vakt i listen for aa se fullstendige detaljer: tid, lokasjon, rolle, kollegaer |
| Type        | tap                                                                                                  |
| Target      | Vaktkort i listen                                                                                    |

### Data Operations

**Reads:**
| Table | Operation | Fields | Condition | RLS Policy | Index |
|-------|-----------|--------|-----------|-----------|-------|
| `schedule_shift` | SELECT | Alle felter inkludert `notes`, `breaks` | `schedule_shift_id = {selected_shift_id}` | `jwt_read_schedule_shift` | PK |
| `profile` | SELECT | `first_name`, `last_name`, `avatar_url` | Kollegaer: `schedule_shift.employee_id` der `shift_date` og `workspace_id` matcher | `jwt_read_profile` (workspace member) | -- |
| `team` | SELECT | `name` | `team_id` fra valgt vakt | `jwt_read_team` | PK |
| `location` | SELECT | `name`, `address` | `location_id` fra valgt vakt (hvis finnes) | `jwt_read_location` | PK |

### Test Assertions

| Type    | Selector                             | Expected                        | Timeout |
| ------- | ------------------------------------ | ------------------------------- | :-----: |
| visible | `[data-testid="shift-detail-sheet"]` | Detaljvisning aapnes            |  2000   |
| text    | `[data-testid="shift-time"]`         | Viser korrekt start- og sluttid |  1000   |
| visible | `[data-testid="shift-colleagues"]`   | Kollegaer for samme dato vises  |  2000   |

---

## STEP 3: Navigere mellom uker (valgfritt)

### Action

| Field       | Value                                                                          |
| ----------- | ------------------------------------------------------------------------------ |
| Description | Ansatt swiper eller trykker paa navigasjonspiler for aa se vakter i andre uker |
| Type        | swipe                                                                          |
| Target      | Ukenavigasjon i kalendervisning                                                |

### Data Operations

**Reads:**
| Table | Operation | Fields | Condition | RLS Policy | Index |
|-------|-----------|--------|-----------|-----------|-------|
| `schedule_shift` | SELECT | Samme som Steg 1 | `employee_id = {current_profile_id} AND is_published = true AND shift_date BETWEEN {week_start} AND {week_end}` | `jwt_read_schedule_shift` | `(employee_id, shift_date)` |

### Test Assertions

| Type  | Selector                     | Expected                            | Timeout |
| ----- | ---------------------------- | ----------------------------------- | :-----: |
| text  | `[data-testid="week-label"]` | Viser oppdatert ukenummer/datoer    |  1000   |
| count | `[data-testid="shift-card"]` | Antall matcher vakter for valgt uke |  3000   |

---

## Event Envelope Summary

All events in this journey follow `ENGINE_SYSTEM_EVENT_ENVELOPE`:

| Event Name            | Family      | Source Domain | Subject Kind |
| --------------------- | ----------- | ------------- | ------------ |
| `schedule.viewed`     | interaction | scheduling    | employee     |
| `shift.detail_viewed` | interaction | scheduling    | employee     |

## Technical Links

| Link Type                  | References                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------- |
| Events used                | `schedule.viewed`, `shift.detail_viewed`                                               |
| Hooks invoked              | start: navigate to schedule tab, run: fetch shifts, verify: data displayed, stop: none |
| Triggers listened to       | none (user-initiated)                                                                  |
| Endpoints touched          | Supabase PostgREST: `schedule_shift`, `profile`, `team`, `location`                    |
| Policy gates evaluated     | `jwt_read_schedule_shift`, `jwt_read_profile`, `jwt_read_team`, `jwt_read_location`    |
| Component templates        | ShiftCard, ShiftDetailSheet, WeekNavigator                                             |
| Role capabilities required | none (basic employee access)                                                           |
