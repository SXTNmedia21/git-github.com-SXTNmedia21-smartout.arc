---
title: "Restaurant Industry Template — Complete Package Overview"
status: done
updated: 2026-05-28
created: 2026-03-06
module: templates
tags: [template, restaurant, industry, seed, NACE-56.101, Mattilsynet, Riksavtalen]
---

# Restaurant Industry Template

> **NACE 56.101** — Restaurant og kafedrift
>
> A complete operational blueprint for a mid-size Norwegian restaurant.
> When a workspace admin selects "Restaurant" during onboarding, they get everything below.

> **Status (2026-05-28) — Pre-ADR-0429 demo data.** This 7-department template
> (`Kjøkken / Restaurant / Bar / Catering / Renhold / Levering / Event`) predates
> [ADR-0429](../../../docs/decisions/0429-department-vocabulary-foh-boh-admin-defaults.md),
> which establishes **FoH / BoH / Admin** as the canonical I1 hospitality defaults
> (with size-conditional 4th `Bar` + optional 5th `Events`). The I1 seed in
> `packages/ai/src/industry/packages/hospitality.ts` and the `bootstrap-cascade`
> Edge Function (`DEPARTMENT_TYPE_MAP` + `OFFSET_DEFAULTS`) already follow ADR-0429
> — new workspaces get FoH/BoH/Admin. This SQL template is retained as-is for the
> 50-employee demo workspace and will be rebuilt around FoH/BoH/Admin in a
> dedicated template-redesign sortie. Open question for that sortie: how to
> remap **Catering / Renhold / Levering** staff (11 of 50 employees), which have
> no canonical home in the 3-dept ADR-0429 default.

---

## What You Get

### At a Glance

| Category             | Count  | Description                              |
| -------------------- | ------ | ---------------------------------------- |
| Departments          | 7      | Organisational units with positions      |
| Positions            | ~20    | Job roles per department                 |
| Locations            | 3      | Physical sites                           |
| Zones                | 12     | Service areas within locations           |
| Employees            | 50     | Diverse workforce profiles               |
| Schedule Shifts      | ~2,500 | 3 months of realistic rosters            |
| Employment Contracts | 50     | Riksavtalen-compliant wages              |
| Policies             | 32     | HACCP, operational, HR, safety           |
| Protocols            | 22     | Enforcement containers 1:1 with policies |
| Procedures           | 51     | Step-by-step with 238 steps              |
| Routines             | 24     | Scheduled daily/weekly tasks             |
| Control Lists        | 18     | Checklists for verification              |
| Knowledge Tests      | 11     | Quizzes with pass thresholds             |
| Confirmations        | 4      | Signed acknowledgements                  |
| Protocol Assignments | ~337   | Readiness tracking per employee          |
| Season Budget        | 1      | NOK 8.5M target                          |
| Day Factors          | 7      | Weekday revenue weights                  |
| Hour Factors         | 18     | Hourly revenue distribution              |
| Operating Hours      | 7      | Weekly opening schedule                  |
| Team Members         | ~41    | Team assignments                         |

---

## Files & Dependency Order

