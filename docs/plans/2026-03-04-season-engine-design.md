---
title: Season Engine — Design
status: approved
created: 2026-03-04
updated: 2026-03-04
module: operations
tags: [season, agent, design, mission, state-machine]
---

# Season Engine

## Kärnan

En säsong är en **mission** i Stage Engine — samma motor som kör onboarding. Fyra faser. Varje fas har en start (fråga) och ett slut (svar). Journeyn däremellan sköter sig själv.

Skillnaden mot onboarding: en säsongsmission lever i **veckor**, inte minuter. Stages triggas av kalender, inte konversation.

## Faserna som stages

```yaml
mission: season-lifecycle
mode: sequential
entity_type: season
entity_scope: workspace

stages:
  - id: seed
    phase: UPPTÄCKT
    trigger: onboarding.season_stage.complete | manual
    goal: "Identifiera tuffaste säsongen och dess datum"
    agent_asks: "Vilken är er tuffaste period under året?"
    complete_when:
      - season.type IS SET
      - season.start_date IS SET
      - season.end_date IS SET
    on_complete:
      - CREATE season record
      - LOAD industry defaults (day_factors, hour_factors)
      - CALCULATE weeks_until_start

  - id: revenue
    phase: FÖRBEREDELSE
    trigger: time(weeks_until_start <= 8)
    goal: "Sätta omsättningsmål"
    agent_asks: "Ni har {weeks} veckor. Vad siktar ni på i omsättning?"
    complete_when:
      - season_budget.total_target_revenue IS SET
    on_complete:
      - CALCULATE day_targets, hour_targets, staffing_need
      - STORE season_budget

  - id: concept
    phase: FÖRBEREDELSE
    trigger: stage.revenue.complete
    goal: "Identifiera konceptförändringar"
    agent_asks: "Ändras konceptet? Buffé, ny meny, andra öppettider?"
    complete_when:
      - concept_change ANSWERED (yes/no + details)
    on_complete:
      - IF yes: IDENTIFY new routines, training needs
      - UPDATE season.metadata

  - id: staffing
    phase: FÖRBEREDELSE
    trigger: stage.concept.complete
    goal: "Gap-analys: nuvarande personal vs behov"
    agent_tells: "{current_staff} just nu. Beräknat behov: {needed}."
    agent_asks: "Räcker det, eller behövs fler?"
    complete_when:
      - staffing_decision ANSWERED
    on_complete:
      - IF gap > 0: FLAG recruitment_needed(count, deadline)

  - id: prepare
    phase: FÖRBEREDELSE
    trigger: stage.staffing.complete
    mode: automated
    goal: "Smartout förbereder allt den kan själv"
    actions:
      - IDENTIFY training gaps → schedule courses
      - ACTIVATE season-specific protocols
      - PREPARE schedule templates from last year or defaults
      - SET reminders for missing items
    complete_when:
      - training_scheduled OR no_gaps
      - protocols_activated
      - schedule_template_ready

  - id: ready
    phase: FÖRBEREDELSE
    trigger: time(weeks_until_start <= 1)
    goal: "Slutstatus"
    agent_tells: "Allt klart. {ready_count}/{total} personal redo. {missing} saknar {course}."
    complete_when:
      - user_acknowledged

  - id: running
    phase: DRIFT
    trigger: time(season.start_date)
    mode: automated
    goal: "Säsongen är igång"
    behavior:
      - REPORT daily: actual vs plan (revenue, staffing, routines)
      - FLAG deviations that need action
      - SUGGEST adjustments
    complete_when:
      - time(season.end_date)

  - id: reflect
    phase: REFLEKTION
    trigger: time(season.end_date + 3 days)
    goal: "Recorda säsongen"
    agent_tells: "{season.name} är klart. Så här gick det."
    actions:
      - CALCULATE factor_learning (actual vs planned)
      - SAVE schedule templates as reusable
      - ARCHIVE routine completion rates
      - GENERATE playbook for next time
    complete_when:
      - playbook_saved
```

## State-maskinens roll

```
engine_sessions                    engine_stages
┌─────────────────────┐           ┌──────────────────────┐
│ mission: season-     │           │ seed (UPPTÄCKT)      │
│   lifecycle          │     ┌────▶│ revenue (FÖRB.)      │
│ status: active       │     │    │ concept (FÖRB.)      │
│ current_stage: seed ─┼─────┘    │ staffing (FÖRB.)     │
│ entity_type: season  │          │ prepare (FÖRB./auto)  │
│ entity_id: season_123│          │ ready (FÖRB.)        │
│ expires_at: NULL     │◀─────    │ running (DRIFT/auto)  │
│   (long-lived)       │  Guardian│ reflect (REFLEKTION) │
└─────────────────────┘  watches  └──────────────────────┘
```

**Nytt vs onboarding:**

| Egenskap             | Onboarding   | Säsong               |
| -------------------- | ------------ | -------------------- |
| Livslängd            | 30 min       | 2-6 månader          |
| Stage-trigger        | Konversation | Kalender + event     |
| expires_at           | 24h          | NULL (aldrig)        |
| Interaktionsfrekvens | Kontinuerlig | En fråga per vecka   |
| Automated stages     | Inga         | `prepare`, `running` |

## Vad Smartout måste fråga

5 frågor. Inget mer.

| #   | Fråga                  | Stage    | Handoff                           |
| --- | ---------------------- | -------- | --------------------------------- |
| 1   | Tuffaste säsongen?     | seed     | → typ bestämmer defaults          |
| 2   | När börjar/slutar den? | seed     | → kalender, veckodagar, helgdagar |
| 3   | Omsättningsmål?        | revenue  | → dagmål, timmål, bemanningsbehov |
| 4   | Ändras konceptet?      | concept  | → nya rutiner, träningsbehov      |
| 5   | Räcker personalen?     | staffing | → rekryteringsflagga              |

## Vad Smartout räknar ut själv

Dagfaktorer, timfaktorer, bemanningsbehov, träningsgap, rutiner per säsongstyp, tidsplan för förberedelser, schemamallar från förra året, faktorlärning efter avslut.

## Guardian-beteende

Guardian orkestrerar hela livscykeln:

```yaml
guardian_rules:
  - watch: calendar
    when: weeks_until(season.start_date) <= 8
    AND: stage.revenue.status != complete
    action: INITIATE stage.revenue

  - watch: calendar
    when: weeks_until(season.start_date) <= 1
    AND: stage.ready.status != complete
    action: INITIATE stage.ready

  - watch: calendar
    when: date >= season.start_date
    action: TRANSITION to stage.running

  - watch: calendar
    when: date >= season.end_date + 3 days
    action: INITIATE stage.reflect
```

## Koppling till onboarding

Onboardingens steg 4 (`season`) planterar fröet. Säsongsmissionen tar vid därifrån.

```
Onboarding (30 min)          Season Mission (veckor)
┌──────────────┐             ┌──────────────────────┐
│ 1. greeting  │             │                      │
│ 2. discovery │             │ seed ◀── redan klart │
│ 3. confirm   │             │ revenue              │
│ 4. season ───┼────handoff──▶│ concept              │
│ 5. depts     │             │ staffing             │
│ 6. locations │             │ prepare (auto)       │
│ 7. procedures│             │ ready                │
│ 8. welcome   │             │ running (auto)       │
│              │             │ reflect              │
└──────────────┘             └──────────────────────┘
```

Onboarding ger oss typ + datum. Säsongsmissionen startar med `seed` redan ifyllt. Hoppar direkt till `revenue` när Guardian ser att det är dags.