| #   | File                | Function                              | Creates                                                                                               |
| --- | ------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | `departments.sql`   | `template_restaurant_departments()`   | 7 departments, ~20 positions                                                                          |
| 2   | `locations.sql`     | `template_restaurant_locations()`     | 3 locations, 12 zones                                                                                 |
| 3   | `policies.sql`      | `template_restaurant_policies()`      | 10 base policies                                                                                      |
| 4   | `governance.sql`    | `template_restaurant_governance()`    | 10 protocols, 12 procedures, 4 routines, 3 control lists, 3 knowledge tests, 2 confirmations, 4 teams |
| 5   | `employees.sql`     | `template_restaurant_employees()`     | 50 auth.users + profiles                                                                              |
| 6   | `schedule.sql`      | `template_restaurant_schedule()`      | ~2,500 shifts over 91 days                                                                            |
| 7   | `budget.sql`        | `template_restaurant_budget()`        | 1 season budget, 7 day factors, 18 hour factors, 7 operating hours                                    |
| 8   | `teams.sql`         | `template_restaurant_teams()`         | ~41 team members, team leaders, position links on shifts                                              |
| 9   | `assignments.sql`   | `template_restaurant_assignments()`   | ~337 protocol assignments                                                                             |
| 10  | `contracts.sql`     | `template_restaurant_contracts()`     | 50 employment contracts                                                                               |
| 11  | `mattilsynet.sql`   | `template_restaurant_mattilsynet()`   | 4 HACCP policies, 20 procedures, 12 routines, 8 control lists, 4 knowledge tests                      |
| 12  | `alcohol-labor.sql` | `template_restaurant_alcohol_labor()` | 3 policies, 10 procedures, 6 routines, 4 control lists, 2 knowledge tests                             |

Master: `_apply.sql` runs all in order via `template_restaurant_apply(workspace_id)`.

---

## Departments & Positions

| Department | Slug         | Positions                                                    |
| ---------- | ------------ | ------------------------------------------------------------ |
| Kjokken    | `kjokken`    | Kjokkensjef, Sous Chef, Kokk, Kjokkenassistent, Oppvaskhjelp |
| Restaurant | `restaurant` | Hovmester, Servitor, Hjelpeservitor                          |
| Bar        | `bar`        | Barbartender (leder), Bartender                              |
| Catering   | `catering`   | Cateringansvarlig, Cateringmedarbeider                       |
| Renhold    | `renhold`    | Renholdsansvarlig, Renholder                                 |
| Levering   | `levering`   | Leveringsansvarlig, Sjafor                                   |
| Event      | `event`      | Eventansvarlig, Eventmedarbeider                             |

---

## Employees (50)

| Group                   | Index | Count | Type       | Contract | Hours               |
| ----------------------- | ----- | ----- | ---------- | -------- | ------------------- |
| Native Norwegian adults | 0-24  | 25    | Fast 100%  | Signed   | Full-time 5/week    |
| Foreign workers         | 25-34 | 10    | Fast 100%  | Signed   | Full-time 5/week    |
| Minors (16-17 yr)       | 35-39 | 5     | Deltid 30% | Signed   | 2/week (4 summer)   |
| Pensioners (67-72 yr)   | 40-43 | 4     | Deltid 40% | Signed   | 2-3/week weekdays   |
| Freelancers             | 44-49 | 6     | Tilkalling | Mixed    | Fri+Sat, occasional |

---

## Employment Contracts — Riksavtalen 2024-2026

All wages sourced from [Riksavtalen on Lovdata](https://lovdata.no/dokument/TARO/tariff/taro-79), effective 1 April 2024.

### Wage Table (NOK per hour)

| Role               | With fagbrev | Without fagbrev | After 2 yr      | After 4 yr      |
| ------------------ | ------------ | --------------- | --------------- | --------------- |
| Kokk               | 224.45       | 213.90          | 226.16 / 215.61 | 240.52 / 229.97 |
| Servitor/Bartender | 219.26       | 208.71          | 223.07 / 212.52 | 237.43 / 226.88 |
| Minor (16 yr)      | —            | 143.06          | —               | —               |
| Minor (17 yr)      | —            | 153.09          | —               | —               |

### Contract Categories

| Category     | Count | Description                                        |
| ------------ | ----- | -------------------------------------------------- |
| Fast (100%)  | 35    | Permanent full-time, monthly salary                |
| Deltid (30%) | 5     | Minors, hourly only                                |
| Deltid (40%) | 4     | Pensioners, hourly only                            |
| Tilkalling   | 6     | On-call, 6-month term, 4 signed + 1 sent + 1 draft |

---

## Season Budget

| Parameter            | Value         | Source                                |
| -------------------- | ------------- | ------------------------------------- |
| Total target revenue | NOK 8,500,000 | Typical mid-size Norwegian restaurant |
| Base price per guest | NOK 450       | Average check                         |
| Target labor %       | 32%           | Industry standard                     |
| Avg hourly wage      | NOK 220       | Riksavtalen weighted average          |
| Status               | Active        |                                       |

### Day Factors (revenue distribution)

| Day       | Factor | Characterization |
| --------- | ------ | ---------------- |
| Monday    | 0.6    | Slowest day      |
| Tuesday   | 0.7    | Quiet            |
| Wednesday | 0.85   | Building         |
| Thursday  | 1.1    | After-work crowd |
| Friday    | 1.6    | Busiest weekday  |
| Saturday  | 1.8    | Peak             |
| Sunday    | 1.35   | Brunch + family  |

### Hour Factors (peak hours)

| Hour      | Factor               |     | Hour      | Factor                |
| --------- | -------------------- | --- | --------- | --------------------- |
| 06:00     | 0.1 (prep)           |     | 15:00     | 0.4 (dead zone)       |
| 07:00     | 0.2                  |     | 16:00     | 0.5                   |
| 08:00     | 0.3                  |     | 17:00     | 0.9                   |
| 09:00     | 0.3                  |     | 18:00     | 1.6                   |
| 10:00     | 0.4                  |     | **19:00** | **2.0** (dinner peak) |
| 11:00     | 0.8                  |     | 20:00     | 1.8                   |
| **12:00** | **1.5** (lunch peak) |     | 21:00     | 1.4                   |
| 13:00     | 1.3                  |     | 22:00     | 0.8                   |
| 14:00     | 0.6                  |     | 23:00     | 0.4                   |

---

## Governance Overview

### Policy Types

| Type        | Count | Domain                                                     |
| ----------- | ----- | ---------------------------------------------------------- |
| HACCP       | 13    | Food safety, temperature, hygiene, allergens, traceability |
| Operational | 5     | Opening/closing, cash handling, alcohol serving            |
| Safety      | 1     | Fire safety and evacuation                                 |
| HR          | 3     | HMS, night work, overtime                                  |

### All Policies

| #   | Policy Name                          | Type        | Scope         | Regulatory Source                               |
| --- | ------------------------------------ | ----------- | ------------- | ----------------------------------------------- |
| 1   | Temperaturkontroll                   | HACCP       | Workspace     | Mattilsynet, Forskrift om naeringsmiddelhygiene |
| 2   | Allergenhandtering                   | HACCP       | Workspace     | EU forordning 1169/2011                         |
| 3   | Apningsrutiner                       | Operational | Workspace     | Internal operations                             |
| 4   | Stengerutiner                        | Operational | Workspace     | Internal operations                             |
| 5   | Handhygiene                          | HACCP       | Workspace     | Forskrift om naeringsmiddelhygiene              |
| 6   | Brannvern og evakuering              | Safety      | Workspace     | Forskrift om brannforebygging §4                |
| 7   | Varemottak og lagring                | HACCP       | Workspace     | Mattilsynet internkontroll                      |
| 8   | Arbeidsmiljo og HMS                  | HR          | Workspace     | Arbeidsmiljoloven                               |
| 9   | Kassaoppgjor og verdihandtering      | Operational | Dept: Kjokken | Internal operations                             |
| 10  | Skjenkekontroll og aldersgrense      | Operational | Dept: Bar     | Alkoholloven §8-11                              |
| 11  | Temperaturovervaking og kaldkjede    | HACCP       | Workspace     | Mattilsynet, EU 852/2004 art. 5                 |
| 12  | Hygiene og renhold                   | HACCP       | Workspace     | Mattilsynet, Smilefjesordningen                 |
| 13  | Allergenhandtering og merking        | HACCP       | Workspace     | EU 1169/2011, Matinformasjonsforskriften        |
| 14  | Sporbarhet og avvikshandtering       | HACCP       | Workspace     | IK-mat FOR-1994-12-15-1187                      |
| 15  | Skjenkekontroll og alkoholhandtering | Operational | Workspace     | Alkoholloven §1-4, §4-1, §8-11                  |
| 16  | Nattarbeid og arbeidstid             | HR          | Workspace     | Arbeidsmiljoloven §10-11                        |
| 17  | Overtid og merarbeid                 | HR          | Workspace     | Arbeidsmiljoloven §10-6                         |

### Procedures by Domain (41+)

| Domain                  | Procedures | Steps | Source File         |
| ----------------------- | ---------- | ----- | ------------------- |
| Base Operations         | 12         | 66    | `governance.sql`    |
| Mattilsynet Food Safety | 20         | 118+  | `mattilsynet.sql`   |
| Alcohol & Labor         | 10         | 58    | `alcohol-labor.sql` |

### Routines by Schedule

| Routine                     | Time          | Frequency          | Assigned To  |
| --------------------------- | ------------- | ------------------ | ------------ |
| Temperatursjekk morgen      | 08:00         | Daily              | Kjokkenteam  |
| Temperatursjekk ettermiddag | 15:00         | Daily              | Kjokkenteam  |
| Apningssjekk                | 09:00         | Daily              | Kjokkenteam  |
| Daglig datokontroll         | 09:00         | Daily              | Kjokkenteam  |
| Handvask kontroll           | 10:00         | Daily (every 3rd)  | Kjokkenteam  |
| Sanitar renhold formiddag   | 11:00         | Daily              | Salteam      |
| Varmholding lunsj           | 12:30         | Mon-Sat            | Kjokkenteam  |
| Sanitar renhold ettermiddag | 17:00         | Daily              | Salteam      |
| Varmholding middag          | 19:30         | Daily              | Kjokkenteam  |
| Daglig renhold kjokken      | 22:00         | Daily              | Kjokkenteam  |
| Lukkesjekk                  | 22:00         | Daily              | Kjokkenteam  |
| Kassaoppgjor kveld          | 22:30         | Daily              | Salteam      |
| Alderskontroll sjekk        | On order      | Every 10th         | Barteam      |
| Beruselsesvurdering         | 22:00         | Fri+Sat            | Barteam      |
| Skjenketidskontroll         | 00:30         | Daily              | Barteam      |
| Mindrearig vaktsjekk        | 09:00         | Daily              | Ledelsesteam |
| Ukentlig dyprenhold         | 06:00 Mon     | Weekly             | Kjokkenteam  |
| Allergensjekk meny          | 10:00 Mon     | Weekly (every 4th) | Kjokkenteam  |
| Arbeidstidskontroll         | 09:00 Mon     | Weekly             | Ledelsesteam |
| Overtidsrapport             | 09:00 1st Mon | Monthly            | Ledelsesteam |

### Control Lists (14+)

| List                                | Items | Assigned To | Source            |
| ----------------------------------- | ----- | ----------- | ----------------- |
| Apningssjekkliste kjokken           | 8     | Team leader | governance.sql    |
| Stengesjekkliste kjokken            | 7     | Team leader | governance.sql    |
| Daglig temperaturlogg               | 5     | Team leader | governance.sql    |
| Temperaturlogg kjoleenheter         | 7     | Team leader | mattilsynet.sql   |
| Varemottak sjekkliste               | 8     | Team leader | mattilsynet.sql   |
| Daglig renholdssjekkliste           | 7     | Team leader | mattilsynet.sql   |
| Ukentlig dyprenhold sjekkliste      | 8     | Team leader | mattilsynet.sql   |
| Allergenoversikt serveringskontroll | 4     | Team leader | mattilsynet.sql   |
| Varmholdingskontroll                | 6     | Team leader | mattilsynet.sql   |
| Nedkjolingskontroll                 | 6     | Team leader | mattilsynet.sql   |
| Sanitar og garderobe sjekkliste     | 5     | Team leader | mattilsynet.sql   |
| Daglig alkoholkontroll              | 6     | Team leader | alcohol-labor.sql |
| Manedlig alkohol-internkontroll     | 6     | Manager     | alcohol-labor.sql |
| Ukentlig arbeidstidskontroll        | 6     | Manager     | alcohol-labor.sql |
| Manedlig overtidskontroll           | 6     | Manager     | alcohol-labor.sql |

### Knowledge Tests (9+)

| Test                               | Questions | Pass % | Domain                            |
| ---------------------------------- | --------- | ------ | --------------------------------- |
| Mattrygghet grunnkurs              | 8         | 80%    | Temperature & food safety         |
| Allergenkunnskap                   | 6         | 80%    | 14 allergens, merking             |
| Brannvern                          | 5         | 100%   | Evacuation, fire equipment        |
| Temperaturkontroll og kaldkjede    | 8         | 80%    | HACCP temperature chain           |
| Hygiene og renhold                 | 6         | 80%    | Personal/kitchen hygiene          |
| Allergenhandtering                 | 6         | 80%    | Cross-contamination, marking      |
| Internkontroll og avvikshandtering | 5         | 75%    | IK-mat system                     |
| Alkoholloven og ansvarlig vertskap | 8         | 80%    | Age limits, intoxication, license |
| Arbeidstid og nattarbeid           | 6         | 75%    | Night work, minors, rest periods  |

### Protocol Assignments & Readiness

| Employee Group      | Assigned | Completed  | Pending | Expired |
| ------------------- | -------- | ---------- | ------- | ------- |
| Adults (0-34)       | ~245     | ~196 (80%) | ~49     | 0       |
| Minors (35-39)      | ~35      | 0 (0%)     | 35      | 0       |
| Pensioners (40-43)  | ~28      | ~19 (67%)  | ~9      | 0       |
| Freelancers (44-49) | ~29      | ~19 (66%)  | ~5      | ~5      |
| **Total**           | **~337** | **~234**   | **~98** | **~5**  |

---

## Teams

| Team         | Slug           | Members | Leader                     | Department |
| ------------ | -------------- | ------- | -------------------------- | ---------- |
| Kjokkenteam  | `kjokkenteam`  | 8       | Employee 0 (Kjokkensjef)   | Kjokken    |
| Salteam      | `salteam`      | 16      | Employee 6 (Hovmester)     | Restaurant |
| Barteam      | `barteam`      | 6       | Employee 11 (Barbartender) | Bar        |
| Ledelsesteam | `ledelsesteam` | 4       | Employee 0 (Kjokkensjef)   | Cross-dept |

---

## Regulatory Sources

All template content is grounded in real Norwegian and EU regulations:

### Food Safety (Mattilsynet)

| Regulation                                  | Reference                                                                                                               | What it covers                            |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Internkontroll for naeringsmiddelvirksomhet | [Mattilsynet: Internkontroll](https://www.mattilsynet.no/mat-og-drikke/matservering/internkontroll)                     | Systematic food safety management         |
| Internkontroll — dette skal med             | [Mattilsynet: Krav](https://www.mattilsynet.no/mat-og-drikke/matservering/internkontroll/internkontroll-dette-skal-med) | 9 mandatory IK components                 |
| HACCP (Fareanalyse)                         | [Mattilsynet: HACCP](https://www.mattilsynet.no/mat-og-drikke/matservering/internkontroll/innforing-i-haccp)            | 7 HACCP principles, 3-tier implementation |
| Smilefjesordningen                          | [Mattilsynet: Smilefjes](https://www.mattilsynet.no/mat-og-drikke/matservering/smilefjes-tilsyn)                        | 25 inspection points, 4 main areas        |
| Mathandtering og hygiene                    | [Mattilsynet: Hygiene](https://www.mattilsynet.no/mat-og-drikke/matservering/mathandtering-hygiene)                     | Temperature, cleaning, personal hygiene   |
| IK-mat forskrift                            | [Lovdata: FOR-1994-12-15-1187](https://lovdata.no/forskrift/1994-12-15-1187)                                            | Legal basis for internkontroll            |
| EU Hygiene Regulation                       | EU forordning 852/2004, art. 5                                                                                          | HACCP principles                          |
| EU Food Information                         | [EU forordning 1169/2011 — 14 allergener](https://lovdata.no/dokument/SF/forskrift/2014-11-28-1497/KAPITTEL_4-1-1-9)    | 14 mandatory allergens                    |

### Alcohol

| Regulation             | Reference                                                                                                                | What it covers                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| Alkoholloven           | §1-4, §4-1                                                                                                               | Licensing requirement          |
| Alkoholloven           | §1-7c                                                                                                                    | Manager/deputy knowledge test  |
| Alkoholloven           | §8-11                                                                                                                    | Refusal of intoxicated persons |
| Internkontroll alkohol | [Helsedirektoratet guide](https://www.helsedirektoratet.no/tema/alkohol/guide-til-god-internkontroll-etter-alkoholloven) | Systematic alcohol compliance  |
| Kunnskapsprove         | [Helsedirektoratet](https://www.helsedirektoratet.no/tema/alkohol/kunnskapsprove-i-alkoholloven)                         | Manager certification test     |
| Skjenkebevilling       | [Oslo kommune](https://www.oslo.kommune.no/skatt-og-naring/salg-servering-og-skjenking/)                                 | Municipal license requirements |

### Employment & Labor

| Regulation                    | Reference                                                                                                                         | What it covers                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Riksavtalen 2024-2026         | [Lovdata: TARO-79](https://lovdata.no/dokument/TARO/tariff/taro-79)                                                               | Minimum wages, categories                            |
| Arbeidsmiljoloven §10-6       | [Lovdata: AML kap. 10](https://lovdata.no/lov/2005-06-17-62/kap10)                                                                | Overtime: 10t/week, 25t/4wk, 200t/yr, 40% supplement |
| Arbeidsmiljoloven §10-11      | [Arbeidstilsynet: Night work](https://www.arbeidstilsynet.no/en/working-hours-and-organisation-of-work/working-hours/night-work/) | Night work 21:00-06:00, 8h avg limit                 |
| Arbeidsmiljoloven §14-5/6     | [Arbeidstilsynet: Contract](https://www.arbeidstilsynet.no/en/working-conditions/contract-of-employment/)                         | 19 mandatory contract elements                       |
| Forskrift om brannforebygging | §4                                                                                                                                | Fire prevention and evacuation                       |

### Temperature Standards

| Parameter         | Value                       | Source      |
| ----------------- | --------------------------- | ----------- |
| Refrigeration     | 0-4°C                       | Mattilsynet |
| Freezer           | -18°C or colder             | Mattilsynet |
| Hot holding       | Over 60°C                   | Mattilsynet |
| Core temp cooking | 70°C+ (poultry 75°C)        | Mattilsynet |
| Rapid cooling     | 60°C to 10°C within 2 hours | Mattilsynet |
| Danger zone       | 8-60°C (bacterial growth)   | Mattilsynet |

---

## Usage

```sql
-- Apply full restaurant template to a workspace
SELECT template_restaurant_apply('your-workspace-uuid');

-- Or apply individual modules
SELECT template_restaurant_departments('uuid');
SELECT template_restaurant_mattilsynet('uuid');
SELECT template_restaurant_contracts('uuid');
-- etc.
```

### Prerequisites

Before applying, the workspace must have:

- A `company` record
- A `workspace` record
- An admin or owner `profile`
- At least one `season` (status = 'active')

These are created during onboarding.
